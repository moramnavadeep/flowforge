<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-6366f1?style=for-the-badge&labelColor=0f0f0f" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-10b981?style=for-the-badge&labelColor=0f0f0f" alt="license">
  <img src="https://img.shields.io/badge/node-≥20-f59e0b?style=for-the-badge&labelColor=0f0f0f" alt="node">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3b82f6?style=for-the-badge&labelColor=0f0f0f" alt="typescript">
</p>

<h1 align="center">⚡ FlowForge</h1>
<h3 align="center">The World's First Intent-Driven Full-Stack Framework</h3>

<p align="center">
  Write <strong>what your app does</strong>. FlowForge generates <strong>everything else</strong>.
</p>

---

```yaml
# This 10-line YAML...
app: StudentPortal

entities:
  Student:
    fields:
      name: string
      email: email

routes:
  /api/students:
    get: list Students
    post: create Student
```

```bash
# ...generates this 400+ lines of production code:
forge generate portal.forge.yaml

✓ API routes      — 2 Express 5 endpoints with Zod validation
✓ DB schema       — Drizzle ORM table + migration-ready schema
✓ React UI        — Typed data table + form components + React Query hooks
```

---

## 🔥 What Makes FlowForge Unique

| Framework | Starts from... | Generates... |
|---|---|---|
| Hasura | DB schema | GraphQL API |
| OpenAPI | API spec | Client code |
| Prisma | DB schema | DB client |
| **FlowForge** | **Intent** (plain English) | **API + DB + UI** |

> **"Infrastructure-as-Intention"** — you describe *what* your app does, FlowForge figures out *how*.

No other framework treats human-readable *intent strings* as the root source of truth.

---

## 📦 Installation

```bash
npm install -g @flowforge/cli
# or in a project:
npm install @flowforge/core
```

---

## 🚀 Quick Start

**1. Create your intent spec:**

```yaml
# myapp.forge.yaml
app: TaskManager
version: 1.0.0

entities:
  Task:
    fields:
      title: string
      status:
        type: string
        default: "todo"
      priority:
        type: string
        default: "medium"
      dueDate:
        type: date
        required: false

routes:
  /api/tasks:
    get: list Tasks
    post: create Task
  /api/tasks/{id}:
    get: get Task
    patch: update Task
    delete: delete Task

ui:
  /tasks:
    title: My Tasks
    table: Task
  /tasks/new:
    title: New Task
    form: Task
```

**2. Validate your spec:**

```bash
forge validate myapp.forge.yaml

✓ Valid FlowForge spec

  App:      TaskManager
  Version:  1.0.0
  Entities: Task
  Routes:   5 endpoints
  Views:    2 pages
```

**3. Generate everything:**

```bash
forge generate myapp.forge.yaml --out ./generated

✓ API routes      — 5 endpoints
✓ DB schema       — 1 table
✓ React UI        — 2 pages
```

**4. Live dev mode — auto-regenerates on every save:**

```bash
forge dev myapp.forge.yaml

  ⚡ FlowForge Dev Mode
  Watching: myapp.forge.yaml
  5/5 intents handled · 0 unimplemented
```

---

## 🏗 Architecture

```
myapp.forge.yaml        ← Single source of truth
       │
       ▼
  [DSL Parser]          ← YAML → ForgeGraph (typed IR)
       │
  ┌────┴────┬──────────┐
  ▼         ▼          ▼
[API Gen] [DB Gen]  [UI Gen]
Express   Drizzle   React +
routes    schema    Query hooks
```

### The 5 Layers of FlowForge

#### 1️⃣ DSL — The Intent Spec
A human-readable YAML file describing your app's intent.
- Entities (→ DB tables)
- Routes with **plain-English intents** (→ API endpoints)
- Views (→ React pages)
- Events (→ reactive hooks)
- Roles (→ RBAC)

#### 2️⃣ Code Generators
Three generators that run from the parsed `ForgeGraph`:
- **`generateApi(graph)`** → Express 5 route handlers with Zod validation
- **`generateDb(graph)`** → Drizzle ORM table definitions + insert schemas
- **`generateUi(graph)`** → React components, data tables, forms, React Query hooks

#### 3️⃣ Intent Router (The Core Innovation)
Unlike URL routers that match HTTP paths, the IntentRouter matches **action intents**:

```typescript
import { IntentRouter } from "@flowforge/core";

const router = new IntentRouter();

router.register("list Tasks", async (ctx) => {
  return await db.select().from(tasks);
});

router.register("create Task", async (ctx) => {
  const task = ctx.body as NewTask;
  return await db.insert(tasks).values(task).returning();
});
```

**The same handler works from HTTP, WebSocket, CLI, tests — any transport.**

#### 4️⃣ Reactive Event Bus
Declare events in YAML, subscribe in code. Wildcard patterns supported:

```typescript
import { forgeBus } from "@flowforge/core";

// Exact match
forgeBus.on("Task.created", async (e) => {
  await sendSlackNotification(e.data);
});

// Wildcard — fires for any entity creation
forgeBus.on("*.created", async (e) => {
  await auditLog.record(e.entity, e.action, e.data);
});
```

#### 5️⃣ Scoped DI Context
Register services by token, resolve anywhere — even in request scope via AsyncLocalStorage:

```typescript
import { forgeContext } from "@flowforge/core";

forgeContext.provide("db", () => drizzleClient);
forgeContext.provide("mailer", () => new SESMailer());

// In a handler:
const db = forgeContext.resolve("db");
```

---

## 📋 Full DSL Reference

