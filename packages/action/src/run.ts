import {buildPriceHistory, parsePriceHistory, renderComment, snapshotFrom} from "./comment";
import {price, explainSize, loadConfig, renderBreakdown, type PrFile} from "@proquo/core";
import {findStickyComment, upsertStickyComment, type IssueCommentsApi} from "./sticky";
import {syncTierLabel, type IssuesLabelsApi} from "./labels";
import type {ComputeResult} from "./result";

export interface ComputeDeps {
    listPrFiles(): Promise<PrFile[]>;
    issueNumber: number;
    logGroup(title: string, lines: string[]): void;
}

export async function runCompute(deps: ComputeDeps): Promise<ComputeResult> {
    const config = loadConfig(process.cwd());
    const files = await deps.listPrFiles();
    const explanation = explainSize(files, config);
    const size = explanation.size;
    deps.logGroup("proquo: calculation breakdown", renderBreakdown(explanation));
    const computedPrice = price(size.effectiveLines);
    return {version: 1, issueNumber: deps.issueNumber, size, price: computedPrice};
}

export interface CommentDeps {
    comments: IssueCommentsApi;
    labels: IssuesLabelsApi;
    target: {owner: string; repo: string; issueNumber: number};
    now: () => Date;
    warn(message: string): void;
}

export async function runComment(deps: CommentDeps, result: ComputeResult): Promise<void> {
    const existing = await findStickyComment(deps.comments, deps.target);
    const existingHistory = existing ? parsePriceHistory(existing.body) : null;
    const snapshot = snapshotFrom(result.price, result.size, deps.now().toISOString());
    const history = buildPriceHistory(existingHistory, snapshot);
    const previousPrice = existingHistory?.current ?? null;
    const body = renderComment(result.size, result.price, history, previousPrice);
    await upsertStickyComment(deps.comments, deps.target, body, existing);

    try {
        await syncTierLabel(deps.labels, deps.target, result.price.tier);
    } catch (error) {
        deps.warn(`proquo: failed to sync tier label — ${error instanceof Error ? error.message : String(error)}`);
    }
}
