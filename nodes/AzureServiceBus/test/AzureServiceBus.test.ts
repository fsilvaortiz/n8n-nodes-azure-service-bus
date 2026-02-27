import { mock } from 'jest-mock-extended';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { AzureServiceBus } from '../AzureServiceBus.node';

const mockSendMessages = jest.fn();
const mockScheduleMessages = jest.fn();
const mockCancelScheduledMessages = jest.fn();
const mockCreateMessageBatch = jest.fn();
const mockSenderClose = jest.fn();
const mockPeekMessages = jest.fn();
const mockReceiveDeferredMessages = jest.fn();
const mockReceiverClose = jest.fn();
const mockClientClose = jest.fn();

// Admin client mocks
const mockCreateQueue = jest.fn();
const mockDeleteQueue = jest.fn();
const mockGetQueue = jest.fn();
const mockGetQueueRuntimeProperties = jest.fn();
const mockListQueues = jest.fn();
const mockCreateTopic = jest.fn();
const mockDeleteTopic = jest.fn();
const mockGetTopic = jest.fn();
const mockGetTopicRuntimeProperties = jest.fn();
const mockListTopics = jest.fn();
const mockCreateSubscription = jest.fn();
const mockDeleteSubscription = jest.fn();
const mockGetSubscription = jest.fn();
const mockGetSubscriptionRuntimeProperties = jest.fn();
const mockListSubscriptions = jest.fn();

jest.mock('@azure/service-bus', () => ({
	ServiceBusClient: jest.fn().mockImplementation(() => ({
		createSender: jest.fn().mockReturnValue({
			sendMessages: mockSendMessages,
			scheduleMessages: mockScheduleMessages,
			cancelScheduledMessages: mockCancelScheduledMessages,
			createMessageBatch: mockCreateMessageBatch,
			close: mockSenderClose,
		}),
		createReceiver: jest.fn().mockReturnValue({
			peekMessages: mockPeekMessages,
			receiveDeferredMessages: mockReceiveDeferredMessages,
			close: mockReceiverClose,
		}),
		close: mockClientClose,
	})),
	ServiceBusAdministrationClient: jest.fn().mockImplementation(() => ({
		createQueue: mockCreateQueue,
		deleteQueue: mockDeleteQueue,
		getQueue: mockGetQueue,
		getQueueRuntimeProperties: mockGetQueueRuntimeProperties,
		listQueues: mockListQueues,
		createTopic: mockCreateTopic,
		deleteTopic: mockDeleteTopic,
		getTopic: mockGetTopic,
		getTopicRuntimeProperties: mockGetTopicRuntimeProperties,
		listTopics: mockListTopics,
		createSubscription: mockCreateSubscription,
		deleteSubscription: mockDeleteSubscription,
		getSubscription: mockGetSubscription,
		getSubscriptionRuntimeProperties: mockGetSubscriptionRuntimeProperties,
		listSubscriptions: mockListSubscriptions,
	})),
}));

