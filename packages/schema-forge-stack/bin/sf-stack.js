#!/usr/bin/env node
import { runStackCli } from '../src/index.js';

runStackCli(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
