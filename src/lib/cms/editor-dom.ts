import { sanitizeBlogPreview } from '@/lib/blog/preview';
import { editorVideo, protectedEditorImage } from './editor-policy';

/** Do not contact third-party media hosts while editing a private draft. */
export function editableDocument(source: string): string {
  const doc = new DOMParser().parseFromString(sanitizeBlogPreview(source), 'text/html');
  doc.querySelectorAll('img').forEach(node => { if (!protectedEditorImage(node.getAttribute('src') || '')) node.remove(); });
  doc.querySelectorAll('video,audio,source,track').forEach(node => node.remove());
  doc.querySelectorAll('iframe').forEach(node => {
    const canonical = editorVideo(node.getAttribute('src') || '');
    if (!canonical) { node.remove(); return; }
    const placeholder = doc.createElement('span');
    placeholder.setAttribute('data-editor-video', canonical);
    placeholder.setAttribute('contenteditable', 'false');
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'YouTube video embed; use Preview to play');
    placeholder.className = 'editor-video my-3 flex min-h-24 items-center rounded border border-border bg-muted p-4 text-sm text-muted-foreground';
    placeholder.textContent = 'YouTube video embed — use Preview to play';
    node.replaceWith(placeholder);
  });
  return doc.body.innerHTML;
}

/** Strip UI-only iframe attributes and restore only a validated canonical URL. */
export function serializeEditableDocument(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-editor-video]').forEach(node => {
    const url = editorVideo(node.getAttribute('data-editor-video') || '');
    if (!url) { node.remove(); return; }
    const frame = clone.ownerDocument.createElement('iframe');
    frame.setAttribute('src', url); frame.setAttribute('title', 'YouTube video');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('referrerpolicy', 'no-referrer'); frame.setAttribute('loading', 'lazy');
    node.replaceWith(frame);
  });
  return clone.innerHTML;
}
