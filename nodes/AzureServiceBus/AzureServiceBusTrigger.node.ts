import type { ServiceBusReceivedMessage, ServiceBusReceiver } from '@azure/service-bus';
import type {
	IDeferredPromise,
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	IRun,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	createServiceBusClient,
	createReceiver,
	parseReceivedMessage,
	getCredentials,
} from './GenericFunctions';
import type { TriggerOptions } from './types';

async function settleMessage(
	receiver: ServiceBusReceiver,
	message: ServiceBusReceivedMessage,
	action: string,
): Promise<void> {
	switch (action) {
		case 'complete':
			await receiver.completeMessage(message);
			break;
		case 'abandon':
			await receiver.abandonMessage(message);
			break;
		case 'deadLetter':
			await receiver.deadLetterMessage(message);
			break;
		default:
			await receiver.completeMessage(message);
	}
}

export class AzureServiceBusTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Azure Service Bus Trigger',
		name: 'azureServiceBusTrigger',
		icon: 'file:azureServiceBus.svg',
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["entityType"] === "subscription" ? $parameter["topicName"] + "/" + $parameter["subscriptionName"] : $parameter["queueName"]}}',
		description: 'Triggers when a message is received from Azure Service Bus',
		eventTriggerDescription: '',
		defaults: {
			name: 'Azure Service Bus Trigger',
		},
		triggerPanel: {
			header: '',
			executionsHelp: {
				inactive:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a message to the configured queue or subscription. This will trigger an execution, which will show up in this editor.<br /><br /><b>Once you're happy with your workflow</b>, publish it. Then every time a message arrives, the workflow will execute. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
				active:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a message to the configured queue or subscription. This will trigger an execution, which will show up in this editor.<br /><br /><b>Your workflow will also execute automatically</b>, since it's activated. Every time a message arrives, this node will trigger an execution. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
			},
			activationHint:
				"Once you've finished building your workflow, publish it to have it also listen continuously (you just won't see those executions here).",
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'azureServiceBusApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Entity Type',
				name: 'entityType',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Queue',
						value: 'queue',
					},
					{
						name: 'Subscription',
						value: 'subscription',
					},
				],
				default: 'queue',
				description: 'The type of Service Bus entity to receive messages from',
			},
			{
				displayName: 'Queue Name',
				name: 'queueName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						entityType: ['queue'],
					},
				},
				description: 'The name of the queue to receive messages from',
			},
			{
				displayName: 'Topic Name',
				name: 'topicName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						entityType: ['subscription'],
					},
				},
				description: 'The name of the topic',
			},
			{
				displayName: 'Subscription Name',
				name: 'subscriptionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						entityType: ['subscription'],
					},
				},
				description: 'The name of the subscription to receive messages from',
			},
			{
				displayName: 'Receive Mode',
				name: 'receiveMode',
				type: 'options',
				options: [
					{
						name: 'Peek Lock',
						value: 'peekLock',
						description:
							'Message is locked while processing. Must be settled (completed, abandoned, or dead-lettered) after processing.',
					},
					{
						name: 'Receive and Delete',
						value: 'receiveAndDelete',
						description:
							'Message is immediately removed from the queue upon receipt. Cannot be recovered if processing fails.',
					},
				],
				default: 'peekLock',
				description: 'How messages are received from Service Bus',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Content Is Binary',
						name: 'contentIsBinary',
						type: 'boolean',
						default: false,
						description: 'Whether to treat the message content as binary data',
					},
					{
						displayName: 'Failure Action',
						name: 'failureAction',
						type: 'options',
						displayOptions: {
							show: {
								'/receiveMode': ['peekLock'],
							},
						},
						options: [
							{
								name: 'Abandon',
								value: 'abandon',
								description: 'Return the message to the queue for retry',
							},
							{
								name: 'Dead Letter',
								value: 'deadLetter',
								description:
									'Move the message to the dead letter queue for manual investigation',
							},
						],
						default: 'abandon',
						description: 'What to do with the message when the workflow fails',
					},
					{
						displayName: 'JSON Parse Body',
						name: 'jsonParseBody',
						type: 'boolean',
						default: false,
						description: 'Whether to try to parse the message body as JSON',
					},
					{
						displayName: 'Max Concurrent Calls',
						name: 'maxConcurrentCalls',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 1,
						},
						description: 'Maximum number of messages to process concurrently',
					},
					{
						displayName: 'Settlement Action',
						name: 'settlementAction',
						type: 'options',
						displayOptions: {
							show: {
								'/receiveMode': ['peekLock'],
							},
						},
						options: [
							{
								name: 'Complete',
								value: 'complete',
								description: 'Remove the message from the queue (mark as processed)',
							},
							{
								name: 'Abandon',
								value: 'abandon',
								description: 'Return the message to the queue for retry',
							},
							{
								name: 'Dead Letter',
								value: 'deadLetter',
								description: 'Move the message to the dead letter queue',
							},
						],
						default: 'complete',
						description:
							'What to do with the message when the workflow succeeds',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const entityType = this.getNodeParameter('entityType') as 'queue' | 'subscription';
		const receiveMode = this.getNodeParameter('receiveMode') as 'peekLock' | 'receiveAndDelete';
		const options = this.getNodeParameter('options', {}) as TriggerOptions;

		const queueName =
			entityType === 'queue'
				? (this.getNodeParameter('queueName') as string)
				: undefined;
		const topicName =
			entityType === 'subscription'
				? (this.getNodeParameter('topicName') as string)
				: undefined;
		const subscriptionName =
			entityType === 'subscription'
				? (this.getNodeParameter('subscriptionName') as string)
				: undefined;

		if (entityType === 'queue' && !queueName) {
			throw new NodeOperationError(this.getNode(), 'Queue name is required');
		}
		if (entityType === 'subscription' && (!topicName || !subscriptionName)) {
			throw new NodeOperationError(
				this.getNode(),
				'Topic name and subscription name are required',
			);
		}

		const credentials = await getCredentials(this);
		const client = createServiceBusClient(credentials);
		const receiver = createReceiver(client, entityType, {
			queueName,
			topicName,
			subscriptionName,
			receiveMode,
		});

		const jsonParseBody = options.jsonParseBody ?? false;
		const settlementAction = options.settlementAction ?? 'complete';
		const failureAction = options.failureAction ?? 'abandon';

		const processIncomingMessage = async (
			message: ServiceBusReceivedMessage,
			donePromise?: IDeferredPromise<IRun>,
		) => {
			const parsedMessage = parseReceivedMessage(message, jsonParseBody);
			const resultData = [this.helpers.returnJsonArray([parsedMessage])];

			this.emit(resultData, undefined, donePromise);

			if (receiveMode === 'peekLock' && donePromise) {
				try {
					const run = await donePromise.promise;
					const isSuccess =
						run?.data?.resultData?.error === undefined;

					if (isSuccess) {
						await settleMessage(receiver, message, settlementAction);
					} else {
						await settleMessage(receiver, message, failureAction);
					}
				} catch {
					await settleMessage(receiver, message, failureAction);
				}
			}
		};

		const manualTriggerFunction = async () => {
			const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 30000 });
			if (messages.length > 0) {
				const parsedMessage = parseReceivedMessage(messages[0], jsonParseBody);
				this.emit([this.helpers.returnJsonArray([parsedMessage])]);

				if (receiveMode === 'peekLock') {
					await settleMessage(receiver, messages[0], settlementAction);
				}
			} else {
				this.emit([this.helpers.returnJsonArray([{ message: 'No messages available' }])]);
			}
		};

		if (this.getMode() === 'trigger') {
			const maxConcurrentCalls = options.maxConcurrentCalls ?? 1;

			receiver.subscribe(
				{
					processMessage: async (message) => {
						const donePromise =
							maxConcurrentCalls === 1
								? this.helpers.createDeferredPromise<IRun>()
								: undefined;
						await processIncomingMessage(message, donePromise);
					},
					processError: async (args) => {
						this.logger.error(
							`Azure Service Bus Trigger error: ${args.error.message}`,
						);
					},
				},
				{
					maxConcurrentCalls,
					autoCompleteMessages: false,
				},
			);
		}

		const closeFunction = async () => {
			await receiver.close();
			await client.close();
		};

		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
