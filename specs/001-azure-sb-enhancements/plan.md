# Implementation Plan: Azure Service Bus Node — Full SDK Coverage

**Branch**: `001-azure-sb-enhancements`
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Data Model**: [data-model.md](./data-model.md)

## Technical Context

- **Package**: `n8n-nodes-azure-service-bus` (standalone community node, NOT monorepo)
- **Runtime**: TypeScript compiled with tsc, Node.js 22, `@azure/service-bus` v7.9.5
- **Testing**: Jest + jest-mock-extended, 16 existing tests
- **Build**: `tsc && copyfiles "nodes/**/*.svg" dist/`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Safety | Compliant | No `any`, proper types throughout |
| II. Monorepo Discipline | N/A | Standalone package, uses npm |
| III. Test & Quality Gates | Compliant | Jest tests for all new functionality |
| IV. Frontend Standards | N/A | No frontend |
| V. Simplicity & Minimalism | Compliant | Only implementing what the spec requires |

## Key Design Decisions

1. **Version bump**: `version: [1, 2]` — V1 preserves current behavior, V2 adds operation dropdown
2. **contentIsBinary**: Implement (not remove) — Buffer → base64 conversion
3. **File split**: Node descriptions moved to `descriptions/` directory
4. **Peek/ReceiveDeferred**: Under "Message" resource as operations in Send node
5. **Admin operations**: Resources `queueAdmin`, `topicAdmin`, `subscriptionAdmin` in Send node

---

## Phase 1: P1 — Fix Bugs + Missing Properties

### 1.1 Fix sequenceNumber + contentIsBinary + expand parseReceivedMessage

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`

- Change `parseReceivedMessage` signature to accept `contentIsBinary: boolean`
- When `contentIsBinary` is true: convert body to base64
- Change `sequenceNumber` from `Number(...)` to `.toString()`
- Add all missing output fields: `state`, `expiresAtUtc`, `lockedUntilUtc`, `deadLetterSource`, `deadLetterReason`, `deadLetterErrorDescription`, `to`, `replyTo`, `sessionId`, `partitionKey`, `replyToSessionId`, `timeToLive`

### 1.2 Add missing send properties

**File**: `nodes/AzureServiceBus/types.ts`
- Extend `SendOptions`: add `sessionId`, `partitionKey`, `replyTo`, `replyToSessionId`, `to`, `scheduledEnqueueTimeUtc`

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`
- Extend `buildServiceBusMessage()` to handle new properties

**File**: `nodes/AzureServiceBus/AzureServiceBus.node.ts`
- Add new option fields in the `options` collection

### 1.3 Pass contentIsBinary in Trigger

**File**: `nodes/AzureServiceBus/AzureServiceBusTrigger.node.ts`
- Pass `contentIsBinary` from options to `parseReceivedMessage()` calls

### 1.4 Tests

- **Modify**: `test/AzureServiceBusTrigger.test.ts` — sequenceNumber as string, new fields, contentIsBinary
- **Modify**: `test/AzureServiceBus.test.ts` — new send properties
- **Create**: `test/GenericFunctions.test.ts` — unit tests for parseReceivedMessage and buildServiceBusMessage

**Build & test**: `npm run build && npm test`

---

## Phase 2: P2 — Dead-Letter Queue + Scheduled Messages

### 2.1 Dead-letter queue support

**File**: `nodes/AzureServiceBus/types.ts`
- Add `subQueueType` to `TriggerOptions`

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`
- Extend `createReceiver()` to accept and pass `subQueueType` option

**File**: `nodes/AzureServiceBus/AzureServiceBusTrigger.node.ts`
- Add `subQueueType` option to UI (in options collection)
- Pass to `createReceiver()`

### 2.2 Scheduled messages (version bump)

**File**: `nodes/AzureServiceBus/AzureServiceBus.node.ts`
- Add `version: [1, 2]` to description
- Add `operation` parameter (v2 only): send, schedule, cancelScheduled
- Add `scheduledTime` (dateTime, required for schedule)
- Add `sequenceNumber` (string, required for cancelScheduled)
- In `execute()`: check typeVersion, route to operation handlers

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`
- Add `Long` import and helper functions for sequence number conversion
- Add `scheduleMessage()` and `cancelScheduledMessage()` wrappers

**File**: `package.json`
- Add `long` to dependencies if not available transitively

### 2.3 Tests

- DLQ receiver creation tests
- Schedule message tests (mock `sender.scheduleMessages()`)
- Cancel scheduled message tests (mock `sender.cancelScheduledMessages()`)
- V1 backward compatibility tests

