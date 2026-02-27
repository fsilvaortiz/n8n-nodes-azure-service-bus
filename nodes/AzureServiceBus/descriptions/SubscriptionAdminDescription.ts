import type { INodeProperties } from 'n8n-workflow';

export const subscriptionAdminOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['subscriptionAdmin'],
		},
	},
	options: [
		{
			name: 'Create',
			value: 'create',
			description: 'Create a new subscription',
			action: 'Create a subscription',
		},
		{
			name: 'Delete',
			value: 'delete',
			description: 'Delete a subscription',
			action: 'Delete a subscription',
		},
		{
			name: 'Get',
			value: 'get',
			description: 'Get subscription properties',
			action: 'Get subscription properties',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			description: 'List all subscriptions for a topic',
			action: 'List all subscriptions',
		},
		{
			name: 'Get Runtime Properties',
			value: 'getRuntimeProperties',
			description: 'Get subscription runtime properties (message counts)',
			action: 'Get subscription runtime properties',
		},
	],
	default: 'getAll',
};

export const subscriptionAdminFields: INodeProperties[] = [
	{
		displayName: 'Topic Name',
		name: 'topicName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['subscriptionAdmin'],
			},
		},
		description: 'The name of the topic the subscription belongs to',
	},
	{
		displayName: 'Subscription Name',
		name: 'subscriptionName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['subscriptionAdmin'],
				operation: ['create', 'delete', 'get', 'getRuntimeProperties'],
			},
		},
		description: 'The name of the subscription',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: ['subscriptionAdmin'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Auto Delete on Idle',
				name: 'autoDeleteOnIdle',
				type: 'string',
				default: '',
				placeholder: 'PT5M',
				description:
					'ISO-8601 duration after which an idle subscription is automatically deleted',
			},
			{
				displayName: 'Dead Lettering on Filter Evaluation Exceptions',
				name: 'deadLetteringOnFilterEvaluationExceptions',
				type: 'boolean',
				default: true,
				description:
					'Whether messages that cause filter evaluation exceptions are dead-lettered',
			},
			{
				displayName: 'Dead Lettering on Message Expiration',
				name: 'deadLetteringOnMessageExpiration',
				type: 'boolean',
				default: false,
				description:
					'Whether expired messages are moved to the dead-letter sub-queue',
			},
			{
				displayName: 'Default Message Time to Live',
				name: 'defaultMessageTimeToLive',
				type: 'string',
				default: '',
				placeholder: 'PT1H',
				description:
					'ISO-8601 duration for the default message time-to-live',
			},
			{
				displayName: 'Enable Batched Operations',
				name: 'enableBatchedOperations',
				type: 'boolean',
				default: true,
				description: 'Whether server-side batched operations are enabled',
			},
			{
				displayName: 'Forward Dead Lettered Messages To',
				name: 'forwardDeadLetteredMessagesTo',
				type: 'string',
				default: '',
				description:
					'Name of the queue or topic to forward dead-lettered messages to',
			},
			{
				displayName: 'Forward To',
				name: 'forwardTo',
				type: 'string',
				default: '',
				description: 'Name of the queue or topic to forward messages to',
			},
			{
				displayName: 'Lock Duration',
				name: 'lockDuration',
				type: 'string',
				default: '',
				placeholder: 'PT1M',
				description:
					'ISO-8601 duration for how long a message is locked for processing',
			},
			{
				displayName: 'Max Delivery Count',
				name: 'maxDeliveryCount',
				type: 'number',
				default: 10,
				description:
					'Maximum number of delivery attempts before the message is dead-lettered',
			},
			{
				displayName: 'Requires Session',
				name: 'requiresSession',
				type: 'boolean',
				default: false,
				description: 'Whether the subscription requires sessions',
			},
		],
	},
];
