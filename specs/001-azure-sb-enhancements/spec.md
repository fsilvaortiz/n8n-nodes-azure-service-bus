# Feature Specification: Azure Service Bus Node — Full SDK Coverage

**Feature Branch**: `001-azure-sb-enhancements`
**Created**: 2026-02-26
**Status**: Draft
**Input**: Enhance n8n community node for Azure Service Bus with all missing SDK capabilities: fix dead code bug, add missing send properties, scheduled messages, batch send, sessions, peek/defer operations, dead-letter queue reading, and admin management operations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fix contentIsBinary Dead Code & Add Missing Send Properties (Priority: P1)

A workflow builder sends messages to Azure Service Bus and needs to set all standard message properties: `sessionId`, `partitionKey`, `replyTo`, `replyToSessionId`, `to`, and `scheduledEnqueueTimeUtc`. Additionally, the existing `contentIsBinary` trigger option is declared but never implemented — it must either work or be removed.

**Why this priority**: These are low-effort fixes that resolve a bug (dead code) and complete the existing send/receive interfaces with all standard Service Bus message properties.

**Independent Test**: Can be tested by sending a message with all new properties set and verifying them on the received message. The `contentIsBinary` fix can be tested by sending binary data and confirming the trigger handles it correctly.

**Acceptance Scenarios**:

1. **Given** a user configures the Send node with `sessionId`, `partitionKey`, `replyTo`, `replyToSessionId`, `to` properties, **When** the message is sent, **Then** all properties are present on the received message in Azure Service Bus.
2. **Given** a user sets `scheduledEnqueueTimeUtc` on a send message, **When** the message is sent, **Then** it does not appear in the queue until the scheduled time.
3. **Given** the Trigger node has `contentIsBinary` enabled, **When** a binary message arrives, **Then** the message body is returned as base64-encoded binary data.
4. **Given** a received message, **When** it is output by the Trigger, **Then** the output includes all available fields: `state`, `expiresAtUtc`, `lockedUntilUtc`, `deadLetterSource`, `deadLetterReason`, `deadLetterErrorDescription`, `to`, `replyTo`, `sessionId`, `partitionKey`, `replyToSessionId`, `timeToLive`.
5. **Given** a message with a large sequence number, **When** received by the Trigger, **Then** the `sequenceNumber` is returned as a string to prevent precision loss.

---

### User Story 2 — Read from Dead-Letter Queue (Priority: P2)

A workflow builder needs to inspect and process messages that ended up in the dead-letter queue for debugging or reprocessing failed messages.

**Why this priority**: Dead-letter queue access is one of the most commonly needed Service Bus operations for production troubleshooting and message recovery.

**Independent Test**: Can be tested by dead-lettering a message, then configuring the Trigger to read from the dead-letter sub-queue and confirming the message (including `deadLetterReason`) is received.

**Acceptance Scenarios**:

1. **Given** a Trigger node configured with "Dead Letter" sub-queue option, **When** a message exists in the dead-letter queue, **Then** the trigger receives it with `deadLetterReason` and `deadLetterErrorDescription` fields.
2. **Given** a Trigger node configured with "Transfer Dead Letter" sub-queue option, **When** a message exists in the transfer dead-letter queue, **Then** the trigger receives it.

---

### User Story 3 — Scheduled Messages (Priority: P2)

A workflow builder needs to schedule messages for future delivery — for example, sending a reminder 24 hours from now — and optionally cancel previously scheduled messages.

**Why this priority**: Scheduled delivery is a core Service Bus capability frequently used in business workflows (reminders, delayed processing, time-based triggers).

**Independent Test**: Can be tested by scheduling a message 60 seconds in the future, confirming it does not appear immediately, then verifying it arrives after the scheduled time.

**Acceptance Scenarios**:

1. **Given** a user selects "Schedule Message" operation in the Send node, **When** a future datetime and message are provided, **Then** the message is scheduled and a sequence number is returned.
2. **Given** a user selects "Cancel Scheduled Message" operation, **When** a valid sequence number is provided, **Then** the scheduled message is cancelled.
3. **Given** an invalid or already-delivered sequence number, **When** cancel is attempted, **Then** an appropriate error message is shown.

---

### User Story 4 — Batch Send (Priority: P3)

A workflow builder processing many items wants to send them as a single batch for better throughput, respecting Azure Service Bus size limits.

**Why this priority**: Batch sending improves throughput and reduces costs for high-volume workflows. Less critical than individual features but important for production use.

