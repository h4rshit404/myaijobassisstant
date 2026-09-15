"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Search" },
  { href: "/dashboard/applied", label: "Applied" },
  { href: "/onboarding", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

function isActiveLink(href: string, pathname: string | null): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname?.startsWith("/dashboard/searches") === true;
  }
  return pathname?.startsWith(href) === true;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          myjobassistant
        </Link>

        {status === "authenticated" && (
          <nav className="hidden gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActiveLink(link.href, pathname) ? "secondary" : "ghost"}
                  size="sm"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {status === "authenticated" && session?.user ? (
            <>
              <Avatar className="h-7 w-7">
                <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
                <AvatarFallback>{session.user.name?.[0] ?? "U"}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
            </>
          ) : status === "loading" ? null : (
            <Button size="sm" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
