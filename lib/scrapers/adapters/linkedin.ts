import * as cheerio from "cheerio";
import type { JobSourceAdapter, RawJob } from "@/lib/scrapers/types";
import { buildCombos } from "@/lib/scrapers/locations";
import { fetchPublic, mapWithConcurrency } from "@/lib/scrapers/http";

// LinkedIn's public "guest" endpoint is the same one the logged-out job search page calls
// client-side to paginate results. It's unauthenticated, server-rendered HTML — no login,
// no CAPTCHA. Markup can change without notice, so this is intentionally isolated from the
// rest of the pipeline: a failure here just yields zero LinkedIn results.
export const linkedinAdapter: JobSourceAdapter = {
  id: "linkedin",
  label: "LinkedIn (best-effort public search)",
  requiresKey: false,

  async fetchJobs({ keywords, locations }) {
    const combos = buildCombos(keywords, locations, 3);
    const settled = await mapWithConcurrency(combos, 3, async ({ keyword, location }) => {
      const url = new URL("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search");
      url.searchParams.set("keywords", keyword);
      url.searchParams.set("location", location);
      url.searchParams.set("start", "0");

      const res = await fetchPublic(url.toString());
      if (!res.ok) return [] as RawJob[];
      const html = await res.text();
      const $ = cheerio.load(html);
      const jobs: RawJob[] = [];

      $("li").each((_, el) => {
        const card = $(el);
        const title = card.find(".base-search-card__title").text().trim();
        if (!title) return;
        jobs.push({
          title,
          company: card.find(".base-search-card__subtitle").text().trim() || undefined,
          location: card.find(".job-search-card__location").text().trim() || location,
          sourcePlatform: "LinkedIn",
          sourceUrl: card.find("a.base-card__full-link").attr("href")?.split("?")[0],
        });
      });

      return jobs;
    });

    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
};
