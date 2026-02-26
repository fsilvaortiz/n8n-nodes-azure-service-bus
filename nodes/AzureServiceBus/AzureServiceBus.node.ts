import type {
	IExecuteFunctions,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	createServiceBusClient,
	createAdministrationClient,
	createSender,
	buildServiceBusMessage,
	getCredentials,
} from './GenericFunctions';
import type { AzureServiceBusCredentials, SendOptions } from './types';

export class AzureServiceBus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Azure Service Bus',
		name: 'azureServiceBus',
		icon: 'file:azureServiceBus.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + ($parameter["queueName"] || $parameter["topicName"] || "")}}',
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
						name: 'Topic',
						value: 'topic',
					},
				],
				default: 'queue',
				description: 'The type of Service Bus entity to send the message to',
			},
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
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
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
				const credentials = credential.data as unknown as AzureServiceBusCredentials;
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
		const client = createServiceBusClient(credentials);

		try {
			const resource = this.getNodeParameter('resource', 0);
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

			const sender = createSender(client, entityName);

			try {
				for (let i = 0; i < items.length; i++) {
					const sendBodyType = this.getNodeParameter('sendBodyType', i) as string;
					const messageBody = this.getNodeParameter('message', i) as string;
					const options = this.getNodeParameter('options', i, {}) as SendOptions;

					if (options.applicationProperties) {
						const rawProps = options.applicationProperties as unknown as {
							property?: Array<{ key: string; value: string }>;
						};
						options.applicationProperties = rawProps.property ?? [];
					}

					const message = buildServiceBusMessage(messageBody, sendBodyType, options);
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
			} finally {
				await sender.close();
			}
		} finally {
			await client.close();
		}

		return [returnItems];
	}
}
