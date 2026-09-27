import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./backend-gate.sh", import.meta.url));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

function gate(overrides = {}) {
  const result = spawnSync(bash, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      DETECT_RESULT: "success",
      CHANGED: "true",
      VERIFY_RESULT: "success",
      EVENT_NAME: "pull_request",
      ...overrides,
    },
  });
  assert.ifError(result.error);
  return result;
}

for (const event of ["push", "pull_request"]) {
  test(`${event}: build only after successful verification`, () => {
    const result = gate({ EVENT_NAME: event });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "build=true");
  });
  test(`${event}: explicit no-change decision permits a noop`, () => {
    const result = gate({ EVENT_NAME: event, CHANGED: "false", VERIFY_RESULT: "skipped" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "build=false");
  });
}

for (const changed of ["true", "false", ""]) {
  test(`manual rebuild requires verification even with changed=${changed}`, () => {
    const result = gate({ EVENT_NAME: "workflow_dispatch", CHANGED: changed });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "build=true");
    assert.notEqual(gate({ EVENT_NAME: "workflow_dispatch", CHANGED: changed, VERIFY_RESULT: "skipped" }).status, 0);
  });
}

for (const result of ["failure", "cancelled", "skipped", ""]) {
  test(`detection ${result || "missing"} cannot pass as a noop`, () => {
    assert.notEqual(gate({ DETECT_RESULT: result, CHANGED: "", VERIFY_RESULT: "skipped" }).status, 0);
    assert.notEqual(gate({ DETECT_RESULT: result, EVENT_NAME: "workflow_dispatch" }).status, 0);
  });
  test(`verification ${result || "missing"} cannot allow a build`, () => {
    assert.notEqual(gate({ VERIFY_RESULT: result }).status, 0);
  });
}

test("missing or malformed change output fails closed", () => {
  for (const changed of ["", "TRUE", "unknown"]) {
    assert.notEqual(gate({ CHANGED: changed }).status, 0);
  }
});

test("failed verification cannot be hidden behind a no-change output", () => {
  assert.notEqual(gate({ CHANGED: "false", VERIFY_RESULT: "failure" }).status, 0);
});

test("unknown events cannot build", () => {
  assert.notEqual(gate({ EVENT_NAME: "schedule" }).status, 0);
});
