import { Logger } from '../core/logger.js';

/** @typedef {import('../core/types.js').AdapterConfiguration} AdapterConfiguration */
/** @typedef {import('../core/types.js').BrowserAdapter} BrowserAdapter */
/** @typedef {import('../core/types.js').BrowserModelPrompt} BrowserModelPrompt */
/** @typedef {import('../core/types.js').BrowserModelResponse} BrowserModelResponse */

export class WebBrowserAdapter {
  /**
   * @param {AdapterConfiguration} configuration
   * @param {Logger} logger
   */
  constructor(configuration, logger) {
    this.id = configuration.id;
    this.displayName = configuration.displayName;
    this.provider = configuration.provider;
    this.capabilities = configuration.capabilities;
    this.isWebBased = true;
    this.#webUrl = configuration.baseUrl;
    this.#completionEndpoint = configuration.completionEndpoint; // Chat interface URL
    this.#timeoutMs = configuration.timeoutMs ?? 30000; // Web interfaces are slower
    this.#logger = logger;
    this.#webviewPanel = null;
    this.#messageHandlers = new Map();
  }

  async initialize() {
    this.#logger.info(`Initialized web adapter ${this.displayName} pointing to ${this.#webUrl}`);
  }

  async isHealthy() {
    // For web-based adapters, health check means we can reach the website
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.#webUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      this.#logger.warn(`Health check failed for web adapter ${this.id}`, error);
      return false;
    }
  }

  /** @param {BrowserModelPrompt} prompt */
  async sendPrompt(prompt) {
    // For web-based adapters, this opens/uses a webview panel
    // The actual prompting happens through the UI
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Web adapter ${this.id} timed out after ${this.#timeoutMs}ms`));
      }, this.#timeoutMs);

      // Store resolver for when webview responds
      this.#messageHandlers.set(prompt.conversationId, (response) => {
        clearTimeout(timeout);
        resolve({
          id: response.id,
          text: response.text,
          latencyMs: response.latencyMs,
          usage: response.usage
        });
      });

      // Open or focus webview with the prompt
      this.#openWebView(prompt);
    });
  }

  /**
   * @param {BrowserModelPrompt} prompt
   * @private
   */
  #openWebView(prompt) {
    const vscode = require('vscode');

    if (this.#webviewPanel) {
      this.#webviewPanel.reveal(vscode.ViewColumn.One);
      this.#webviewPanel.webview.postMessage({
        command: 'sendPrompt',
        prompt: prompt.prompt,
        conversationId: prompt.conversationId
      });
      return;
    }

    this.#webviewPanel = vscode.window.createWebviewPanel(
      `devconx.${this.id}`,
      `${this.displayName} - DevConX`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.#webviewPanel.webview.html = this.#getWebviewHtml();

    // Handle messages from webview
    this.#webviewPanel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'response':
          const handler = this.#messageHandlers.get(message.conversationId);
          if (handler) {
            handler(message.response);
            this.#messageHandlers.delete(message.conversationId);
          }
          break;
        case 'error':
          const errorHandler = this.#messageHandlers.get(message.conversationId);
          if (errorHandler) {
            const error = new Error(message.error.message || 'Web adapter failed');
            errorHandler(Promise.reject(error));
            this.#messageHandlers.delete(message.conversationId);
          }
          break;
      }
    });

    // Pre-load the chatgpt.com interface
    this.#webviewPanel.webview.postMessage({
      command: 'loadInterface',
      url: this.#completionEndpoint,
      prompt: prompt.prompt,
      conversationId: prompt.conversationId
    });

    // Clean up when panel closes
    this.#webviewPanel.onDidDispose(() => {
      this.#webviewPanel = null;
      // Reject any pending handlers
      for (const [id, handler] of this.#messageHandlers) {
        handler(Promise.reject(new Error('Webview closed')));
        this.#messageHandlers.delete(id);
      }
    });
  }

  /**
   * @private
   * @returns {string}
   */
  #getWebviewHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.displayName} - DevConX</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }

    .container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .devconx-prompt {
      padding: 10px;
      background: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .prompt-input {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 3px;
      font-size: 13px;
    }

    .prompt-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .send-button {
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }

    .send-button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .webview-frame {
      flex: 1;
      border: none;
      width: 100%;
      background: white;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="devconx-prompt">
      <input type="text" class="prompt-input" placeholder="DevConX prompt..." id="devconx-input">
      <button class="send-button" id="send-button">Send</button>
    </div>
    <div id="loading" class="loading">
      <div>Loading ${this.displayName} interface...</div>
    </div>
    <iframe id="webview-frame" class="webview-frame" style="display: none;"></iframe>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('devconx-input');
    const sendButton = document.getElementById('send-button');
    const loading = document.getElementById('loading');
    const iframe = document.getElementById('webview-frame');

    let currentConversationId = null;

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'loadInterface':
          currentConversationId = message.conversationId;
          input.value = message.prompt;
          iframe.src = message.url;
          iframe.onload = () => {
            loading.style.display = 'none';
            iframe.style.display = 'block';
          };
          break;
        case 'sendPrompt':
          currentConversationId = message.conversationId;
          input.value = message.prompt;
          // Try to auto-submit to the web interface
          submitToWebInterface(message.prompt);
          break;
      }
    });

    sendButton.onclick = () => {
      const prompt = input.value.trim();
      if (prompt && currentConversationId) {
        submitToWebInterface(prompt);
      }
    };

    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        sendButton.click();
      }
    };

    function submitToWebInterface(prompt) {
      // Implementation of prompt submission to web interface
      console.log('Submitting to web interface:', prompt);
      // Placeholder - actual implementation would interact with specific web interface
      vscode.postMessage({
        command: 'response',
        conversationId: currentConversationId,
        response: {
          id: Date.now().toString(),
          text: 'Web interface response - implementation in progress',
          latencyMs: 1000,
          usage: { promptTokens: prompt.length, completionTokens: 50 }
        }
      });
    }
  </script>
</body>
</html>`;
  }

  async dispose() {
    if (this.#webviewPanel) {
      this.#webviewPanel.dispose();
      this.#webviewPanel = null;
    }
    this.#messageHandlers.clear();
    this.#logger.info(`Disposed web adapter ${this.id}`);
  }

  #webUrl;
  #completionEndpoint;
  #timeoutMs;
  #logger;
  #webviewPanel;
  #messageHandlers;
}
