/** URL policy shared by the editor controls; never accepts executable schemes. */
export function editorLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u0020\u007f\\<>"']/.test(trimmed) || trimmed.startsWith('//')) return null;
  if (/^\/(?!\/)/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function editorVideo(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.searchParams.get('v') || (/^\/(embed|shorts)\//.test(url.pathname) ? url.pathname.split('/')[2] : null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function protectedEditorImage(value: string): boolean {
  return /^\/api\/(?:dev\/legacy-media-preview\/[A-Za-z0-9_-]{1,128}|private\/journal-media\/[a-f0-9-]{36})$/i.test(value);
}
