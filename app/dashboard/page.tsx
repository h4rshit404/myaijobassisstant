import Link from "next/link";
import { requireOnboardedUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { PLATFORM_OPTIONS } from "@/lib/scrapers/registry";
import { SearchForm } from "./search-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SCRAPING: "secondary",
  CLASSIFYING: "secondary",
  DONE: "default",
  FAILED: "destructive",
};

export default async function DashboardPage() {
  const { user } = await requireOnboardedUser();

  const searches = await prisma.jobSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      keywords: true,
      locations: true,
      status: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search for jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Up to 10 keywords and 3 locations at a time, across as many platforms as you like.
        </p>
        <div className="mt-6">
          <SearchForm platforms={PLATFORM_OPTIONS} />
        </div>
      </div>

      {searches.length > 0 && (
        <div>
          <h2 className="text-lg font-medium">Recent searches</h2>
          <div className="mt-3 space-y-2">
            {searches.map((s) => (
              <Link key={s.id} href={`/dashboard/searches/${s.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{s.keywords.join(", ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.locations.join(", ")} &middot; {s._count.listings} listings &middot;{" "}
                        {new Date(s.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{s.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
