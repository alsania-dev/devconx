import { Logger } from '../core/logger.js';

/** @typedef {import('../core/types.js').AdapterConfiguration} AdapterConfiguration */
/** @typedef {import('../core/types.js').BrowserAdapter} BrowserAdapter */
/** @typedef {import('../core/types.js').BrowserModelPrompt} BrowserModelPrompt */
/** @typedef {import('../core/types.js').BrowserModelResponse} BrowserModelResponse */

export class HttpBrowserAdapter {
  /**
   * @param {AdapterConfiguration} configuration
   * @param {Logger} logger
   */
  constructor(configuration, logger) {
    this.id = configuration.id;
    this.displayName = configuration.displayName;
    this.provider = configuration.provider;
    this.capabilities = configuration.capabilities;
    this.#baseUrl = configuration.baseUrl.replace(/\/?$/, '');
    this.#healthEndpoint = configuration.healthEndpoint;
    this.#completionEndpoint = configuration.completionEndpoint;
    this.#headers = configuration.headers ?? {};
    this.#timeoutMs = configuration.timeoutMs ?? 15000;
    this.#logger = logger;
  }

  async initialize() {
    this.#logger.info(`Initialized HTTP adapter ${this.displayName}`);
  }

  async isHealthy() {
    if (!this.#healthEndpoint) {
      return true;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
      const response = await fetch(`${this.#baseUrl}${this.#healthEndpoint}`, {
        method: 'GET',
        headers: this.#headers,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      this.#logger.warn(`Health check failed for adapter ${this.id}`, error);
      return false;
    }
  }

  /** @param {BrowserModelPrompt} prompt */
  async sendPrompt(prompt) {
    const body = {
      conversation_id: prompt.conversationId,
      prompt: prompt.prompt,
      context: prompt.context
    };

    const url = `${this.#baseUrl}${this.#completionEndpoint}`;
    this.#logger.debug(`Dispatching prompt via ${this.id}`, { url });

    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.#headers },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Adapter ${this.id} responded with ${response.status}: ${text}`);
      }

      const result = await response.json();
      const latencyMs = performance.now() - start;
      return {
        id: result.id,
        text: result.text,
        latencyMs,
        usage: {
          promptTokens: result.prompt_tokens,
          completionTokens: result.completion_tokens
        }
      };
    } catch (error) {
      clearTimeout(timeout);
      this.#logger.error(`Prompt dispatch failed for adapter ${this.id}`, error);
      throw error;
    }
  }

  async dispose() {
    this.#logger.info(`Disposing adapter ${this.id}`);
  }

  #baseUrl;
  #healthEndpoint;
  #completionEndpoint;
  #headers;
  #timeoutMs;
  #logger;
}
