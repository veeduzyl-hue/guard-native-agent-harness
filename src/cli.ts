#!/usr/bin/env node
import { Command } from "commander";

import { parsePlannerTimeoutMs } from "./agent/planner-timeout.js";
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
  .option("--planner <provider>", "planner provider to use", "mock")
  .option("--model <model>", "model name for model-backed planner providers")
  .option(
    "--planner-timeout-ms <milliseconds>",
    "planner provider timeout in milliseconds",
    parsePlannerTimeoutMs
  )
  .description("initialize a local evidence pack for a task")
  .action(
    async (
      task: string,
      options: { planner: string; model?: string; plannerTimeoutMs?: number }
    ) => {
      try {
        const result = await runTask(task, {
          plannerProvider: options.planner,
          plannerModel: options.model ?? null,
          plannerTimeoutMs: options.plannerTimeoutMs ?? null
        });

        console.log("Task completed.");
        console.log("");
        console.log(`Task ID: ${result.task.task_id}`);
        console.log(`Evidence Pack: ${result.relativeEvidenceDirectory}`);
        console.log(`Final report: ${result.relativeFinalReportPath}`);
        console.log(`Planner provider: ${result.task.planner_provider}`);
        console.log(`Planner model: ${result.task.planner_model ?? "none"}`);
        console.log(`Guard available: ${result.guardAvailable}`);
        console.log(`Steps planned: ${result.executionSummary.steps_planned}`);
        console.log(`Steps completed: ${result.executionSummary.steps_completed}`);
        console.log(`Steps blocked: ${result.executionSummary.steps_blocked}`);
        console.log(`Steps failed: ${result.executionSummary.steps_failed}`);
      } catch (error) {
        console.error(`${PROJECT_NAME}: failed to initialize task evidence`);
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    }
  );

await program.parseAsync(process.argv);
