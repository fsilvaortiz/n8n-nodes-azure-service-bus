import { mockDeep } from 'jest-mock-extended';
import type { ITriggerFunctions, IDataObject, IRun } from 'n8n-workflow';

import { AzureServiceBusTrigger } from '../AzureServiceBusTrigger.node';

const mockReceiveMessages = jest.fn();
const mockSubscribe = jest.fn();
const mockCompleteMessage = jest.fn();
const mockAbandonMessage = jest.fn();
const mockDeadLetterMessage = jest.fn();
const mockReceiverClose = jest.fn();
const mockClientClose = jest.fn();

jest.mock('@azure/service-bus', () => ({
	ServiceBusClient: jest.fn().mockImplementation(() => ({
		createReceiver: jest.fn().mockReturnValue({
			receiveMessages: mockReceiveMessages,
			subscribe: mockSubscribe,
			completeMessage: mockCompleteMessage,
			abandonMessage: mockAbandonMessage,
			deadLetterMessage: mockDeadLetterMessage,
			close: mockReceiverClose,
		}),
		close: mockClientClose,
	})),
	ServiceBusAdministrationClient: jest.fn(),
}));

const createMockMessage = (body: unknown, overrides: IDataObject = {}) => ({
	body,
	messageId: 'msg-001',
	contentType: 'application/json',
	correlationId: 'corr-001',
	subject: 'test',
	enqueuedTimeUtc: new Date('2026-01-01T00:00:00Z'),
	sequenceNumber: BigInt(1),
	deliveryCount: 0,
	applicationProperties: {},
	...overrides,
});