**Independent Test**: Can be tested by sending 10 items through the node with batch mode enabled and verifying all arrive as separate messages in the queue.

**Acceptance Scenarios**:

1. **Given** a user enables "Batch Send" option and provides multiple input items, **When** the node executes, **Then** all items are sent in a single batch operation.
2. **Given** batch items exceed the Azure Service Bus message size limit, **When** the node executes, **Then** items are automatically split into multiple batches.
3. **Given** one message in a batch fails validation, **When** the node executes, **Then** an appropriate error is returned identifying the problematic item.

---

### User Story 5 — Session Support (Priority: P3)

A workflow builder uses session-enabled queues for ordered message processing and needs the Trigger to accept sessions and manage session state.

**Why this priority**: Sessions are important for ordered processing scenarios but only apply to users who have explicitly enabled sessions on their Service Bus entities.

**Independent Test**: Can be tested by sending messages with a `sessionId` to a session-enabled queue, then configuring the Trigger with session support and verifying messages arrive in session order.

**Acceptance Scenarios**:

1. **Given** a session-enabled queue and a Trigger configured with session support, **When** messages arrive with a specific `sessionId`, **Then** the Trigger receives them in order.
2. **Given** a Trigger with "Accept Next Session" mode, **When** messages are available in any session, **Then** the Trigger automatically picks up the next available session.
3. **Given** a Trigger with a specific session ID configured, **When** messages arrive for that session, **Then** only messages for that session are received.

---

### User Story 6 — Peek Messages (Priority: P3)

A workflow builder wants to inspect messages in a queue without removing them — for monitoring, auditing, or conditional processing.

**Why this priority**: Peek is useful for monitoring and auditing but not required for core send/receive workflows.

**Independent Test**: Can be tested by sending a message, peeking it (confirming it's returned), then receiving it normally (confirming it's still there after peek).

**Acceptance Scenarios**:

1. **Given** a user selects "Peek Messages" operation in a new action, **When** messages exist in the queue, **Then** messages are returned without being removed.
2. **Given** a user specifies a max message count, **When** peek is executed, **Then** at most that many messages are returned.
3. **Given** a user specifies a `fromSequenceNumber`, **When** peek is executed, **Then** messages starting from that sequence number are returned.

---

### User Story 7 — Defer Settlement Action (Priority: P4)

A workflow builder using Peek Lock mode wants to defer a message for later processing, then retrieve it by sequence number when ready.

**Why this priority**: Defer is a specialized settlement action used in advanced message processing patterns. Lower priority than standard settlement actions already implemented.

**Independent Test**: Can be tested by receiving a message, deferring it, then retrieving it by sequence number using a separate operation.

**Acceptance Scenarios**:

1. **Given** a Trigger in Peek Lock mode with settlement action set to "Defer", **When** the workflow succeeds, **Then** the message is deferred and its sequence number is available in the output.
2. **Given** a deferred message sequence number, **When** a "Receive Deferred Messages" operation is executed, **Then** the deferred message is returned.

---

### User Story 8 — Queue/Topic/Subscription Management (Priority: P4)

An advanced user wants to manage Azure Service Bus entities directly from n8n — creating, listing, and deleting queues, topics, and subscriptions.

**Why this priority**: Admin operations are useful for infrastructure automation but most users configure entities outside n8n. This is a convenience feature.

**Independent Test**: Can be tested by creating a queue, listing queues (confirming it appears), getting its properties, then deleting it and confirming removal.

**Acceptance Scenarios**:

1. **Given** a user selects "Queue" resource with "Create" operation, **When** a queue name is provided, **Then** the queue is created in Azure Service Bus.
2. **Given** a user selects "Queue" resource with "List" operation, **When** executed, **Then** all queues are returned with their properties.
3. **Given** a user selects "Queue" resource with "Delete" operation, **When** an existing queue name is provided, **Then** the queue is deleted.
4. **Given** a user selects "Topic" or "Subscription" resource, **When** CRUD operations are performed, **Then** they behave equivalently to queue operations.
5. **Given** a user selects "Get Runtime Properties" operation for a queue, **When** executed, **Then** message counts, sizes, and other runtime metrics are returned.

---

### Edge Cases

