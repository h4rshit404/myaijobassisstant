"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobListingsBoard, type JobListing } from "@/components/job-listings-board";

type SearchStatus = "PENDING" | "SCRAPING" | "ENRICHING" | "CLASSIFYING" | "DONE" | "FAILED";

interface SourceStatusEntry {
  platform: string;
  ok: boolean;
  count: number;
  error?: string;
  skipped?: boolean;
}

interface JobSearchData {
  id: string;
  keywords: string[];
  locations: string[];
  platforms: string[];
  status: SearchStatus;
  sourceStatus: SourceStatusEntry[] | null;
  errorMessage: string | null;
  listings: JobListing[];
}

const IN_PROGRESS: SearchStatus[] = ["PENDING", "SCRAPING", "ENRICHING", "CLASSIFYING"];

export function ResultsView({ initial }: { initial: JobSearchData }) {
  const [jobSearch, setJobSearch] = useState<JobSearchData>(initial);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!IN_PROGRESS.includes(jobSearch.status)) return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/search/${jobSearch.id}/status`);
      if (!res.ok) return;
      const data = await res.json();
      setJobSearch(data.jobSearch);
    }, 2500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobSearch.status, jobSearch.id]);

  async function refreshAfterSend() {
    const res = await fetch(`/api/search/${jobSearch.id}/status`);
    if (res.ok) setJobSearch((await res.json()).jobSearch);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{jobSearch.keywords.join(", ")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{jobSearch.locations.join(", ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {IN_PROGRESS.includes(jobSearch.status) && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> {jobSearch.status}
            </Badge>
          )}
          {jobSearch.status === "DONE" && <Badge>Done</Badge>}
          {jobSearch.status === "FAILED" && <Badge variant="destructive">Failed</Badge>}
        </div>
      </div>

      {jobSearch.sourceStatus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Source status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            {jobSearch.sourceStatus.map((s) => (
              <Badge
                key={s.platform}
                variant={s.skipped ? "outline" : s.ok ? "secondary" : "destructive"}
                title={s.error}
              >
                {s.platform}: {s.skipped ? "skipped (no key)" : s.ok ? `${s.count} found` : "failed"}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {jobSearch.errorMessage && (
        <p className="text-sm text-destructive">Search failed: {jobSearch.errorMessage}</p>
      )}

      <JobListingsBoard
        listings={jobSearch.listings}
        onApplied={refreshAfterSend}
        emptyMessage="No listings with a contact email for this search (postings without one, or already applied to, are left out)."
        loadingMessage={
          IN_PROGRESS.includes(jobSearch.status) ? "Searching platforms..." : undefined
        }
      />

      {IN_PROGRESS.includes(jobSearch.status) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" /> Updating automatically...
        </p>
      )}
    </div>
  );
}