**Build & test**: `npm run build && npm test`

---

## Phase 3: P3 — Batch Send, Sessions, Peek

### 3.1 Batch send

**File**: `nodes/AzureServiceBus/AzureServiceBus.node.ts`
- Add `batchSend` operation (v2)
- Implement using `sender.createMessageBatch()` + `tryAddMessage()` with auto-splitting

### 3.2 Session support in Trigger

**File**: `nodes/AzureServiceBus/AzureServiceBusTrigger.node.ts`
- Add `sessionMode` parameter: none, acceptNext, specific
- Add `sessionId` parameter (visible when sessionMode=specific)
- Branch on sessionMode: use `createSessionReceiver()` or `createReceiver()`

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`
- Add `createSessionReceiver()` using `client.acceptSession()` / `client.acceptNextSession()`

### 3.3 Peek messages + Receive deferred

**File**: `nodes/AzureServiceBus/AzureServiceBus.node.ts`
- Add `peek` and `receiveDeferred` operations (v2)
- Peek: creates a receiver, calls `receiver.peekMessages()`
- ReceiveDeferred: creates a receiver, calls `receiver.receiveDeferredMessages()`
- Add `subscriptionName` parameter (visible when resource=topic + operation=peek|receiveDeferred)
- Add `maxMessageCount` and `fromSequenceNumber` for peek
- Add `sequenceNumbers` (comma-separated) for receiveDeferred

### 3.4 Tests

- Batch send with auto-splitting
- Session receiver creation (acceptSession, acceptNextSession)
- Peek messages
- Receive deferred messages

**Build & test**: `npm run build && npm test`

---

## Phase 4: P4 — Defer + Admin Operations

### 4.1 Defer settlement action

**File**: `nodes/AzureServiceBus/AzureServiceBusTrigger.node.ts`
- Add `defer` to settlement action options
- Handle in `settleMessage()` function

### 4.2 Admin operations (file split)

**Create**: `nodes/AzureServiceBus/descriptions/` directory with:
- `index.ts` — re-exports
- `MessageDescription.ts` — message operation fields for v2
- `QueueAdminDescription.ts` — queue CRUD operations + fields
- `TopicAdminDescription.ts` — topic CRUD operations + fields
- `SubscriptionAdminDescription.ts` — subscription CRUD operations + fields

**File**: `nodes/AzureServiceBus/AzureServiceBus.node.ts`
- Add `queueAdmin`, `topicAdmin`, `subscriptionAdmin` resources (v2)
- Import and spread descriptions
- Add execute routing for admin operations

**File**: `nodes/AzureServiceBus/GenericFunctions.ts`
- Add admin operation helpers using `ServiceBusAdministrationClient`
- Sanitize SDK return objects to plain `IDataObject`

### 4.3 Tests

- Defer settlement action
- Admin CRUD operations (mock admin client)

**Build & test**: `npm run build && npm test`

---

## File Summary

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `GenericFunctions.ts` | 1-4 | Fix sequenceNumber, contentIsBinary, new send props, subQueueType, sessions, Long helpers, admin helpers |
| `types.ts` | 1-4 | Extend SendOptions, TriggerOptions, add admin types |
| `AzureServiceBus.node.ts` | 1-4 | Version [1,2], operation param, all new operations, admin routing |
| `AzureServiceBusTrigger.node.ts` | 1-4 | contentIsBinary passthrough, DLQ, sessions, defer |
| `test/AzureServiceBus.test.ts` | 1-4 | New send props, schedule, cancel, peek, deferred, batch, admin |
| `test/AzureServiceBusTrigger.test.ts` | 1-4 | New fields, DLQ, sessions, defer, contentIsBinary |
| `package.json` | 2 | Add `long` dependency if needed |

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `test/GenericFunctions.test.ts` | 1 | Unit tests for helper functions |
| `descriptions/index.ts` | 4 | Re-export descriptions |
| `descriptions/MessageDescription.ts` | 4 | Message operation descriptions |
| `descriptions/QueueAdminDescription.ts` | 4 | Queue admin descriptions |
| `descriptions/TopicAdminDescription.ts` | 4 | Topic admin descriptions |
| `descriptions/SubscriptionAdminDescription.ts` | 4 | Subscription admin descriptions |

## Verification

After each phase:
1. `npm run build` — compiles without errors
2. `npm test` — all tests pass
3. Manual test with n8n: `N8N_CUSTOM_EXTENSIONS=... npx n8n start`

Final verification:
4. Test all 8 user stories against real Azure Service Bus
5. Verify v1 backward compatibility (existing workflows still work)
