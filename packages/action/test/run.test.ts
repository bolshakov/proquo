import {describe, expect, it, vi} from "vitest";
import {run} from "../src/run";
import {MARKER, parsePriceHistory, renderComment, type PriceHistory} from "../src/comment";

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

function makeLabels(initial: string[] = []) {
    let current = [...initial];
    return {
        listLabelsOnIssue: vi.fn().mockImplementation(async () => ({data: current.map((name) => ({name}))})),
        addLabels: vi.fn().mockImplementation(async ({labels}: {labels: string[]}) => {
            current = [...current, ...labels];
            return {};
        }),
        removeLabel: vi.fn().mockImplementation(async ({name}: {name: string}) => {
            current = current.filter((n) => n !== name);
            return {};
        }),
        createLabel: vi.fn().mockResolvedValue({}),
    };
}

describe("run", () => {
    it("prices the PR files and upserts the sticky comment", async () => {
        const comments = makeComments();
        await run({
            listPrFiles: vi.fn().mockResolvedValue([
                {filename: "src/a.ts", additions: 80, deletions: 20},
                {filename: "package-lock.json", additions: 500, deletions: 100},
            ]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        const body: string = comments.createComment.mock.calls[0][0].body;
        expect(body).toContain("100 effective lines");
        expect(body).toContain("12–30 min");
        expect(body).toContain("600 lines across 1 generated/lockfile file were excluded");
    });

    it("logs the calculation breakdown via logGroup without changing the comment body", async () => {
        const comments = makeComments();
        const logGroup = vi.fn();
        await run({
            listPrFiles: vi.fn().mockResolvedValue([
                {filename: "src/a.ts", additions: 80, deletions: 20},
                {filename: "package-lock.json", additions: 500, deletions: 100},
            ]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup,
            labels: makeLabels(),
            warn: vi.fn(),
        });
        expect(logGroup).toHaveBeenCalledTimes(1);
        const [title, lines] = logGroup.mock.calls[0];
        expect(title).toBe("proquo: calculation breakdown");
        expect(lines).toContain("Config: no .proquo.yml found — using built-in defaults (commentWeight 0.3)");
        expect(lines.some((line: string) => line.includes("package-lock.json"))).toBe(true);
        const body: string = comments.createComment.mock.calls[0][0].body;
        expect(body).toContain("100 effective lines");
        expect(body).not.toContain("Config:");
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
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 80, deletions: 20}]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });
        expect(comments.listComments).toHaveBeenCalledTimes(1);
        expect(comments.createComment).not.toHaveBeenCalled();
        expect(comments.updateComment).toHaveBeenCalledTimes(1);
        const body: string = comments.updateComment.mock.calls[0][0].body;
        expect(body).toContain("down from 108–270 min");
    });

    it("down-weights comment-only lines when listPrFiles returns a patch", async () => {
        const comments = makeComments();
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        await run({
            listPrFiles: vi
                .fn()
                .mockResolvedValue([{filename: "src/a.ts", additions: 2, deletions: 0, patch}]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });
        const body: string = comments.createComment.mock.calls[0][0].body;
        expect(body).toContain("**1 effective lines**");
    });

    it("carries the first snapshot forward and increments revisions across runs", async () => {
        const comments = makeComments();
        const target = {owner: "o", repo: "r", issueNumber: 7};

        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 300, deletions: 0}]),
            comments,
            target,
            now: () => new Date("2024-01-01T00:00:00.000Z"),
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 100, deletions: 0}]),
            comments,
            target,
            now: () => new Date("2024-01-02T00:00:00.000Z"),
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });

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
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 40, deletions: 0}]),
            comments,
            target: {owner: "o", repo: "r", issueNumber: 8},
            now: fixedNow,
            logGroup: vi.fn(),
            labels: makeLabels(),
            warn: vi.fn(),
        });
        expect(comments.updateComment).toHaveBeenCalledTimes(1);
        const body: string = comments.updateComment.mock.calls[0][0].body;
        expect(body).not.toMatch(/(down|up) from/);
        const history = parsePriceHistory(body)!;
        expect(history.revisions).toBe(1);
        expect(history.first).toEqual(history.current);
    });

    it("syncs the PR's tier label to the computed price tier", async () => {
        const comments = makeComments();
        const labels = makeLabels();
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 900, deletions: 0}]),
            comments,
            labels,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup: vi.fn(),
            warn: vi.fn(),
        });
        expect(labels.addLabels).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            issue_number: 3,
            labels: ["proquo: large"],
        });
    });

    it("warns but does not fail the run when label sync throws", async () => {
        const comments = makeComments();
        const labels = makeLabels();
        labels.listLabelsOnIssue.mockRejectedValue(new Error("boom"));
        const warn = vi.fn();
        await run({
            listPrFiles: vi.fn().mockResolvedValue([{filename: "src/a.ts", additions: 80, deletions: 20}]),
            comments,
            labels,
            target: {owner: "o", repo: "r", issueNumber: 3},
            now: fixedNow,
            logGroup: vi.fn(),
            warn,
        });
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("boom");
    });
});
