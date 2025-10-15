import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

import { Logger } from '../core/logger.js';

/** @typedef {import('../adapters/adapterRegistry.js').AdapterProvider} AdapterProvider */

export class ProxyServer {
  /**
   * @param {{port: number, host: string, heartbeatIntervalMs: number, shutdownGracePeriodMs: number}} options
   * @param {AdapterProvider} registry
   * @param {Logger} [logger]
   */
  constructor(options, registry, logger) {
    this.#options = options;
    this.#registry = registry;
    this.#logger = logger ?? new Logger('info');
    this.#httpServer = createServer();
  }

  async start() {
    await this.#registry.initialize();
    this.#clients = new Set();

    this.#httpServer.on('upgrade', (request, socket) => {
      this.#handleUpgrade(request, socket).catch((error) => {
        this.#logger.error('Upgrade failed', error);
        socket.destroy();
      });
    });

    await new Promise((resolve) => {
      this.#httpServer.listen(this.#options.port, this.#options.host, () => {
        this.#logger.info(`Proxy server listening on ${this.#options.host}:${this.#options.port}`);
        resolve();
      });
    });

    this.#heartbeatInterval = setInterval(() => this.#broadcastHeartbeat(), this.#options.heartbeatIntervalMs);
    this.#heartbeatInterval.unref?.();
  }

  getAddress() {
    const address = this.#httpServer.address();
    if (!address || typeof address === 'string') {
      return undefined;
    }
    const host = address.address === '::' ? '127.0.0.1' : address.address;
    return { port: address.port, host };
  }

  async stop() {
    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
    }

    for (const client of this.#clients) {
      client.destroy();
    }
    this.#clients.clear();

    await new Promise((resolve, reject) => {
      this.#httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    await this.#registry.dispose();
  }

  async #handleUpgrade(request, socket) {
    if (request.method !== 'GET' || !request.headers.upgrade || request.headers.upgrade.toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (!key || Array.isArray(key)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = this.#generateAcceptValue(key);
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`
    ];

    socket.write(`${responseHeaders.join('\r\n')}\r\n\r\n`);
    const connectionId = randomUUID();
    this.#clients.add(socket);
    this.#logger.info(`Client connected: ${connectionId}`, { origin: request.headers.origin });

    socket.on('data', (buffer) => {
      this.#handleFrame(socket, buffer).catch((error) => {
        this.#logger.error('Frame handling failed', error);
        socket.destroy();
        this.#clients.delete(socket);
      });
    });

    socket.on('close', () => {
      this.#clients.delete(socket);
      this.#logger.info(`Client disconnected: ${connectionId}`);
    });

    socket.on('error', (error) => {
      this.#logger.error('Socket error', error);
      this.#clients.delete(socket);
    });
  }

  async #handleFrame(socket, buffer) {
    const { opcode, payload } = this.#decodeFrame(buffer);
    if (opcode === 0x8) {
      socket.end();
      this.#clients.delete(socket);
      return;
    }

    if (opcode !== 0x1) {
      return;
    }

    const parsed = JSON.parse(payload.toString());
    const adapter = this.#registry.get(parsed.adapterId);
    const response = await adapter.sendPrompt({
      conversationId: parsed.conversationId,
      prompt: parsed.prompt,
      context: parsed.context
    });

    const reply = JSON.stringify({
      type: 'response',
      data: {
        adapterId: adapter.id,
        response
      }
    });
    socket.write(this.#encodeFrame(reply));
  }

  #broadcastHeartbeat() {
    const payload = JSON.stringify({
      type: 'heartbeat',
      data: {
        timestamp: Date.now(),
        adapters: this.#registry.list().map((adapter) => ({
          id: adapter.id,
          displayName: adapter.displayName,
          provider: adapter.provider,
          capabilities: adapter.capabilities
        }))
      }
    });
    const frame = this.#encodeFrame(payload);
    for (const client of this.#clients) {
      client.write(frame);
    }
  }

  #generateAcceptValue(key) {
    return createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary').digest('base64');
  }

  #decodeFrame(buffer) {
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskingKey;
    if (masked) {
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    const payload = buffer.slice(offset, offset + payloadLength);
    if (masked && maskingKey) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    return { opcode, payload };
  }

  #encodeFrame(data) {
    const payload = Buffer.from(data);
    const length = payload.length;
    let header;

    if (length < 126) {
      header = Buffer.from([0x81, length]);
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    return Buffer.concat([header, payload]);
  }

  #options;
  #registry;
  #logger;
  #httpServer;
  #heartbeatInterval;
  #clients = new Set();
}
