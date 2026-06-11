#!/usr/bin/env node
import { runDomainBoundaryCheckCli } from '../src/domain-boundary-check.js';

process.exitCode = runDomainBoundaryCheckCli();
