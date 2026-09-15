export interface RawJob {
  title: string;
  company?: string;
  location?: string;
  sourcePlatform: string;
  sourceUrl?: string;
  descriptionRaw?: string;
}

export interface DecryptedScraperKeys {
  adzunaAppId?: string;
  adzunaAppKey?: string;
  rapidApiKey?: string;
  serpApiKey?: string;
}

export interface ScraperParams {
  keywords: string[];
  locations: string[];
  keys: DecryptedScraperKeys;
}

export interface JobSourceAdapter {
  /** Matches the platform id used in JobSearch.platforms and the UI checkboxes. */
  id: string;
  label: string;
  /** If true, this adapter is skipped entirely when the required key isn't configured. */
  requiresKey: boolean;
  /** Only relevant when requiresKey is true. */
  isConfigured?(keys: DecryptedScraperKeys): boolean;
  fetchJobs(params: ScraperParams): Promise<RawJob[]>;
}

export interface SourceRunResult {
  platform: string;
  ok: boolean;
  count: number;
  error?: string;
  skipped?: boolean;
}
