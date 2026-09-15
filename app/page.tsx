import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profile.skills.length) redirect("/onboarding");

  redirect("/dashboard");
}
