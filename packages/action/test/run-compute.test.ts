import {describe, expect, it, vi} from "vitest";
import {runCompute} from "../src/run";

describe("runCompute", () => {
    it("prices the PR files and returns effective size, price, and issueNumber", async () => {
        const result = await runCompute({
            listPrFiles: vi.fn().mockResolvedValue([
                {filename: "src/a.ts", additions: 80, deletions: 20},
                {filename: "package-lock.json", additions: 500, deletions: 100},
            ]),
            issueNumber: 3,
            logGroup: vi.fn(),
        });
        expect(result).toEqual({
            version: 1,
            issueNumber: 3,
            size: {effectiveLines: 100, excludedLines: 600, excludedFiles: 1, pricedFiles: 1},
            price: {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false},
        });
    });

    it("logs the calculation breakdown via logGroup", async () => {
        const logGroup = vi.fn();
        await runCompute({
            listPrFiles: vi.fn().mockResolvedValue([
                {filename: "src/a.ts", additions: 80, deletions: 20},
                {filename: "package-lock.json", additions: 500, deletions: 100},
            ]),
            issueNumber: 3,
            logGroup,
        });
        expect(logGroup).toHaveBeenCalledTimes(1);
        const [title, lines] = logGroup.mock.calls[0];
        expect(title).toBe("proquo: calculation breakdown");
        expect(lines).toContain("Config: no .proquo.yml found — using built-in defaults (commentWeight 0.3)");
        expect(lines.some((line: string) => line.includes("package-lock.json"))).toBe(true);
    });

    it("down-weights comment-only lines when listPrFiles returns a patch", async () => {
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        const result = await runCompute({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 2, deletions: 0, patch}]),
            issueNumber: 3,
            logGroup: vi.fn(),
        });
        expect(result.size.effectiveLines).toBe(1);
    });
});
