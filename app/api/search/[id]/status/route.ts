import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const jobSearch = await prisma.jobSearch.findFirst({
    where: { id, userId: user.id },
    include: { listings: { orderBy: { createdAt: "desc" } } },
  });

  if (!jobSearch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ jobSearch });
}
