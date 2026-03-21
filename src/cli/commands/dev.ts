/**
 * FlowForge CLI — `forge dev`
 *
 * Starts a live dev watcher on a `.forge.yaml` spec file.
 * On any change: re-parses → re-generates → prints audit report.
 *
 * Usage:
 *   forge dev <spec.forge.yaml> [--out <dir>]
 */

import { Command } from "commander";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { watch } from "chokidar";
import chalk from "chalk";
import { parseForgeSpec } from "../../dsl/schema.js";
import { generateApi } from "../../codegen/api.js";
import { generateDb } from "../../codegen/db.js";
import { generateUi } from "../../codegen/ui.js";
import { IntentRouter } from "../../runtime/router.js";

function regenerate(specPath: string, outDir: string): void {
    const start = Date.now();
    try {
        const graph = parseForgeSpec(specPath);
        const apiSrc = generateApi(graph);
        const dbFiles = generateDb(graph);
        const uiFiles = generateUi(graph);

        // Write API
        const apiPath = join(outDir, "api/routes.ts");
        mkdirSync(dirname(apiPath), { recursive: true });
        writeFileSync(apiPath, apiSrc);

        // Write DB
        for (const [rel, src] of dbFiles.entries()) {
            const full = join(outDir, rel);
            mkdirSync(dirname(full), { recursive: true });
            writeFileSync(full, src);
        }

        // Write UI
        for (const [rel, src] of uiFiles.entries()) {
            const full = join(outDir, rel);
            mkdirSync(dirname(full), { recursive: true });
            writeFileSync(full, src);
        }

        // Intent audit
        const router = new IntentRouter().withGraph(graph);
        const audit = router.auditGraph();
        const unhandled = audit.filter((r) => !r.handled);

        const elapsed = Date.now() - start;
        console.clear();
        console.log(chalk.bold.blue("\n  ⚡ FlowForge Dev Mode"));
        console.log(chalk.dim(`  Watching: ${specPath}`));
        console.log(chalk.dim(`  Output:   ${outDir}`));
        console.log();
        console.log(chalk.bold(`  ${graph.app}`) + chalk.dim(` v${graph.version}`));
        console.log(
            `  ${chalk.green(`${audit.length - unhandled.length}/${audit.length}`)} intents handled` +
            (unhandled.length > 0 ? chalk.yellow(` · ${unhandled.length} unimplemented`) : ""),
        );
        console.log();

        if (unhandled.length > 0) {
            console.log(chalk.yellow("  ⚠ Unimplemented intents:"));
            for (const u of unhandled) {
                console.log(`    ${chalk.dim(u.route.padEnd(35))} "${u.intent}"`);
            }
            console.log();
        }

        console.log(chalk.dim(`  Regenerated in ${elapsed}ms — ${new Date().toLocaleTimeString()}`));
    } catch (err) {
        console.error(chalk.red("\n  ✗ Spec error:"));
        console.error(chalk.red("  " + (err as Error).message));
    }
}

export function makeDevCommand(): Command {
    return new Command("dev")
        .description("Watch a .forge.yaml spec and regenerate code on changes")
        .argument("<spec>", "Path to the .forge.yaml file")
        .option("--out <dir>", "Output directory for generated code", "./forge-generated")
        .action(async (specPath: string, opts: { out: string }) => {
            if (!existsSync(specPath)) {
                console.error(chalk.red(`✗ File not found: ${specPath}`));
                process.exit(1);
            }

            console.log(chalk.bold.blue("\n  ⚡ FlowForge Dev Mode"));
            console.log(chalk.dim(`  Starting watcher on ${specPath}...`));
            console.log(chalk.dim("  Press Ctrl+C to stop.\n"));

            // Initial generation
            regenerate(specPath, opts.out);

            // Watch for changes
            const watcher = watch(specPath, { persistent: true });
            watcher.on("change", () => {
                console.log(chalk.dim("\n  [change detected] Regenerating..."));
                regenerate(specPath, opts.out);
            });

            process.on("SIGINT", () => {
                watcher.close();
                console.log(chalk.dim("\n  FlowForge dev mode stopped."));
                process.exit(0);
            });
        });
}
