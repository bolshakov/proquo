import {parseComputeResult} from "./result";
import {runComment, type CommentDeps} from "./run";
import type {IssueCommentsApi} from "./sticky";
import type {IssuesLabelsApi} from "./labels";

export const MAX_ARTIFACT_BYTES = 16 * 1024;

export type CommentPipelineOutcome =
    | {status: "missing-artifact"}
    | {status: "malformed-artifact"}
    | {status: "unverified"; issueNumber: number; headSha: string}
    | {status: "posted"};

export interface ArtifactSource {
    size(): number;
    contents(): string;
}

export interface CommentPipelineDeps {
    artifact: ArtifactSource;
    maxArtifactBytes: number;
    verify(target: {owner: string; repo: string; headSha: string}, issueNumber: number): Promise<boolean>;
    target: {owner: string; repo: string; headSha: string};
    comments: IssueCommentsApi;
    labels: IssuesLabelsApi;
    now: () => Date;
    warn(message: string): void;
}

export async function runCommentPipeline(deps: CommentPipelineDeps): Promise<CommentPipelineOutcome> {
    let size: number;
    try {
        size = deps.artifact.size();
    } catch {
        return {status: "missing-artifact"};
    }
    if (size > deps.maxArtifactBytes) {
        return {status: "malformed-artifact"};
    }

    let raw: string;
    try {
        raw = deps.artifact.contents();
    } catch {
        return {status: "missing-artifact"};
    }

    const result = parseComputeResult(raw);
    if (!result) {
        return {status: "malformed-artifact"};
    }

    const verified = await deps.verify(deps.target, result.issueNumber);
    if (!verified) {
        return {status: "unverified", issueNumber: result.issueNumber, headSha: deps.target.headSha};
    }

    const commentDeps: CommentDeps = {
        comments: deps.comments,
        labels: deps.labels,
        target: {owner: deps.target.owner, repo: deps.target.repo, issueNumber: result.issueNumber},
        now: deps.now,
        warn: deps.warn,
    };
    await runComment(commentDeps, result);
    return {status: "posted"};
}
