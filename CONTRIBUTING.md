# Contributing to FlowForge

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/flowforge`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development

```bash
# Run the CLI in dev mode
npx tsx src/cli/index.ts validate examples/student-portal.forge.yaml

# Generate from the example spec
npx tsx src/cli/index.ts generate examples/student-portal.forge.yaml --dry-run
```

## Pull Request Process

1. Make your changes with clear, descriptive commits
2. Update `CHANGELOG.md` under `[Unreleased]`
3. Ensure no TypeScript errors: `npm run typecheck`
4. Open a PR with a description of what you changed and why

## Areas Where Help is Needed

- 🧪 **Tests** — Add a test suite (Jest or Vitest)
- 🔌 **Generators** — FastAPI (Python), NestJS, Prisma generators
- 🎨 **Visual Builder** — Bi-directional YAML ↔ drag-drop editor
- 🤖 **AI Layer** — Natural language → `.forge.yaml` expansion
- 📦 **Plugin system** — Custom generators and runtime middlewares
- 📝 **Docs site** — Docusaurus or Astro documentation website

## Reporting Issues

Open a GitHub Issue with:
- FlowForge version
- Your `.forge.yaml` spec (or minimal reproduction)
- Expected vs actual behavior
