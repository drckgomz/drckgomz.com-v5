// src/components/admin/editor/Editor.tsx
"use client";

import { editableDocument, serializeEditableDocument } from "@/lib/cms/editor-dom";
import { editorLink, editorVideo } from "@/lib/cms/editor-policy";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { replaceHtmlPlaceholder } from "@/lib/content/placeholder";
import React, {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useState,
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
  readOnly?: boolean;
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
  ({ value, onChange, className, readOnly = false }, ref) => {
    const [dialog, setDialog] = useState<"link" | "video" | null>(null);
    const [url, setUrl] = useState("");
    const [urlError, setUrlError] = useState("");
    const divRef = useRef<HTMLDivElement>(null);
    const lastExternalValueRef = useRef<string>("");
    const savedRangeRef = useRef<Range | null>(null);

    useLayoutEffect(() => {
      const el = divRef.current;
      if (!el) return;

      if (value !== lastExternalValueRef.current) {
        el.innerHTML = editableDocument(value || "");
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
      if (readOnly) return;
      const html = serializeEditableDocument(el);
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

    function command(name: string, argument?: string) {
      if (readOnly) return;
      divRef.current?.focus();
      restoreSavedRangeOrEnd();
      document.execCommand(name, false, argument);
      pushChange();
    }

    function insertVideo(src: string) {
      const el = divRef.current;
      if (!el || readOnly) return;
      el.focus();
      const range = restoreSavedRangeOrEnd();
      if (!range) return;
      const frame = document.createElement("span");
      frame.setAttribute("data-editor-video", src);
      frame.setAttribute("contenteditable", "false");
      frame.setAttribute("role", "img");
      frame.setAttribute("aria-label", "YouTube video embed; use Preview to play");
      frame.className = "editor-video my-3 flex min-h-24 items-center rounded border border-border bg-muted p-4 text-sm text-muted-foreground";
      frame.textContent = "YouTube video embed — use Preview to play";
      range.deleteContents(); range.insertNode(frame); range.setStartAfter(frame); range.collapse(true);
      savedRangeRef.current = range.cloneRange();
      pushChange();
    }

    const insertMediaPlaceholder = (opts: {
      id: string;
      type: "image" | "youtube" | "instagram";
      caption?: string | null;
      title?: string | null;
    }) => {
      const el = divRef.current;
      if (!el || readOnly) return;

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
      const htmlAfter = replaceHtmlPlaceholder(htmlBefore, re, wanted);
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

    const tools = [
      ["Paragraph", "formatBlock", "p"], ["Heading 2", "formatBlock", "h2"], ["Heading 3", "formatBlock", "h3"],
      ["Bold", "bold"], ["Italic", "italic"], ["Bullet list", "insertUnorderedList"], ["Numbered list", "insertOrderedList"],
      ["Quote", "formatBlock", "blockquote"], ["Code block", "formatBlock", "pre"], ["Remove link", "unlink"], ["Undo", "undo"], ["Redo", "redo"],
    ];
    return (
      <div className="min-w-0 space-y-2">
      {!readOnly && <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap gap-1 rounded-lg border border-border p-2">
        {tools.map(([label, name, arg]) => <button key={label} type="button" onMouseDown={event => event.preventDefault()} onClick={() => command(name, arg)} className="min-h-11 rounded border border-border px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{label}</button>)}
        {(["link", "video"] as const).map(kind => <button key={kind} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setUrl(""); setUrlError(""); setDialog(kind); }} className="min-h-11 rounded border border-border px-3 text-sm">{kind === "link" ? "Insert link" : "Embed video"}</button>)}
      </div>}
      <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); divRef.current?.focus(); }}>
          <DialogTitle>{dialog === "video" ? "Embed YouTube video" : "Insert link"}</DialogTitle>
          <DialogDescription>{dialog === "video" ? "The editor keeps embeds inactive. Use the post preview to play. Private reader policy may restrict external embeds." : "Use a web, email, or root-relative link."}</DialogDescription>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            const accepted = dialog === "video" ? editorVideo(url) : editorLink(url);
            if (!accepted) { setUrlError("Enter a supported, safe URL."); return; }
            if (dialog === "video") insertVideo(accepted);
            else {
              const range = restoreSavedRangeOrEnd();
              if (range?.collapsed) {
                const anchor = document.createElement("a"); anchor.href = accepted; anchor.textContent = accepted; anchor.rel = "noopener noreferrer";
                range.insertNode(anchor); range.setStartAfter(anchor); range.collapse(true); savedRangeRef.current = range.cloneRange(); pushChange();
              }
              else command("createLink", accepted);
            }
            setDialog(null);
          }}>
            <label className="block">URL<input autoFocus value={url} onChange={event => setUrl(event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-3" /></label>
            {urlError && <p role="alert">{urlError}</p>}
            <button type="submit" className="rounded border border-border px-4 py-3">Insert</button>
          </form>
        </DialogContent>
      </Dialog>
      <div
        ref={divRef}
        role="textbox" aria-label="Post content" aria-multiline="true" aria-readonly={readOnly} contentEditable={!readOnly}
        onInput={pushChange}
        onDrop={(event) => event.preventDefault()}
        onPaste={(event) => {
          event.preventDefault();
          const el = divRef.current;
          const selection = window.getSelection();
          if (!el || !selection?.rangeCount) return;
          const range = selection.getRangeAt(0);
          if (!isNodeInside(el, range.commonAncestorContainer)) return;
          const html = event.clipboardData.getData("text/html");
          const fragment = html ? range.createContextualFragment(editableDocument(html)) : document.createTextNode(event.clipboardData.getData("text/plain"));
          range.deleteContents();
          range.insertNode(fragment);
          range.collapse(false);
          pushChange();
        }}
        suppressContentEditableWarning
        spellCheck
        className={cn(
          // theme-friendly editor surface
          "post-editor min-w-0 min-h-[520px] w-full rounded-xl border border-border bg-background",
          "px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // make paragraphs not look cramped
          "[&_p]:my-2 [&_br]:leading-6",
          className
        )}
      />
      </div>
    );
  }
);

Editor.displayName = "Editor";
export default Editor;
