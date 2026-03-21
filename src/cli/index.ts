#!/usr/bin/env node
/**
 * FlowForge CLI Entry Point
 *
 *   forge validate <spec>
 *   forge generate <spec> [--out <dir>] [--only api,db,ui] [--dry-run]
 *   forge dev <spec> [--out <dir>]
 */

import { Command } from "commander";
import chalk from "chalk";
import { makeValidateCommand } from "./commands/validate.js";
import { makeGenerateCommand } from "./commands/generate.js";
import { makeDevCommand } from "./commands/dev.js";

const FLOWFORGE_BANNER = `
${chalk.bold.blue("  ███████╗██╗      ██████╗ ██╗    ██╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗")}
${chalk.bold.blue("  ██╔════╝██║     ██╔═══██╗██║    ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝")}
${chalk.bold.blue("  █████╗  ██║     ██║   ██║██║ █╗ ██║█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  ")}
${chalk.blue("  ██╔══╝  ██║     ██║   ██║██║███╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ")}
${chalk.blue("  ██║     ███████╗╚██████╔╝╚███╔███╔╝██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗")}
${chalk.dim("  ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝")}
  ${chalk.dim("Intent-Driven Full-Stack Framework  ·  v0.1.0")}
`;

const program = new Command();

program
    .name("forge")
    .description("FlowForge CLI — build full-stack apps from intent specs")
    .version("0.1.0")
    .addHelpText("before", FLOWFORGE_BANNER);

program.addCommand(makeValidateCommand());
program.addCommand(makeGenerateCommand());
program.addCommand(makeDevCommand());

program.parse();
