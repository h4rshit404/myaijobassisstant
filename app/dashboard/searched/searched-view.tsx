"use client";

import { useRouter } from "next/navigation";
import { JobListingsBoard, type JobListing } from "@/components/job-listings-board";

export function SearchedView({ listings }: { listings: JobListing[] }) {
  const router = useRouter();

  return (
    <JobListingsBoard
      listings={listings}
      onApplied={() => router.refresh()}
      emptyMessage="Nothing queued yet — run a search and its results with a contact email will show up here until you apply."
    />
  );
}
