import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { mapWithConcurrency } from "@/lib/scrapers/http";

interface JSearchResult {
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_apply_link?: string;
  job_description?: string;
  job_publisher?: string;
}

// JSearch (RapidAPI) aggregates Indeed, LinkedIn, Glassdoor, ZipRecruiter and more, and
// reports which one each listing actually came from via `job_publisher` — we use that as
// the Source Platform so results still reflect where the posting is really from.
export const jsearchAdapter: JobSourceAdapter = {
  id: "jsearch",
  label: "JSearch (aggregates Indeed, LinkedIn, Glassdoor & more)",
  requiresKey: true,
  isConfigured: (keys) => !!keys.rapidApiKey,

  async fetchJobs({ keywords, locations, keys }) {
    if (!keys.rapidApiKey) return [];

    const combos = buildCombos(keywords, locations);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = new URL("https://jsearch.p.rapidapi.com/search");
      url.searchParams.set("query", `${keyword} in ${location}`);
      url.searchParams.set("num_pages", "1");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            "X-RapidAPI-Key": keys.rapidApiKey!,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        });
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as { data?: JSearchResult[] };
        return (data.data ?? []).map(
          (r): RawJob => ({
            title: r.job_title ?? "Untitled role",
            company: r.employer_name,
            location: [r.job_city, r.job_state, r.job_country].filter(Boolean).join(", ") || location,
            sourcePlatform: r.job_publisher || "JSearch",
            sourceUrl: r.job_apply_link,
            descriptionRaw: r.job_description,
          })
        );
      } finally {
        clearTimeout(timer);
      }
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
