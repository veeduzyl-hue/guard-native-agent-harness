#!/usr/bin/env node
import { Command } from "commander";

import { parsePlannerTimeoutMs } from "./agent/planner-timeout.js";
import {
  inspectEvidencePack,
  renderEvidenceInspectionJson,
  renderEvidenceInspectionMarkdown
} from "./evidence/inspector.js";
import { loadReviewProfile } from "./evidence/review-profile.js";
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

program
  .command("inspect-evidence")
  .requiredOption("--evidence-dir <path>", "existing evidence directory to inspect")
  .option("--json", "emit deterministic JSON inspection output")
  .option("--markdown", "emit deterministic Markdown inspection output")
  .option("--profile <profile-id>", "v0.5 review profile metadata to include")
  .description("inspect an existing local evidence pack without executing it")
  .action(async (options: { evidenceDir: string; json?: boolean; markdown?: boolean; profile?: string }) => {
    try {
      if (options.json && options.markdown) {
        throw new Error("Choose either --json or --markdown, not both.");
      }

      const reviewProfile = options.profile ? await loadReviewProfile(options.profile) : null;
      const inspection = await inspectEvidencePack({
        evidenceDirectory: options.evidenceDir,
        displayPath: options.evidenceDir,
        reviewProfile
      });
      const output =
        options.markdown && !options.json
          ? renderEvidenceInspectionMarkdown(inspection)
          : renderEvidenceInspectionJson(inspection);

      process.stdout.write(output);
    } catch (error) {
      console.error(`${PROJECT_NAME}: failed to inspect evidence`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