describe('AzureServiceBusTrigger Node', () => {
	const node = new AzureServiceBusTrigger();
	let triggerFunctions: ReturnType<typeof mockDeep<ITriggerFunctions>>;

	beforeEach(() => {
		jest.clearAllMocks();
		triggerFunctions = mockDeep<ITriggerFunctions>();

		triggerFunctions.getCredentials.mockResolvedValue({
			connectionString:
				'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test123',
		});
		triggerFunctions.helpers.returnJsonArray.mockImplementation((data) =>
			(Array.isArray(data) ? data : [data]).map((item) => ({
				json: item as IDataObject,
			})),
		);
		triggerFunctions.getMode.mockReturnValue('manual');
	});

	describe('manual trigger - queue', () => {
		it('should receive a message from a queue', async () => {
			const mockMsg = createMockMessage({ hello: 'world' });
			mockReceiveMessages.mockResolvedValue([mockMsg]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { jsonParseBody: false },
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);

			await result.manualTriggerFunction!();

			expect(mockReceiveMessages).toHaveBeenCalledWith(1, { maxWaitTimeInMs: 30000 });
			expect(triggerFunctions.emit).toHaveBeenCalledTimes(1);

			const emittedData = (triggerFunctions.emit as jest.Mock).mock.calls[0][0];
			expect(emittedData[0][0].json.body).toEqual({ hello: 'world' });
			expect(emittedData[0][0].json.messageId).toBe('msg-001');
		});

		it('should complete message on success in peekLock mode', async () => {
			const mockMsg = createMockMessage({ data: 'test' });
			mockReceiveMessages.mockResolvedValue([mockMsg]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { settlementAction: 'complete' },
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.manualTriggerFunction!();

			expect(mockCompleteMessage).toHaveBeenCalledWith(mockMsg);
		});

		it('should not settle in receiveAndDelete mode', async () => {
			const mockMsg = createMockMessage({ data: 'test' });
			mockReceiveMessages.mockResolvedValue([mockMsg]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'receiveAndDelete',
					options: {},
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.manualTriggerFunction!();

			expect(mockCompleteMessage).not.toHaveBeenCalled();
			expect(mockAbandonMessage).not.toHaveBeenCalled();
		});

		it('should emit empty result when no messages available', async () => {
			mockReceiveMessages.mockResolvedValue([]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: {},
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.manualTriggerFunction!();

			expect(triggerFunctions.emit).toHaveBeenCalled();
		});

		it('should parse JSON body when option is enabled', async () => {
			const mockMsg = createMockMessage('{"parsed":true}');
			mockReceiveMessages.mockResolvedValue([mockMsg]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'receiveAndDelete',
					options: { jsonParseBody: true },
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.manualTriggerFunction!();

			const emittedData = (triggerFunctions.emit as jest.Mock).mock.calls[0][0];
			expect(emittedData[0][0].json.body).toEqual({ parsed: true });
		});
	});

	describe('active trigger - queue', () => {
		it('should subscribe to messages in active mode', async () => {
			triggerFunctions.getMode.mockReturnValue('trigger');
			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { maxConcurrentCalls: 1 },
				};
				return params[param];
			});

			const donePromise = {
				promise: Promise.resolve({
					data: { resultData: {} },
				} as IRun),
				resolve: jest.fn(),
				reject: jest.fn(),
			};
			triggerFunctions.helpers.createDeferredPromise.mockReturnValue(donePromise);

			const result = await node.trigger.call(triggerFunctions);

			expect(mockSubscribe).toHaveBeenCalledWith(
				expect.objectContaining({
					processMessage: expect.any(Function),
					processError: expect.any(Function),
				}),
				expect.objectContaining({
					maxConcurrentCalls: 1,
					autoCompleteMessages: false,
				}),
			);
			expect(result.closeFunction).toBeDefined();
		});

		it('should settle complete on workflow success', async () => {
			triggerFunctions.getMode.mockReturnValue('trigger');
			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { settlementAction: 'complete', failureAction: 'abandon' },
				};
				return params[param];
			});

			const successRun = {
				data: { resultData: { runData: {} } },
				finished: true,
				mode: 'trigger',
				startedAt: new Date(),
				status: 'success',
			} as unknown as IRun;

			const donePromise = {
				promise: Promise.resolve(successRun),
				resolve: jest.fn(),
				reject: jest.fn(),
			};
			triggerFunctions.helpers.createDeferredPromise.mockReturnValue(donePromise);

			await node.trigger.call(triggerFunctions);

			const subscribeCall = mockSubscribe.mock.calls[0];
			const { processMessage } = subscribeCall[0];
			const mockMsg = createMockMessage({ test: 'data' });

			await processMessage(mockMsg);

			expect(mockCompleteMessage).toHaveBeenCalledWith(mockMsg);
		});

		it('should settle abandon on workflow failure', async () => {
			triggerFunctions.getMode.mockReturnValue('trigger');
			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { settlementAction: 'complete', failureAction: 'abandon' },
				};
				return params[param];
			});

			const failureRun = {
				data: {
					resultData: {
						runData: {},
						error: { message: 'Workflow failed', name: 'Error' },
					},
				},
				finished: false,
				mode: 'trigger',
				startedAt: new Date(),
				status: 'error',
			} as unknown as IRun;

			const donePromise = {
				promise: Promise.resolve(failureRun),
				resolve: jest.fn(),
				reject: jest.fn(),
			};
			triggerFunctions.helpers.createDeferredPromise.mockReturnValue(donePromise);

			await node.trigger.call(triggerFunctions);

			const subscribeCall = mockSubscribe.mock.calls[0];
			const { processMessage } = subscribeCall[0];
			const mockMsg = createMockMessage({ test: 'data' });

			await processMessage(mockMsg);

			expect(mockAbandonMessage).toHaveBeenCalledWith(mockMsg);
		});

		it('should dead-letter on failure when configured', async () => {
			triggerFunctions.getMode.mockReturnValue('trigger');
			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: { settlementAction: 'complete', failureAction: 'deadLetter' },
				};
				return params[param];
			});

			const failureRun = {
				data: {
					resultData: {
						runData: {},
						error: { message: 'Workflow failed', name: 'Error' },
					},
				},
				finished: false,
				mode: 'trigger',
				startedAt: new Date(),
				status: 'error',
			} as unknown as IRun;

			const donePromise = {
				promise: Promise.resolve(failureRun),
				resolve: jest.fn(),
				reject: jest.fn(),
			};
			triggerFunctions.helpers.createDeferredPromise.mockReturnValue(donePromise);

			await node.trigger.call(triggerFunctions);

			const subscribeCall = mockSubscribe.mock.calls[0];
			const { processMessage } = subscribeCall[0];
			const mockMsg = createMockMessage({ test: 'data' });

			await processMessage(mockMsg);

			expect(mockDeadLetterMessage).toHaveBeenCalledWith(mockMsg);
		});
	});

	describe('close function', () => {
		it('should close receiver and client', async () => {
			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'queue',
					queueName: 'test-queue',
					receiveMode: 'peekLock',
					options: {},
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.closeFunction!();

			expect(mockReceiverClose).toHaveBeenCalled();
			expect(mockClientClose).toHaveBeenCalled();
		});
	});

	describe('subscription entity type', () => {
		it('should receive from a topic subscription', async () => {
			const mockMsg = createMockMessage({ event: 'created' });
			mockReceiveMessages.mockResolvedValue([mockMsg]);

			triggerFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					entityType: 'subscription',
					topicName: 'test-topic',
					subscriptionName: 'test-sub',
					receiveMode: 'receiveAndDelete',
					options: {},
				};
				return params[param];
			});

			const result = await node.trigger.call(triggerFunctions);
			await result.manualTriggerFunction!();

			expect(mockReceiveMessages).toHaveBeenCalledWith(1, { maxWaitTimeInMs: 30000 });
			expect(triggerFunctions.emit).toHaveBeenCalled();
		});
	});
});
