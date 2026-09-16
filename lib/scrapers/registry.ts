import type { JobSourceAdapter } from "@/lib/scrapers/types";
import { adzunaAdapter } from "@/lib/scrapers/adapters/adzuna";
import { jsearchAdapter } from "@/lib/scrapers/adapters/jsearch";
import { serpApiGoogleJobsAdapter } from "@/lib/scrapers/adapters/serpapi-google-jobs";
import { joobleAdapter } from "@/lib/scrapers/adapters/jooble";
import { linkedinAdapter } from "@/lib/scrapers/adapters/linkedin";
import { naukriAdapter } from "@/lib/scrapers/adapters/naukri";
import { indeedAdapter } from "@/lib/scrapers/adapters/indeed";
import { glassdoorAdapter } from "@/lib/scrapers/adapters/glassdoor";
import { hiristAdapter } from "@/lib/scrapers/adapters/hirist";

export const ALL_ADAPTERS: JobSourceAdapter[] = [
  adzunaAdapter,
  jsearchAdapter,
  serpApiGoogleJobsAdapter,
  joobleAdapter,
  linkedinAdapter,
  naukriAdapter,
  indeedAdapter,
  glassdoorAdapter,
  hiristAdapter,
];

export const PLATFORM_OPTIONS = ALL_ADAPTERS.map((a) => ({
  id: a.id,
  label: a.label,
  requiresKey: a.requiresKey,
}));
