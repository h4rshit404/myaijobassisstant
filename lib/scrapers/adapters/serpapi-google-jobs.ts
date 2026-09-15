import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { mapWithConcurrency } from "@/lib/scrapers/http";

interface SerpApiJobResult {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  share_link?: string;
  apply_options?: { link?: string }[];
}

export const serpApiGoogleJobsAdapter: JobSourceAdapter = {
  id: "google_jobs",
  label: "Google Jobs (via SerpAPI)",
  requiresKey: true,
  isConfigured: (keys) => !!keys.serpApiKey,

  async fetchJobs({ keywords, locations, keys }) {
    if (!keys.serpApiKey) return [];

    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_jobs");
      url.searchParams.set("q", `${keyword} ${location}`);
      url.searchParams.set("location", location);
      url.searchParams.set("api_key", keys.serpApiKey!);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as { jobs_results?: SerpApiJobResult[] };
        return (data.jobs_results ?? []).map(
          (r): RawJob => ({
            title: r.title ?? "Untitled role",
            company: r.company_name,
            location: r.location ?? location,
            sourcePlatform: "Google Jobs",
            sourceUrl: r.apply_options?.[0]?.link ?? r.share_link,
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
