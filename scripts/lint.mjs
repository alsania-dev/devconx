import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const roots = [path.resolve(dirname, '../src'), path.resolve(dirname, '../tests')];

async function gather(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await gather(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

let allFiles = [];
for (const root of roots) {
  allFiles = allFiles.concat(await gather(root));
}

for (const file of allFiles) {
  await exec(process.execPath, ['--check', file]);
  console.log(`Syntax OK: ${path.relative(path.resolve(dirname, '..'), file)}`);
}
