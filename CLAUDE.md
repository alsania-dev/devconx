# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Workflow

- **Build**: `make build` or `npm run build`
- **Check**: `make check` (lint + build + tests)
- **Lint**: `make lint` or `npm run lint`
- **Test**: `make test` or `npm test`
- **Single test**: Run `node --test <specific.test.file>` or use your preferred test runner
- **Clean**: `make clean` (removes dist directory)

### Installation
- `make install` or `npm install`

### Extension Development
- Press `F5` in VS Code to launch Extension Development Host
- Use command palette: `DevConX: Launch Control Panel`

## Architecture

### Three-Layer Architecture

DevCon-X follows a three-cooperating layers model:

1. **Adapters Layer** - Integration layer for browser model adapters
   - `HttpBrowserAdapter` - Replicates Nyx browser model adapters using Nyx-compatible HTTP/JSON calls
   - `WebBrowserAdapter` - Drives a VS Code webview for browser-based adapters
   - Both implement shared interface from `src/core/types.js`
   - Instantiated through `AdapterRegistry` from `src/adapters/adapterRegistry.js`

2. **MCP Proxy Layer** - Lightweight WebSocket proxy server
   - Located in `src/backend/proxyServer.js`
   - Accepts prompt dispatches, performs heartbeat broadcasts
   - Delegates requests to adapters and returns responses
   - Isolates VS Code processes from browser automation runtimes
   - Exposes single WebSocket endpoint with structured message format
   - Supports heartbeats for liveness detection

3. **Extension UX Layer** - VS Code extension interface
   - Entry point: `src/extension.js`
   - Control panel: `src/frontend/control-panel/controlPanel.js`
   - Implemented without React to comply with Alsania lightweight requirements
   - Uses native webview with neon Alsania theming

### Key Components

- **src/core/**: Configuration, logging, and shared types
- **src/core/types.js**: Shared adapter interface definitions
- **src/core/config.js**: Configuration validation and normalization
- **src/core/logger.js**: Standardized logging
- **src/adapterRegistry.js**: Adapter lifecycle and capability management
- **src/adapters/**: Two adapter implementations
- **src/backend/proxyServer.js**: WebSocket proxy implementation
- **src/frontend/control-panel/**: VS Code control panel interface

### Data Flow

1. VS Code commands trigger prompts to AdapterRegistry
2. Registry routes to appropriate adapter (HTTP or WebView)
3. Adapters communicate with Nyx Proxy or browser models
4. ProxyServer handles WebSocket communication to control panel
5. Responses flow back through proxy to VS Code client

## Configuration

### Runtime Configuration

- Primary config: `config/devconx.config.json`
- VS Code setting: `devconx.configPath` for relocation
- Adapters defined in config with type-specific properties:
  - HTTP adapters: Nyx-compatible with completionEndpoint
  - Web-based adapters: `webBased: true` with HTTP(s) completionEndpoint
  - Validation pipeline: `normalizeConfiguration` in `src/core/config.js`

### Configuration Validation

All configuration writes pass through:
- `normalizeConfiguration` validation function
- `ConfigLoader.save()` re-runs validation before writing
- Prevents unvetted adapters from loading silently
- Supports API key injection via headers without hardcoding secrets

## Testing

### Test Structure

- Location: `tests/` directory
- Test framework: Node.js native tests (`node --test`)
- Coverage: Configuration, adapters, and proxy layers

### Key Test Files

- `configLoader.test.js`: Configuration loading and validation tests
- `httpBrowserAdapter.test.js`: HTTP adapter communication tests
- `proxyServer.test.js`: WebSocket proxy functionality tests

### Test Execution

- All tests: `make test` or `npm test`
- Individual test: `node --test tests/<specific>.test.js`
- Fast, offline-friendly with built-in Node.js tooling

## Extensibility

### Adding New Adapters

1. Extend `config/devconx.config.json` with new adapter definition
2. No code changes required - configuration-driven approach
3. Adapters automatically register through AdapterRegistry
4. Support for both HTTP and web-view adapter types

### Reuse Opportunities

- `ProxyServer` and `AdapterRegistry` can be reused as standalone Node modules
- For headless deployments
- Control panel assets in `src/frontend/control-panel/`
- Can be themed or internationalized independently

## Security

### Default Configuration

- Proxy binds to localhost only by default
- External exposure requires intentional configuration with TLS termination
- Adapter headers support API key injection
- Secrets managed via environment variables, not hardcoded

### Runtime Guarantees

- Configuration validation prevents malformed configurations
- Heartbeat system maintains liveness detection
- Capability-aware UX based on adapter capabilities
- Strict validation prevents silent security issues