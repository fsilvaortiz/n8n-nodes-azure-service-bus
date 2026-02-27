# n8n-nodes-azure-servicebus

[![npm version](https://img.shields.io/npm/v/n8n-nodes-azure-servicebus.svg)](https://www.npmjs.com/package/n8n-nodes-azure-servicebus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An [n8n](https://n8n.io/) community node for [Azure Service Bus](https://azure.microsoft.com/products/service-bus) — send, receive, schedule, peek, batch, and manage queues, topics, and subscriptions with full admin CRUD, dead letter support, and session handling.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Nodes

### Azure Service Bus

Regular node for sending messages and managing Azure Service Bus resources.

#### Queue & Topic Messaging

| Operation | Description |
|-----------|-------------|
| Send | Send a JSON or text message |
| Batch Send | Send multiple messages from input items in a single batch |
| Schedule | Schedule a message for future delivery |
| Cancel Scheduled | Cancel a previously scheduled message by sequence number |
| Peek | Non-destructive read of messages (supports dead-letter sub-queue) |
| Receive Deferred | Receive a deferred message by sequence number |

#### Queue Admin

| Operation | Description |
|-----------|-------------|
| Create | Create a new queue with optional settings |
| Get | Get queue properties |
| List | List all queues in the namespace |
| Update | Update queue settings |
| Delete | Delete a queue |
| Get Runtime Properties | Get message counts, size, and other runtime info |

#### Topic Admin

| Operation | Description |
|-----------|-------------|
| Create | Create a new topic |
| Get | Get topic properties |
| List | List all topics |
| Update | Update topic settings |
| Delete | Delete a topic |
| Get Runtime Properties | Get subscription count and size info |

#### Subscription Admin

| Operation | Description |
|-----------|-------------|
| Create | Create a subscription on a topic |
| Get | Get subscription properties |
| List | List subscriptions for a topic |
| Update | Update subscription settings |
| Delete | Delete a subscription |
| Get Runtime Properties | Get message counts and status |

### Azure Service Bus Trigger

Receives messages from queues or topic subscriptions in real time.

| Feature | Description |
|---------|-------------|
| Entity types | Queue or Topic Subscription |
| Receive modes | Peek Lock, Receive & Delete |
| Settlement actions | Complete, Abandon, Dead-letter, Defer |
| Session support | Session-aware receiving with session ID filter |
| JSON parsing | Automatic body parsing option |
| Concurrency | Configurable max concurrent calls |

## Credentials

You need an Azure Service Bus **connection string** to authenticate.

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to your Service Bus namespace
3. Open **Shared Access Policies**
4. Copy the connection string from your policy (e.g., `RootManageSharedAccessKey`)

The credential is validated on save — if the connection string is invalid you'll get an immediate error.

## Compatibility

- **n8n**: 1.0+
- **Node.js**: 18+
- **Azure Service Bus tiers**: Basic (queues only), Standard, Premium (all features)

> **Note:** Topics, subscriptions, and sessions require Standard or Premium tier.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Azure Service Bus documentation](https://learn.microsoft.com/azure/service-bus-messaging/)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
