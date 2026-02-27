import {
	ServiceBusClient,
	ServiceBusAdministrationClient,
} from '@azure/service-bus';
import type {
	ServiceBusSender,
	ServiceBusReceiver,
	ServiceBusReceivedMessage,
	ServiceBusMessage,
	ServiceBusSessionReceiver,
} from '@azure/service-bus';
import Long from 'long';
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
		subQueueType?: 'deadLetter' | 'transferDeadLetter';
	},
): ServiceBusReceiver {
	const receiveMode = options.receiveMode === 'receiveAndDelete' ? 'receiveAndDelete' : 'peekLock';
	const receiverOptions: { receiveMode: 'peekLock' | 'receiveAndDelete'; subQueueType?: 'deadLetter' | 'transferDeadLetter' } = { receiveMode };

	if (options.subQueueType) {
		receiverOptions.subQueueType = options.subQueueType;
	}

	if (entityType === 'subscription' && options.topicName && options.subscriptionName) {
		return client.createReceiver(options.topicName, options.subscriptionName, receiverOptions);
	}

	return client.createReceiver(options.queueName ?? '', receiverOptions);
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
	if (messageOptions.sessionId) {
		message.sessionId = messageOptions.sessionId;
	}
	if (messageOptions.partitionKey) {
		message.partitionKey = messageOptions.partitionKey;
	}
	if (messageOptions.replyTo) {
		message.replyTo = messageOptions.replyTo;
	}
	if (messageOptions.replyToSessionId) {
		message.replyToSessionId = messageOptions.replyToSessionId;
	}
	if (messageOptions.to) {
		message.to = messageOptions.to;
	}
	if (messageOptions.scheduledEnqueueTimeUtc) {
		message.scheduledEnqueueTimeUtc = new Date(messageOptions.scheduledEnqueueTimeUtc);
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
	contentIsBinary = false,
): IDataObject {
	let body = message.body as unknown;

	if (contentIsBinary) {
		if (Buffer.isBuffer(body)) {
			body = (body as Buffer).toString('base64');
		} else if (typeof body === 'string') {
			body = Buffer.from(body).toString('base64');
		}
	} else if (jsonParseBody && typeof body === 'string') {
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
		to: message.to,
		replyTo: message.replyTo,
		sessionId: message.sessionId,
		partitionKey: message.partitionKey,
		replyToSessionId: message.replyToSessionId,
		timeToLive: message.timeToLive,
		enqueuedTimeUtc: message.enqueuedTimeUtc?.toISOString(),
		expiresAtUtc: message.expiresAtUtc?.toISOString(),
		lockedUntilUtc: message.lockedUntilUtc?.toISOString(),
		sequenceNumber: message.sequenceNumber
			? message.sequenceNumber.toString()
			: undefined,
		deliveryCount: message.deliveryCount,
		state: message.state,
		deadLetterSource: message.deadLetterSource,
		deadLetterReason: message.deadLetterReason,
		deadLetterErrorDescription: message.deadLetterErrorDescription,
		applicationProperties: (message.applicationProperties as IDataObject) ?? {},
	} as IDataObject;
}

export function sequenceNumbersFromString(input: string): Long[] {
	return input
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => Long.fromString(s));
}

export function longFromString(input: string): Long {
	return Long.fromString(input);
}

export async function createSessionReceiver(
	client: ServiceBusClient,
	entityType: 'queue' | 'subscription',
	sessionMode: 'acceptNext' | 'specific',
	options: {
		queueName?: string;
		topicName?: string;
		subscriptionName?: string;
		sessionId?: string;
		receiveMode?: 'peekLock' | 'receiveAndDelete';
	},
): Promise<ServiceBusSessionReceiver> {
	const receiveMode: 'peekLock' | 'receiveAndDelete' =
		options.receiveMode === 'receiveAndDelete' ? 'receiveAndDelete' : 'peekLock';
	const receiverOptions = { receiveMode };

	if (sessionMode === 'specific') {
		const sessionId = options.sessionId ?? '';
		if (entityType === 'subscription' && options.topicName && options.subscriptionName) {
			return client.acceptSession(
				options.topicName,
				options.subscriptionName,
				sessionId,
				receiverOptions,
			);
		}
		return client.acceptSession(options.queueName ?? '', sessionId, receiverOptions);
	}

	if (entityType === 'subscription' && options.topicName && options.subscriptionName) {
		return client.acceptNextSession(
			options.topicName,
			options.subscriptionName,
			receiverOptions,
		);
	}
	return client.acceptNextSession(options.queueName ?? '', receiverOptions);
}

export async function getCredentials(
	context: IExecuteFunctions | ITriggerFunctions,
): Promise<AzureServiceBusCredentials> {
	return (await context.getCredentials(
		'azureServiceBusApi',
	)) as unknown as AzureServiceBusCredentials;
}

export function sanitizeProperties(obj: Record<string, unknown>): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		if (key.startsWith('_')) continue;
		if (value instanceof Date) {
			result[key] = value.toISOString();
		} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			result[key] = sanitizeProperties(value as Record<string, unknown>);
		} else {
			result[key] = value as IDataObject[keyof IDataObject];
		}
	}
	return result;
}
