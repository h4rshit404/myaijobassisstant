"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailPreviewModal } from "@/components/email-preview-modal";

export type EmailType = "HR" | "REFERRAL" | "UNKNOWN";
export type EmailSource = "SCRAPED" | "HUNTER" | "AI_GUESSED" | null;

export interface JobListing {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  sourcePlatform: string;
  sourceUrl: string | null;
  contactEmail: string | null;
  emailType: EmailType;
  emailSource: EmailSource;
}

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

/** The checkbox table + Apply (Selected)/Apply to All actions + send-preview modal, shared
 * between a single search's results page and the cross-search queue page. Purely
 * presentational over whatever `listings` it's given — the caller owns fetching/pagination
 * and is told (via onApplied) when to refresh after a send completes. */
export function JobListingsBoard({
  listings,
  onApplied,
  emptyMessage,
  loadingMessage,
}: {
  listings: JobListing[];
  onApplied?: () => void;
  emptyMessage: string;
  loadingMessage?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalListingIds, setModalListingIds] = useState<string[]>([]);

  const applicableListings = listings.filter((l) => l.emailType !== "UNKNOWN" && l.contactEmail);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(listings.map((l) => l.id)) : new Set());
  }

  function openPreview(ids: string[]) {
    if (!ids.length) {
      toast.error("No listings with a classified contact email to apply to");
      return;
    }
    setModalListingIds(ids);
    setModalOpen(true);
  }

  function handleSent() {
    setSelected(new Set());
    onApplied?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {listings.length} listing{listings.length === 1 ? "" : "s"} with a classified contact
          email &middot; jobs without one, or already applied to, are left out
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openPreview(Array.from(selected))}>
            Apply (Selected)
          </Button>
          <Button size="sm" onClick={() => openPreview(applicableListings.map((l) => l.id))}>
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
                  checked={listings.length > 0 && selected.size === listings.length}
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
            {listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  {loadingMessage ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {loadingMessage}
                    </span>
                  ) : (
                    emptyMessage
                  )}
                </TableCell>
              </TableRow>
            ) : (
              listings.map((listing) => (
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
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {listing.contactEmail ?? "—"}
                      {listing.emailSource === "AI_GUESSED" && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-600 border-amber-300"
                          title="AI-inferred guess from the company name — not scraped or verified. Double-check before relying on it."
                        >
                          <Sparkles className="h-3 w-3" /> Guessed
                        </Badge>
                      )}
                    </div>
                  </TableCell>
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

      <EmailPreviewModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jobListingIds={modalListingIds}
        onSent={handleSent}
      />
    </div>
  );
}
