import * as cheerio from "cheerio";

const MAX_LENGTH = 8000;

/** Strips an arbitrary HTML page down to its visible text — a generic fallback for job/company
 * pages that don't expose schema.org JobPosting JSON-LD. Good enough to let the AI classifier
 * find a contact email buried in the body copy of a career page or ATS listing. */
export function extractReadableText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header").remove();

  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  return text.slice(0, MAX_LENGTH);
}
