import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { visibleListingsWhere } from "@/lib/scrapers/visible-listings";
import { ResultsView } from "./results-view";

export default async function SearchResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireOnboardedUser();
  const { id } = await params;

  const jobSearch = await prisma.jobSearch.findFirst({
    where: { id, userId: user.id },
    include: {
      listings: { where: visibleListingsWhere(), orderBy: { createdAt: "desc" } },
    },
  });

  if (!jobSearch) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ResultsView
        initial={JSON.parse(
          JSON.stringify({
            ...jobSearch,
            listings: jobSearch.listings,
          })
        )}
      />
    </div>
  );
}