describe('AzureServiceBus Node', () => {
	const node = new AzureServiceBus();
	let executeFunctions: ReturnType<typeof mock<IExecuteFunctions>>;

	beforeEach(() => {
		jest.clearAllMocks();
		executeFunctions = mock<IExecuteFunctions>();

		executeFunctions.getCredentials.mockResolvedValue({
			connectionString:
				'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test123',
		});
		executeFunctions.getNode.mockReturnValue({
			typeVersion: 1,
		} as any);
	});

	it('should send a JSON message to a queue', async () => {
		const inputData: INodeExecutionData[] = [{ json: { test: 'data' } }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'queue',
				queueName: 'test-queue',
				sendBodyType: 'json',
				message: '{"hello":"world"}',
				options: {},
			};
			return params[param];
		});

		const result = await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledTimes(1);
		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { hello: 'world' },
			}),
		);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.success).toBe(true);
		expect(result[0][0].json.resource).toBe('queue');
		expect(result[0][0].json.entityName).toBe('test-queue');
		expect(mockSenderClose).toHaveBeenCalled();
		expect(mockClientClose).toHaveBeenCalled();
	});

	it('should send a string message to a queue', async () => {
		const inputData: INodeExecutionData[] = [{ json: {} }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'queue',
				queueName: 'test-queue',
				sendBodyType: 'string',
				message: 'plain text message',
				options: {},
			};
			return params[param];
		});

		const result = await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				body: 'plain text message',
			}),
		);
		expect(result[0][0].json.success).toBe(true);
	});

	it('should set custom message properties', async () => {
		const inputData: INodeExecutionData[] = [{ json: {} }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'queue',
				queueName: 'test-queue',
				sendBodyType: 'json',
				message: '{"data":1}',
				options: {
					contentType: 'application/json',
					correlationId: 'corr-123',
					subject: 'test-subject',
					messageId: 'msg-001',
					timeToLive: 60,
					applicationProperties: {
						property: [
							{ key: 'env', value: 'test' },
							{ key: 'source', value: 'n8n' },
						],
					},
				},
			};
			return params[param];
		});

		await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { data: 1 },
				contentType: 'application/json',
				correlationId: 'corr-123',
				subject: 'test-subject',
				messageId: 'msg-001',
				timeToLive: 60000,
				applicationProperties: { env: 'test', source: 'n8n' },
			}),
		);
	});

	it('should send multiple items as separate messages', async () => {
		const inputData: INodeExecutionData[] = [
			{ json: { id: 1 } },
			{ json: { id: 2 } },
			{ json: { id: 3 } },
		];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation(
			(param: string, itemIndex?: number) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					sendBodyType: 'json',
					message: JSON.stringify({ id: (itemIndex ?? 0) + 1 }),
					options: {},
				};
				return params[param];
			},
		);

		const result = await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledTimes(3);
		expect(result[0]).toHaveLength(3);
	});

	it('should send a message to a topic', async () => {
		const inputData: INodeExecutionData[] = [{ json: {} }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'topic',
				topicName: 'test-topic',
				sendBodyType: 'json',
				message: '{"event":"created"}',
				options: {},
			};
			return params[param];
		});

		const result = await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { event: 'created' },
			}),
		);
		expect(result[0][0].json.resource).toBe('topic');
		expect(result[0][0].json.entityName).toBe('test-topic');
	});

	it('should set sessionId, partitionKey, replyTo, replyToSessionId, and to', async () => {
		const inputData: INodeExecutionData[] = [{ json: {} }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'queue',
				queueName: 'test-queue',
				sendBodyType: 'json',
				message: '{"data":1}',
				options: {
					sessionId: 'session-1',
					partitionKey: 'pk-1',
					replyTo: 'reply-queue',
					replyToSessionId: 'reply-session',
					to: 'dest-queue',
				},
			};
			return params[param];
		});

		await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 'session-1',
				partitionKey: 'pk-1',
				replyTo: 'reply-queue',
				replyToSessionId: 'reply-session',
				to: 'dest-queue',
			}),
		);
	});

	it('should set scheduledEnqueueTimeUtc as a Date', async () => {
		const inputData: INodeExecutionData[] = [{ json: {} }];
		executeFunctions.getInputData.mockReturnValue(inputData);
		executeFunctions.getNodeParameter.mockImplementation((param: string) => {
			const params: Record<string, string | number | boolean | object> = {
				resource: 'queue',
				queueName: 'test-queue',
				sendBodyType: 'json',
				message: '{"data":1}',
				options: {
					scheduledEnqueueTimeUtc: '2026-03-01T12:00:00Z',
				},
			};
			return params[param];
		});

		await node.execute.call(executeFunctions);

		expect(mockSendMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				scheduledEnqueueTimeUtc: new Date('2026-03-01T12:00:00Z'),
			}),
		);
	});

	describe('v2 operations', () => {
		beforeEach(() => {
			executeFunctions.getNode.mockReturnValue({
				typeVersion: 1,
			} as any);
		});

		it('should send a message using v2 send operation', async () => {
			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					operation: 'send',
					sendBodyType: 'json',
					message: '{"hello":"v2"}',
					options: {},
				};
				return params[param];
			});

			const result = await node.execute.call(executeFunctions);

			expect(mockSendMessages).toHaveBeenCalledTimes(1);
			expect(mockSendMessages).toHaveBeenCalledWith(
				expect.objectContaining({ body: { hello: 'v2' } }),
			);
			expect(result[0][0].json.success).toBe(true);
		});

		it('should schedule a message and return sequence numbers', async () => {
			const mockLong = { toString: () => '12345' };
			mockScheduleMessages.mockResolvedValue([mockLong]);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					operation: 'schedule',
					sendBodyType: 'json',
					message: '{"scheduled":true}',
					scheduledTime: '2026-06-01T12:00:00Z',
					options: {},
				};
				return params[param];
			});

			const result = await node.execute.call(executeFunctions);

			expect(mockScheduleMessages).toHaveBeenCalledTimes(1);
			expect(mockScheduleMessages).toHaveBeenCalledWith(
				[expect.objectContaining({ body: { scheduled: true } })],
				new Date('2026-06-01T12:00:00Z'),
			);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.operation).toBe('schedule');
			expect(result[0][0].json.sequenceNumbers).toEqual(['12345']);
			expect(result[0][0].json.scheduledTime).toBe('2026-06-01T12:00:00Z');
		});

		it('should cancel scheduled messages by sequence numbers', async () => {
			mockCancelScheduledMessages.mockResolvedValue(undefined);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					operation: 'cancelScheduled',
					sequenceNumbers: '100, 200, 300',
				};
				return params[param];
			});

			const result = await node.execute.call(executeFunctions);

			expect(mockCancelScheduledMessages).toHaveBeenCalledTimes(1);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.operation).toBe('cancelScheduled');
			expect(result[0][0].json.cancelledSequenceNumbers).toEqual(['100', '200', '300']);
		});

		it('should throw error when sequence numbers are empty for cancel', async () => {
			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					operation: 'cancelScheduled',
					sequenceNumbers: '  ',
				};
				return params[param];
			});

			await expect(node.execute.call(executeFunctions)).rejects.toThrow(
				'Sequence numbers cannot be empty',
			);
		});

		it('should schedule a message to a topic', async () => {
			const mockLong = { toString: () => '99999' };
			mockScheduleMessages.mockResolvedValue([mockLong]);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'topic',
					topicName: 'test-topic',
					operation: 'schedule',
					sendBodyType: 'json',
					message: '{"event":"scheduled"}',
					scheduledTime: '2026-07-01T00:00:00Z',
					options: {},
				};
				return params[param];
			});

			const result = await node.execute.call(executeFunctions);

			expect(result[0][0].json.resource).toBe('topic');
			expect(result[0][0].json.entityName).toBe('test-topic');
			expect(result[0][0].json.operation).toBe('schedule');
		});

		it('should batch send all items', async () => {
			const mockBatch = {
				tryAddMessage: jest.fn().mockReturnValue(true),
				count: 3,
				sizeInBytes: 100,
			};
			mockCreateMessageBatch.mockResolvedValue(mockBatch);

			const inputData: INodeExecutionData[] = [
				{ json: { id: 1 } },
				{ json: { id: 2 } },
				{ json: { id: 3 } },
			];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, itemIndex?: number) => {
					const params: Record<string, string | number | boolean | object> = {
						resource: 'queue',
						queueName: 'test-queue',
						operation: 'batchSend',
						sendBodyType: 'json',
						message: JSON.stringify({ id: (itemIndex ?? 0) + 1 }),
						options: {},
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockCreateMessageBatch).toHaveBeenCalledTimes(1);
			expect(mockBatch.tryAddMessage).toHaveBeenCalledTimes(3);
			expect(mockSendMessages).toHaveBeenCalledTimes(1);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.operation).toBe('batchSend');
			expect(result[0][0].json.messageCount).toBe(3);
		});

		it('should auto-split batches when full', async () => {
			let callCount = 0;
			const mockBatch1 = {
				tryAddMessage: jest.fn().mockImplementation(() => {
					callCount++;
					return callCount <= 2;
				}),
				count: 2,
			};
			const mockBatch2 = {
				tryAddMessage: jest.fn().mockReturnValue(true),
				count: 1,
			};
			mockCreateMessageBatch
				.mockResolvedValueOnce(mockBatch1)
				.mockResolvedValueOnce(mockBatch2);

			const inputData: INodeExecutionData[] = [
				{ json: { id: 1 } },
				{ json: { id: 2 } },
				{ json: { id: 3 } },
			];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, itemIndex?: number) => {
					const params: Record<string, string | number | boolean | object> = {
						resource: 'queue',
						queueName: 'test-queue',
						operation: 'batchSend',
						sendBodyType: 'json',
						message: JSON.stringify({ id: (itemIndex ?? 0) + 1 }),
						options: {},
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockCreateMessageBatch).toHaveBeenCalledTimes(2);
			expect(mockSendMessages).toHaveBeenCalledTimes(2);
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.messageCount).toBe(3);
		});

		it('should peek messages from a queue', async () => {
			const mockMessages = [
				{
					body: { hello: 'peeked' },
					messageId: 'peek-001',
					contentType: 'application/json',
					correlationId: undefined,
					subject: undefined,
					to: undefined,
					replyTo: undefined,
					sessionId: undefined,
					partitionKey: undefined,
					replyToSessionId: undefined,
					timeToLive: undefined,
					enqueuedTimeUtc: new Date('2026-01-01T00:00:00Z'),
					expiresAtUtc: undefined,
					lockedUntilUtc: undefined,
					sequenceNumber: BigInt(5),
					deliveryCount: 0,
					state: 'active',
					deadLetterSource: undefined,
					deadLetterReason: undefined,
					deadLetterErrorDescription: undefined,
					applicationProperties: {},
				},
			];
			mockPeekMessages.mockResolvedValue(mockMessages);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'queue',
						queueName: 'test-queue',
						operation: 'peek',
						maxMessageCount: 10,
						fromSequenceNumber: '',
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockPeekMessages).toHaveBeenCalledWith(10, {});
			expect(result[0][0].json.body).toEqual({ hello: 'peeked' });
			expect(result[0][0].json.messageId).toBe('peek-001');
			expect(result[0][0].json.sequenceNumber).toBe('5');
		});

		it('should return empty message when peek finds nothing', async () => {
			mockPeekMessages.mockResolvedValue([]);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'queue',
						queueName: 'test-queue',
						operation: 'peek',
						maxMessageCount: 10,
						fromSequenceNumber: '',
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(result[0][0].json.message).toBe('No messages available');
		});

		it('should receive deferred messages by sequence numbers', async () => {
			const mockMessages = [
				{
					body: { deferred: true },
					messageId: 'def-001',
					contentType: undefined,
					correlationId: undefined,
					subject: undefined,
					to: undefined,
					replyTo: undefined,
					sessionId: undefined,
					partitionKey: undefined,
					replyToSessionId: undefined,
					timeToLive: undefined,
					enqueuedTimeUtc: new Date('2026-01-01T00:00:00Z'),
					expiresAtUtc: undefined,
					lockedUntilUtc: undefined,
					sequenceNumber: BigInt(42),
					deliveryCount: 1,
					state: 'deferred',
					deadLetterSource: undefined,
					deadLetterReason: undefined,
					deadLetterErrorDescription: undefined,
					applicationProperties: {},
				},
			];
			mockReceiveDeferredMessages.mockResolvedValue(mockMessages);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation((param: string) => {
				const params: Record<string, string | number | boolean | object> = {
					resource: 'queue',
					queueName: 'test-queue',
					operation: 'receiveDeferred',
					sequenceNumbers: '42',
				};
				return params[param];
			});

			const result = await node.execute.call(executeFunctions);

			expect(mockReceiveDeferredMessages).toHaveBeenCalledTimes(1);
			expect(result[0][0].json.body).toEqual({ deferred: true });
			expect(result[0][0].json.sequenceNumber).toBe('42');
			expect(result[0][0].json.state).toBe('deferred');
		});

		it('should peek from a topic subscription', async () => {
			mockPeekMessages.mockResolvedValue([]);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'topic',
						topicName: 'test-topic',
						operation: 'peek',
						subscriptionName: 'test-sub',
						maxMessageCount: 5,
						fromSequenceNumber: '',
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockPeekMessages).toHaveBeenCalled();
			expect(result[0][0].json.message).toBe('No messages available');
		});
	});

	describe('queue admin operations', () => {
		beforeEach(() => {
			executeFunctions.getNode.mockReturnValue({
				typeVersion: 1,
			} as any);
		});

		it('should list all queues', async () => {
			const queues = [
				{ name: 'queue-1', status: 'Active', createdAt: new Date('2026-01-01T00:00:00Z') },
				{ name: 'queue-2', status: 'Active', createdAt: new Date('2026-01-02T00:00:00Z') },
			];
			mockListQueues.mockReturnValue((async function* () {
				for (const q of queues) yield q;
			})());

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'queueAdmin',
						operation: 'getAll',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.name).toBe('queue-1');
			expect(result[0][1].json.name).toBe('queue-2');
			expect(result[0][0].json.createdAt).toBe('2026-01-01T00:00:00.000Z');
		});

		it('should create a queue with options', async () => {
			const createdQueue = {
				name: 'new-queue',
				status: 'Active',
				maxSizeInMegabytes: 2048,
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockCreateQueue.mockResolvedValue(createdQueue);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'queueAdmin',
						operation: 'create',
						queueName: 'new-queue',
						options: { maxSizeInMegabytes: 2048, lockDuration: 'PT1M' },
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockCreateQueue).toHaveBeenCalledWith('new-queue', {
				maxSizeInMegabytes: 2048,
				lockDuration: 'PT1M',
			});
			expect(result[0][0].json.name).toBe('new-queue');
		});

		it('should delete a queue', async () => {
			mockDeleteQueue.mockResolvedValue(undefined);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'queueAdmin',
						operation: 'delete',
						queueName: 'old-queue',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockDeleteQueue).toHaveBeenCalledWith('old-queue');
			expect(result[0][0].json.success).toBe(true);
			expect(result[0][0].json.queueName).toBe('old-queue');
		});

		it('should get queue properties', async () => {
			const queueProps = {
				name: 'test-queue',
				status: 'Active',
				maxSizeInMegabytes: 1024,
				lockDuration: 'PT1M',
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockGetQueue.mockResolvedValue(queueProps);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'queueAdmin',
						operation: 'get',
						queueName: 'test-queue',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockGetQueue).toHaveBeenCalledWith('test-queue');
			expect(result[0][0].json.name).toBe('test-queue');
			expect(result[0][0].json.maxSizeInMegabytes).toBe(1024);
		});

		it('should get queue runtime properties', async () => {
			const runtimeProps = {
				name: 'test-queue',
				totalMessageCount: 100,
				activeMessageCount: 80,
				deadLetterMessageCount: 15,
				scheduledMessageCount: 5,
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockGetQueueRuntimeProperties.mockResolvedValue(runtimeProps);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'queueAdmin',
						operation: 'getRuntimeProperties',
						queueName: 'test-queue',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockGetQueueRuntimeProperties).toHaveBeenCalledWith('test-queue');
			expect(result[0][0].json.totalMessageCount).toBe(100);
			expect(result[0][0].json.activeMessageCount).toBe(80);
			expect(result[0][0].json.deadLetterMessageCount).toBe(15);
		});
	});

	describe('topic admin operations', () => {
		beforeEach(() => {
			executeFunctions.getNode.mockReturnValue({
				typeVersion: 1,
			} as any);
		});

		it('should list all topics', async () => {
			const topics = [
				{ name: 'topic-1', status: 'Active', createdAt: new Date('2026-01-01T00:00:00Z') },
			];
			mockListTopics.mockReturnValue((async function* () {
				for (const t of topics) yield t;
			})());

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'topicAdmin',
						operation: 'getAll',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json.name).toBe('topic-1');
		});

		it('should create a topic', async () => {
			const createdTopic = {
				name: 'new-topic',
				status: 'Active',
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockCreateTopic.mockResolvedValue(createdTopic);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'topicAdmin',
						operation: 'create',
						topicName: 'new-topic',
						options: { maxSizeInMegabytes: 2048 },
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockCreateTopic).toHaveBeenCalledWith('new-topic', {
				maxSizeInMegabytes: 2048,
			});
			expect(result[0][0].json.name).toBe('new-topic');
		});

		it('should delete a topic', async () => {
			mockDeleteTopic.mockResolvedValue(undefined);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'topicAdmin',
						operation: 'delete',
						topicName: 'old-topic',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockDeleteTopic).toHaveBeenCalledWith('old-topic');
			expect(result[0][0].json.success).toBe(true);
		});

		it('should get topic runtime properties', async () => {
			const runtimeProps = {
				name: 'test-topic',
				subscriptionCount: 3,
				sizeInBytes: 1024,
				scheduledMessageCount: 2,
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockGetTopicRuntimeProperties.mockResolvedValue(runtimeProps);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'topicAdmin',
						operation: 'getRuntimeProperties',
						topicName: 'test-topic',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockGetTopicRuntimeProperties).toHaveBeenCalledWith('test-topic');
			expect(result[0][0].json.subscriptionCount).toBe(3);
		});
	});

	describe('subscription admin operations', () => {
		beforeEach(() => {
			executeFunctions.getNode.mockReturnValue({
				typeVersion: 1,
			} as any);
		});

		it('should list all subscriptions for a topic', async () => {
			const subs = [
				{ subscriptionName: 'sub-1', topicName: 'test-topic', status: 'Active', createdAt: new Date('2026-01-01T00:00:00Z') },
				{ subscriptionName: 'sub-2', topicName: 'test-topic', status: 'Active', createdAt: new Date('2026-01-02T00:00:00Z') },
			];
			mockListSubscriptions.mockReturnValue((async function* () {
				for (const s of subs) yield s;
			})());

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'subscriptionAdmin',
						operation: 'getAll',
						topicName: 'test-topic',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.subscriptionName).toBe('sub-1');
			expect(result[0][1].json.subscriptionName).toBe('sub-2');
		});

		it('should create a subscription', async () => {
			const createdSub = {
				subscriptionName: 'new-sub',
				topicName: 'test-topic',
				status: 'Active',
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockCreateSubscription.mockResolvedValue(createdSub);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string, _itemIndex?: number, fallback?: unknown) => {
					const params: Record<string, unknown> = {
						resource: 'subscriptionAdmin',
						operation: 'create',
						topicName: 'test-topic',
						subscriptionName: 'new-sub',
						options: { maxDeliveryCount: 5 },
					};
					return params[param] ?? fallback;
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockCreateSubscription).toHaveBeenCalledWith(
				'test-topic',
				'new-sub',
				{ maxDeliveryCount: 5 },
			);
			expect(result[0][0].json.subscriptionName).toBe('new-sub');
		});

		it('should delete a subscription', async () => {
			mockDeleteSubscription.mockResolvedValue(undefined);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'subscriptionAdmin',
						operation: 'delete',
						topicName: 'test-topic',
						subscriptionName: 'old-sub',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockDeleteSubscription).toHaveBeenCalledWith('test-topic', 'old-sub');
			expect(result[0][0].json.success).toBe(true);
		});

		it('should get subscription runtime properties', async () => {
			const runtimeProps = {
				subscriptionName: 'test-sub',
				topicName: 'test-topic',
				totalMessageCount: 50,
				activeMessageCount: 40,
				deadLetterMessageCount: 10,
				createdAt: new Date('2026-01-01T00:00:00Z'),
			};
			mockGetSubscriptionRuntimeProperties.mockResolvedValue(runtimeProps);

			const inputData: INodeExecutionData[] = [{ json: {} }];
			executeFunctions.getInputData.mockReturnValue(inputData);
			executeFunctions.getNodeParameter.mockImplementation(
				(param: string) => {
					const params: Record<string, unknown> = {
						resource: 'subscriptionAdmin',
						operation: 'getRuntimeProperties',
						topicName: 'test-topic',
						subscriptionName: 'test-sub',
					};
					return params[param];
				},
			);

			const result = await node.execute.call(executeFunctions);

			expect(mockGetSubscriptionRuntimeProperties).toHaveBeenCalledWith(
				'test-topic',
				'test-sub',
			);
			expect(result[0][0].json.totalMessageCount).toBe(50);
			expect(result[0][0].json.activeMessageCount).toBe(40);
		});
	});
});
