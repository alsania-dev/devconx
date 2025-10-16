import { HttpBrowserAdapter } from './httpBrowserAdapter.js';
import { WebBrowserAdapter } from './webBrowserAdapter.js';
import { Logger } from '../core/logger.js';

/** @typedef {import('../core/types.js').AdapterConfiguration} AdapterConfiguration */
/** @typedef {import('../core/types.js').BrowserAdapter} BrowserAdapter */
/**
 * @typedef {Object} AdapterProvider
 * @property {() => Promise<void>} initialize
 * @property {(id: string) => BrowserAdapter} get
 * @property {() => BrowserAdapter[]} list
 * @property {() => Promise<void>} dispose
 */

export class AdapterRegistry {
  /**
   * @param {readonly AdapterConfiguration[]} configurations
   * @param {Logger} [logger]
   */
  constructor(configurations, logger) {
    this.#configurations = configurations;
    this.#logger = logger ?? new Logger('info');
  }

  async initialize() {
    await Promise.all(
      this.#configurations.map(async (config) => {
        let adapter;
        if (config.webBased === true || config.completionEndpoint?.startsWith('http')) {
          adapter = new WebBrowserAdapter(config, this.#logger);
        } else {
          adapter = new HttpBrowserAdapter(config, this.#logger);
        }
        await adapter.initialize();
        this.#adapters.set(adapter.id, adapter);
      })
    );
  }

  /** @param {string} id */
  get(id) {
    const adapter = this.#adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter with id ${id} is not registered`);
    }
    return adapter;
  }

  list() {
    return [...this.#adapters.values()];
  }

  async dispose() {
    await Promise.all([...this.#adapters.values()].map(async (adapter) => adapter.dispose()));
    this.#adapters.clear();
  }

  #configurations;
  #logger;
  #adapters = new Map();
}
