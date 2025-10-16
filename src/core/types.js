/**
 * @typedef {Object} BrowserModelResponse
 * @property {string} id
 * @property {string} text
 * @property {number} latencyMs
 * @property {{promptTokens: number, completionTokens: number}} usage
 */

/**
 * @typedef {Object} BrowserModelPrompt
 * @property {string} conversationId
 * @property {string} prompt
 * @property {Record<string, unknown>=} context
 */

/**
 * @typedef {Object} BrowserAdapter
 * @property {string} id
 * @property {string} displayName
 * @property {string} provider
 * @property {readonly string[]} capabilities
 * @property {boolean=} isWebBased
 * @property {() => Promise<void>} initialize
 * @property {() => Promise<boolean>} isHealthy
 * @property {(prompt: BrowserModelPrompt) => Promise<BrowserModelResponse>} sendPrompt
 * @property {() => Promise<void>} dispose
 */

/**
 * @typedef {Object} AdapterConfiguration
 * @property {string} id
 * @property {string} displayName
 * @property {string} provider
 * @property {string} baseUrl
 * @property {string=} healthEndpoint
 * @property {string} completionEndpoint
 * @property {readonly string[]} capabilities
 * @property {Record<string, string>=} headers
 * @property {number=} timeoutMs
 * @property {boolean=} webBased
 */

/**
 * @typedef {Object} DevConConfiguration
 * @property {readonly AdapterConfiguration[]} adapters
 * @property {{port: number, host: string, heartbeatIntervalMs: number, shutdownGracePeriodMs: number}} proxy
 */

export {};
