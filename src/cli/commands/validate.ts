/**
 * FlowForge CLI — `forge validate`
 *
 * Validates a `.forge.yaml` spec file against the FlowForge DSL schema.
 * Exits with code 0 on success, 1 on failure.
 *
 * Usage:
 *   forge validate <spec.forge.yaml>
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { parseForgeSpec } from "../../dsl/schema.js";

export function makeValidateCommand(): Command {
    return new Command("validate")
        .description("Validate a .forge.yaml intent spec")
        .argument("<spec>", "Path to the .forge.yaml file")
        .option("--json", "Output validation result as JSON")
        .action(async (specPath: string, opts: { json?: boolean }) => {
            const spinner = ora(`Validating ${chalk.cyan(specPath)}`).start();
            try {
                const graph = parseForgeSpec(specPath);
                spinner.succeed(chalk.green("✓ Valid FlowForge spec"));

                if (opts.json) {
                    console.log(JSON.stringify({ valid: true, app: graph.app, version: graph.version, entities: Object.keys(graph.entities), routes: graph.routes.length, views: graph.views.length }, null, 2));
                } else {
                    console.log();
                    console.log(chalk.bold(`  App:      `) + graph.app);
                    console.log(chalk.bold(`  Version:  `) + graph.version);
                    console.log(chalk.bold(`  Entities: `) + chalk.cyan(Object.keys(graph.entities).join(", ") || "(none)"));
                    console.log(chalk.bold(`  Routes:   `) + chalk.cyan(`${graph.routes.length} endpoints`));
                    console.log(chalk.bold(`  Views:    `) + chalk.cyan(`${graph.views.length} pages`));
                    console.log(chalk.bold(`  Events:   `) + chalk.cyan(`${graph.events.length} hooks`));
                    console.log(chalk.bold(`  Auth:     `) + chalk.cyan(graph.auth.strategy));
                    console.log();
                    console.log(chalk.dim("  Run ") + chalk.yellow("forge generate " + specPath) + chalk.dim(" to generate code."));
                }
                process.exit(0);
            } catch (err) {
                spinner.fail(chalk.red("✗ Invalid spec"));
                console.error();
                console.error(chalk.red((err as Error).message));
                if (opts.json) {
                    console.log(JSON.stringify({ valid: false, error: (err as Error).message }, null, 2));
                }
                process.exit(1);
            }
        });
}
