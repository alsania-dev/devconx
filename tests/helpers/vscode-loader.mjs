export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vscode') {
    const url = new URL('./vscode-shim.mjs', import.meta.url).href;
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
