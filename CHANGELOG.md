# Changelog

All notable changes to FlowForge will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-03-21

### 🎉 Initial Release

#### DSL Layer
- `ForgeApp` YAML specification with full Zod validation
- Entity definitions with 10 scalar types: `string`, `text`, `number`, `boolean`, `date`, `datetime`, `email`, `url`, `uuid`, `json`
- Route declarations with plain-English intent strings (`"list Tasks"`, `"create Task"`, etc.)
- UI view declarations with `table`, `form`, and full `layout` components
- Reactive event hook declarations with wildcard pattern support
- Role-based access control definitions
- JWT / session / apikey / none auth strategies
- `ForgeGraph` normalized intermediate representation

#### Code Generators
- **API Generator** (`generateApi`): Express 5 route handlers with Zod validation, role guards, CRUD templates, error handling
- **DB Generator** (`generateDb`): Drizzle ORM PostgreSQL table definitions with `drizzle-zod` insert/select schemas, timestamps, soft deletes, foreign keys
- **UI Generator** (`generateUi`): React + TanStack Query table pages, form pages, App Router, navigation manifest

#### Runtime Engine
- **IntentRouter**: Transport-agnostic handler registry with Express adapter, graph audit, and `ForgeIntentNotFoundError`
- **ForgeEventBus**: Reactive event bus with exact and wildcard pattern matching, `once()`, auto-wiring from `ForgeGraph`, error handling, singleton `forgeBus`
- **ForgeValidator**: Runtime Zod validators built from `ForgeGraph` entities — Express middleware and direct `.validate()` API
- **ForgeContext**: Scoped dependency injection via `AsyncLocalStorage` — singleton and transient services, request-scoped middleware, `ForgeContext.current()`

#### CLI (`forge`)
- `forge validate <spec>` — validates a `.forge.yaml` spec with colored output and `--json` flag for CI
- `forge generate <spec>` — generates all code with `--out`, `--only`, and `--dry-run` flags
- `forge dev <spec>` — live watcher with hot-regeneration and intent audit dashboard

#### Examples
- `examples/student-portal.forge.yaml` — complete Student Portal spec (3 entities, 10 routes, 4 reactive events, JWT auth, RBAC)
