import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";
import { extractJobPostingsFromJsonLd } from "@/lib/scrapers/json-ld";
import { slugify } from "@/lib/scrapers/slug";

interface HiristJob {
  title?: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  locationName?: string;
  jobUrl?: string;
  slug?: string;
  description?: string;
}

function extractPreloadedFeed(html: string, fallbackLocation: string): RawJob[] {
  const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});?\s*<\/script>/s);
  if (!match) return [];

  try {
    const state = JSON.parse(match[1]) as { feed?: { jobFeed?: HiristJob[] } };
    const jobFeed = state.feed?.jobFeed ?? [];
    return jobFeed.map(
      (j): RawJob => ({
        title: j.title ?? j.jobTitle ?? "Untitled role",
        company: j.companyName,
        location: j.location ?? j.locationName ?? fallbackLocation,
        sourcePlatform: "Hirist",
        sourceUrl: j.jobUrl ?? (j.slug ? `https://www.hirist.tech/j/${j.slug}` : undefined),
        descriptionRaw: j.description,
      })
    );
  } catch {
    return [];
  }
}

// Hirist server-renders an initial Redux state blob (window.__PRELOADED_STATE__) which,
// when the page's own query matches how the frontend fetches results, includes the job
// list directly — no API key or login needed. The exact query shape isn't publicly
// documented, so this can legitimately return zero results if the page didn't populate
// feed.jobFeed for a given URL. JSON-LD is tried as a secondary, more standard fallback.
export const hiristAdapter: JobSourceAdapter = {
  id: "hirist",
  label: "Hirist (best-effort public search)",
  requiresKey: false,

  async fetchJobs({ keywords, locations }) {
    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = `https://www.hirist.tech/search/${slugify(keyword)}-jobs-in-${slugify(location)}`;
      const res = await fetchPublic(url);
      if (!res.ok) return [] as RawJob[];
      const html = await res.text();

      const fromState = extractPreloadedFeed(html, location);
      if (fromState.length) return fromState;
      return extractJobPostingsFromJsonLd(html, "Hirist", location);
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
