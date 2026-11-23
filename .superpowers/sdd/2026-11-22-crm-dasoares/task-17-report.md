# Task 17 report
- Dockerfile: Build Args NEXT_PUBLIC_* + ENV, fail-fast check for URL/ANON_KEY, comment fixed, port 3000/0.0.0.0 documented. /api/saude exists, public in middleware.
- playwright.config.ts, tests/e2e/smoke.spec.ts (skips without E2E_EMAIL; competência E2E_COMPETENCIA default 2099-12; dev DB only), @playwright/test devDep, script test:e2e, vitest excludes tests/e2e. Not run.
- docs/deploy-easypanel.md (pt-BR).
- tsc/lint clean; vitest 193 passed, 1 skipped.