### Entities

```yaml
entities:
  Product:
    plural: Products           # used in UI labels (default: name + "s")
    timestamps: true           # auto createdAt/updatedAt (default: true)
    softDelete: false          # deletedAt instead of hard delete
    fields:
      name:
        type: string           # string | text | number | boolean | date
        label: Product Name    #   datetime | email | url | uuid | json
        required: true
        unique: false
        maxLength: 200
        display: true          # used as the display label in UI
        default: "Untitled"
        ref: Category          # foreign key → Category.id
```

### Routes (Intent Mapping)

```yaml
routes:
  /api/products:
    get: list Products           # → GET handler: SELECT * FROM products
    post:
      intent: create Product     # → POST handler: INSERT INTO products
      middleware: [auth]
      roles: [admin]

  /api/products/{id}:
    get: get Product             # → GET handler: SELECT WHERE id = :id
    patch:
      intent: update Product
      roles: [admin, editor]
    delete:
      intent: delete Product
      roles: [admin]
```

**Built-in intent patterns** (automatically mapped to CRUD):
- `list <Entity>` → `GET`, returns array
- `create <Entity>` → `POST`, inserts record
- `get <Entity>` → `GET /:id`, returns single
- `update <Entity>` → `PATCH /:id`, updates fields
- `delete <Entity>` → `DELETE /:id`, removes record

### Views (UI Pages)

```yaml
ui:
  /products:
    title: Products
    table: Product               # shorthand for full layout below
    
  /products/new:
    title: Add Product
    form: Product
    
  /dashboard:
    title: Dashboard
    layout:
      - component: table         # table | form | detail | gallery | chart
        entity: Product
        columns:
          - name
          - field: price
            label: Price (USD)
            sortable: true
        actions: [create, edit, delete]
```

### Events

```yaml
events:
  - on: Product.created          # entity.action
    do: send admin notification
    params:
      channel: "#products"

  - on: "*.deleted"              # wildcard: any entity deleted
    do: archive deleted record

  - on: "User.created"
    do: send welcome email
```

### Auth

```yaml
auth:
  strategy: jwt                  # jwt | session | apikey | none
  userEntity: User
  identifierField: email
  passwordField: passwordHash
```

### Roles

```yaml
roles:
  admin:
    description: Full system access
    permissions:
      Product: ["*"]             # * = all actions
      User: ["*"]
      
  editor:
    permissions:
      Product: [list, create, get, update]
      User: [list, get]
```

---

## 🛠 CLI Reference

```bash
# Validate a spec
forge validate <spec.forge.yaml> [--json]

# Generate code
forge generate <spec.forge.yaml> [--out <dir>] [--only api,db,ui] [--dry-run]

# Live dev watcher
forge dev <spec.forge.yaml> [--out <dir>]
```

---

## 🔌 Programmatic API

```typescript
import {
  parseForgeSpec,     // YAML → ForgeGraph
  generateApi,        // ForgeGraph → Express route source
  generateDb,         // ForgeGraph → Drizzle schema source
  generateUi,         // ForgeGraph → React component source
  IntentRouter,       // Transport-agnostic handler dispatch
  ForgeEventBus,      // Reactive wildcard event bus
  ForgeValidator,     // Runtime Zod validators from spec
  ForgeContext,       // Scoped DI via AsyncLocalStorage
  forgeBus,           // Singleton global event bus
  forgeContext,       // Singleton global context
} from "@flowforge/core";
```

---

## 📂 Repository Structure

```
flowforge/
├── src/
│   ├── dsl/
│   │   ├── types.ts        ← DSL type definitions (ForgeApp, ForgeGraph, etc.)
│   │   └── schema.ts       ← YAML parser + ForgeGraph normalizer
│   ├── codegen/
│   │   ├── api.ts          ← Express route generator
│   │   ├── db.ts           ← Drizzle ORM schema generator
│   │   └── ui.ts           ← React component generator
│   ├── runtime/
│   │   ├── router.ts       ← Intent-driven handler registry + Express adapter
│   │   ├── events.ts       ← Reactive event bus with wildcard patterns
│   │   ├── validator.ts    ← Runtime Zod validator from ForgeGraph
│   │   └── context.ts      ← Scoped DI via AsyncLocalStorage
│   └── cli/
│       ├── index.ts        ← CLI entry (forge command)
│       └── commands/
│           ├── validate.ts ← forge validate
│           ├── generate.ts ← forge generate
│           └── dev.ts      ← forge dev
├── examples/
│   └── student-portal.forge.yaml
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🗺 Roadmap

| Phase | Feature | Status |
|---|---|---|
| ✅ v0.1 | DSL parser, 3 code generators, runtime engine, CLI | Done |
| 🔄 v0.2 | AI intent expansion (`intent: "admin dashboard for students"` → full spec) | Planned |
| 🔄 v0.3 | Visual builder (drag-drop ↔ YAML sync) | Planned |
| 🔄 v0.4 | Database migrations from spec changes | Planned |
| 🔄 v0.5 | One-command deploy (`forge deploy`) | Planned |
| 🔄 v1.0 | Plugin system + community generators | Planned |

---

## 🤝 Contributing

```bash
git clone https://github.com/moramnavadeep/flowforge.git
cd flowforge
npm install
npm run dev
```

PRs welcome! Open an issue before making large changes.

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<p align="center">
  Built with ❤️ · <a href="https://github.com/YOUR_USERNAME/flowforge](https://github.com/moramnavadeep)">GitHub</a>
</p>
