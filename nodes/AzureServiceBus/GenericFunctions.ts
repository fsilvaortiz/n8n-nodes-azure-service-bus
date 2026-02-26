import {
	ServiceBusClient,
	ServiceBusAdministrationClient,
} from '@azure/service-bus';
import type {
	ServiceBusSender,
	ServiceBusReceiver,
	ServiceBusReceivedMessage,
	ServiceBusMessage,
} from '@azure/service-bus';
import type { IExecuteFunctions, ITriggerFunctions, IDataObject } from 'n8n-workflow';
import { jsonParse } from 'n8n-workflow';

import type { AzureServiceBusCredentials, SendOptions } from './types';

export function createServiceBusClient(credentials: AzureServiceBusCredentials): ServiceBusClient {
	return new ServiceBusClient(credentials.connectionString);
}

export function createAdministrationClient(
	credentials: AzureServiceBusCredentials,
): ServiceBusAdministrationClient {
	return new ServiceBusAdministrationClient(credentials.connectionString);
}

export function createSender(client: ServiceBusClient, entityName: string): ServiceBusSender {
	return client.createSender(entityName);
}

export function createReceiver(
	client: ServiceBusClient,
	entityType: 'queue' | 'subscription',
	options: {
		queueName?: string;
		topicName?: string;
		subscriptionName?: string;
		receiveMode?: 'peekLock' | 'receiveAndDelete';
	},
): ServiceBusReceiver {
	const receiveMode = options.receiveMode === 'receiveAndDelete' ? 'receiveAndDelete' : 'peekLock';

	if (entityType === 'subscription' && options.topicName && options.subscriptionName) {
		return client.createReceiver(options.topicName, options.subscriptionName, { receiveMode });
	}

	return client.createReceiver(options.queueName ?? '', { receiveMode });
}

export function buildServiceBusMessage(
	body: unknown,
	sendBodyType: string,
	messageOptions: SendOptions,
): ServiceBusMessage {
	let messageBody: unknown;

	if (sendBodyType === 'json') {
		messageBody = typeof body === 'string' ? jsonParse(body) : body;
	} else {
		messageBody = typeof body === 'object' && body !== null ? JSON.stringify(body) : String(body as string ?? '');
	}

	const message: ServiceBusMessage = { body: messageBody };

	if (messageOptions.contentType) {
		message.contentType = messageOptions.contentType;
	}
	if (messageOptions.correlationId) {
		message.correlationId = messageOptions.correlationId;
	}
	if (messageOptions.subject) {
		message.subject = messageOptions.subject;
	}
	if (messageOptions.messageId) {
		message.messageId = messageOptions.messageId;
	}
	if (messageOptions.timeToLive) {
		message.timeToLive = messageOptions.timeToLive * 1000;
	}
	if (messageOptions.applicationProperties?.length) {
		const props: Record<string, string> = {};
		for (const { key, value } of messageOptions.applicationProperties) {
			props[key] = value;
		}
		message.applicationProperties = props;
	}

	return message;
}

export function parseReceivedMessage(
	message: ServiceBusReceivedMessage,
	jsonParseBody: boolean,
): IDataObject {
	let body = message.body as unknown;

	if (jsonParseBody && typeof body === 'string') {
		try {
			body = JSON.parse(body);
		} catch {
			// keep as string
		}
	}

	return {
		body,
		messageId: message.messageId,
		contentType: message.contentType,
		correlationId: message.correlationId,
		subject: message.subject,
		enqueuedTimeUtc: message.enqueuedTimeUtc?.toISOString(),
		sequenceNumber: message.sequenceNumber
			? Number(message.sequenceNumber)
			: undefined,
		deliveryCount: message.deliveryCount,
		applicationProperties: (message.applicationProperties as IDataObject) ?? {},
	} as IDataObject;
}

export async function getCredentials(
	context: IExecuteFunctions | ITriggerFunctions,
): Promise<AzureServiceBusCredentials> {
	return (await context.getCredentials(
		'azureServiceBusApi',
	)) as unknown as AzureServiceBusCredentials;
}
