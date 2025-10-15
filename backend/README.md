# DevConX Backend Services

The backend directory captures standalone services that complement the VS Code extension.

## MCP Proxy

The primary backend shipped with DevConX is the WebSocket MCP proxy implemented in `src/backend/proxyServer.ts`. The proxy can be executed independently:

```bash
npm run build
node dist/backend/proxyServer.js
```

(When running headless, instantiate an `AdapterRegistry` and pass it to the proxy constructor.)

## Additional Services

Future enhancements — such as persistence daemons, audit log sinks, or Nyx automation runners — should live in this directory. Each service must provide:

1. Clear documentation for configuration and deployment.
2. Tests verifying message flow with adapters or downstream consumers.
3. Resource usage notes to maintain compatibility with low-power machines.
