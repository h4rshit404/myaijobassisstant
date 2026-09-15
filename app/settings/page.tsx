import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const [keySet, gmailAccount] = await Promise.all([
    prisma.apiKeySet.findUnique({ where: { userId: user.id } }),
    prisma.gmailAccount.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your OpenAI key, optional job-source API keys, and Gmail connection.
      </p>
      <div className="mt-8">
        <SettingsForm
          openai={{
            hasKey: !!keySet?.openaiKeyEncrypted,
            isValid: keySet?.openaiIsValid ?? false,
            model: keySet?.openaiModel ?? "gpt-4o-mini",
            lastValidated: keySet?.openaiLastValidated?.toISOString() ?? null,
          }}
          scraperKeys={{
            adzunaAppId: !!keySet?.adzunaAppIdEncrypted,
            adzunaAppKey: !!keySet?.adzunaAppKeyEncrypted,
            rapidApiKey: !!keySet?.rapidApiKeyEncrypted,
            serpApiKey: !!keySet?.serpApiKeyEncrypted,
          }}
          gmail={
            gmailAccount
              ? {
                  email: gmailAccount.email,
                  scopes: gmailAccount.scopes,
                  connectedAt: gmailAccount.connectedAt.toISOString(),
                }
              : null
          }
        />
      </div>
    </div>
  );
}
