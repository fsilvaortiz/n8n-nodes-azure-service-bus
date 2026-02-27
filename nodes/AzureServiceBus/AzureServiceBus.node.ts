import type {
	ServiceBusClient as ServiceBusClientType,
	ServiceBusAdministrationClient as AdminClientType,
} from '@azure/service-bus';
import type {
	IExecuteFunctions,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	createServiceBusClient,
	createAdministrationClient,
	createSender,
	buildServiceBusMessage,
	parseReceivedMessage,
	sequenceNumbersFromString,
	longFromString,
	getCredentials,
	sanitizeProperties,
} from './GenericFunctions';
import type { AzureServiceBusCredentials, SendOptions } from './types';
import {
	queueAdminOperations,
	queueAdminFields,
	topicAdminOperations,
	topicAdminFields,
	subscriptionAdminOperations,
	subscriptionAdminFields,
} from './descriptions';

async function executeReceiverOperation(
	context: IExecuteFunctions,
	client: ServiceBusClientType,
	resource: string,
	entityName: string,
	operation: string,
	items: INodeExecutionData[],
	returnItems: INodeExecutionData[],
): Promise<void> {
	const subscriptionName =
		resource === 'topic'
			? (context.getNodeParameter('subscriptionName', 0) as string)
			: undefined;

	const subQueueRaw = context.getNodeParameter('subQueueType', 0, 'none') as string;
	const receiverOptions: { subQueueType?: 'deadLetter' | 'transferDeadLetter' } = {};
	if (subQueueRaw && subQueueRaw !== 'none') {
		receiverOptions.subQueueType = subQueueRaw as 'deadLetter' | 'transferDeadLetter';
	}

	const receiver =
		resource === 'topic' && subscriptionName
			? client.createReceiver(entityName, subscriptionName, receiverOptions)
			: client.createReceiver(entityName, receiverOptions);

	try {
		if (operation === 'peek') {
			const maxMessageCount = context.getNodeParameter(
				'maxMessageCount',
				0,
				10,
			) as number;
			const fromSequenceNumberStr = context.getNodeParameter(
				'fromSequenceNumber',
				0,
				'',
			) as string;

			const peekOptions: { fromSequenceNumber?: ReturnType<typeof longFromString> } = {};
			if (fromSequenceNumberStr) {
				peekOptions.fromSequenceNumber = longFromString(fromSequenceNumberStr);
			}

			const messages = await receiver.peekMessages(maxMessageCount, peekOptions);

			if (messages.length === 0) {
				returnItems.push({
					json: { message: 'No messages available' },
				});
			} else {
				for (const msg of messages) {
					returnItems.push({
						json: parseReceivedMessage(msg, false),
					});
				}
			}
		} else if (operation === 'receiveDeferred') {
			for (let i = 0; i < items.length; i++) {
				const sequenceNumbersRaw = context.getNodeParameter(
					'sequenceNumbers',
					i,
				) as string;

				if (!sequenceNumbersRaw.trim()) {
					throw new NodeOperationError(
						context.getNode(),
						'Sequence numbers cannot be empty',
						{ itemIndex: i },
					);
				}

				const longs = sequenceNumbersFromString(sequenceNumbersRaw);
				const messages = await receiver.receiveDeferredMessages(longs);

				for (const msg of messages) {
					returnItems.push({
						json: parseReceivedMessage(msg, false),
						pairedItem: { item: i },
					});
				}
			}
		}
	} finally {
		await receiver.close();
	}
}

