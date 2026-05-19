#!/usr/bin/env node
import { Command } from "commander";

import { PROJECT_NAME } from "./index.js";
import { runTask } from "./task/runner.js";

const program = new Command();

program
  .name("guard-agent")
  .description("Guard-native Agent Harness local evidence initializer")
  .version("0.0.0");

program
  .command("run")
  .argument("<task>", "task prompt to initialize evidence for")
  .description("initialize a local evidence pack for a task")
  .action(async (task: string) => {
    try {
      const result = await runTask(task);

      console.log("Task initialized.");
      console.log("");
      console.log(`Task ID: ${result.task.task_id}`);
      console.log(`Evidence Pack: ${result.relativeEvidenceDirectory}`);
      console.log(`Final report: ${result.relativeFinalReportPath}`);
    } catch (error) {
      console.error(`${PROJECT_NAME}: failed to initialize task evidence`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
