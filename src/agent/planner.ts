import type { PlanEvidence } from "../evidence/schema.js";
import type { PlannerProvider } from "./provider.js";
import type { MockPlanEvidence, MockPlanStep } from "./types.js";

export function createPlaceholderPlan(taskId: string): PlanEvidence {
  return {
    task_id: taskId,
    planner: "placeholder",
    steps: [
      {
        id: "step-1",
        type: "placeholder",
        description: "No real agent or tool execution is implemented in PR 2."
      }
    ],
    risk_notes: [
      "PR 2 initializes evidence only. No files are read, written, or modified by agent tools."
    ],
    expected_outputs: [
      "task.json",
      "plan.json",
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json",
      "evidence-manifest.json",
      "evidence-pack.json",
      "final-report.md"
    ]
  };
}

export function createMockPlan(taskId: string, userPrompt: string): MockPlanEvidence {
  const normalizedPrompt = userPrompt.toLowerCase();

  if (matchesAny(normalizedPrompt, ["readme", "safe readme update"])) {
    return createPlan(taskId, [
      {
        id: "step-1",
        tool: "list_files",
        input: { path: "." },
        description: "List workspace files."
      },
      {
        id: "step-2",
        tool: "read_file",
        input: { path: "README.md" },
        description: "Read the current README as context for a safe proposal."
      },
      {
        id: "step-3",
        tool: "git_status",
        input: {},
        description: "Inspect the current git status."
      },
      {
        id: "step-4",
        tool: "git_diff",
        input: {},
        description: "Inspect the current git diff."
      },
      {
        id: "step-5",
        tool: "write_file",
        input: {
          path: "examples/readme-update/README_UPDATE_PROPOSAL.md",
          content: renderReadmeProposal(userPrompt)
        },
        description: "Write a README update proposal artifact without modifying README.md directly."
      },
      {
        id: "step-6",
        tool: "create_report",
        input: {
          title: "README Update Demo Report",
          content: "The mock planner created a bounded README proposal artifact and recorded evidence."
        },
        description: "Create a task-local tool report artifact."
      }
    ]);
  }

  if (matchesAny(normalizedPrompt, ["repo review", "review this repo", "repository review"])) {
    return createPlan(taskId, [
      {
        id: "step-1",
        tool: "list_files",
        input: { path: "." },
        description: "List workspace files."
      },
      {
        id: "step-2",
        tool: "git_status",
        input: {},
        description: "Inspect the current git status."
      },
      {
        id: "step-3",
        tool: "git_diff",
        input: {},
        description: "Inspect the current git diff."
      },
      {
        id: "step-4",
        tool: "create_report",
        input: {
          title: "Repository Review Demo Report",
          content: "The mock planner ran a bounded repository review template through registered tools."
        },
        description: "Create a task-local repository review report artifact."
      }
    ]);
  }

  if (matchesAny(normalizedPrompt, ["unsafe", "policy demo", "blocked action", "env"])) {
    return createPlan(taskId, [
      {
        id: "step-1",
        tool: "read_file",
        input: { path: ".env" },
        description: "Attempt an unsafe .env read to demonstrate Policy Gate blocking."
      },
      {
        id: "step-2",
        tool: "run_command",
        input: { command: "git push origin main" },
        description: "Attempt an unsafe git push request to demonstrate command blocking."
      }
    ]);
  }

  return createPlan(taskId, [
    {
      id: "step-1",
      tool: "list_files",
      input: { path: "." },
      description: "List workspace files."
    },
    {
      id: "step-2",
      tool: "git_status",
      input: {},
      description: "Inspect the current git status."
    },
    {
      id: "step-3",
      tool: "create_report",
      input: {
        title: "Default Mock Planner Report",
        content: "The mock planner executed the safe default workflow template."
      },
      description: "Create a task-local report artifact."
    }
  ]);
}

export const mockPlannerProvider: PlannerProvider = {
  name: "mock",
  kind: "local-deterministic",
  available: true,
  async createPlan(context) {
    return {
      provider: "mock",
      model: null,
      plan: createMockPlan(context.taskId, context.userPrompt),
      rawProviderMetadata: {
        deterministic: true
      }
    };
  }
};

function createPlan(taskId: string, steps: MockPlanStep[]): MockPlanEvidence {
  return {
    task_id: taskId,
    planner: "mock",
    provider: "mock",
    model: null,
    steps,
    risk_notes: [
      "Mock planner uses deterministic templates only.",
      "All tool calls are routed through the Tool Registry and Policy Gate."
    ],
    expected_outputs: [
      "tool-calls.jsonl",
      "blocked-actions.jsonl",
      "command-results.jsonl",
      "guard-results.json",
      "evidence-manifest.json",
      "evidence-pack.json",
      "final-report.md"
    ]
  };
}

function matchesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function renderReadmeProposal(userPrompt: string): string {
  return [
    "# README Update Proposal",
    "",
    `Requested task: ${userPrompt}`,
    "",
    "## Proposal",
    "",
    "- Review the existing README structure.",
    "- Add concise current-status notes for the bounded local harness workflow.",
    "- Keep MindForge Guard boundary language intact.",
    "",
    "## Boundary",
    "",
    "This proposal artifact was generated by the deterministic mock planner. It does not modify README.md directly."
  ].join("\n");
}
