# n8n-nodes-azure-service-bus

This is an [n8n](https://n8n.io/) community node that lets you send and receive messages from [Azure Service Bus](https://azure.microsoft.com/products/service-bus) queues, topics, and subscriptions.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Nodes

### Azure Service Bus

Send messages to Azure Service Bus queues and topics.

**Features:**
- Send JSON or string messages to queues and topics
- Set custom message properties (content type, correlation ID, subject, TTL)
- Attach application-specific key-value properties

### Azure Service Bus Trigger

Receive messages from Azure Service Bus queues and topic subscriptions.

**Features:**
- Listen for messages on queues or topic subscriptions
- Peek Lock and Receive & Delete receive modes
- Configurable message settlement (complete, abandon, dead-letter)
- JSON body parsing option
- Configurable concurrency

## Credentials

You need an Azure Service Bus **connection string** to authenticate. Find it in the [Azure Portal](https://portal.azure.com/) under your Service Bus namespace > Shared Access Policies.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Azure Service Bus documentation](https://learn.microsoft.com/azure/service-bus-messaging/)

## License

[MIT](LICENSE)
