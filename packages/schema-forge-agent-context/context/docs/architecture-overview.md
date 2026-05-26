# Schema Forge Portable Architecture Overview

Schema Forge and Etendo Go form one system with separate responsibilities.

Schema Forge owns:

- extraction and generation tooling,
- contracts and validation rules,
- generated/custom window artifacts,
- app-shell source and reusable packages,
- documentation and agent workflows.

Etendo Go owns:

- NEO Headless runtime APIs,
- auth enforcement,
- selector/process/report execution,
- persisted `ETGO_SF_*` configuration,
- server-side extension hooks.

The reusable package boundary is intentionally narrower than the monorepo:

- app-shell core is reusable shell runtime and shared UI infrastructure,
- generated windows and contracts remain consumer-owned,
- generator/core validation logic is packaged separately,
- agent context is shipped as docs/tooling rather than mixed into runtime code.
