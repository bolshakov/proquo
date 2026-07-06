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
            {effectiveLines: 900, excludedLines: 0, excludedFiles: 0},
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
});
