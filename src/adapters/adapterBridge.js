/**
 * DevCon Adapter Bridge
 * Connects the VSCode extension to the Python backend adapter
 */

import { EventEmitter } from 'events';
import { Logger } from '../core/logger.js';

/**
 * @typedef {Object} AdapterConfig
 * @property {string} backendUrl - URL of the backend adapter
 * @property {string} backendWs - WebSocket URL of the backend adapter
 * @property {string} mcpUrl - MCP server URL
 * @property {string} model - Model name to use
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} text - The response text
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} prompt - The user prompt
 * @property {string} [sessionId] - Optional session ID
 */

export class AdapterBridge extends EventEmitter {
  /**
   * @param {AdapterConfig} config
   * @param {Logger} [logger]
   */
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || new Logger('info');
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.messageQueue = [];
    this.pendingRequests = new Map();
  }

  /**
   * Initialize the adapter bridge
   */
  async initialize() {
    this.logger.info('Initializing AdapterBridge');
    await this.connectWebSocket();
    return this;
  }

  /**
   * Connect to the backend adapter WebSocket
   */
  async connectWebSocket() {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.config.backendWs;
        this.logger.info(`Connecting to WebSocket: ${wsUrl}`);

        // Use Node.js WebSocket if available, otherwise fallback to browser
        const WebSocket = typeof window !== 'undefined' 
          ? window.WebSocket 
          : require('ws');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.logger.info('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.flushQueue();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = typeof event.data === 'string' 
              ? JSON.parse(event.data) 
              : event.data;
            this.handleMessage(data);
          } catch (err) {
            this.logger.error('Error parsing WebSocket message:', err);
          }
        };

        this.ws.onerror = (error) => {
          this.logger.error('WebSocket error:', error);
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          this.logger.warn('WebSocket closed');
          this.isConnected = false;
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (err) {
        this.logger.error('WebSocket connection failed:', err);
        reject(err);
      }
    });
  }

  /**
   * Attempt to reconnect WebSocket
   */
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      this.emit('connection_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (err) {
        this.logger.error('Reconnect attempt failed:', err);
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    // Handle token streaming
    if (data.type === 'token') {
      this.emit('token', data.content);
      return;
    }

    // Handle final response
    if (data.type === 'final') {
      this.emit('final', data.text);
      return;
    }

    // Handle other message types
    this.emit('message', data);
  }

  /**
   * Flush queued messages after connection is established
   */
  flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.send(msg);
    }
  }

  /**
   * Send a message via WebSocket
   */
  send(data) {
    if (!this.isConnected || !this.ws) {
      this.messageQueue.push(data);
      this.logger.warn('WebSocket not connected, queued message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
    } catch (err) {
      this.logger.error('Send failed:', err);
    }
  }

  /**
   * Send a chat message
   * @param {string} prompt
   * @param {string} [sessionId]
   * @returns {Promise<string>}
   */
  async chat(prompt, sessionId = null) {
    this.logger.info(`Sending chat: ${prompt.substring(0, 50)}...`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Chat request timed out'));
      }, 60000);

      const handleFinal = (text) => {
        clearTimeout(timeout);
        this.removeListener('token', handleToken);
        this.removeListener('final', handleFinal);
        this.removeListener('error', handleError);
        resolve(text);
      };

      const handleToken = (token) => {
        // Tokens are emitted for streaming
        this.emit('stream_token', token);
      };

      const handleError = (error) => {
        clearTimeout(timeout);
        this.removeListener('token', handleToken);
        this.removeListener('final', handleFinal);
        this.removeListener('error', handleError);
        reject(error);
      };

      this.once('final', handleFinal);
      this.on('token', handleToken);
      this.once('error', handleError);

      const message = {
        type: 'chat',
        prompt: prompt,
        sessionId: sessionId || this.sessionId,
      };

      this.send(message);
    });
  }

  /**
   * Get the backend adapter identity
   */
  async getIdentity() {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/echo/identity`);
      return await response.json();
    } catch (err) {
      this.logger.error('Failed to get identity:', err);
      return null;
    }
  }

  /**
   * HTTP fallback chat (when WebSocket is not available)
   */
  async chatHttp(prompt, sessionId = null) {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/echo/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          sessionId: sessionId || this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || data;
    } catch (err) {
      this.logger.error('HTTP chat failed:', err);
      throw err;
    }
  }

  /**
   * Dispose the adapter bridge
   */
  async dispose() {
    this.logger.info('Disposing AdapterBridge');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageQueue = [];
    this.pendingRequests.clear();
    this.removeAllListeners();
  }

  /**
   * Check if the adapter is connected
   */
  isReady() {
    return this.isConnected;
  }
}

/**
 * Create a new AdapterBridge instance
 * @param {AdapterConfig} config
 * @param {Logger} [logger]
 * @returns {AdapterBridge}
 */
export function createAdapterBridge(config, logger) {
  return new AdapterBridge(config, logger);
}
