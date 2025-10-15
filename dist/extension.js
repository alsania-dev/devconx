import { randomUUID } from 'node:crypto';
import path from 'node:path';

import * as vscode from 'vscode';

import { AdapterRegistry } from './adapters/adapterRegistry.js';
import { ProxyServer } from './backend/proxyServer.js';
import { ConfigLoader } from './core/config.js';
import { Logger } from './core/logger.js';
import { ControlPanel } from './frontend/control-panel/controlPanel.js';

let proxyServer;
let registry;
let controlPanel;
let logger;

/** @param {vscode.ExtensionContext} context */
export async function activate(context) {
  logger = new Logger('info');
  try {
    const configuration = await loadConfiguration();
    registry = new AdapterRegistry(configuration.adapters, logger);
    await registry.initialize();

    proxyServer = new ProxyServer(configuration.proxy, registry, logger);
    await proxyServer.start();

    const address = proxyServer.getAddress();
    const proxyUrl = address ? `ws://${address.host}:${address.port}` : `ws://${configuration.proxy.host}:${configuration.proxy.port}`;
    controlPanel = new ControlPanel(context, proxyUrl, registry.list());

    context.subscriptions.push(
      vscode.commands.registerCommand('devconx.launchControlPanel', () => {
        controlPanel?.open();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('devconx.sendPrompt', async () => {
        if (!registry) {
          void vscode.window.showErrorMessage('DevConX adapters are not ready yet.');
          return;
        }

        const picks = registry.list().map((adapter) => ({
          label: adapter.displayName,
          description: adapter.provider,
          adapterId: adapter.id
        }));

        const adapterPick = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select a browser model adapter'
        });

        if (!adapterPick) {
          return;
        }

        const prompt = await vscode.window.showInputBox({
          prompt: `Prompt for ${adapterPick.label}`,
          placeHolder: 'Ask anything...'
        });

        if (!prompt) {
          return;
        }

        const adapter = registry.get(adapterPick.adapterId);
        const status = vscode.window.setStatusBarMessage(`DevConX · dispatching via ${adapter.displayName}...`);
        try {
          const response = await adapter.sendPrompt({
            conversationId: randomUUID(),
            prompt,
            context: { source: 'commandPalette' }
          });
          await vscode.window.showInformationMessage(
            `${adapter.displayName} responded in ${Math.round(response.latencyMs)}ms`,
            { modal: true, detail: response.text }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          void vscode.window.showErrorMessage(`Prompt failed: ${message}`);
        } finally {
          status.dispose();
        }
      })
    );

    context.subscriptions.push({
      dispose: () => {
        void deactivate();
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown activation error';
    logger.error('DevConX activation failed', error);
    void vscode.window.showErrorMessage(`DevConX activation failed: ${message}`);
  }
}

export async function deactivate() {
  await proxyServer?.stop();
  proxyServer = undefined;
  await registry?.dispose();
  registry = undefined;
}

async function loadConfiguration() {
  const configuration = vscode.workspace.getConfiguration('devconx');
  const configuredPath = configuration.get('configPath');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const fallback = workspaceFolder
    ? path.join(workspaceFolder, 'config', 'devconx.config.json')
    : path.join(process.cwd(), 'config', 'devconx.config.json');

  const configPath = typeof configuredPath === 'string' ? configuredPath.replace('${workspaceFolder}', ensureWorkspace()) : fallback;
  logger.info(`Loading DevConX configuration from ${configPath}`);
  const loader = new ConfigLoader(configPath);
  return loader.load();
}

function ensureWorkspace() {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    throw new Error('DevConX requires an open workspace to resolve configuration paths.');
  }
  return folder;
}
