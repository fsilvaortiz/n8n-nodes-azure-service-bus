# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-02-27

### Added

- **Queue messaging**: send, batch send, schedule, cancel scheduled, peek, receive deferred
- **Topic messaging**: send, batch send, schedule, cancel scheduled, peek (via subscription), receive deferred
- **Queue admin**: create, get, list, update, delete, get runtime properties
- **Topic admin**: create, get, list, update, delete, get runtime properties
- **Subscription admin**: create, get, list, update, delete, get runtime properties
- **Dead letter support**: peek from dead-letter and transfer-dead-letter sub-queues
- **Trigger node**: receive messages from queues and topic subscriptions with configurable settlement (complete, abandon, dead-letter, defer)
- **Session support**: session-aware message receiving in the Trigger node
- Application properties (custom key-value metadata) on sent messages
- Message options: messageId, correlationId, contentType, subject, timeToLive, partitionKey, sessionId
- Credential test on save (validates connection string)
- 79 unit tests
