/** Insert caption/placeholder text into existing HTML without creating new markup. */
export function replaceHtmlPlaceholder(html: string, pattern: RegExp, text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // A callback also keeps replacement-string sequences such as $& literal.
  return html.replace(pattern, () => escaped);
}
