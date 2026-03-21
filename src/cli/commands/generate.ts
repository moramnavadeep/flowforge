/**
 * FlowForge CLI — `forge generate`
 *
 * Reads a `.forge.yaml` intent spec and generates all code:
 *   - Express route handlers  → <output>/api/routes.ts
 *   - Drizzle DB schema       → <output>/db/schema/*.ts
 *   - React UI components     → <output>/ui/pages/index.tsx
 *
 * Usage:
 *   forge generate <spec.forge.yaml> [--out <dir>] [--only api|db|ui]
 */

import { Command } from "commander";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import chalk from "chalk";
import ora from "ora";
import { parseForgeSpec } from "../../dsl/schema.js";
import { generateApi } from "../../codegen/api.js";
import { generateDb } from "../../codegen/db.js";
import { generateUi } from "../../codegen/ui.js";

type GeneratorTarget = "api" | "db" | "ui";

function writeGenerated(files: Map<string, string>, baseDir: string): void {
    for (const [relPath, content] of files.entries()) {
        const fullPath = join(baseDir, relPath);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
        console.log("  " + chalk.green("✓") + " " + chalk.dim(relPath));
    }
}

export function makeGenerateCommand(): Command {
    return new Command("generate")
        .alias("g")
        .description("Generate code from a .forge.yaml intent spec")
        .argument("<spec>", "Path to the .forge.yaml file")
        .option("--out <dir>", "Output directory for generated code", "./forge-generated")
        .option("--only <targets>", "Comma-separated targets: api,db,ui (default: all)")
        .option("--dry-run", "Print what would be generated without writing files")
        .action(async (specPath: string, opts: { out: string; only?: string; dryRun?: boolean }) => {
            const targets: GeneratorTarget[] = opts.only
                ? (opts.only.split(",").map((t) => t.trim()) as GeneratorTarget[])
                : ["api", "db", "ui"];

            const spinner = ora(`Parsing ${chalk.cyan(specPath)}`).start();
            let graph;
            try {
                graph = parseForgeSpec(specPath);
                spinner.succeed(`Parsed ${chalk.bold(graph.app)} v${graph.version}`);
            } catch (err) {
                spinner.fail(chalk.red("Parse failed"));
                console.error(chalk.red((err as Error).message));
                process.exit(1);
            }

            const outDir = opts.out;
            console.log();
            console.log(chalk.bold.blue("  FlowForge Code Generation"));
            console.log(chalk.dim(`  Output: ${outDir}`));
            console.log(chalk.dim(`  Targets: ${targets.join(", ")}`));
            console.log();

            if (targets.includes("api")) {
                const step = ora("Generating API routes").start();
                const src = generateApi(graph);
                const files = new Map([["api/routes.ts", src]]);
                if (!opts.dryRun) {
                    writeGenerated(files, outDir);
                } else {
                    console.log(chalk.dim("  [dry-run] Would write: api/routes.ts"));
                }
                step.succeed(`API routes — ${graph.routes.length} endpoints`);
            }

            if (targets.includes("db")) {
                const step = ora("Generating DB schema").start();
                const files = generateDb(graph);
                if (!opts.dryRun) {
                    writeGenerated(files, outDir);
                } else {
                    for (const f of files.keys()) {
                        console.log(chalk.dim(`  [dry-run] Would write: ${f}`));
                    }
                }
                step.succeed(`DB schema — ${Object.keys(graph.entities).length} tables`);
            }

            if (targets.includes("ui")) {
                const step = ora("Generating React UI").start();
                const files = generateUi(graph);
                if (!opts.dryRun) {
                    writeGenerated(files, outDir);
                } else {
                    for (const f of files.keys()) {
                        console.log(chalk.dim(`  [dry-run] Would write: ${f}`));
                    }
                }
                step.succeed(`React UI — ${graph.views.length} pages`);
            }

            console.log();
            console.log(chalk.bold.green("  ✓ Generation complete!"));
            console.log();
            console.log(chalk.dim("  Next steps:"));
            console.log("  1. " + chalk.yellow(`Review generated code in ${outDir}/`));
            console.log("  2. " + chalk.yellow("pnpm --filter @workspace/db run push  (apply DB schema)"));
            console.log("  3. " + chalk.yellow("pnpm --filter @workspace/api-server run dev  (start API)"));
            console.log();
        });
}
