"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface EmailDraft {
  id: string;
  jobListingId: string;
  jobTitle: string;
  company: string | null;
  contactEmail: string;
  type: "APPLICATION" | "REFERRAL";
  subject: string;
  body: string;
}

interface SendResult {
  id: string;
  status: "SENT" | "FAILED";
  error?: string;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  jobListingIds,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobListingIds: string[];
  onSent?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, SendResult>>({});

  useEffect(() => {
    if (!open) return;
    // Reset + kick off the fetch when the modal opens. These are intentional
    // synchronous resets driven by the `open` transition, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts([]);
    setResults({});
    setLoading(true);

    fetch("/api/emails/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobListingIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          onOpenChange(false);
          return;
        }
        setDrafts(data.drafts ?? []);
        setSkippedCount(data.skipped?.length ?? 0);
      })
      .catch(() => toast.error("Failed to generate email drafts"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateDraft(id: string, field: "subject" | "body", value: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafts: drafts.map(({ id, subject, body }) => ({ id, subject, body })),
        }),
      });
      const data = await res.json();
      const byId: Record<string, SendResult> = {};
      for (const r of data.results ?? []) byId[r.id] = r;
      setResults(byId);

      const sentCount = (data.results ?? []).filter((r: SendResult) => r.status === "SENT").length;
      const failedCount = (data.results ?? []).length - sentCount;
      if (sentCount) toast.success(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"}`);
      if (failedCount) toast.error(`${failedCount} email${failedCount === 1 ? "" : "s"} failed to send`);
      onSent?.();
    } catch {
      toast.error("Failed to send emails");
    } finally {
      setSending(false);
    }
  }

  const allDone = drafts.length > 0 && drafts.every((d) => results[d.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review outreach emails</DialogTitle>
          <DialogDescription>
            These will be sent from your connected Gmail account. Edit anything before sending.
            {skippedCount > 0 &&
              ` ${skippedCount} selected listing${skippedCount === 1 ? " was" : "s were"} skipped (no classified contact email).`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Drafting emails...
          </div>
        ) : drafts.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No emails could be drafted for the selected listings.
          </p>
        ) : (
          <div className="space-y-6">
            {drafts.map((draft, i) => {
              const result = results[draft.id];
              return (
                <div key={draft.id} className="space-y-3">
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {draft.jobTitle} {draft.company && `— ${draft.company}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To: {draft.contactEmail} &middot;{" "}
                        <Badge variant="outline" className="ml-1">
                          {draft.type === "APPLICATION" ? "Job Application" : "Referral Request"}
                        </Badge>
                      </p>
                    </div>
                    {result && (
                      <Badge variant={result.status === "SENT" ? "default" : "destructive"} className="gap-1">
                        {result.status === "SENT" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {result.status === "SENT" ? "Sent" : result.error ?? "Failed"}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={draft.subject}
                      onChange={(e) => updateDraft(draft.id, "subject", e.target.value)}
                      disabled={sending || !!result}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      rows={7}
                      value={draft.body}
                      onChange={(e) => updateDraft(draft.id, "body", e.target.value)}
                      disabled={sending || !!result}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {allDone ? "Close" : "Cancel"}
          </Button>
          {!allDone && (
            <Button onClick={handleSend} disabled={sending || loading || drafts.length === 0}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send {drafts.length} email{drafts.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