async function executeSenderOperation(
	context: IExecuteFunctions,
	client: ServiceBusClientType,
	resource: string,
	entityName: string,
	operation: string,
	items: INodeExecutionData[],
	returnItems: INodeExecutionData[],
): Promise<void> {
	const sender = createSender(client, entityName);

	try {
		if (operation === 'cancelScheduled') {
			for (let i = 0; i < items.length; i++) {
				const sequenceNumbersRaw = context.getNodeParameter(
					'sequenceNumbers',
					i,
				) as string;

				if (!sequenceNumbersRaw.trim()) {
					throw new NodeOperationError(
						context.getNode(),
						'Sequence numbers cannot be empty',
						{ itemIndex: i },
					);
				}

				const longs = sequenceNumbersFromString(sequenceNumbersRaw);
				await sender.cancelScheduledMessages(longs);

				returnItems.push({
					json: {
						success: true,
						operation: 'cancelScheduled',
						cancelledSequenceNumbers: longs.map((l) => l.toString()),
						resource,
						entityName,
					},
					pairedItem: { item: i },
				});
			}
		} else if (operation === 'batchSend') {
			let batch = await sender.createMessageBatch();
			let batchCount = 0;
			let totalSent = 0;

			for (let i = 0; i < items.length; i++) {
				const sendBodyType = context.getNodeParameter('sendBodyType', i) as string;
				const messageBody = context.getNodeParameter('message', i) as string;
				const options = context.getNodeParameter('options', i, {}) as SendOptions;

				if (options.applicationProperties) {
					const rawProps = options.applicationProperties as unknown as {
						property?: Array<{ key: string; value: string }>;
					};
					options.applicationProperties = rawProps.property ?? [];
				}

				const message = buildServiceBusMessage(messageBody, sendBodyType, options);

				if (!batch.tryAddMessage(message)) {
					if (batchCount === 0) {
						throw new NodeOperationError(
							context.getNode(),
							'Message is too large to fit in a single batch',
							{ itemIndex: i },
						);
					}

					await sender.sendMessages(batch);
					totalSent += batchCount;

					batch = await sender.createMessageBatch();
					batchCount = 0;

					if (!batch.tryAddMessage(message)) {
						throw new NodeOperationError(
							context.getNode(),
							'Message is too large to fit in a single batch',
							{ itemIndex: i },
						);
					}
				}
				batchCount++;
			}

			if (batchCount > 0) {
				await sender.sendMessages(batch);
				totalSent += batchCount;
			}

			returnItems.push({
				json: {
					success: true,
					operation: 'batchSend',
					messageCount: totalSent,
					resource,
					entityName,
				},
			});
		} else {
			// send or schedule
			for (let i = 0; i < items.length; i++) {
				const sendBodyType = context.getNodeParameter('sendBodyType', i) as string;
				const messageBody = context.getNodeParameter('message', i) as string;
				const options = context.getNodeParameter('options', i, {}) as SendOptions;

				if (options.applicationProperties) {
					const rawProps = options.applicationProperties as unknown as {
						property?: Array<{ key: string; value: string }>;
					};
					options.applicationProperties = rawProps.property ?? [];
				}

				const message = buildServiceBusMessage(messageBody, sendBodyType, options);

				if (operation === 'schedule') {
					const scheduledTime = context.getNodeParameter(
						'scheduledTime',
						i,
					) as string;
					const sequenceNumbers = await sender.scheduleMessages(
						[message],
						new Date(scheduledTime),
					);

					returnItems.push({
						json: {
							success: true,
							operation: 'schedule',
							sequenceNumbers: sequenceNumbers.map((sn) => sn.toString()),
							scheduledTime,
							resource,
							entityName,
						},
						pairedItem: { item: i },
					});
				} else {
					await sender.sendMessages(message);

					returnItems.push({
						json: {
							success: true,
							messageId: message.messageId ?? null,
							resource,
							entityName,
						},
						pairedItem: { item: i },
					});
				}
			}
		}
	} finally {
		await sender.close();
	}
}

async function executeQueueAdminOperation(
	context: IExecuteFunctions,
	adminClient: AdminClientType,
	operation: string,
	returnItems: INodeExecutionData[],
): Promise<void> {
	if (operation === 'getAll') {
		const queues = adminClient.listQueues();
		for await (const queue of queues) {
			returnItems.push({
				json: sanitizeProperties(queue as unknown as Record<string, unknown>),
			});
		}
		if (returnItems.length === 0) {
			returnItems.push({ json: { message: 'No queues found' } });
		}
		return;
	}

	const queueName = context.getNodeParameter('queueName', 0) as string;
	if (!queueName) {
		throw new NodeOperationError(context.getNode(), 'Queue name cannot be empty');
	}

	if (operation === 'create') {
		const options = context.getNodeParameter('options', 0, {}) as IDataObject;
		const createOptions: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(options)) {
			if (value !== '' && value !== undefined) {
				createOptions[key] = value;
			}
		}
		const result = await adminClient.createQueue(queueName, createOptions);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'delete') {
		await adminClient.deleteQueue(queueName);
		returnItems.push({
			json: { success: true, operation: 'delete', queueName },
		});
	} else if (operation === 'get') {
		const result = await adminClient.getQueue(queueName);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'getRuntimeProperties') {
		const result = await adminClient.getQueueRuntimeProperties(queueName);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	}
}

