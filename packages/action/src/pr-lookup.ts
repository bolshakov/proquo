/**
 * Confirms a compute artifact's claimed PR number against the commit that actually triggered
 * this run, rather than trusting the artifact directly. On a fork PR, the compute job runs the
 * fork's own code under a read-only token — an attacker can make it write any `issueNumber` into
 * the artifact. `listPulls` must resolve every PR associated with `headSha` (a value the artifact
 * cannot influence); the claim is accepted only when that association is unambiguous — exactly
 * one PR, matching the claim — since a shared head SHA across more than one PR (backports,
 * stacked diffs) would otherwise let a forged claim ride along with a real one.
 */
export async function verifyIssueNumber(
    listPulls: () => Promise<Array<{number: number}>>,
    claimedIssueNumber: number,
): Promise<boolean> {
    const pulls = await listPulls();
    return pulls.length === 1 && pulls[0].number === claimedIssueNumber;
}
