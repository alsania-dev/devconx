# DevConX Makefile Guide

The provided `Makefile` wraps the npm scripts for consistent local and CI execution. Each target is idempotent and safe to re-run.

## Targets

- `make install` — Install project dependencies. Note: the `postinstall` step installs the `@alsania-io/mcpnyx` CLI globally; if you lack permission, use `npm install --ignore-scripts`.
- `make build` — Copy `src/` into `dist/` for VS Code packaging.
- `make lint` — Perform syntax checks across all JavaScript sources via `node --check`.
- `make test` — Execute the Node.js test suites located in `tests/`.
- `make check` — Run linting, build, and tests sequentially.
- `make clean` — Remove the `dist/` directory.

## Usage

```bash
make install
make check
```

The lint and test steps rely solely on built-in Node.js tooling, keeping the workflow fast and offline-friendly.
