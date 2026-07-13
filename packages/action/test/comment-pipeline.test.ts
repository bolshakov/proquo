import {describe, expect, it, vi} from "vitest";
import {runCommentPipeline, MAX_ARTIFACT_BYTES} from "../src/comment-pipeline";
import {serializeComputeResult, type ComputeResult} from "../src/result";

const fixedNow = () => new Date("2024-01-01T00:00:00.000Z");
const target = {owner: "o", repo: "r", headSha: "abc123"};

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
        updateLabel: vi.fn().mockResolvedValue({}),
    };
}

function computeResult(overrides: Partial<ComputeResult> = {}): ComputeResult {
    return {
        version: 1,
        issueNumber: 3,
        size: {effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
        price: {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false},
        ...overrides,
    };
}

function artifactWith(contents: string) {
    return {
        size: () => Buffer.byteLength(contents, "utf8"),
        contents: () => contents,
    };
}

describe("runCommentPipeline", () => {
    it("returns missing-artifact when the artifact file cannot be read", async () => {
        const comments = makeComments();
        const outcome = await runCommentPipeline({
            artifact: {
                size: () => {
                    throw new Error("ENOENT");
                },
                contents: () => {
                    throw new Error("ENOENT");
                },
            },
            maxArtifactBytes: MAX_ARTIFACT_BYTES,
            verify: vi.fn(),
            target,
            comments,
            labels: makeLabels(),
            now: fixedNow,
            warn: vi.fn(),
        });
        expect(outcome).toEqual({status: "missing-artifact"});
        expect(comments.createComment).not.toHaveBeenCalled();
    });

    it("returns malformed-artifact when the artifact exceeds the byte limit, without reading its contents", async () => {
        const comments = makeComments();
        const contents = vi.fn(() => {
            throw new Error("should not be called");
        });
        const outcome = await runCommentPipeline({
            artifact: {size: () => MAX_ARTIFACT_BYTES + 1, contents},
            maxArtifactBytes: MAX_ARTIFACT_BYTES,
            verify: vi.fn(),
            target,
            comments,
            labels: makeLabels(),
            now: fixedNow,
            warn: vi.fn(),
        });
        expect(outcome).toEqual({status: "malformed-artifact"});
        expect(contents).not.toHaveBeenCalled();
    });

    it("returns malformed-artifact when the artifact content fails to parse", async () => {
        const comments = makeComments();
        const outcome = await runCommentPipeline({
            artifact: artifactWith("not json"),
            maxArtifactBytes: MAX_ARTIFACT_BYTES,
            verify: vi.fn(),
            target,
            comments,
            labels: makeLabels(),
            now: fixedNow,
            warn: vi.fn(),
        });
        expect(outcome).toEqual({status: "malformed-artifact"});
        expect(comments.createComment).not.toHaveBeenCalled();
    });

    it("returns unverified and does not post when verify rejects the claimed issueNumber", async () => {
        const comments = makeComments();
        const verify = vi.fn().mockResolvedValue(false);
        const result = computeResult({issueNumber: 758});
        const outcome = await runCommentPipeline({
            artifact: artifactWith(serializeComputeResult(result)),
            maxArtifactBytes: MAX_ARTIFACT_BYTES,
            verify,
            target,
            comments,
            labels: makeLabels(),
            now: fixedNow,
            warn: vi.fn(),
        });
        expect(outcome).toEqual({status: "unverified", issueNumber: 758, headSha: "abc123"});
        expect(verify).toHaveBeenCalledWith(target, 758);
        expect(comments.createComment).not.toHaveBeenCalled();
    });

    it("posts the comment when the artifact is valid and verified", async () => {
        const comments = makeComments();
        const verify = vi.fn().mockResolvedValue(true);
        const result = computeResult({issueNumber: 3});
        const outcome = await runCommentPipeline({
            artifact: artifactWith(serializeComputeResult(result)),
            maxArtifactBytes: MAX_ARTIFACT_BYTES,
            verify,
            target,
            comments,
            labels: makeLabels(),
            now: fixedNow,
            warn: vi.fn(),
        });
        expect(outcome).toEqual({status: "posted"});
        expect(comments.createComment).toHaveBeenCalledTimes(1);
        const body: string = comments.createComment.mock.calls[0][0].body;
        expect(body).toContain("100 effective lines");
    });
});
