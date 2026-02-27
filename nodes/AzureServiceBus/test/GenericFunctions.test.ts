import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import type { IDataObject } from 'n8n-workflow';

import { parseReceivedMessage, buildServiceBusMessage, sequenceNumbersFromString, longFromString, sanitizeProperties } from '../GenericFunctions';

const createMockReceivedMessage = (overrides: Partial<ServiceBusReceivedMessage> = {}) =>
	({
		body: { hello: 'world' },
		messageId: 'msg-001',
		contentType: 'application/json',
		correlationId: 'corr-001',
		subject: 'test-subject',
		to: 'dest-queue',
		replyTo: 'reply-queue',
		sessionId: 'session-1',
		partitionKey: 'pk-1',
		replyToSessionId: 'reply-session',
		timeToLive: 60000,
		enqueuedTimeUtc: new Date('2026-01-01T00:00:00Z'),
		expiresAtUtc: new Date('2026-01-02T00:00:00Z'),
		lockedUntilUtc: new Date('2026-01-01T00:01:00Z'),
		sequenceNumber: BigInt(42),
		deliveryCount: 3,
		state: 'active' as const,
		deadLetterSource: undefined,
		deadLetterReason: undefined,
		deadLetterErrorDescription: undefined,
		applicationProperties: { env: 'test' },
		...overrides,
	}) as unknown as ServiceBusReceivedMessage;

describe('parseReceivedMessage', () => {
	it('should return sequenceNumber as a string', () => {
		const msg = createMockReceivedMessage({ sequenceNumber: BigInt('9007199254740993') });
		const result = parseReceivedMessage(msg, false);
		expect(result.sequenceNumber).toBe('9007199254740993');
		expect(typeof result.sequenceNumber).toBe('string');
	});

	it('should include all standard fields', () => {
		const msg = createMockReceivedMessage();
		const result = parseReceivedMessage(msg, false);

		expect(result.messageId).toBe('msg-001');
		expect(result.contentType).toBe('application/json');
		expect(result.correlationId).toBe('corr-001');
		expect(result.subject).toBe('test-subject');
		expect(result.to).toBe('dest-queue');
		expect(result.replyTo).toBe('reply-queue');
		expect(result.sessionId).toBe('session-1');
		expect(result.partitionKey).toBe('pk-1');
		expect(result.replyToSessionId).toBe('reply-session');
		expect(result.timeToLive).toBe(60000);
		expect(result.enqueuedTimeUtc).toBe('2026-01-01T00:00:00.000Z');
		expect(result.expiresAtUtc).toBe('2026-01-02T00:00:00.000Z');
		expect(result.lockedUntilUtc).toBe('2026-01-01T00:01:00.000Z');
		expect(result.sequenceNumber).toBe('42');
		expect(result.deliveryCount).toBe(3);
		expect(result.state).toBe('active');
		expect(result.applicationProperties).toEqual({ env: 'test' });
	});

	it('should include dead-letter fields when present', () => {
		const msg = createMockReceivedMessage({
			deadLetterSource: 'source-queue',
			deadLetterReason: 'MaxDeliveryCountExceeded',
			deadLetterErrorDescription: 'too many retries',
		});
		const result = parseReceivedMessage(msg, false);

		expect(result.deadLetterSource).toBe('source-queue');
		expect(result.deadLetterReason).toBe('MaxDeliveryCountExceeded');
		expect(result.deadLetterErrorDescription).toBe('too many retries');
	});

	it('should parse JSON body when jsonParseBody is true', () => {
		const msg = createMockReceivedMessage({ body: '{"parsed":true}' });
		const result = parseReceivedMessage(msg, true);
		expect(result.body).toEqual({ parsed: true });
	});

	it('should keep string body when JSON parse fails', () => {
		const msg = createMockReceivedMessage({ body: 'not json' });
		const result = parseReceivedMessage(msg, true);
		expect(result.body).toBe('not json');
	});

	it('should convert Buffer body to base64 when contentIsBinary is true', () => {
		const buf = Buffer.from('binary data');
		const msg = createMockReceivedMessage({ body: buf });
		const result = parseReceivedMessage(msg, false, true);
		expect(result.body).toBe(buf.toString('base64'));
	});

	it('should convert string body to base64 when contentIsBinary is true', () => {
		const msg = createMockReceivedMessage({ body: 'string data' });
		const result = parseReceivedMessage(msg, false, true);
		expect(result.body).toBe(Buffer.from('string data').toString('base64'));
	});

	it('should return undefined sequenceNumber when not present', () => {
		const msg = createMockReceivedMessage({
			sequenceNumber: undefined as unknown as bigint,
		});
		const result = parseReceivedMessage(msg, false);
		expect(result.sequenceNumber).toBeUndefined();
	});
});

