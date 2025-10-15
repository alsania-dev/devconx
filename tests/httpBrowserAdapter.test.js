import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { HttpBrowserAdapter } from '../src/adapters/httpBrowserAdapter.js';
import { Logger } from '../src/core/logger.js';

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400).end();
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200).end('ok');
        return;
      }
      if (req.url === '/api/v1/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const payload = JSON.parse(body);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'test-response',
              text: `echo:${payload.prompt}`,
              prompt_tokens: payload.prompt.length,
              completion_tokens: payload.prompt.length
            })
          );
        });
        return;
      }
      res.writeHead(404).end();
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Server did not bind to an address');
      }
      baseUrl = `http://${address.address}:${address.port}`;
      resolve();
    });
  });
}

test('HttpBrowserAdapter health check and prompt dispatch', async (t) => {
  await startServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
  });

  const adapter = new HttpBrowserAdapter(
    {
      id: 'test',
      displayName: 'Test Adapter',
      provider: 'unit',
      baseUrl,
      healthEndpoint: '/health',
      completionEndpoint: '/api/v1/completions',
      capabilities: ['chat']
    },
    new Logger('error')
  );

  await adapter.initialize();
  assert.equal(await adapter.isHealthy(), true);
  const response = await adapter.sendPrompt({ conversationId: '1', prompt: 'hello' });
  assert.equal(response.text, 'echo:hello');
  assert.equal(response.usage.promptTokens, 5);
});
