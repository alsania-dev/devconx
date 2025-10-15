import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(dirname, '../src');
const target = path.resolve(dirname, '../dist');

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Copied ${source} -> ${target}`);
