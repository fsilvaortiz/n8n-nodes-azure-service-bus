import type { ServiceBusReceivedMessage } from '@azure/service-bus';

export interface AzureServiceBusCredentials {
	connectionString: string;
}

export interface SendOptions {
	contentType?: string;
	correlationId?: string;
	subject?: string;
	messageId?: string;
	timeToLive?: number;
	applicationProperties?: Array<{ key: string; value: string }>;
}

export interface TriggerOptions {
	settlementAction?: 'complete' | 'abandon' | 'deadLetter';
	failureAction?: 'abandon' | 'deadLetter';
	maxConcurrentCalls?: number;
	jsonParseBody?: boolean;
	contentIsBinary?: boolean;
}

export interface MessageProperties {
	messageId?: string;
	contentType?: string;
	correlationId?: string;
	subject?: string;
	timeToLive?: number;
	applicationProperties?: Record<string, string | number | boolean>;
}

export type ReceivedMessage = ServiceBusReceivedMessage;
