import {describe, expect, it, vi} from "vitest";
import {run} from "../src/run";

describe("run", () => {
    it("prices the PR files and upserts the sticky comment", async () => {
        const comments = {
            listComments: vi.fn().mockResolvedValue({data: []}),
            createComment: vi.fn().mockResolvedValue({}),
            updateComment: vi.fn().mockResolvedValue({}),
        };
        await run({
            listPrFiles: vi.fn().mockResolvedValue([
                {filename: "src/a.ts", additions: 80, deletions: 20},
                {filename: "package-lock.json", additions: 500, deletions: 100},
            ]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
            costPerMinute: 1.25,
        });
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        const body: string = comments.createComment.mock.calls[0][0].body;
        // 100 effective lines price at 21 minutes, the lockfile lines are excluded
        expect(body).toContain("100 effective changed lines");
        expect(body).toContain("~21 min");
        expect(body).toContain("600 lines across 1 generated/lockfile file were excluded");
    });
});
