/** A listing is worth showing once it has a classified contact email, and only until it's
 * been applied to (a SENT outbound email moves it to the Applied Jobs section instead). */
export function visibleListingsWhere() {
  return {
    contactEmail: { not: null },
    outboundEmails: { none: { status: "SENT" as const } },
  };
}
