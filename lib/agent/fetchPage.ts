const MAX_CONTENT_LENGTH = 15_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function fetchPage(
  url: string
): Promise<{ text: string; status: number }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Capra/1.0; +https://capra.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const raw = await res.text();
    const text = stripHtml(raw).slice(0, MAX_CONTENT_LENGTH);
    return { text, status: res.status };
  } catch {
    return { text: "Failed to fetch page.", status: 0 };
  }
}