async function executeTopicAdminOperation(
	context: IExecuteFunctions,
	adminClient: AdminClientType,
	operation: string,
	returnItems: INodeExecutionData[],
): Promise<void> {
	if (operation === 'getAll') {
		const topics = adminClient.listTopics();
		for await (const topic of topics) {
			returnItems.push({
				json: sanitizeProperties(topic as unknown as Record<string, unknown>),
			});
		}
		if (returnItems.length === 0) {
			returnItems.push({ json: { message: 'No topics found' } });
		}
		return;
	}

	const topicName = context.getNodeParameter('topicName', 0) as string;
	if (!topicName) {
		throw new NodeOperationError(context.getNode(), 'Topic name cannot be empty');
	}

	if (operation === 'create') {
		const options = context.getNodeParameter('options', 0, {}) as IDataObject;
		const createOptions: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(options)) {
			if (value !== '' && value !== undefined) {
				createOptions[key] = value;
			}
		}
		const result = await adminClient.createTopic(topicName, createOptions);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'delete') {
		await adminClient.deleteTopic(topicName);
		returnItems.push({
			json: { success: true, operation: 'delete', topicName },
		});
	} else if (operation === 'get') {
		const result = await adminClient.getTopic(topicName);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'getRuntimeProperties') {
		const result = await adminClient.getTopicRuntimeProperties(topicName);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	}
}

async function executeSubscriptionAdminOperation(
	context: IExecuteFunctions,
	adminClient: AdminClientType,
	operation: string,
	returnItems: INodeExecutionData[],
): Promise<void> {
	const topicName = context.getNodeParameter('topicName', 0) as string;
	if (!topicName) {
		throw new NodeOperationError(context.getNode(), 'Topic name cannot be empty');
	}

	if (operation === 'getAll') {
		const subscriptions = adminClient.listSubscriptions(topicName);
		for await (const sub of subscriptions) {
			returnItems.push({
				json: sanitizeProperties(sub as unknown as Record<string, unknown>),
			});
		}
		if (returnItems.length === 0) {
			returnItems.push({ json: { message: 'No subscriptions found' } });
		}
		return;
	}

	const subscriptionName = context.getNodeParameter('subscriptionName', 0) as string;
	if (!subscriptionName) {
		throw new NodeOperationError(context.getNode(), 'Subscription name cannot be empty');
	}

	if (operation === 'create') {
		const options = context.getNodeParameter('options', 0, {}) as IDataObject;
		const createOptions: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(options)) {
			if (value !== '' && value !== undefined) {
				createOptions[key] = value;
			}
		}
		const result = await adminClient.createSubscription(
			topicName,
			subscriptionName,
			createOptions,
		);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'delete') {
		await adminClient.deleteSubscription(topicName, subscriptionName);
		returnItems.push({
			json: { success: true, operation: 'delete', topicName, subscriptionName },
		});
	} else if (operation === 'get') {
		const result = await adminClient.getSubscription(topicName, subscriptionName);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	} else if (operation === 'getRuntimeProperties') {
		const result = await adminClient.getSubscriptionRuntimeProperties(
			topicName,
			subscriptionName,
		);
		returnItems.push({
			json: sanitizeProperties(result as unknown as Record<string, unknown>),
		});
	}
}

