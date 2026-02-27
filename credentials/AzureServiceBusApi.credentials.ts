import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AzureServiceBusApi implements ICredentialType {
	name = 'azureServiceBusApi';

	displayName = 'Azure Service Bus API';

	documentationUrl = 'https://github.com/fsilvaortiz/n8n-nodes-azure-service-bus#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Connection String',
			name: 'connectionString',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder:
				'Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=<policy>;SharedAccessKey=<key>',
			required: true,
			description:
				'The connection string for your Azure Service Bus namespace. Find it in Azure Portal under Shared Access Policies.',
		},
	];
}
