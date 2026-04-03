import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** @typedef {import('./types.js').AdapterConfiguration} AdapterConfiguration */
/** @typedef {import('./types.js').DevConConfiguration} DevConConfiguration */

const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_TIMEOUT_MS = 1;

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

function normalizeHeaders(rawHeaders) {
  if (rawHeaders === undefined) {
    return undefined;
  }

  if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) {
    throw new Error('Adapter headers must be an object when specified');
  }

  const headers = Object.fromEntries(
    Object.entries(rawHeaders).map(([key, value]) => {
      assertString(key, 'Adapter header key must be a non-empty string');
      assertString(value, `Adapter header ${key} must be a non-empty string`);
      return [key.trim(), value.trim()];
    })
  );

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeCapabilities(rawCapabilities) {
  if (!Array.isArray(rawCapabilities) || rawCapabilities.length === 0) {
    throw new Error('Adapter capabilities must be a non-empty array');
  }

  const capabilities = rawCapabilities.map((capability) => {
    assertString(capability, 'Adapter capability must be a non-empty string');
    return capability.trim();
  });

  return [...new Set(capabilities)];
}

function normalizeAdapter(raw) {
  assertString(raw.id, 'Adapter id is required');
  assertString(raw.displayName, 'Adapter displayName is required');
  assertString(raw.provider, 'Adapter provider is required');
  assertString(raw.baseUrl, 'Adapter baseUrl is required');
  assertString(raw.completionEndpoint, 'Adapter completionEndpoint is required');

  const timeoutMs = raw.timeoutMs === undefined ? undefined : Number(raw.timeoutMs);
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS)) {
    throw new Error('Adapter timeoutMs must be a positive integer when specified');
  }

  return {
    id: raw.id.trim(),
    displayName: raw.displayName.trim(),
    provider: raw.provider.trim(),
    baseUrl: raw.baseUrl.trim(),
    healthEndpoint: raw.healthEndpoint ? String(raw.healthEndpoint).trim() : undefined,
    completionEndpoint: raw.completionEndpoint.trim(),
    capabilities: normalizeCapabilities(raw.capabilities),
    headers: normalizeHeaders(raw.headers),
    timeoutMs
  };
}

function normalizeProxy(rawProxy) {
  if (!rawProxy || typeof rawProxy !== 'object') {
    throw new Error('Proxy configuration is required');
  }

  assertString(rawProxy.host, 'Proxy host is required');

  const proxy = {
    port: Number(rawProxy.port),
    host: rawProxy.host.trim(),
    heartbeatIntervalMs: Number(rawProxy.heartbeatIntervalMs),
    shutdownGracePeriodMs: Number(rawProxy.shutdownGracePeriodMs)
  };

  assertNumber(proxy.port, 'Proxy port must be a number');
  assertNumber(proxy.heartbeatIntervalMs, 'Proxy heartbeatIntervalMs must be a number');
  assertNumber(proxy.shutdownGracePeriodMs, 'Proxy shutdownGracePeriodMs must be a number');

  if (!Number.isInteger(proxy.port) || proxy.port < MIN_PORT || proxy.port > MAX_PORT) {
    throw new Error(`Proxy port must be an integer between ${MIN_PORT} and ${MAX_PORT}`);
  }

  if (!Number.isInteger(proxy.heartbeatIntervalMs) || proxy.heartbeatIntervalMs < MIN_TIMEOUT_MS) {
    throw new Error('Proxy heartbeatIntervalMs must be a positive integer');
  }

  if (!Number.isInteger(proxy.shutdownGracePeriodMs) || proxy.shutdownGracePeriodMs < 0) {
    throw new Error('Proxy shutdownGracePeriodMs must be a non-negative integer');
  }

  return proxy;
}

function normalizeConfiguration(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Configuration must be an object');
  }

  const adapters = Array.isArray(raw.adapters) ? raw.adapters.map(normalizeAdapter) : [];
  if (adapters.length === 0) {
    throw new Error('At least one adapter configuration is required');
  }

  return {
    adapters,
    proxy: normalizeProxy(raw.proxy)
  };
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
