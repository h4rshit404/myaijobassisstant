import { createHash } from "crypto";

export function dedupeHash(title: string, company: string | undefined, location: string | undefined): string {
  const normalized = `${title}|${company ?? ""}|${location ?? ""}`.toLowerCase().trim();
  return createHash("sha1").update(normalized).digest("hex");
}
