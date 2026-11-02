# Third-party notices

ERPWAM currently bundles the following runtime dependencies. Exact resolved
versions are recorded in `package-lock.json`.

| Dependency | Purpose | License |
| --- | --- | --- |
| React / React DOM | User interface | MIT |
| Scheduler | React scheduling runtime | MIT |
| Apache ECharts | Interactive analytical charts | Apache-2.0 |
| zrender | ECharts rendering engine | BSD-3-Clause |
| tslib | TypeScript runtime helpers used by ECharts | 0BSD |
| TanStack Table | Typed accessible table model | MIT |
| TanStack Table Core | Headless table engine | MIT |

Development dependencies include Vite, TypeScript, Vitest, Playwright, and
Oxlint under their respective package licenses.
The installed packages retain their upstream license files. The source and
resolved-license inventory can be inspected with `npm query :root` and
`npm query "[license]"` after `npm ci`.

## Apache ECharts notice

Apache ECharts

Copyright 2017-2026 The Apache Software Foundation

This product includes software developed at The Apache Software Foundation
(https://www.apache.org/). Apache ECharts is licensed under Apache License 2.0;
its upstream `LICENSE` and `NOTICE` files remain controlling.

## zrender notice

Copyright (c) 2017, Baidu Inc.

zrender is licensed under the BSD 3-Clause License. Its upstream `LICENSE`
file remains controlling.

ERPWAM remains licensed under the MIT License. See `LICENSE` for the project
license text.
