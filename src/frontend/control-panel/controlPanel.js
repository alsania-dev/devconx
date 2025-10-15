import * as vscode from 'vscode';

/** @typedef {import('../../core/types.js').BrowserAdapter} BrowserAdapter */

export class ControlPanel {
  /**
   * @param {vscode.ExtensionContext} context
   * @param {string} proxyUrl
   * @param {BrowserAdapter[]} adapters
   */
  constructor(context, proxyUrl, adapters) {
    this.#proxyUrl = proxyUrl;
    this.#adapters = adapters;
    void context; // reserved for future use
  }

  open() {
    if (this.#panel) {
      this.#panel.reveal();
      this.#panel.webview.html = this.#renderHtml(this.#panel.webview);
      return;
    }

    this.#panel = vscode.window.createWebviewPanel(
      'devconxControlPanel',
      'DevConX Control Panel',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.#panel.onDidDispose(() => {
      this.#panel = undefined;
    });

    this.#panel.webview.html = this.#renderHtml(this.#panel.webview);
  }

  #renderHtml(webview) {
    const nonce = this.#generateNonce();
    const adapterPayload = JSON.stringify(
      this.#adapters.map((adapter) => ({
        id: adapter.id,
        displayName: adapter.displayName,
        provider: adapter.provider,
        capabilities: adapter.capabilities
      }))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevConX Control Panel</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #04060f; color: #d4ffea; }
    header { background: #071b2c; padding: 16px; border-bottom: 1px solid #0b2d4a; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0.08em; text-transform: uppercase; }
    main { padding: 16px; display: grid; gap: 16px; }
    .adapter { border: 1px solid #0b2d4a; border-radius: 8px; padding: 12px; background: rgba(11, 45, 74, 0.35); }
    .adapter h2 { margin: 0 0 8px; font-size: 16px; color: #7fffd4; }
    .adapter p { margin: 4px 0; font-size: 13px; }
    textarea { width: 100%; min-height: 120px; border-radius: 8px; border: 1px solid #0b2d4a; background: rgba(3, 12, 20, 0.9); color: #d4ffea; padding: 12px; resize: vertical; }
    button { background: linear-gradient(135deg, #0ef0a0, #0770d9); border: none; border-radius: 999px; padding: 10px 18px; color: #02060a; font-weight: 600; cursor: pointer; margin-top: 12px; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .response { background: rgba(9, 30, 45, 0.7); border-radius: 8px; padding: 12px; margin-top: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <header>
    <h1>DevConX Control Panel</h1>
    <p>Connected to proxy: ${this.#proxyUrl}</p>
  </header>
  <main id="adapters"></main>
  <script nonce="${nonce}">
    const adapters = ${adapterPayload};
    const proxyUrl = ${JSON.stringify(this.#proxyUrl)};

    const socket = new WebSocket(proxyUrl);
    const state = new Map();

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'response') {
        const { adapterId, response } = payload.data;
        const entry = state.get(adapterId);
        if (entry) {
          entry.response.textContent = response.text;
          entry.status.textContent = 'Latency: '
            + Math.round(response.latencyMs)
            + 'ms | Usage: prompt '
            + response.usage.promptTokens
            + ', completion '
            + response.usage.completionTokens;
          entry.button.disabled = false;
        }
      }
      if (payload.type === 'error') {
        const { adapterId, message } = payload.data;
        const entry = state.get(adapterId);
        if (entry) {
          entry.response.textContent = 'Error: ' + message;
          entry.button.disabled = false;
        }
      }
    });

    const container = document.getElementById('adapters');
    adapters.forEach((adapter) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'adapter';

      const title = document.createElement('h2');
      title.textContent = adapter.displayName + ' — ' + adapter.provider;
      wrapper.appendChild(title);

      const capability = document.createElement('p');
      capability.textContent = 'Capabilities: ' + adapter.capabilities.join(', ');
      wrapper.appendChild(capability);

      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Enter prompt to send to this adapter';
      wrapper.appendChild(textarea);

      const status = document.createElement('p');
      status.textContent = 'Idle';
      wrapper.appendChild(status);

      const response = document.createElement('div');
      response.className = 'response';
      response.textContent = 'Awaiting prompt...';
      wrapper.appendChild(response);

      const button = document.createElement('button');
      button.textContent = 'Send Prompt';
      button.addEventListener('click', () => {
        if (socket.readyState !== WebSocket.OPEN) {
          status.textContent = 'Socket disconnected';
          return;
        }
        const prompt = textarea.value.trim();
        if (!prompt) {
          status.textContent = 'Prompt cannot be empty';
          return;
        }
        button.disabled = true;
        status.textContent = 'Sending prompt...';
        response.textContent = '';
        socket.send(JSON.stringify({
          adapterId: adapter.id,
          conversationId: crypto.randomUUID(),
          prompt,
          context: { source: 'control-panel' }
        }));
      });
      wrapper.appendChild(button);

      state.set(adapter.id, { response, status, button });
      container.appendChild(wrapper);
    });
  </script>
</body>
</html>`;
  }

  #generateNonce() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
  }

  #panel;
  #proxyUrl;
  #adapters;
}
