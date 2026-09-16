import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaginationControls({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const prevHref = `${basePath}?page=${page - 1}`;
  const nextHref = `${basePath}?page=${page + 1}`;

  return (
    <div className="flex items-center justify-center gap-3">
      <PageLink href={prevHref} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </PageLink>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <PageLink href={nextHref} disabled={page >= totalPages}>
        Next <ChevronRight className="h-4 w-4" />
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const classes = cn(buttonVariants({ variant: "outline", size: "sm" }), disabled && "pointer-events-none opacity-40");

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
