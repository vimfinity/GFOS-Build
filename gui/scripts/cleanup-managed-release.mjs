#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(guiRoot, '..');
const managedReleaseRoot = path.resolve(repoRoot, 'release', 'desktop', 'managed');

fs.rmSync(path.join(managedReleaseRoot, 'win-unpacked'), { recursive: true, force: true });
fs.rmSync(path.join(managedReleaseRoot, 'builder-debug.yml'), { force: true });
