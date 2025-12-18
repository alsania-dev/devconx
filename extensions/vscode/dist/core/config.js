import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** @typedef {import('./types.js').AdapterConfiguration} AdapterConfiguration */
/** @typedef {import('./types.js').DevConConfiguration} DevConConfiguration */

function assertString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message);
  }
}

function assertNumber(value, message) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message);
  }
}

function normalizeAdapter(raw) {
  assertString(raw.id, 'Adapter id is required');
  assertString(raw.displayName, 'Adapter displayName is required');
  assertString(raw.provider, 'Adapter provider is required');
  assertString(raw.baseUrl, 'Adapter baseUrl is required');
  assertString(raw.completionEndpoint, 'Adapter completionEndpoint is required');
  if (!Array.isArray(raw.capabilities) || raw.capabilities.length === 0) {
    throw new Error('Adapter capabilities must be a non-empty array');
  }
  const headers = raw.headers && typeof raw.headers === 'object' ? raw.headers : undefined;
  const timeoutMs = raw.timeoutMs === undefined ? undefined : Number(raw.timeoutMs);
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
    throw new Error('Adapter timeoutMs must be a positive integer when specified');
  }
  return {
    id: String(raw.id),
    displayName: String(raw.displayName),
    provider: String(raw.provider),
    baseUrl: String(raw.baseUrl),
    healthEndpoint: raw.healthEndpoint ? String(raw.healthEndpoint) : undefined,
    completionEndpoint: String(raw.completionEndpoint),
    capabilities: raw.capabilities.map((capability) => String(capability)),
    headers,
    timeoutMs
  };
}

function normalizeConfiguration(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Configuration must be an object');
  }
  const adapters = Array.isArray(raw.adapters) ? raw.adapters.map(normalizeAdapter) : [];
  if (adapters.length === 0) {
    throw new Error('At least one adapter configuration is required');
  }
  if (!raw.proxy || typeof raw.proxy !== 'object') {
    throw new Error('Proxy configuration is required');
  }
  const proxy = {
    port: Number(raw.proxy.port),
    host: String(raw.proxy.host),
    heartbeatIntervalMs: Number(raw.proxy.heartbeatIntervalMs),
    shutdownGracePeriodMs: Number(raw.proxy.shutdownGracePeriodMs)
  };
  assertNumber(proxy.port, 'Proxy port must be a number');
  assertNumber(proxy.heartbeatIntervalMs, 'Proxy heartbeatIntervalMs must be a number');
  assertNumber(proxy.shutdownGracePeriodMs, 'Proxy shutdownGracePeriodMs must be a number');
  assertString(proxy.host, 'Proxy host is required');

  return { adapters, proxy };
}

export class ConfigLoader {
  #resolvedPath;

  constructor(configPath) {
    this.#resolvedPath = path.resolve(configPath);
  }

  /** @returns {Promise<DevConConfiguration>} */
  async load() {
    const raw = await readFile(this.#resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeConfiguration(parsed);
  }

  /** @param {DevConConfiguration} config */
  async save(config) {
    const validated = normalizeConfiguration(config);
    await writeFile(this.#resolvedPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  }

  /** @param {AdapterConfiguration} config */
  static validateAdapter(config) {
    return normalizeAdapter(config);
  }
}
