import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

import { ProxyServer } from '../src/backend/proxyServer.js';
import { Logger } from '../src/core/logger.js';

class MemoryAdapter {
  constructor(id) {
    this.id = id;
    this.displayName = `Memory Adapter ${id}`;
    this.provider = 'stub';
    this.capabilities = ['chat'];
  }

  async initialize() {}

  async isHealthy() {
    return true;
  }

  async sendPrompt(prompt) {
    return {
      id: `${this.id}-${prompt.conversationId}`,
      text: `processed:${prompt.prompt}`,
      latencyMs: 5,
      usage: { promptTokens: prompt.prompt.length, completionTokens: prompt.prompt.length }
    };
  }

  async dispose() {}
}

class StubRegistry {
  constructor(adapters) {
    this.adapters = adapters;
  }

  async initialize() {}

  get(id) {
    const adapter = this.adapters.find((item) => item.id === id);
    if (!adapter) {
      throw new Error(`Adapter ${id} missing`);
    }
    return adapter;
  }

  list() {
    return [...this.adapters];
  }

  async dispose() {}
}

function encodeClientFrame(data) {
  const payload = Buffer.from(data);
  const mask = randomBytes(4);
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x81, 0x80 | length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  const maskedPayload = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    maskedPayload[i] = payload[i] ^ mask[i % 4];
  }

  return Buffer.concat([header, mask, maskedPayload]);
}

function decodeServerFrame(buffer) {
  const firstByte = buffer[0];
  const opcode = firstByte & 0x0f;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const payload = buffer.slice(offset, offset + length);
  return { opcode, payload };
}

test('ProxyServer routes prompts through WebSocket frames', async (t) => {
  const registry = new StubRegistry([new MemoryAdapter('mem')]);
  const proxy = new ProxyServer(
    { port: 0, host: '127.0.0.1', heartbeatIntervalMs: 100, shutdownGracePeriodMs: 100 },
    registry,
    new Logger('error')
  );

  await proxy.start();
  t.after(async () => {
    await proxy.stop();
  });

  const address = proxy.getAddress();
  assert.ok(address);

  const socket = net.createConnection(address.port, address.host);
  t.after(() => socket.destroy());

  const key = randomBytes(16).toString('base64');
  const handshake = [
    'GET / HTTP/1.1',
    `Host: ${address.host}:${address.port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '\r\n'
  ].join('\r\n');
  socket.write(handshake);

  await new Promise((resolve, reject) => {
    socket.once('data', (buffer) => {
      if (buffer.toString().includes('101 Switching Protocols')) {
        resolve();
      } else {
        reject(new Error('Handshake failed'));
      }
    });
    socket.once('error', reject);
  });

  const request = encodeClientFrame(
    JSON.stringify({
      adapterId: 'mem',
      conversationId: 'conv-1',
      prompt: 'ping'
    })
  );
  socket.write(request);

  const response = await new Promise((resolve, reject) => {
    const onData = (buffer) => {
      const { opcode, payload } = decodeServerFrame(buffer);
      if (opcode === 0x1) {
        socket.off('data', onData);
        resolve(payload.toString());
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });

  const parsed = JSON.parse(response);
  assert.equal(parsed.type, 'response');
  assert.equal(parsed.data.adapterId, 'mem');
  assert.equal(parsed.data.response.text, 'processed:ping');
});
