import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos, guessCountryCode } from "@/lib/scrapers/locations";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";
import { extractJobPostingsFromJsonLd } from "@/lib/scrapers/json-ld";

// Indeed's search pages generally return a 403 bot challenge to plain server-side fetches.
// We still attempt a plain, unauthenticated GET (no CAPTCHA solving, no headless-browser
// evasion) and fall back to an empty result on failure, which the pipeline treats as this
// source simply contributing nothing for that run.
export const indeedAdapter: JobSourceAdapter = {
  id: "indeed",
  label: "Indeed (best-effort public search)",
  requiresKey: false,

  async fetchJobs({ keywords, locations }) {
    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const country = guessCountryCode(location);
      const host = country === "in" ? "in.indeed.com" : "www.indeed.com";
      const url = new URL(`https://${host}/jobs`);
      url.searchParams.set("q", keyword);
      url.searchParams.set("l", location);

      const res = await fetchPublic(url.toString());
      if (!res.ok) return [] as RawJob[];
      const html = await res.text();
      return extractJobPostingsFromJsonLd(html, "Indeed", location);
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
