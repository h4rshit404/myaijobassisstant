import { requireOnboardedUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { visibleListingsWhere } from "@/lib/scrapers/visible-listings";
import { PaginationControls } from "@/components/pagination-controls";
import { SearchedView } from "./searched-view";

const PAGE_SIZE = 25;

export default async function SearchedJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await requireOnboardedUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.trunc(Number(pageParam) || 1));

  const where = { jobSearch: { userId: user.id }, ...visibleListingsWhere() };

  const [listings, total] = await Promise.all([
    prisma.jobListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.jobListing.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Searched jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every job with a classified contact email found across all your searches, queued
          until you apply — not just the one you last ran. {total} queued.
        </p>
      </div>

      <SearchedView listings={JSON.parse(JSON.stringify(listings))} />

      <PaginationControls page={page} totalPages={totalPages} basePath="/dashboard/searched" />
    </div>
  );
}
