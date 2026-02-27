# Contributing

Thanks for your interest in contributing to this project! Here's how to get started.

## Development Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/fsilvaortiz/n8n-nodes-azure-service-bus.git
   cd n8n-nodes-azure-service-bus
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build**

   ```bash
   npm run build
   ```

4. **Run tests**

   ```bash
   npm test
   ```

5. **Link to local n8n for manual testing**

   ```bash
   npm link
   cd ~/.n8n/nodes
   npm link n8n-nodes-azure-servicebus
   ```

   Then restart n8n to pick up the linked node.

## Project Structure

```
credentials/          Credential definitions
nodes/AzureServiceBus/
  AzureServiceBus.node.ts       Regular node (send, peek, admin, etc.)
  AzureServiceBusTrigger.node.ts  Trigger node (receive messages)
  GenericFunctions.ts             Shared helpers
  types.ts                        TypeScript interfaces
  descriptions/                   Admin operation field definitions
  test/                           Unit tests (Jest)
```

## Making Changes

1. Create a branch from `main`:

   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes and add tests.

3. Ensure everything passes:

   ```bash
   npm run build
   npm test
   ```

4. Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat: add support for message sessions
   fix: handle empty queue gracefully
   docs: update README with new operations
   ```

5. Push and open a Pull Request against `main`.

## Pull Request Guidelines

- Keep PRs focused on a single change.
- Include tests for new functionality.
- Update the README if you add new operations or change behavior.
- Ensure the build and tests pass before requesting review.

## Reporting Bugs

Use the [bug report template](https://github.com/fsilvaortiz/n8n-nodes-azure-service-bus/issues/new?template=bug_report.md) and include:

- n8n version
- Node version
- Steps to reproduce
- Expected vs actual behavior

## Requesting Features

Use the [feature request template](https://github.com/fsilvaortiz/n8n-nodes-azure-service-bus/issues/new?template=feature_request.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
