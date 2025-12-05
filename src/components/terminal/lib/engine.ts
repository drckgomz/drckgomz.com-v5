// frontend/src/features/terminal/lib/engine.ts

export type Callbacks = {
  print: (text: string) => void | Promise<void>;
  typeWrite?: (text: string) => Promise<void>;
  navigate: (href: string) => void;
  openUrl: (url: string, newTab?: boolean) => void;
  playAudio: (src: string) => void;
  showVideo: (src: string) => void;
  showGallery: (images: string[]) => void;
  isAuthed?: () => boolean;
  isAdmin?: () => boolean;
};

export type EngineCommand = {
  name: string;
  aliases?: string[];
  description?: string;
  actions: Array<
    | { type: "print"; text: string }
    | { type: "navigate"; href: string }
    | { type: "openUrl"; url: string; newTab?: boolean }
    | { type: "audio"; src: string }
    | { type: "video"; src: string }
    | { type: "gallery"; images: string[] }
  >;
  requiresAuth?: boolean;
  role?: "user" | "admin";
  showInHelp?: boolean;
  enabled?: boolean;
  rateLimitPerMin?: number;
};

export class CommandEngine {
  private registry = new Map<string, EngineCommand>();
  private cb: Callbacks;

  private rateBucket = new Map<
    string,
    { windowStartMs: number; count: number; limit: number }
  >();
  private RATE_WINDOW_MS = 60_000;

  // LOGIN STATE
  private loginMode = false;
  private loginStep: "username" | "password" | "both" = "both";
  private loginUsername = "";
  private loginPassword = "";

  constructor(cb: Callbacks) {
    this.cb = cb;
  }

  register(cmd: EngineCommand) {
    const norm: EngineCommand = {
      showInHelp: true,
      enabled: true,
      requiresAuth: false,
      role: "user",
      rateLimitPerMin: 0,
      aliases: [],
      description: "",
      ...cmd,
      name: cmd.name.toLowerCase(),
    };

    this.registry.set(norm.name, norm);
    for (const a of norm.aliases ?? []) this.registry.set(a.toLowerCase(), norm);
  }

  list(): EngineCommand[] {
    return Array.from(new Set(this.registry.values()));
  }

  private checkRateLimit(cmd: EngineCommand): boolean {
    const limit = cmd.rateLimitPerMin ?? 0;
    if (!limit || limit <= 0) return true;

    const key = cmd.name;
    const now = Date.now();
    const bucket = this.rateBucket.get(key);

    if (!bucket) {
      this.rateBucket.set(key, {
        windowStartMs: now,
        count: 1,
        limit,
      });
      return true;
    }

    if (now - bucket.windowStartMs >= this.RATE_WINDOW_MS) {
      bucket.windowStartMs = now;
      bucket.count = 1;
      return true;
    }

    if (bucket.count < bucket.limit) {
      bucket.count += 1;
      return true;
    }

    return false;
  }

  private resetLoginState() {
    this.loginMode = false;
    this.loginStep = "both";
    this.loginUsername = "";
    this.loginPassword = "";
  }

  async execute(raw: string) {
    const input = raw.trim();
    if (!input) return;

    // LOGIN MODE
    if (this.loginMode) {
      if (["quit", ":q", "stop"].includes(input.toLowerCase())) {
        this.resetLoginState();
        await this.cb.print("Login cancelled.");
        return;
      }

      if (input.includes(" ") && this.loginStep === "both") {
        const [username, password] = input.split(" ");
        this.loginUsername = username;
        this.loginPassword = password;
      } else if (this.loginStep === "both") {
        this.loginUsername = input;
        this.loginStep = "password";
        await this.cb.print("Enter password:");
        return;
      } else if (this.loginStep === "password") {
        this.loginPassword = input;
      }

      if (this.loginUsername && this.loginPassword) {
        try {
          const res = await fetch("/api/terminal/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: this.loginUsername,
              password: this.loginPassword,
            }),
          });

          if (!res.ok) {
            await this.cb.print("Invalid credentials. Try again.");
            this.resetLoginState();
            return;
          }

          const { token } = await res.json();
          localStorage.setItem("blog_token", token);
          await this.cb.print("Login successful. Redirecting to blog...");
          this.cb.navigate("/blog");
          this.resetLoginState();
          return;
        } catch (err) {
          await this.cb.print("Login failed. Please try again later.");
          this.resetLoginState();
          return;
        }
      }

      return;
    }

    // Special case: intercept 'blog' command
    if (input.toLowerCase() === "blog") {
      this.loginMode = true;
      this.loginStep = "both";
      this.loginUsername = "";
      this.loginPassword = "";
      await (this.cb.typeWrite
      ? this.cb.typeWrite("Enter user email (or 'email and password' together). Type ':q' to cancel.")
      : this.cb.print("Enter email (or 'email and password' together). Type ':q' to cancel."));
      return;
    }

    const cmd = this.registry.get(input.toLowerCase());
    if (!cmd) {
      await this.cb.print(`Command not found: ${raw}`);
      return;
    }

    if (cmd.enabled === false) {
      await this.cb.print(`Command disabled: ${cmd.name}`);
      return;
    }
    if (cmd.requiresAuth && !(this.cb.isAuthed?.() ?? false)) {
      await this.cb.print("You must log in first.");
      return;
    }
    if (cmd.role === "admin" && !(this.cb.isAdmin?.() ?? false)) {
      await this.cb.print("Admin-only command.");
      return;
    }
    if (!this.checkRateLimit(cmd)) {
      await this.cb.print("Rate limit exceeded. Try again in a minute.");
      return;
    }

    for (const action of cmd.actions) {
      switch (action.type) {
        case "print":
          await (this.cb.typeWrite
            ? this.cb.typeWrite(action.text)
            : this.cb.print(action.text));
          break;
        case "navigate":
          this.cb.navigate(action.href);
          break;
        case "openUrl":
          this.cb.openUrl(action.url, action.newTab);
          break;
        case "audio":
          this.cb.playAudio(action.src);
          break;
        case "video":
          this.cb.showVideo(action.src);
          break;
        case "gallery":
          this.cb.showGallery(action.images);
          break;
      }
    }
  }
}
