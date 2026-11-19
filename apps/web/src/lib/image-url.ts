/**
 * Some file hosts hand out a "share page" link (an HTML preview) rather than a
 * link to the image bytes, so `<img src>` fails. Rewrite the common ones into a
 * direct-image URL; anything unrecognised is returned untouched.
 */
export function toDirectImageUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value; // not a full URL (yet) — leave it alone
  }

  const host = url.hostname.replace(/^www\./, "");

  // Dropbox: /scl/... and /s/... links render a preview unless `raw=1`.
  if (host === "dropbox.com") {
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
    return url.toString();
  }

  // Google Drive: .../file/d/<id>/view or ...?id=<id> → embeddable thumbnail.
  if (host === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }

  return value;
}
