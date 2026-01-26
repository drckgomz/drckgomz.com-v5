// src/components/admin/editor/Editor.tsx
"use client";

import React, {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { cn } from "@/lib/utils/utils";

export type EditorHandle = {
  insertMediaPlaceholder: (opts: {
    id: string;
    type: "image" | "youtube" | "instagram";
    caption?: string | null;
    title?: string | null;
  }) => void;

  updateMediaCaption: (opts: {
    id: string;
    type?: "image" | "youtube" | "instagram";
    caption?: string | null;
    title?: string | null;
  }) => void;

  removeMediaPlaceholders: (id: string) => void;
  focus: () => void;
};

type EditorProps = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
};

function isNodeInside(root: Node, n: Node | null | undefined) {
  if (!n) return false;
  let cur: Node | null = n;
  while (cur) {
    if (cur === root) return true;
    cur = cur.parentNode;
  }
  return false;
}

function buildPlaceholderText(
  id: string,
  type: string | undefined,
  caption: string | null | undefined,
  title: string | null | undefined
) {
  const t = (type ?? "media").toUpperCase();
  const label = (caption ?? title ?? `Untitled ${t}`).trim();
  return `[MEDIA ${t}: ${label} (${id})]`;
}

function placeholderRegexForId(id: string) {
  return new RegExp(String.raw`\[MEDIA\s+[A-Z]+:\s*.*?\s*\(${id}\)\]`, "g");
}

const Editor = forwardRef<EditorHandle, EditorProps>(
  ({ value, onChange, className }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);
    const lastExternalValueRef = useRef<string>("");
    const savedRangeRef = useRef<Range | null>(null);

    useLayoutEffect(() => {
      const el = divRef.current;
      if (!el) return;

      if (value !== lastExternalValueRef.current) {
        el.innerHTML = value || "";
        lastExternalValueRef.current = value || "";

        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);

        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          savedRangeRef.current = range.cloneRange();
        }
      }
    }, [value]);

    const pushChange = () => {
      const el = divRef.current;
      if (!el) return;
      const html = el.innerHTML;
      lastExternalValueRef.current = html;
      onChange(html);
    };

    useEffect(() => {
      const el = divRef.current;
      if (!el) return;

      const updateSavedRange = () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        if (isNodeInside(el, r.startContainer) && isNodeInside(el, r.endContainer)) {
          savedRangeRef.current = r.cloneRange();
        }
      };

      el.addEventListener("mouseup", updateSavedRange);
      el.addEventListener("keyup", updateSavedRange);
      document.addEventListener("selectionchange", updateSavedRange);

      return () => {
        el.removeEventListener("mouseup", updateSavedRange);
        el.removeEventListener("keyup", updateSavedRange);
        document.removeEventListener("selectionchange", updateSavedRange);
      };
    }, []);

    const restoreSavedRangeOrEnd = () => {
      const el = divRef.current;
      if (!el) return null;
      const sel = window.getSelection();
      if (!sel) return null;

      let range: Range | null = null;

      if (savedRangeRef.current) {
        range = savedRangeRef.current.cloneRange();
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }

      sel.removeAllRanges();
      sel.addRange(range);
      return range;
    };

    const insertMediaPlaceholder = (opts: {
      id: string;
      type: "image" | "youtube" | "instagram";
      caption?: string | null;
      title?: string | null;
    }) => {
      const el = divRef.current;
      if (!el) return;

      const text = buildPlaceholderText(opts.id, opts.type, opts.caption, opts.title);

      el.focus();
      const range = restoreSavedRangeOrEnd();

      // placeholder chip (theme-friendly)
      const span = document.createElement("span");
      span.className =
        "media-placeholder inline-flex items-center rounded-md " +
        "bg-cyan-500/10 px-1.5 py-0.5 " +
        "text-cyan-300 ring-1 ring-cyan-400/30 " +
        "font-semibold tracking-wide";
      span.textContent = text;

      // zero-width space so caret can move past the chip
      const zwsp = document.createElement("span");
      zwsp.textContent = "\u200B";

      const sel = window.getSelection();
      if (range && sel) {
        range.deleteContents();
        const frag = document.createDocumentFragment();
        frag.appendChild(span);
        frag.appendChild(zwsp);
        range.insertNode(frag);

        const newRange = document.createRange();
        newRange.setStartAfter(zwsp);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedRangeRef.current = newRange.cloneRange();
      } else {
        el.append(span, zwsp);
      }

      pushChange();
    };

    const updateMediaCaption = (opts: {
      id: string;
      type?: "image" | "youtube" | "instagram";
      caption?: string | null;
      title?: string | null;
    }) => {
      const el = divRef.current;
      if (!el) return;

      const wanted = buildPlaceholderText(opts.id, opts.type, opts.caption, opts.title);
      const re = placeholderRegexForId(opts.id);

      // Update chip placeholders
      const spans = el.querySelectorAll<HTMLSpanElement>("span.media-placeholder");
      spans.forEach((s) => {
        const txt = s.textContent || "";
        if (txt.includes(`(${opts.id})]`)) s.textContent = wanted;
      });

      // Update any raw text placeholders
      const htmlBefore = el.innerHTML;
      const htmlAfter = htmlBefore.replace(re, wanted);
      if (htmlAfter !== htmlBefore) {
        el.innerHTML = htmlAfter;
      }

      pushChange();
    };

    const removeMediaPlaceholders = (id: string) => {
      const el = divRef.current;
      if (!el) return;

      const re = placeholderRegexForId(id);

      const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("span.media-placeholder"));
      spans.forEach((s) => {
        const txt = s.textContent || "";
        if (txt.includes(`(${id})]`)) {
          const next = s.nextSibling;
          s.remove();
          if (next && next.nodeType === Node.TEXT_NODE && (next as Text).data === "\u200B") {
            next.parentNode?.removeChild(next);
          }
        }
      });

      const htmlBefore = el.innerHTML;
      const htmlAfter = htmlBefore.replace(re, "");
      if (htmlAfter !== htmlBefore) {
        el.innerHTML = htmlAfter;
      }

      pushChange();
    };

    useImperativeHandle(ref, () => ({
      insertMediaPlaceholder,
      updateMediaCaption,
      removeMediaPlaceholders,
      focus: () => divRef.current?.focus(),
    }));

    return (
      <div
        ref={divRef}
        contentEditable
        onInput={pushChange}
        spellCheck
        className={cn(
          // theme-friendly editor surface
          "min-h-[520px] w-full rounded-xl border border-border bg-background",
          "px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // make paragraphs not look cramped
          "[&_p]:my-2 [&_br]:leading-6",
          className
        )}
      />
    );
  }
);

Editor.displayName = "Editor";
export default Editor;
