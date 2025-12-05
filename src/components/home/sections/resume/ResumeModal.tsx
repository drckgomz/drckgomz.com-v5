// src/components/home/sections/resume/ResumeModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ResumeBody =
  | { kind: "pdf"; url: string }
  | { kind: "docx"; url: string }
  | { kind: "text"; text: string };

type ResumeSectionWire = {
  key: string;
  title?: string | null;
  description?: string | null;
  body?: any;
};

export default function ResumeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [body, setBody] = useState<ResumeBody | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch resume section from Supabase when opened (only once per mount)
  useEffect(() => {
    if (!isOpen || hasLoaded) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("home_sections")
          .select("key, title, description, body")
          .eq("key", "resume")
          .maybeSingle();

        if (cancelled) return;

        console.log("[ResumeModal] supabase result:", { data, error });

        if (error) {
          console.error("[ResumeModal] supabase error:", error);
          setBody(null);
          setHasLoaded(true);
          return;
        }

        const row = data as ResumeSectionWire | null;

        // --- NORMALIZE body: handle stringified JSON or direct JSONB object ---
        let config: any = null;
        if (row?.body) {
          if (typeof row.body === "string") {
            try {
              config = JSON.parse(row.body);
            } catch (e) {
              console.warn("[ResumeModal] failed to parse body JSON string:", row.body, e);
            }
          } else if (typeof row.body === "object") {
            config = row.body;
          }
        }

        console.log("[ResumeModal] normalized body config:", config);

        let parsed: ResumeBody | null = null;
        if (config && typeof config === "object") {
          if (config.kind === "pdf" && config.url) {
            parsed = { kind: "pdf", url: String(config.url) };
          } else if (config.kind === "docx" && config.url) {
            parsed = { kind: "docx", url: String(config.url) };
          } else if (config.kind === "text" && typeof config.text === "string") {
            parsed = { kind: "text", text: config.text };
          }
        }

        setBody(parsed);
        setHasLoaded(true);
      } catch (e) {
        if (!cancelled) {
          console.error("[ResumeModal] unexpected error:", e);
          setBody(null);
          setHasLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoaded]);

  const canPrintInline = body?.kind === "text";

  const print = () => {
    if (!body) return;

    if (body.kind === "text") {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`
        <html>
          <head><title>Resume</title></head>
          <body style="padding:24px;font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap;">
            ${body.text.replace(/</g, "&lt;")}
          </body>
        </html>
      `);
      w.document.close();
      w.focus();
      w.print();
    } else {
      window.open(body.url, "_blank");
    }
  };

  // Pick viewer based on body.kind
  const viewer = useMemo(() => {
    if (!hasLoaded) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-white/70">
          Loading resume…
        </div>
      );
    }

    if (!body) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-white/70">
          No resume found.
        </div>
      );
    }

    if (body.kind === "pdf") {
      return (
        <iframe
          className="h-full w-full rounded-lg border border-white/10"
          src={`${body.url}#view=FitH`}
          title="Resume PDF"
        />
      );
    }

    if (body.kind === "docx") {
      const src =
        "https://view.officeapps.live.com/op/embed.aspx?src=" +
        encodeURIComponent(body.url);
      return (
        <iframe
          className="h-full w-full rounded-lg border border-white/10"
          src={src}
          title="Resume (DOCX)"
        />
      );
    }

    // Plain text
    return (
      <div className="h-full w-full overflow-auto rounded-lg border border-white/10 bg-white/5 p-4">
        <pre className="whitespace-pre-wrap text-sm text-white/90">
          {body.text || "Resume is empty."}
        </pre>
      </div>
    );
  }, [body, hasLoaded]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="
          flex
          h-[90vh]
          max-h-[95vh]
          w-[min(100vw-2rem,80rem)]
          max-w-5xl
          flex-col
          bg-slate-900/95
          text-white
          border-white/10
        "
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="text-2xl font-semibold">Resume</DialogTitle>
          <DialogDescription className="text-sm text-white/70">
            View or print my resume directly from here.
          </DialogDescription>
        </DialogHeader>

        {/* Viewer flexes to fill remaining space */}
        <div className="mt-3 flex-1 min-h-0 overflow-hidden">{viewer}</div>

        {/* Actions row pinned visually to bottom & centered */}
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="default"
            onClick={print}
            className="font-semibold"
            disabled={!body}
          >
            {canPrintInline ? "Print" : "Open to Print"}
          </Button>

          {body && body.kind !== "text" && (
            <Button
              type="button"
              variant="outline"
              asChild
              className="border-white/30 text-white hover:bg-white/10"
            >
              <a href={body.url} target="_blank" rel="noreferrer">
                Open Original
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
