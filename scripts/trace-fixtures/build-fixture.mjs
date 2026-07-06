import { readFile } from "node:fs/promises";
import {
  buildControlledTraceFixture,
  validateControlledTraceFixture,
} from "@/lib/executor/runtime/trace-fixtures";

const artifactPath = process.argv[2];

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exitCode = 1;
}

if (!artifactPath) {
  fail("Usage: npm run trace:fixture:build -- <artifact.json>");
} else {
  let raw;
  try {
    raw = await readFile(artifactPath, "utf8");
  } catch (error) {
    fail(
      "Failed to read governed trace artifact",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (raw !== undefined) {
    let artifact;
    try {
      artifact = JSON.parse(raw);
    } catch (error) {
      fail(
        "Failed to parse governed trace artifact JSON",
        error instanceof Error ? error.message : String(error),
      );
    }

    if (artifact !== undefined) {
      try {
        const fixture = buildControlledTraceFixture(artifact);
        const validation = validateControlledTraceFixture(fixture);

        if (!validation.ok) {
          fail(
            "Governed trace artifact did not produce a valid fixture",
            validation.errors.map((item) => `- ${item}`).join("\n"),
          );
        } else {
          console.log(JSON.stringify(fixture, null, 2));
        }
      } catch (error) {
        fail(
          "Governed trace artifact did not produce a valid fixture",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
}
