import { mock } from 'jest-mock-extended';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { AzureServiceBus } from '../AzureServiceBus.node';

const mockSendMessages = jest.fn();
const mockSenderClose = jest.fn();
const mockClientClose = jest.fn();

jest.mock('@azure/service-bus', () => ({
	ServiceBusClient: jest.fn().mockImplementation(() => ({
		createSender: jest.fn().mockReturnValue({
			sendMessages: mockSendMessages,
			close: mockSenderClose,
		}),
		close: mockClientClose,
	})),
	ServiceBusAdministrationClient: jest.fn(),
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
});
