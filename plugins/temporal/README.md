# Temporal Frontend Plugin

Streams, run diagrams, and catalog entity views for Backstage.

## Installation

```bash
yarn add @acarmisc/backstage-plugin-temporal
```

or

```bash
npm install @acarmisc/backstage-plugin-temporal
```

## Configuration

### Backend Configuration

Add the plugin to your backend `app-config.yaml`:

```yaml
plugins:
  register:
    - '@acarmisc/backstage-plugin-temporal-backend'
```

Configure Temporal clusters in `app-config.yaml`:

```yaml
temporal:
  clusters:
    - name: default
      address: localhost:7233
      namespaces:
        - default
      tls:
        enabled: false
      apiKey: ${TEMPORAL_API_KEY}
      streamPrefix: stream/
      workflowTypes:
        - StreamWorkflow
      cache:
        ttlSeconds: 300
```

### Frontend Configuration

Add the plugin to your frontend `app-config.yaml`:

```yaml
plugins:
  register:
    - '@acarmisc/backstage-plugin-temporal'
```

## RBAC & Permissions

The plugin provides two fine-grained permissions that can be configured via Backstage's permission system:

### Permissions

| Permission | Description |
|------------|-------------|
| `temporal.read` | List clusters, health, streams, and workflow definitions |
| `temporal.run.read` | Read run details including task output (tails) and parameters |

### Default Behavior

Both permissions are **required** by default. All backend API routes enforce authentication via `temporal.read`.

### Making Permissions Optional

If you want to disable permission checks (e.g., for internal/troubleshooting purposes), configure the plugin with:

```yaml
temporal:
  permissions:
    enabled: false
```

When `permissions.enabled: false`, all routes will bypass RBAC checks.

### Custom Permission Names

Override the default permission names:

```yaml
temporal:
  permissions:
    read: my-custom.read
    runRead: my-custom.run.read
```

## Entity Integration

The plugin adds Temporal stream information to Backstage entities via annotations:

```yaml
metadata:
  annotations:
    temporal.io/cluster: "my-cluster"
    temporal.io/namespace: "my-namespace"
    temporal.io/stream: "my-stream"
    temporal.io/definition-location: "path/to/workflow.yaml"
```

### Entity Tab

The `TemporalTab` appears on entities that have the `temporal.io/stream` annotation. It displays:
- Stream name and latest run status
- Freshness badge (last success time)
- Link to all runs

### Entity Card

The `TemporalCard` shows an overview on the entity sidebar:
- Stream name
- Latest run status
- Freshness badge
- Open link to all runs

## Development

### Local Development

```bash
# Start the development server
yarn start

# Or run specific packages
yarn build
yarn test
yarn lint
```

### Adding New Features

1. Add types/handlers in `plugins/temporal-common/src/`
2. Add backend routes in `plugins/temporal-backend/src/router.ts`
3. Add frontend components in `plugins/temporal/src/components/`
4. Export from `plugins/temporal/src/index.ts`
5. Update `plugins/temporal/plugin.tsx` with new route extensions