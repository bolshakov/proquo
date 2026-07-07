import {describe, expect, it, vi} from "vitest";
import {run} from "../src/run";
import {renderComment} from "../src/comment";

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
        });
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        const body: string = comments.createComment.mock.calls[0][0].body;
        // 100 effective lines: lower = max(5, round(100/500*60=12)) = 12, upper = max(12, round(100/200*60=30)) = 30
        expect(body).toContain("100 effective lines");
        expect(body).toContain("12–30 min");
        expect(body).toContain("600 lines across 1 generated/lockfile file were excluded");
    });

    it("updates the existing sticky comment and shows the delta since the previous price", async () => {
        const oldBody = renderComment(
            {effectiveLines: 900, excludedLines: 0, excludedFiles: 0, pricedFiles: 5},
            {lowerMinutes: 108, upperMinutes: 270, tier: "red", sessionFlag: true, splitNudge: true},
        );
        const comments = {
            listComments: vi.fn().mockResolvedValue({data: [{id: 42, body: oldBody}]}),
            createComment: vi.fn().mockResolvedValue({}),
            updateComment: vi.fn().mockResolvedValue({}),
        };
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 80, deletions: 20}]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
        });
        expect(comments.listComments).toHaveBeenCalledTimes(1);
        expect(comments.createComment).not.toHaveBeenCalled();
        expect(comments.updateComment).toHaveBeenCalledTimes(1);
        const body: string = comments.updateComment.mock.calls[0][0].body;
        // 100 effective lines -> 12-30 min, avg 21, well under the previous avg of 189 -> shows full previous range
        expect(body).toContain("down from 108–270 min");
    });

    it("down-weights comment-only lines when listPrFiles returns a patch", async () => {
        const comments = {
            listComments: vi.fn().mockResolvedValue({data: []}),
            createComment: vi.fn().mockResolvedValue({}),
            updateComment: vi.fn().mockResolvedValue({}),
        };
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        await run({
            listPrFiles: vi
                .fn()
                .mockResolvedValue([{filename: "src/a.ts", additions: 2, deletions: 0, patch}]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
        });
        const body: string = comments.createComment.mock.calls[0][0].body;
        // 1 comment line * 0.3 + 1 code line * 1 = 1.3 -> rounds to 1 effective line
        expect(body).toContain("**1 effective lines**");
    });
});
