import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";
import { extractJobPostingsFromJsonLd } from "@/lib/scrapers/json-ld";

// Glassdoor's search pages sit behind an aggressive bot-detection layer and generally
// return a 403 "Security" page to a plain fetch. Attempted anyway, best-effort, with the
// same JSON-LD strategy as the other adapters; expect this to frequently return nothing.
export const glassdoorAdapter: JobSourceAdapter = {
  id: "glassdoor",
  label: "Glassdoor (best-effort public search)",
  requiresKey: false,

  async fetchJobs({ keywords, locations }) {
    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = new URL("https://www.glassdoor.co.in/Job/jobs.htm");
      url.searchParams.set("sc.keyword", keyword);
      url.searchParams.set("locT", "C");
      url.searchParams.set("locName", location);

      const res = await fetchPublic(url.toString());
      if (!res.ok) return [] as RawJob[];
      const html = await res.text();
      return extractJobPostingsFromJsonLd(html, "Glassdoor", location);
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
