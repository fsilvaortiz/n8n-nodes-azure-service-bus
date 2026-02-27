# Data Model: Azure Service Bus Node Enhancements

## ServiceBusMessage (Send)

Properties set by the user when sending:

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| body | unknown | Existing | JSON or string |
| messageId | string | Existing | Optional, auto-generated |
| contentType | string | Existing | |
| correlationId | string | Existing | |
| subject | string | Existing | |
| timeToLive | number (ms) | Existing | UI takes seconds, converted |
| applicationProperties | Record<string, string> | Existing | |
| sessionId | string | **New** | For session-enabled entities |
| partitionKey | string | **New** | For partitioned entities |
| replyTo | string | **New** | Reply address |
| replyToSessionId | string | **New** | Reply session |
| to | string | **New** | Destination routing |
| scheduledEnqueueTimeUtc | Date | **New** | Delayed delivery |

## ServiceBusReceivedMessage (Trigger Output)

Fields output by the trigger when a message is received:

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| body | unknown | Existing | |
| messageId | string | Existing | |
| contentType | string | Existing | |
| correlationId | string | Existing | |
| subject | string | Existing | |
| enqueuedTimeUtc | string (ISO) | Existing | |
| sequenceNumber | string | **Fix** | Was Number (lossy) |
| deliveryCount | number | Existing | |
| applicationProperties | Record | Existing | |
| state | string | **New** | "active", "deferred", "scheduled" |
| expiresAtUtc | string (ISO) | **New** | |
| lockedUntilUtc | string (ISO) | **New** | |
| deadLetterSource | string | **New** | |
| deadLetterReason | string | **New** | |
| deadLetterErrorDescription | string | **New** | |
| to | string | **New** | |
| replyTo | string | **New** | |
| sessionId | string | **New** | |
| partitionKey | string | **New** | |
| replyToSessionId | string | **New** | |
| timeToLive | number | **New** | |

## SendOptions (TypeScript interface)

Extended with new fields:

```
sessionId?, partitionKey?, replyTo?, replyToSessionId?, to?, scheduledEnqueueTimeUtc?
```

## TriggerOptions (TypeScript interface)

Extended with:

```
subQueueType?: 'none' | 'deadLetter' | 'transferDeadLetter'
sessionMode? (not in TriggerOptions — top-level parameter)
```

Settlement actions extended: `'complete' | 'abandon' | 'deadLetter' | 'defer'`

## Admin Entities

### Queue Properties (create/get)
lockDuration, maxSizeInMegabytes, requiresDuplicateDetection, requiresSession, defaultMessageTimeToLive, deadLetteringOnMessageExpiration, maxDeliveryCount, enablePartitioning, enableBatchedOperations

### Topic Properties (create/get)
maxSizeInMegabytes, requiresDuplicateDetection, defaultMessageTimeToLive, enablePartitioning, enableBatchedOperations, supportOrdering

### Subscription Properties (create/get)
lockDuration, defaultMessageTimeToLive, deadLetteringOnMessageExpiration, maxDeliveryCount, enableBatchedOperations, requiresSession

### Runtime Properties (read-only)
activeMessageCount, deadLetterMessageCount, scheduledMessageCount, transferMessageCount, sizeInBytes, createdAt, modifiedAt
