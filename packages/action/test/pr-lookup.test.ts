import {describe, expect, it, vi} from "vitest";
import {verifyIssueNumber} from "../src/pr-lookup";

function listing(prNumbers: number[]) {
    return vi.fn().mockResolvedValue(prNumbers.map((number) => ({number})));
}

describe("verifyIssueNumber", () => {
    it("returns true when the commit is associated with exactly one PR matching the claim", async () => {
        const listPulls = listing([758]);
        const result = await verifyIssueNumber(listPulls, 758);
        expect(result).toBe(true);
        expect(listPulls).toHaveBeenCalledTimes(1);
    });

    it("returns false when the commit's one associated PR doesn't match the claim", async () => {
        const result = await verifyIssueNumber(listing([12]), 758);
        expect(result).toBe(false);
    });

    it("returns false when the commit has no associated pull requests", async () => {
        const result = await verifyIssueNumber(listing([]), 758);
        expect(result).toBe(false);
    });

    it("returns false when the commit is associated with more than one PR, even if one of them matches the claim", async () => {
        const result = await verifyIssueNumber(listing([758, 12]), 758);
        expect(result).toBe(false);
    });
});
