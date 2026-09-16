interface HunterEmail {
  value: string;
  type?: "generic" | "personal";
  confidence?: number;
  position?: string | null;
  department?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface HunterDomainSearchResponse {
  data?: { emails?: HunterEmail[] };
  errors?: { code: number; details: string }[];
}

export interface HunterContact {
  contactEmail: string;
  contactName: string | null;
  emailType: "HR" | "REFERRAL";
  confidence: number;
}

function fullName(email: HunterEmail): string | null {
  const name = [email.first_name, email.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

const HR_LOCAL_PART_HINTS = ["hr", "career", "recruit", "talent", "jobs", "hiring", "people"];
const HR_ROLE_HINTS = ["hr", "human resources", "recruit", "talent", "people"];

function looksLikeHrAddress(email: string): boolean {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  return HR_LOCAL_PART_HINTS.some((hint) => localPart.includes(hint));
}

function looksLikeHrRole(email: HunterEmail): boolean {
  const text = `${email.position ?? ""} ${email.department ?? ""}`.toLowerCase();
  return HR_ROLE_HINTS.some((hint) => text.includes(hint));
}

function pickBestContact(emails: HunterEmail[]): HunterContact | null {
  const withValue = emails.filter((e) => e.value);
  if (!withValue.length) return null;

  // 1. A generic/role inbox that reads as HR (hr@, careers@, recruiting@...) — highest priority.
  const genericHr = withValue.find((e) => e.type === "generic" && looksLikeHrAddress(e.value));
  if (genericHr) {
    return {
      contactEmail: genericHr.value,
      contactName: fullName(genericHr),
      emailType: "HR",
      confidence: (genericHr.confidence ?? 70) / 100,
    };
  }

  // 2. A named person whose role is HR/recruiting — personal address, HR role.
  const personalHr = withValue.find((e) => e.type === "personal" && looksLikeHrRole(e));
  if (personalHr) {
    return {
      contactEmail: personalHr.value,
      contactName: fullName(personalHr),
      emailType: "HR",
      confidence: (personalHr.confidence ?? 60) / 100,
    };
  }

  // 3. Any other generic company inbox — treat as the HR/careers bucket.
  const anyGeneric = withValue.find((e) => e.type === "generic");
  if (anyGeneric) {
    return {
      contactEmail: anyGeneric.value,
      contactName: fullName(anyGeneric),
      emailType: "HR",
      confidence: (anyGeneric.confidence ?? 50) / 100,
    };
  }

  // 4. Any named working professional at the company — a referral candidate.
  const bestPersonal = [...withValue]
    .filter((e) => e.type === "personal")
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (bestPersonal) {
    return {
      contactEmail: bestPersonal.value,
      contactName: fullName(bestPersonal),
      emailType: "REFERRAL",
      confidence: (bestPersonal.confidence ?? 40) / 100,
    };
  }

  return null;
}

/** Looks up real HR/careers and working-professional emails for a company via Hunter.io's
 * Domain Search (by company name — Hunter resolves the domain itself). Best-effort: quota
 * exhaustion, an unknown company, or a network error all just yield null rather than
 * throwing, so callers can treat "no contact found" as a normal outcome. */
export async function findCompanyContact(
  companyName: string,
  apiKey: string
): Promise<HunterContact | null> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("company", companyName);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as HunterDomainSearchResponse;
    if (data.errors?.length) return null;

    return pickBestContact(data.data?.emails ?? []);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
