import * as cheerio from "cheerio";
import type { RawJob } from "@/lib/scrapers/types";

interface JsonLdAddress {
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
}
interface JsonLdJobPosting {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: JsonLdAddress } | { address?: JsonLdAddress }[];
  url?: string;
  "@graph"?: JsonLdJobPosting[];
}

/** Many job boards embed schema.org JobPosting structured data (originally meant for Google
 * Jobs indexing) in <script type="application/ld+json"> tags on their public pages. Parsing
 * that is far more robust than guessing CSS class names, when it's present. */
export function extractJobPostingsFromJsonLd(
  html: string,
  sourcePlatform: string,
  fallbackLocation?: string
): RawJob[] {
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const top = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of top as JsonLdJobPosting[]) {
      const candidates = entry?.["@graph"] ?? [entry];
      for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        const type = c["@type"];
        const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
        if (!isJobPosting) continue;

        const loc = c.jobLocation;
        const address = Array.isArray(loc) ? loc[0]?.address : loc?.address;
        const locationStr = address
          ? [address.addressLocality, address.addressRegion, address.addressCountry]
              .filter(Boolean)
              .join(", ")
          : undefined;

        jobs.push({
          title: c.title || "Untitled role",
          company: c.hiringOrganization?.name,
          location: locationStr || fallbackLocation,
          sourcePlatform,
          sourceUrl: c.url,
          descriptionRaw: typeof c.description === "string" ? c.description : undefined,
        });
      }
    }
  });

  return jobs;
}
