/** Existing slugs are identifiers, not new title suggestions. Preserve case/Unicode/literal punctuation. */
export const slugDraft = (value: string) => value;
export const slugFinalize = (value: string) => value.trim();
