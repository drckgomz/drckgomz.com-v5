/** Accept only literal root-relative public asset paths for video sources. */
export function isSafeLocalMediaPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (!/^\/[A-Za-z0-9_./-]*$/.test(value)) return false;

  const segments = value.split("/");
  return segments.every((segment) => segment !== "." && segment !== "..");
}
