import { InvalidArgumentError } from "commander";

const timeoutErrorMessage = "--planner-timeout-ms must be a positive integer.";

export function parsePlannerTimeoutMs(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new InvalidArgumentError(timeoutErrorMessage);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidArgumentError(timeoutErrorMessage);
  }

  return parsed;
}
