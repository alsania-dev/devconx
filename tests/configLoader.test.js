import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { ConfigLoader } from '../src/core/config.js';

const configPath = path.join(process.cwd(), 'config', 'devconx.config.json');

test('ConfigLoader loads configuration and validates structure', async () => {
  const loader = new ConfigLoader(configPath);
  const config = await loader.load();
  assert.equal(config.adapters.length, 4); // Updated for web adapters
  assert.equal(config.proxy.port, 4800);
});
