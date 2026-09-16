/** Hostnames that are job boards or third-party ATS platforms, never the hiring company's
 * own domain — a sourceUrl on one of these tells us nothing about the company's email
 * domain, so it must not be passed to the AI guesser as a "verified domain" hint. */
const KNOWN_NON_COMPANY_DOMAINS = [
  // ATS / applicant tracking
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "workday.com",
  "smartrecruiters.com",
  "icims.com",
  "taleo.net",
  "bamboohr.com",
  "zohorecruit.com",
  "breezy.hr",
  "jazzhr.com",
  "workable.com",
  "ashbyhq.com",
  "recruitee.com",
  "successfactors.com",
  "oraclecloud.com",
  "ultipro.com",
  "adp.com",
  "ceipal.com",
  "freshteam.com",
  "keka.com",
  // job boards / aggregators
  "linkedin.com",
  "naukri.com",
  "indeed.com",
  "in.indeed.com",
  "glassdoor.com",
  "glassdoor.co.in",
  "monster.com",
  "wellfound.com",
  "angel.co",
  "jooble.org",
  "adzuna.com",
  "adzuna.co.in",
  "ziprecruiter.com",
  "hirist.tech",
  "instahyre.com",
  "cutshort.io",
  "shine.com",
  "timesjobs.com",
];

/** Returns a company-domain hint from a listing's sourceUrl, or null if the host is a known
 * job board / ATS (i.e. not actually the company's own domain). */
export function extractTrustedDomainHint(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;

  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    const isKnownNonCompany = KNOWN_NON_COMPANY_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
    return isKnownNonCompany ? null : host;
  } catch {
    return null;
  }
}
