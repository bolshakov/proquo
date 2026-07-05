import {describe, expect, it, vi} from "vitest";
import {MARKER} from "../src/comment";
import {upsertStickyComment} from "../src/sticky";

const target = {owner: "o", repo: "r", issueNumber: 7};

function apiWith(comments: Array<{ id: number; body?: string }>) {
    return {
        listComments: vi.fn().mockResolvedValue({data: comments}),
        createComment: vi.fn().mockResolvedValue({}),
        updateComment: vi.fn().mockResolvedValue({}),
    };
}

describe("upsertStickyComment", () => {
    it("creates a comment when no marked comment exists", async () => {
        const api = apiWith([{id: 1, body: "unrelated"}]);
        await upsertStickyComment(api, target, `${MARKER}\nnew body`);
        expect(api.createComment).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            issue_number: 7,
            body: `${MARKER}\nnew body`
        });
        expect(api.updateComment).not.toHaveBeenCalled();
    });

    it("updates the existing marked comment", async () => {
        const api = apiWith([
            {id: 1, body: "unrelated"},
            {id: 2, body: `${MARKER}\nold body`},
        ]);
        await upsertStickyComment(api, target, `${MARKER}\nnew body`);
        expect(api.updateComment).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            comment_id: 2,
            body: `${MARKER}\nnew body`
        });
        expect(api.createComment).not.toHaveBeenCalled();
    });
});
