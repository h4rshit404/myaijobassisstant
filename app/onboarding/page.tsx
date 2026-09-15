import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload your resume so we can pre-fill your profile, and share a Drive link — it&apos;s
        the link we&apos;ll include in outreach emails sent on your behalf.
      </p>
      <div className="mt-8">
        <OnboardingForm
          initialProfile={
            profile
              ? {
                  resumeFileUrl: profile.resumeFileUrl,
                  resumeFileName: profile.resumeFileName,
                  resumeDriveLink: profile.resumeDriveLink,
                  headline: profile.headline ?? "",
                  summary: profile.summary ?? "",
                  experienceYears: profile.experienceYears ?? 0,
                  skills: profile.skills,
                  targetLocations: profile.targetLocations,
                  outreachPreferences:
                    (profile.outreachPreferences as { tone?: string; notes?: string } | null) ?? {
                      tone: "friendly",
                      notes: "",
                    },
                }
              : null
          }
        />
      </div>
    </div>
  );
}
