import {buildPriceHistory, parsePriceHistory, renderComment, snapshotFrom} from "./comment";
import {price, explainSize, loadConfig, renderBreakdown, type PrFile} from "@proquo/core";
import {findStickyComment, upsertStickyComment, type IssueCommentsApi} from "./sticky";
import {syncTierLabel, type IssuesLabelsApi} from "./labels";

export interface RunDeps {
    listPrFiles(): Promise<PrFile[]>;

    comments: IssueCommentsApi;
    labels: IssuesLabelsApi;
    target: {owner: string; repo: string; issueNumber: number};
    now: () => Date;
    logGroup(title: string, lines: string[]): void;
    warn(message: string): void;
}

export async function run(deps: RunDeps): Promise<void> {
    const config = loadConfig(process.cwd());
    const files = await deps.listPrFiles();
    const explanation = explainSize(files, config);
    const size = explanation.size;
    deps.logGroup("proquo: calculation breakdown", renderBreakdown(explanation));
    const computedPrice = price(size.effectiveLines);
    const existing = await findStickyComment(deps.comments, deps.target);
    const existingHistory = existing ? parsePriceHistory(existing.body) : null;
    const snapshot = snapshotFrom(computedPrice, size, deps.now().toISOString());
    const history = buildPriceHistory(existingHistory, snapshot);
    const previousPrice = existingHistory?.current ?? null;
    const body = renderComment(size, computedPrice, history, previousPrice);
    await upsertStickyComment(deps.comments, deps.target, body, existing);

    try {
        await syncTierLabel(deps.labels, deps.target, computedPrice.tier);
    } catch (error) {
        deps.warn(`proquo: failed to sync tier label — ${error instanceof Error ? error.message : String(error)}`);
    }
}
