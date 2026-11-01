#!/usr/bin/env node
import { runInstaller } from './scripts/installer.mjs';
import { edition } from './scripts/edition.mjs';

await runInstaller(edition, process.argv.slice(2));
