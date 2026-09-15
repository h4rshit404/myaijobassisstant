import { prisma } from "@/lib/prisma";
import { ALL_ADAPTERS } from "@/lib/scrapers/registry";
import { getScraperKeysForUser } from "@/lib/scrapers/keys";
import { dedupeHash } from "@/lib/scrapers/dedupe";
import type { RawJob, SourceRunResult } from "@/lib/scrapers/types";

const ADAPTER_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

async function persistJobs(jobSearchId: string, jobs: RawJob[]): Promise<number> {
  if (!jobs.length) return 0;

  const rows = jobs
    .filter((j) => j.title?.trim())
    .map((j) => ({
      jobSearchId,
      title: j.title.trim(),
      company: j.company?.trim() || null,
      location: j.location?.trim() || null,
      sourcePlatform: j.sourcePlatform,
      sourceUrl: j.sourceUrl || null,
      descriptionRaw: j.descriptionRaw || null,
      dedupeHash: dedupeHash(j.title, j.company, j.location),
    }));

  const result = await prisma.jobListing.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/** Runs every selected platform's adapter in parallel, each isolated behind its own timeout
 * and try/catch, persists whatever each one finds, and always resolves — a source failing
 * (blocked, timed out, threw) never prevents the others from completing. */
export async function runScrapePipeline(params: {
  jobSearchId: string;
  userId: string;
  keywords: string[];
  locations: string[];
  platforms: string[];
}): Promise<SourceRunResult[]> {
  const { jobSearchId, userId, keywords, locations, platforms } = params;
  const keys = await getScraperKeysForUser(userId);
  const adapters = ALL_ADAPTERS.filter((a) => platforms.includes(a.id));

  const runs = await Promise.allSettled(
    adapters.map(async (adapter): Promise<SourceRunResult> => {
      if (adapter.requiresKey && adapter.isConfigured && !adapter.isConfigured(keys)) {
        return { platform: adapter.label, ok: true, count: 0, skipped: true };
      }

      try {
        const jobs = await withTimeout(
          adapter.fetchJobs({ keywords, locations, keys }),
          ADAPTER_TIMEOUT_MS,
          [] as RawJob[]
        );
        const persisted = await persistJobs(jobSearchId, jobs);
        return { platform: adapter.label, ok: true, count: persisted };
      } catch (err) {
        return {
          platform: adapter.label,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );

  return runs.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { platform: "unknown", ok: false, count: 0, error: String(r.reason) }
  );
}
