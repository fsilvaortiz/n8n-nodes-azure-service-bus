import type { INodeProperties } from 'n8n-workflow';

export const topicAdminOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['topicAdmin'],
		},
	},
	options: [
		{
			name: 'Create',
			value: 'create',
			description: 'Create a new topic',
			action: 'Create a topic',
		},
		{
			name: 'Delete',
			value: 'delete',
			description: 'Delete a topic',
			action: 'Delete a topic',
		},
		{
			name: 'Get',
			value: 'get',
			description: 'Get topic properties',
			action: 'Get topic properties',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			description: 'List all topics',
			action: 'List all topics',
		},
		{
			name: 'Get Runtime Properties',
			value: 'getRuntimeProperties',
			description: 'Get topic runtime properties (subscription count, sizes)',
			action: 'Get topic runtime properties',
		},
	],
	default: 'getAll',
};

export const topicAdminFields: INodeProperties[] = [
	{
		displayName: 'Topic Name',
		name: 'topicName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['topicAdmin'],
				operation: ['create', 'delete', 'get', 'getRuntimeProperties'],
			},
		},
		description: 'The name of the topic',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				resource: ['topicAdmin'],
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
					'ISO-8601 duration after which an idle topic is automatically deleted',
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
				description:
					'Whether the topic is partitioned across multiple message brokers',
			},
			{
				displayName: 'Max Size in Megabytes',
				name: 'maxSizeInMegabytes',
				type: 'number',
				default: 1024,
				description: 'Maximum size of the topic in megabytes',
			},
			{
				displayName: 'Requires Duplicate Detection',
				name: 'requiresDuplicateDetection',
				type: 'boolean',
				default: false,
				description: 'Whether duplicate detection is enabled',
			},
			{
				displayName: 'Support Ordering',
				name: 'supportOrdering',
				type: 'boolean',
				default: false,
				description: 'Whether the topic supports message ordering',
			},
		],
	},
];
