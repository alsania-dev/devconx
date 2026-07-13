const noop = () => {};
const disposable = () => ({ dispose: noop });
const panel = {
  webview: {
    html: '',
    cspSource: 'https://dummy',
    postMessage: noop,
    onDidReceiveMessage: noop,
    asWebviewUri: (uri) => uri,
  },
  reveal: noop,
  onDidDispose: noop,
  dispose: noop,
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
  getConfiguration: () => ({ get: () => undefined }),
};

export const commands = { registerCommand: () => disposable() };

export const window = {
  showErrorMessage: noop,
  showInformationMessage: noop,
  showQuickPick: async () => undefined,
  showInputBox: async () => undefined,
  setStatusBarMessage: () => disposable(),
  createWebviewPanel: () => panel,
};

export const ViewColumn = { One: 1, Two: 2 };

export default { workspace, commands, window, ViewColumn };
