import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { ConfigLoader } from '../src/core/config.js';

const configPath = path.join(process.cwd(), 'config', 'devconx.config.json');

test('ConfigLoader loads configuration and validates structure', async () => {
  const loader = new ConfigLoader(configPath);
  const config = await loader.load();
  assert.equal(config.adapters.length, 4);
  assert.equal(config.proxy.port, 4800);
});

test('ConfigLoader.validateAdapter normalizes capabilities and headers', () => {
  const adapter = ConfigLoader.validateAdapter({
    id: 'adapter-id',
    displayName: 'Adapter Name',
    provider: 'Provider',
    baseUrl: 'http://localhost:8080',
    completionEndpoint: '/api/v1/completions',
    capabilities: ['chat', 'chat', ' browser-automation '],
    headers: {
      Authorization: 'Bearer token'
    },
    timeoutMs: 15000
  });

  assert.deepEqual(adapter.capabilities, ['chat', 'browser-automation']);
  assert.deepEqual(adapter.headers, { Authorization: 'Bearer token' });
});

test('ConfigLoader.validateAdapter rejects invalid header values', () => {
  assert.throws(
    () =>
      ConfigLoader.validateAdapter({
        id: 'adapter-id',
        displayName: 'Adapter Name',
        provider: 'Provider',
        baseUrl: 'http://localhost:8080',
        completionEndpoint: '/api/v1/completions',
        capabilities: ['chat'],
        headers: {
          Authorization: ''
        }
      }),
    /Adapter header Authorization must be a non-empty string/
  );
});
