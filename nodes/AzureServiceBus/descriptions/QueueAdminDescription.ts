import type { INodeProperties } from 'n8n-workflow';

export const queueAdminOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['queueAdmin'],
		},
	},
	options: [
		{
			name: 'Create',
			value: 'create',
			description: 'Create a new queue',
			action: 'Create a queue',
		},
		{
			name: 'Delete',
			value: 'delete',
			description: 'Delete a queue',
			action: 'Delete a queue',
		},
		{
			name: 'Get',
			value: 'get',
			description: 'Get queue properties',
			action: 'Get queue properties',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			description: 'List all queues',
			action: 'List all queues',
		},
		{
			name: 'Get Runtime Properties',
			value: 'getRuntimeProperties',
			description: 'Get queue runtime properties (message counts)',
			action: 'Get queue runtime properties',
		},
	],
	default: 'getAll',
};

export const queueAdminFields: INodeProperties[] = [
	{
		displayName: 'Queue Name',
		name: 'queueName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['queueAdmin'],
				operation: ['create', 'delete', 'get', 'getRuntimeProperties'],
			},
		},
		description: 'The name of the queue',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: ['queueAdmin'],
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
					'ISO-8601 duration after which an idle queue is automatically deleted (e.g. "PT5M" for 5 minutes)',
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
					'ISO-8601 duration for the default message time-to-live (e.g. "PT1H" for 1 hour)',
			},
			{
				displayName: 'Duplicate Detection History Time Window',
				name: 'duplicateDetectionHistoryTimeWindow',
				type: 'string',
				default: '',
				placeholder: 'PT10M',
				description:
					'ISO-8601 duration for the duplicate detection history window',
			},
			{
				displayName: 'Enable Batched Operations',
				name: 'enableBatchedOperations',
				type: 'boolean',
				default: true,
				description: 'Whether server-side batched operations are enabled',
			},
			{
				displayName: 'Enable Partitioning',
				name: 'enablePartitioning',
				type: 'boolean',
				default: false,
				description: 'Whether the queue is partitioned across multiple message brokers',
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
					'ISO-8601 duration for how long a message is locked for processing (e.g. "PT1M" for 1 minute)',
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
				displayName: 'Max Size in Megabytes',
				name: 'maxSizeInMegabytes',
				type: 'number',
				default: 1024,
				description: 'Maximum size of the queue in megabytes',
			},
			{
				displayName: 'Requires Duplicate Detection',
				name: 'requiresDuplicateDetection',
				type: 'boolean',
				default: false,
				description: 'Whether duplicate detection is enabled',
			},
			{
				displayName: 'Requires Session',
				name: 'requiresSession',
				type: 'boolean',
				default: false,
				description: 'Whether the queue requires sessions',
			},
		],
	},
];
