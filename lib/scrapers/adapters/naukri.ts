import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";
import { extractJobPostingsFromJsonLd } from "@/lib/scrapers/json-ld";
import { slugify } from "@/lib/scrapers/slug";

// Naukri's search-result page is a client-rendered SPA shell with no server-rendered job
// data, and its internal JSON API requires solving a reCAPTCHA — which we deliberately do
// not attempt (that's anti-bot evasion, out of bounds for this app). This adapter fetches
// the public SEO page and looks for schema.org JobPosting JSON-LD, which Naukri sometimes
// includes for individual listing pages picked up by Google; it will often return zero
// results, and that's an acceptable, isolated outcome rather than something to work around.
export const naukriAdapter: JobSourceAdapter = {
  id: "naukri",
  label: "Naukri (best-effort public search)",
  requiresKey: false,

  async fetchJobs({ keywords, locations }) {
    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = `https://www.naukri.com/${slugify(keyword)}-jobs-in-${slugify(location)}`;
      const res = await fetchPublic(url);
      if (!res.ok) return [] as RawJob[];
      const html = await res.text();
      return extractJobPostingsFromJsonLd(html, "Naukri", location);
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