- What happens when sending to a session-enabled queue without providing a `sessionId`? → Azure Service Bus rejects the message; the node should surface a clear error.
- What happens when batch items exceed max batch size? → Node should split into multiple batches automatically.
- What happens when peeking an empty queue? → Return empty result set, not an error.
- What happens when cancelling an already-delivered scheduled message? → Azure returns silently; the node should indicate no action was taken.
- What happens when trying to read from dead-letter queue of a non-existent entity? → Surface the Azure error with context.
- What happens when accepting a session on a non-session-enabled queue? → Surface a clear error message.
- What happens when `sequenceNumber` exceeds JavaScript Number.MAX_SAFE_INTEGER? → Return as string to preserve precision.

## Requirements *(mandatory)*

### Functional Requirements

**Bug fixes:**
- **FR-001**: System MUST either implement `contentIsBinary` option in the Trigger (returning binary message body as base64) or remove it from the UI if not applicable.
- **FR-002**: System MUST return `sequenceNumber` as a string (not a JavaScript Number) to prevent precision loss for large 64-bit values.

**Missing send properties:**
- **FR-003**: Send node MUST expose `sessionId`, `partitionKey`, `replyTo`, `replyToSessionId`, and `to` as optional message properties.
- **FR-004**: Send node MUST expose `scheduledEnqueueTimeUtc` as an optional datetime property on individual messages.

**Missing received message fields:**
- **FR-005**: Trigger node MUST include all available received message fields in its output: `state`, `expiresAtUtc`, `lockedUntilUtc`, `deadLetterSource`, `deadLetterReason`, `deadLetterErrorDescription`, `to`, `replyTo`, `sessionId`, `partitionKey`, `replyToSessionId`, `timeToLive`.

**Dead-letter queue:**
- **FR-006**: Trigger node MUST support receiving messages from the dead-letter sub-queue via a `subQueueType` option ("None", "Dead Letter", "Transfer Dead Letter").

**Scheduled messages:**
- **FR-007**: Send node MUST support a "Schedule Message" operation that accepts a future datetime and returns the scheduled sequence number.
- **FR-008**: Send node MUST support a "Cancel Scheduled Message" operation that accepts a sequence number.

**Batch send:**
- **FR-009**: Send node MUST support a "Batch Send" option that groups all input items into message batches respecting Azure Service Bus size limits.

**Session support:**
- **FR-010**: Trigger node MUST support session-enabled queues and subscriptions with options for specific session ID or "accept next session".
- **FR-011**: Trigger node MUST expose session state management (get/set session state) when in session mode.

**Peek messages:**
- **FR-012**: Send node (or a separate operation) MUST support peeking messages from a queue or subscription without removing them.

**Defer:**
- **FR-013**: Trigger node MUST support "Defer" as a settlement action in Peek Lock mode.
- **FR-014**: System MUST support receiving deferred messages by sequence number.

**Admin operations:**
- **FR-015**: System MUST support Create, Get, List, Delete operations for queues.
- **FR-016**: System MUST support Create, Get, List, Delete operations for topics.
- **FR-017**: System MUST support Create, Get, List, Delete operations for subscriptions.
- **FR-018**: System MUST support Get Runtime Properties for queues, topics, and subscriptions (message counts, sizes, etc.).

### Key Entities

- **Message**: The core unit of communication — has a body, system properties (messageId, sequenceNumber, etc.), and user-defined application properties.
- **Queue**: A first-in-first-out message store with optional sessions, dead-letter sub-queue, and configurable TTL/lock duration.
- **Topic**: A publish-subscribe message distribution point that fans out to subscriptions.
- **Subscription**: A virtual queue attached to a topic that receives a copy of each published message (optionally filtered by rules).
- **Session**: A grouping mechanism for ordered message processing, identified by a `sessionId`.
- **Dead-Letter Queue**: A secondary sub-queue that holds messages that could not be delivered or processed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All standard Azure Service Bus message properties are available when sending and visible when receiving — no SDK property is inaccessible from the node.
- **SC-002**: Users can read from dead-letter queues and see the reason a message was dead-lettered.
- **SC-003**: Users can schedule messages for future delivery and cancel them before delivery.
- **SC-004**: Users can send multiple messages in a single batch operation with automatic size-limit handling.
- **SC-005**: Users can receive messages from session-enabled queues in session order.
- **SC-006**: Users can peek messages without removing them from the queue.
- **SC-007**: Users can manage (create, list, get, delete) queues, topics, and subscriptions directly from n8n.
- **SC-008**: All new functionality has unit test coverage.
- **SC-009**: All 8 user stories pass acceptance scenarios when tested against a real Azure Service Bus instance.
