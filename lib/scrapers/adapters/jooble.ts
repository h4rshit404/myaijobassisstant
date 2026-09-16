import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { mapWithConcurrency } from "@/lib/scrapers/http";

interface JoobleResult {
  title?: string;
  location?: string;
  snippet?: string;
  link?: string;
  company?: string;
}

export const joobleAdapter: JobSourceAdapter = {
  id: "jooble",
  label: "Jooble",
  requiresKey: true,
  isConfigured: (keys) => !!keys.joobleApiKey,

  async fetchJobs({ keywords, locations, keys }) {
    if (!keys.joobleApiKey) return [];

    const combos = buildCombos(keywords, locations);
    const settled = await mapWithConcurrency(combos, 4, async ({ keyword, location }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`https://jooble.org/api/${keys.joobleApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: keyword, location }),
          signal: controller.signal,
        });
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as { jobs?: JoobleResult[] };
        return (data.jobs ?? []).map(
          (r): RawJob => ({
            title: r.title ?? "Untitled role",
            company: r.company,
            location: r.location ?? location,
            sourcePlatform: "Jooble",
            sourceUrl: r.link,
            descriptionRaw: r.snippet,
          })
        );
      } finally {
        clearTimeout(timer);
      }
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
