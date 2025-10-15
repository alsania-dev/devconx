# DevConX Client Frontend

This directory documents the assets delivered to the DevConX VS Code control panel. The runtime HTML is generated directly inside `src/frontend/control-panel/controlPanel.ts`, but standalone assets and future localisation bundles should live here.

## Assets

- `styles/` — Optional CSS overrides for organisations that extend the base neon theme.
- `scripts/` — Pure JavaScript utilities for enhancing the control panel without introducing heavy frameworks.

## Extending the UI

1. Update `src/frontend/control-panel/controlPanel.ts` to reference static assets via `vscode.Uri.joinPath`.
2. Place the static files in this directory and ensure they are added to the extension `package.json` contributes section if needed.
3. Re-run `npm run build` and reload the extension host.

The control panel is intentionally dependency-free and should remain accessible on low-spec hardware.