describe('buildServiceBusMessage', () => {
	it('should set sessionId on the message', () => {
		const result = buildServiceBusMessage('test', 'string', { sessionId: 'session-1' });
		expect(result.sessionId).toBe('session-1');
	});

	it('should set partitionKey on the message', () => {
		const result = buildServiceBusMessage('test', 'string', { partitionKey: 'pk-1' });
		expect(result.partitionKey).toBe('pk-1');
	});

	it('should set replyTo on the message', () => {
		const result = buildServiceBusMessage('test', 'string', { replyTo: 'reply-queue' });
		expect(result.replyTo).toBe('reply-queue');
	});

	it('should set replyToSessionId on the message', () => {
		const result = buildServiceBusMessage('test', 'string', { replyToSessionId: 'rs-1' });
		expect(result.replyToSessionId).toBe('rs-1');
	});

	it('should set to on the message', () => {
		const result = buildServiceBusMessage('test', 'string', { to: 'dest' });
		expect(result.to).toBe('dest');
	});

	it('should convert scheduledEnqueueTimeUtc string to Date', () => {
		const result = buildServiceBusMessage('test', 'string', {
			scheduledEnqueueTimeUtc: '2026-03-01T12:00:00Z',
		});
		expect(result.scheduledEnqueueTimeUtc).toEqual(new Date('2026-03-01T12:00:00Z'));
	});

	it('should not set properties when they are empty strings', () => {
		const result = buildServiceBusMessage('test', 'string', {
			sessionId: '',
			partitionKey: '',
			replyTo: '',
			replyToSessionId: '',
			to: '',
			scheduledEnqueueTimeUtc: '',
		});
		expect(result.sessionId).toBeUndefined();
		expect(result.partitionKey).toBeUndefined();
		expect(result.replyTo).toBeUndefined();
		expect(result.replyToSessionId).toBeUndefined();
		expect(result.to).toBeUndefined();
		expect(result.scheduledEnqueueTimeUtc).toBeUndefined();
	});

	it('should parse JSON body when sendBodyType is json', () => {
		const result = buildServiceBusMessage('{"key":"value"}', 'json', {});
		expect(result.body).toEqual({ key: 'value' });
	});

	it('should keep string body when sendBodyType is string', () => {
		const result = buildServiceBusMessage('plain text', 'string', {});
		expect(result.body).toBe('plain text');
	});
});

describe('sequenceNumbersFromString', () => {
	it('should parse a single sequence number', () => {
		const result = sequenceNumbersFromString('42');
		expect(result).toHaveLength(1);
		expect(result[0].toString()).toBe('42');
	});

	it('should parse multiple comma-separated sequence numbers', () => {
		const result = sequenceNumbersFromString('1,2,3');
		expect(result).toHaveLength(3);
		expect(result[0].toString()).toBe('1');
		expect(result[1].toString()).toBe('2');
		expect(result[2].toString()).toBe('3');
	});

	it('should trim whitespace around sequence numbers', () => {
		const result = sequenceNumbersFromString(' 10 , 20 , 30 ');
		expect(result).toHaveLength(3);
		expect(result[0].toString()).toBe('10');
		expect(result[1].toString()).toBe('20');
		expect(result[2].toString()).toBe('30');
	});

	it('should skip empty entries from trailing commas', () => {
		const result = sequenceNumbersFromString('5,,10,');
		expect(result).toHaveLength(2);
		expect(result[0].toString()).toBe('5');
		expect(result[1].toString()).toBe('10');
	});

	it('should handle large sequence numbers beyond Number.MAX_SAFE_INTEGER', () => {
		const result = sequenceNumbersFromString('9007199254740993');
		expect(result).toHaveLength(1);
		expect(result[0].toString()).toBe('9007199254740993');
	});
});

describe('longFromString', () => {
	it('should convert a string to Long', () => {
		const result = longFromString('42');
		expect(result.toString()).toBe('42');
	});

	it('should handle large values', () => {
		const result = longFromString('9007199254740993');
		expect(result.toString()).toBe('9007199254740993');
	});
});

describe('sanitizeProperties', () => {
	it('should convert Date fields to ISO strings', () => {
		const input = {
			name: 'test-queue',
			createdAt: new Date('2026-01-01T00:00:00Z'),
			modifiedAt: new Date('2026-01-02T00:00:00Z'),
		};
		const result = sanitizeProperties(input);
		expect(result.name).toBe('test-queue');
		expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
		expect(result.modifiedAt).toBe('2026-01-02T00:00:00.000Z');
	});

	it('should skip properties starting with underscore', () => {
		const input = {
			name: 'test',
			_internalProp: 'hidden',
			_response: { statusCode: 200 },
		};
		const result = sanitizeProperties(input);
		expect(result.name).toBe('test');
		expect(result._internalProp).toBeUndefined();
		expect(result._response).toBeUndefined();
	});

	it('should recursively sanitize nested objects', () => {
		const input = {
			name: 'test',
			nested: {
				createdAt: new Date('2026-01-01T00:00:00Z'),
				_hidden: 'secret',
				value: 42,
			},
		};
		const result = sanitizeProperties(input);
		expect(result.nested).toEqual({
			createdAt: '2026-01-01T00:00:00.000Z',
			value: 42,
		});
	});

	it('should pass through primitive values unchanged', () => {
		const input = {
			name: 'test',
			count: 42,
			enabled: true,
			nothing: null,
		};
		const result = sanitizeProperties(input as Record<string, unknown>);
		expect(result.name).toBe('test');
		expect(result.count).toBe(42);
		expect(result.enabled).toBe(true);
		expect(result.nothing).toBeNull();
	});
});
