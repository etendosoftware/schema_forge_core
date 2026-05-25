#!/usr/bin/env node
import { runDomainBoundaryCheckCli } from '@schema-forge/core/domain-boundary-check';

process.exitCode = runDomainBoundaryCheckCli();
