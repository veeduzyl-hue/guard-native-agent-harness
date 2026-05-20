import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface ReadResult<T> {
  file: string;
  status: "present" | "missing" | "empty" | "malformed";
  value: T | null;
  warnings: string[];
}

export interface JsonlReadResult<T> extends ReadResult<T[]> {
  malformedLines: number[];
}

export async function readJsonFile<T>(evidenceDirectory: string, fileName: string): Promise<ReadResult<T>> {
  const filePath = path.join(evidenceDirectory, fileName);

  try {
    const content = await readFile(filePath, "utf8");
    if (content.trim() === "") {
      return { file: fileName, status: "empty", value: null, warnings: [`${fileName} is empty.`] };
    }

    try {
      return { file: fileName, status: "present", value: JSON.parse(content) as T, warnings: [] };
    } catch {
      return { file: fileName, status: "malformed", value: null, warnings: [`${fileName} is malformed JSON.`] };
    }
  } catch (error) {
    if (isMissingFile(error)) {
      return { file: fileName, status: "missing", value: null, warnings: [`${fileName} is missing.`] };
    }

    throw error;
  }
}

export async function readJsonlFile<T>(evidenceDirectory: string, fileName: string): Promise<JsonlReadResult<T>> {
  const filePath = path.join(evidenceDirectory, fileName);

  try {
    const content = await readFile(filePath, "utf8");
    if (content.trim() === "") {
      return {
        file: fileName,
        status: "empty",
        value: [],
        warnings: [],
        malformedLines: []
      };
    }

    const events: T[] = [];
    const malformedLines: number[] = [];
    const warnings: string[] = [];

    content.split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === "") {
        return;
      }

      try {
        events.push(JSON.parse(line) as T);
      } catch {
        const lineNumber = index + 1;
        malformedLines.push(lineNumber);
        warnings.push(`${fileName} contains malformed JSONL at line ${lineNumber}.`);
      }
    });

    return {
      file: fileName,
      status: malformedLines.length > 0 ? "malformed" : "present",
      value: events,
      warnings,
      malformedLines
    };
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        file: fileName,
        status: "missing",
        value: null,
        warnings: [`${fileName} is missing.`],
        malformedLines: []
      };
    }

    throw error;
  }
}

export async function readTextFile(evidenceDirectory: string, fileName: string): Promise<ReadResult<string>> {
  const filePath = path.join(evidenceDirectory, fileName);

  try {
    const content = await readFile(filePath, "utf8");
    return {
      file: fileName,
      status: content.trim() === "" ? "empty" : "present",
      value: content,
      warnings: content.trim() === "" ? [`${fileName} is empty.`] : []
    };
  } catch (error) {
    if (isMissingFile(error)) {
      return { file: fileName, status: "missing", value: null, warnings: [`${fileName} is missing.`] };
    }

    throw error;
  }
}

export async function evidenceFileStatus(evidenceDirectory: string, fileName: string): Promise<"present" | "missing"> {
  try {
    await stat(path.join(evidenceDirectory, fileName));
    return "present";
  } catch (error) {
    if (isMissingFile(error)) {
      return "missing";
    }

    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
