import assert from "node:assert/strict";
import test from "node:test";
import { interpretTerminalCommand } from "../../src/lib/terminal/safe-command";

test("terminal command allowlist returns deterministic feedback and internal routes", () => {
  const help = interpretTerminalCommand("help");
  assert.equal(help.kind, "output");
  if (help.kind === "output") assert.match(help.text, /No operating-system commands/);
  assert.deepEqual(interpretTerminalCommand("  BLOG  "), { kind: "navigate", href: "/blog", message: "Opening blog…" });
  assert.deepEqual(interpretTerminalCommand("clear"), { kind: "clear" });
  assert.deepEqual(interpretTerminalCommand("whoami"), { kind: "output", text: "visitor" });
});

test("terminal rejects shell syntax, URL tricks, arbitrary commands, and oversized input", () => {
  for (const input of ["id", "ls /", "cat .env", "blog; whoami", "$(id)", "https://evil.example", "../private"]) {
    const result = interpretTerminalCommand(input);
    assert.equal(result.kind, "output", input);
    if (result.kind === "output") assert.match(result.text, /Unknown command/);
  }
  const long = interpretTerminalCommand("x".repeat(129));
  assert.equal(long.kind, "output");
  if (long.kind === "output") assert.match(long.text, /limited to 128/);
});
