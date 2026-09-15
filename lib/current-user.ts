import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Redirects to /login if unauthenticated. Use in server components/route handlers. */
export async function requireUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  return user;
}

/** Like requireUser, but also redirects to /onboarding if the profile isn't complete yet. */
export async function requireOnboardedUser() {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile || !profile.skills.length) redirect("/onboarding");
  return { user, profile };
}
