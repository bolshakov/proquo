import {describe, expect, it, vi} from "vitest";
import {runComment} from "../src/run";
import {MARKER, parsePriceHistory, renderComment, type PriceHistory} from "../src/comment";
import type {ComputeResult} from "../src/result";

const fixedNow = () => new Date("2024-01-01T00:00:00.000Z");

function makeComments(initial: {id: number; body: string} | null = null) {
    let stored = initial;
    return {
        listComments: vi.fn().mockImplementation(async () => ({data: stored ? [stored] : []})),
        createComment: vi.fn().mockImplementation(async ({body}: {body: string}) => {
            stored = {id: 1, body};
            return {};
        }),
        updateComment: vi.fn().mockImplementation(async ({body}: {body: string}) => {
            stored = {id: stored?.id ?? 1, body};
            return {};
        }),
        get stored() {
            return stored;
        },
    };
}

function computeResult(overrides: Partial<ComputeResult> = {}): ComputeResult {
    return {
        version: 1,
        issueNumber: 3,
        size: {effectiveLines: 100, excludedLines: 600, excludedFiles: 1, pricedFiles: 1},
        price: {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false},
        ...overrides,
    };
}

describe("runComment", () => {
    it("creates the sticky comment from a ComputeResult", async () => {
        const comments = makeComments();
        await runComment(
            {comments, target: {owner: "o", repo: "r", issueNumber: 3}, now: fixedNow},
            computeResult(),
        );
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        const body: string = comments.createComment.mock.calls[0][0].body;
        expect(body).toContain("100 effective lines");
        expect(body).toContain("12–30 min");
        expect(body).toContain("600 lines across 1 generated/lockfile file were excluded");
    });

    it("updates the existing sticky comment and shows the delta since the previous price", async () => {
        const oldSnapshot = {
            effectiveLines: 900,
            tier: "red" as const,
            lowerMinutes: 108,
            upperMinutes: 270,
            pricedFiles: 5,
            at: "2023-12-01T00:00:00.000Z",
        };
        const oldHistory: PriceHistory = {version: 1, first: oldSnapshot, current: oldSnapshot, revisions: 1};
        const oldBody = renderComment(
            {effectiveLines: 900, excludedLines: 0, excludedFiles: 0, pricedFiles: 5},
            {lowerMinutes: 108, upperMinutes: 270, tier: "red", sessionFlag: true, splitNudge: true},
            oldHistory,
        );
        const comments = makeComments({id: 42, body: oldBody});
        await runComment(
            {comments, target: {owner: "o", repo: "r", issueNumber: 3}, now: fixedNow},
            computeResult({size: {effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}}),
        );
        expect(comments.listComments).toHaveBeenCalledTimes(1);
        expect(comments.createComment).not.toHaveBeenCalled();
        expect(comments.updateComment).toHaveBeenCalledTimes(1);
        const body: string = comments.updateComment.mock.calls[0][0].body;
        expect(body).toContain("down from 108–270 min");
    });

    it("carries the first snapshot forward and increments revisions across runs", async () => {
        const comments = makeComments();
        const target = {owner: "o", repo: "r", issueNumber: 7};

        await runComment(
            {comments, target, now: () => new Date("2024-01-01T00:00:00.000Z")},
            computeResult({
                issueNumber: 7,
                size: {effectiveLines: 300, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
                price: {lowerMinutes: 36, upperMinutes: 90, tier: "yellow", sessionFlag: true, splitNudge: false},
            }),
        );
        await runComment(
            {comments, target, now: () => new Date("2024-01-02T00:00:00.000Z")},
            computeResult({
                issueNumber: 7,
                size: {effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
                price: {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false},
            }),
        );

        const history = parsePriceHistory(comments.stored!.body)!;
        expect(history.first.effectiveLines).toBe(300);
        expect(history.first.at).toBe("2024-01-01T00:00:00.000Z");
        expect(history.current.effectiveLines).toBe(100);
        expect(history.current.at).toBe("2024-01-02T00:00:00.000Z");
        expect(history.revisions).toBe(2);
    });

    it("resets the history when the existing comment predates the price-history schema", async () => {
        const legacyBody = [
            MARKER,
            '<!-- proquo:price-data {"lowerMinutes":39,"upperMinutes":96} -->',
            "### Review price tag",
            "",
            "some old-shape comment",
        ].join("\n");
        const comments = makeComments({id: 9, body: legacyBody});
        await runComment(
            {comments, target: {owner: "o", repo: "r", issueNumber: 8}, now: fixedNow},
            computeResult({
                issueNumber: 8,
                size: {effectiveLines: 40, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
                price: {lowerMinutes: 5, upperMinutes: 12, tier: "green", sessionFlag: false, splitNudge: false},
            }),
        );
        expect(comments.updateComment).toHaveBeenCalledTimes(1);
        const body: string = comments.updateComment.mock.calls[0][0].body;
        expect(body).not.toMatch(/(down|up) from/);
        const history = parsePriceHistory(body)!;
        expect(history.revisions).toBe(1);
        expect(history.first).toEqual(history.current);
    });
});
