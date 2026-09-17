/**
 * The case detail URL for one of a case's commitments. A case has several
 * commitments (first response, resolution) on the same page; the
 * `commitmentId` query parameter only records which one the user came from,
 * so the page can highlight it.
 */
export function caseCommitmentHref(caseId: string, commitmentId: string): string {
  return `/cases/${caseId}?${new URLSearchParams({ commitmentId })}`;
}
