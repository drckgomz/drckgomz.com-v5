export type TerminalCommandResult =
  | { kind: "clear" }
  | { kind: "navigate"; href: "/blog" | "/projects" | "/about" | "/contact"; message: string }
  | { kind: "output"; text: string };

const NAVIGATION: Record<string, "/blog" | "/projects" | "/about" | "/contact"> = {
  blog: "/blog", projects: "/projects", about: "/about", contact: "/contact",
};

/** Pure allowlist interpreter: no shell, eval, dynamic imports, or OS access. */
export function interpretTerminalCommand(input: string): TerminalCommandResult {
  if (typeof input !== "string" || input.length > 128) {
    return { kind: "output", text: "Input too long. Commands are limited to 128 characters." };
  }
  const command = input.trim().toLowerCase();
  if (command === "clear" || command === "cls") return { kind: "clear" };
  if (command === "help" || command === "") {
    return { kind: "output", text: "Available commands: about, blog, clear, contact, projects, whoami. No operating-system commands are supported." };
  }
  if (command === "whoami") return { kind: "output", text: "visitor" };
  if (Object.hasOwn(NAVIGATION, command)) {
    const href = NAVIGATION[command]!;
    return { kind: "navigate", href, message: `Opening ${command}…` };
  }
  return { kind: "output", text: "Unknown command. Type help for the available commands." };
}
