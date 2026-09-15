import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { guessCountryCode } from "@/lib/scrapers/locations";
import { mapWithConcurrency } from "@/lib/scrapers/http";

interface AdzunaResult {
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  description?: string;
}

export const adzunaAdapter: JobSourceAdapter = {
  id: "adzuna",
  label: "Adzuna (Google Jobs & aggregated listings)",
  requiresKey: true,
  isConfigured: (keys) => !!keys.adzunaAppId && !!keys.adzunaAppKey,

  async fetchJobs({ keywords, locations, keys }) {
    if (!keys.adzunaAppId || !keys.adzunaAppKey) return [];

    const combos = buildCombos(keywords, locations);
    const settled = await mapWithConcurrency(combos, 4, async ({ keyword, location }) => {
      const country = guessCountryCode(location);
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
      url.searchParams.set("app_id", keys.adzunaAppId!);
      url.searchParams.set("app_key", keys.adzunaAppKey!);
      url.searchParams.set("what", keyword);
      url.searchParams.set("where", location);
      url.searchParams.set("results_per_page", "20");
      url.searchParams.set("content-type", "application/json");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as { results?: AdzunaResult[] };
        return (data.results ?? []).map(
          (r): RawJob => ({
            title: r.title ?? "Untitled role",
            company: r.company?.display_name,
            location: r.location?.display_name ?? location,
            sourcePlatform: "Adzuna",
            sourceUrl: r.redirect_url,
            descriptionRaw: r.description,
          })
        );
      } finally {
        clearTimeout(timer);
      }
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