export class AzureServiceBus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Azure Service Bus',
		name: 'azureServiceBus',
		icon: 'file:azureServiceBus.svg',
		group: ['transform'],
		version: 1,
		subtitle:
			'={{$parameter["resource"] + ": " + ($parameter["operation"] || "send")}}',
		description: 'Send messages to Azure Service Bus queues and topics',
		defaults: {
			name: 'Azure Service Bus',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'azureServiceBusApi',
				required: true,
				testedBy: 'azureServiceBusConnectionTest',
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Queue',
						value: 'queue',
					},
					{
						name: 'Queue Admin',
						value: 'queueAdmin',
						description: 'Manage queues (create, delete, get properties)',
					},
					{
						name: 'Subscription Admin',
						value: 'subscriptionAdmin',
						description:
							'Manage subscriptions (create, delete, get properties)',
					},
					{
						name: 'Topic',
						value: 'topic',
					},
					{
						name: 'Topic Admin',
						value: 'topicAdmin',
						description: 'Manage topics (create, delete, get properties)',
					},
				],
				default: 'queue',
				description: 'The type of Service Bus entity to work with',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a message to a queue or topic',
						action: 'Send a message',
					},
					{
						name: 'Schedule Message',
						value: 'schedule',
						description: 'Schedule a message for future delivery',
						action: 'Schedule a message',
					},
					{
						name: 'Cancel Scheduled Message',
						value: 'cancelScheduled',
						description: 'Cancel a previously scheduled message',
						action: 'Cancel a scheduled message',
					},
					{
						name: 'Batch Send',
						value: 'batchSend',
						description:
							'Send all input items as a batch (auto-splits if size limit exceeded)',
						action: 'Send messages as batch',
					},
					{
						name: 'Peek Messages',
						value: 'peek',
						description:
							'Inspect messages in a queue or subscription without removing them',
						action: 'Peek messages',
					},
					{
						name: 'Receive Deferred Messages',
						value: 'receiveDeferred',
						description: 'Receive previously deferred messages by sequence number',
						action: 'Receive deferred messages',
					},
				],
				default: 'send',
				description: 'The operation to perform',
			},
			// Admin operation dropdowns
			queueAdminOperations,
			topicAdminOperations,
			subscriptionAdminOperations,
			{
				displayName: 'Queue Name',
				name: 'queueName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['queue'],
					},
				},
				description: 'The name of the queue to send the message to',
			},
			{
				displayName: 'Topic Name',
				name: 'topicName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['topic'],
					},
				},
				description: 'The name of the topic to publish the message to',
			},
			{
				displayName: 'Subscription Name',
				name: 'subscriptionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {

						resource: ['topic'],
						operation: ['peek', 'receiveDeferred'],
					},
				},
				description:
					'The name of the subscription to read messages from (required for peek/receive on topics)',
			},
			// Admin resource fields
			...queueAdminFields,
			...topicAdminFields,
			...subscriptionAdminFields,
			{
				displayName: 'Send Body Type',
				name: 'sendBodyType',
				type: 'options',
				options: [
					{
						name: 'JSON',
						value: 'json',
					},
					{
						name: 'String',
						value: 'string',
					},
				],
				default: 'json',
				description: 'The format of the message body',
				displayOptions: {
					show: {
						resource: ['queue', 'topic'],
					},
					hide: {
						operation: ['cancelScheduled', 'peek', 'receiveDeferred'],
					},
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				required: true,
				typeOptions: {
					rows: 5,
				},
				description: 'The message body to send',
				displayOptions: {
					show: {
						resource: ['queue', 'topic'],
					},
					hide: {
						operation: ['cancelScheduled', 'peek', 'receiveDeferred'],
					},
				},
			},
			{
				displayName: 'Scheduled Time (UTC)',
				name: 'scheduledTime',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
						operation: ['schedule'],
					},
				},
				description:
					'The UTC date and time at which the message should become available in the queue or topic',
			},
			{
				displayName: 'Sequence Numbers',
				name: 'sequenceNumbers',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
						operation: ['cancelScheduled', 'receiveDeferred'],
					},
				},
				description: 'Comma-separated sequence numbers of the messages to process',
			},
			{
				displayName: 'Max Message Count',
				name: 'maxMessageCount',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
						operation: ['peek'],
					},
				},
				description: 'Maximum number of messages to peek',
			},
			{
				displayName: 'From Sequence Number',
				name: 'fromSequenceNumber',
				type: 'string',
				default: '',
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
						operation: ['peek'],
					},
				},
				description:
					'Start peeking from this sequence number. If empty, peeks from the beginning.',
			},
			{
				displayName: 'Sub-Queue',
				name: 'subQueueType',
				type: 'options',
				default: 'none',
				displayOptions: {
					show: {

						resource: ['queue', 'topic'],
						operation: ['peek', 'receiveDeferred'],
					},
				},
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Dead Letter',
						value: 'deadLetter',
						description: 'Read from the dead-letter sub-queue',
					},
					{
						name: 'Transfer Dead Letter',
						value: 'transferDeadLetter',
						description: 'Read from the transfer dead-letter sub-queue',
					},
				],
				description: 'Choose which sub-queue to read messages from',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						resource: ['queue', 'topic'],
					},
					hide: {
						operation: ['cancelScheduled', 'peek', 'receiveDeferred'],
					},
				},
				options: [
					{
						displayName: 'Application Properties',
						name: 'applicationProperties',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Property',
						options: [
							{
								displayName: 'Property',
								name: 'property',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
									},
								],
							},
						],
						description: 'Custom key-value properties to attach to the message',
					},
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'string',
						default: '',
						placeholder: 'application/json',
						description: 'The MIME content type of the message',
					},
					{
						displayName: 'Correlation ID',
						name: 'correlationId',
						type: 'string',
						default: '',
						description: 'Correlation identifier for request-reply patterns',
					},
					{
						displayName: 'Message ID',
						name: 'messageId',
						type: 'string',
						default: '',
						description:
							'Unique identifier for the message. Auto-generated if not provided.',
					},
					{
						displayName: 'Subject',
						name: 'subject',
						type: 'string',
						default: '',
						description: 'Application-specific label for the message',
					},
					{
						displayName: 'Time to Live (Seconds)',
						name: 'timeToLive',
						type: 'number',
						default: 0,
						description:
							'Message time-to-live in seconds. Uses queue/topic default if set to 0.',
					},
					{
						displayName: 'Partition Key',
						name: 'partitionKey',
						type: 'string',
						default: '',
						description: 'The partition key for sending to partitioned entities',
					},
					{
						displayName: 'Reply To',
						name: 'replyTo',
						type: 'string',
						default: '',
						description: 'The address of the entity to send replies to',
					},
					{
						displayName: 'Reply To Session ID',
						name: 'replyToSessionId',
						type: 'string',
						default: '',
						description: 'The session identifier for reply messages',
					},
					{
						displayName: 'Scheduled Enqueue Time (UTC)',
						name: 'scheduledEnqueueTimeUtc',
						type: 'dateTime',
						default: '',
						description:
							'The UTC time at which the message should become visible in the queue',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
						description:
							'The session identifier for session-enabled queues and topics',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'string',
						default: '',
						description: 'The destination address for routing scenarios',
					},
				],
			},
		],
	};

	methods = {
		credentialTest: {
			async azureServiceBusConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials =
					credential.data as unknown as AzureServiceBusCredentials;
				try {
					const adminClient = createAdministrationClient(credentials);
					const iterator = adminClient.listQueues();
					await iterator.next();
				} catch (error) {
					return {
						status: 'Error',
						message: (error as Error).message,
					};
				}
				return {
					status: 'OK',
					message: 'Connection successful!',
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];
		const credentials = await getCredentials(this);
		const resource = this.getNodeParameter('resource', 0) as string;

		// Admin operations use the administration client
		if (resource === 'queueAdmin' || resource === 'topicAdmin' || resource === 'subscriptionAdmin') {
			const adminClient = createAdministrationClient(credentials);
			const operation = this.getNodeParameter('operation', 0) as string;

			if (resource === 'queueAdmin') {
				await executeQueueAdminOperation(this, adminClient, operation, returnItems);
			} else if (resource === 'topicAdmin') {
				await executeTopicAdminOperation(this, adminClient, operation, returnItems);
			} else {
				await executeSubscriptionAdminOperation(this, adminClient, operation, returnItems);
			}

			return [returnItems];
		}

		// Message operations use the messaging client
		const client = createServiceBusClient(credentials);

		try {
			const entityName =
				resource === 'topic'
					? (this.getNodeParameter('topicName', 0) as string)
					: (this.getNodeParameter('queueName', 0) as string);

			if (!entityName) {
				throw new NodeOperationError(
					this.getNode(),
					`The ${resource} name cannot be empty`,
				);
			}

			const operation = this.getNodeParameter('operation', 0) as string;

			if (operation === 'peek' || operation === 'receiveDeferred') {
				await executeReceiverOperation(
					this,
					client,
					resource,
					entityName,
					operation,
					items,
					returnItems,
				);
			} else {
				await executeSenderOperation(
					this,
					client,
					resource,
					entityName,
					operation,
					items,
					returnItems,
				);
			}
		} finally {
			await client.close();
		}

		return [returnItems];
	}
}
