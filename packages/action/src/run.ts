import {buildPriceHistory, parsePriceHistory, renderComment, snapshotFrom} from "./comment";
import {price, effectiveSize, loadConfig, type PrFile} from "@proquo/core";
import {findStickyComment, upsertStickyComment, type IssueCommentsApi} from "./sticky";

export interface RunDeps {
    listPrFiles(): Promise<PrFile[]>;

    comments: IssueCommentsApi;
    target: { owner: string; repo: string; issueNumber: number };
    now: () => Date;
}

export async function run(deps: RunDeps): Promise<void> {
    const config = loadConfig(process.cwd());
    const files = await deps.listPrFiles();
    const size = effectiveSize(files, config);
    const computedPrice = price(size.effectiveLines);
    const existing = await findStickyComment(deps.comments, deps.target);
    const existingHistory = existing ? parsePriceHistory(existing.body) : null;
    const snapshot = snapshotFrom(computedPrice, size, deps.now().toISOString());
    const history = buildPriceHistory(existingHistory, snapshot);
    const previousPrice = existingHistory?.current ?? null;
    const body = renderComment(size, computedPrice, history, previousPrice);
    await upsertStickyComment(deps.comments, deps.target, body, existing);
}
