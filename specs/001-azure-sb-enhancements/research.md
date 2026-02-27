# Research: Azure Service Bus Node Enhancements

## Decision 1: contentIsBinary — Implement or Remove?

**Decision**: Implement it.
**Rationale**: The option is already visible in the UI. Removing it is a breaking change for anyone who enabled it. Implementation is straightforward: check if body is a Buffer → convert to base64.
**Alternatives**: Remove it (breaking change, simpler code).

## Decision 2: Node Organization for New Operations

**Decision**: Bump to version 2 (`version: [1, 2]`). V1 preserves current behavior. V2 adds `operation` parameter with resource/operation pattern.
**Rationale**: Adding operations (schedule, cancel, peek, batch, admin CRUD) requires a proper operation dropdown. n8n light versioning preserves backward compatibility.
**Alternatives**: Separate admin node (fragments UX, duplicate credential config), single version with breaking changes (not acceptable).

**V2 resource/operation layout**:
- `message` → send, schedule, cancelScheduled, peek, receiveDeferred, batchSend
- `queueAdmin` → create, get, list, delete, getRuntimeProperties
- `topicAdmin` → create, get, list, delete, getRuntimeProperties
- `subscriptionAdmin` → create, get, list, delete, getRuntimeProperties

## Decision 3: Peek and Receive Deferred UX

**Decision**: Put under "Message" resource as operations in the Send node.
**Rationale**: Users think "I want to do something with messages." Peek/receiveDeferred are message operations even though they read. This follows the pattern of SQS, RabbitMQ nodes.
**Alternatives**: Separate node for read operations (too many nodes), add to Trigger (wrong UX — trigger is event-driven).

## Decision 4: File Organization

**Decision**: Split node descriptions into `descriptions/` directory.
**Rationale**: The node will grow significantly with admin operations. Follows the Azure Storage / Discord node patterns in n8n.

## Decision 5: Long Type for Sequence Numbers

**Decision**: Import `Long` from the `long` package (transitive dependency of `@azure/service-bus`). Add it as explicit dependency in package.json if needed.
**Rationale**: `scheduleMessages()` returns `Long[]` and `cancelScheduledMessages()` takes `Long[]`. Need explicit Long handling.

## Decision 6: Session Receiver Lifetime

**Decision**: For manual trigger mode, accept session and receive one message. For active trigger mode, accept session, subscribe, and handle `SessionLockLost` in processError by logging.
**Rationale**: Session locks expire. The trigger must be resilient. Re-accepting sessions on lock loss is complex and can be added later if needed.
