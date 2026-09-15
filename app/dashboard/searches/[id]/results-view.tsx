"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailPreviewModal } from "@/components/email-preview-modal";

type EmailType = "HR" | "REFERRAL" | "UNKNOWN";
type SearchStatus = "PENDING" | "SCRAPING" | "ENRICHING" | "CLASSIFYING" | "DONE" | "FAILED";

interface Listing {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  sourcePlatform: string;
  sourceUrl: string | null;
  contactEmail: string | null;
  emailType: EmailType;
}

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
  listings: Listing[];
}

const IN_PROGRESS: SearchStatus[] = ["PENDING", "SCRAPING", "ENRICHING", "CLASSIFYING"];

const EMAIL_TYPE_LABEL: Record<EmailType, string> = {
  HR: "HR / Application",
  REFERRAL: "Referral",
  UNKNOWN: "Unclassified",
};
const EMAIL_TYPE_VARIANT: Record<EmailType, "default" | "secondary" | "outline"> = {
  HR: "default",
  REFERRAL: "secondary",
  UNKNOWN: "outline",
};

export function ResultsView({ initial }: { initial: JobSearchData }) {
  const [jobSearch, setJobSearch] = useState<JobSearchData>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalListingIds, setModalListingIds] = useState<string[]>([]);
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

  const applicableListings = jobSearch.listings.filter((l) => l.emailType !== "UNKNOWN" && l.contactEmail);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(jobSearch.listings.map((l) => l.id)) : new Set());
  }

  function openPreview(ids: string[]) {
    if (!ids.length) {
      toast.error("No listings with a classified contact email to apply to");
      return;
    }
    setModalListingIds(ids);
    setModalOpen(true);
  }

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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {jobSearch.listings.length} listing{jobSearch.listings.length === 1 ? "" : "s"} with a
          classified contact email &middot; jobs without one, or already applied to, are left out
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openPreview(Array.from(selected))}>
            Apply (Selected)
          </Button>
          <Button
            size="sm"
            onClick={() => openPreview(applicableListings.map((l) => l.id))}
          >
            Apply to All
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={jobSearch.listings.length > 0 && selected.size === jobSearch.listings.length}
                  onCheckedChange={(c) => toggleAll(c === true)}
                />
              </TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobSearch.listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  {IN_PROGRESS.includes(jobSearch.status) ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching platforms...
                    </span>
                  ) : (
                    "No listings with a contact email for this search (postings without one, or already applied to, are left out)."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              jobSearch.listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(listing.id)}
                      onCheckedChange={(c) => toggleOne(listing.id, c === true)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    {listing.sourceUrl ? (
                      <a
                        href={listing.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-medium hover:underline"
                      >
                        {listing.title}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium">{listing.title}</span>
                    )}
                  </TableCell>
                  <TableCell>{listing.company ?? "—"}</TableCell>
                  <TableCell>{listing.location ?? "—"}</TableCell>
                  <TableCell>{listing.sourcePlatform}</TableCell>
                  <TableCell className="text-sm">{listing.contactEmail ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={EMAIL_TYPE_VARIANT[listing.emailType]}>
                      {EMAIL_TYPE_LABEL[listing.emailType]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {IN_PROGRESS.includes(jobSearch.status) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" /> Updating automatically...
        </p>
      )}

      <EmailPreviewModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobListingIds={modalListingIds}
        onSent={refreshAfterSend}
      />
    </div>
  );
}
