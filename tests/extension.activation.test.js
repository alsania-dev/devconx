import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { register } from 'node:module';

// Map the bare `vscode` specifier to the local shim so the built extension can
// be loaded outside a real VS Code host. Must be registered BEFORE the dynamic
// import below (static imports are hoisted and would resolve `vscode` too early).
register(new URL('./helpers/vscode-loader.mjs', import.meta.url).href, import.meta.url);

function connect(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', reject);
  });
}

test('built extension activates, binds the proxy, and deactivates cleanly', async () => {
  const { activate, deactivate } = await import('../dist/extension.js');
  const context = { subscriptions: [] };

  await activate(context);

  assert.ok(Array.isArray(context.subscriptions), 'commands should be registered on the context');
  assert.ok(context.subscriptions.length >= 2, 'expected launch + sendPrompt command registrations');

  // Proxy listens on 127.0.0.1:4800 per config/devconx.config.json
  await connect(4800, '127.0.0.1');

  await deactivate();

  // After deactivate the proxy socket must be closed.
  await assert.rejects(() => connect(4800, '127.0.0.1'));
});
