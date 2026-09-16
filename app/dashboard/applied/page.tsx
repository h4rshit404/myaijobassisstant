import { ExternalLink, Sparkles } from "lucide-react";
import { requireOnboardedUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AppliedJobsPage() {
  const { user } = await requireOnboardedUser();

  const applied = await prisma.outboundEmail.findMany({
    where: { userId: user.id, status: "SENT" },
    include: { jobListing: true },
    orderBy: { sentAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applied jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs you&apos;ve already sent an outreach email to. These won&apos;t reappear in new
          search results.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applied.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No applications sent yet.
                </TableCell>
              </TableRow>
            ) : (
              applied.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="max-w-[260px]">
                    {email.jobListing.sourceUrl ? (
                      <a
                        href={email.jobListing.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-medium hover:underline"
                      >
                        {email.jobListing.title}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium">{email.jobListing.title}</span>
                    )}
                  </TableCell>
                  <TableCell>{email.jobListing.company ?? "—"}</TableCell>
                  <TableCell>{email.jobListing.location ?? "—"}</TableCell>
                  <TableCell>{email.jobListing.sourcePlatform}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {email.jobListing.contactEmail ?? "—"}
                      {email.jobListing.emailSource === "AI_GUESSED" && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-600 border-amber-300"
                          title="This was an AI-inferred guess, not a scraped or verified email."
                        >
                          <Sparkles className="h-3 w-3" /> Guessed
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={email.type === "APPLICATION" ? "default" : "secondary"}>
                      {email.type === "APPLICATION" ? "Job Application" : "Referral"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
