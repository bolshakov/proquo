import {renderComment} from "./comment";
import {price} from "./pricing";
import {effectiveSize, type PrFile} from "./size";
import {upsertStickyComment, type IssueCommentsApi} from "./sticky";

export interface RunDeps {
    listPrFiles(): Promise<PrFile[]>;

    comments: IssueCommentsApi;
    target: { owner: string; repo: string; issueNumber: number };
    costPerMinute: number;
}

export async function run(deps: RunDeps): Promise<void> {
    const files = await deps.listPrFiles();
    const size = effectiveSize(files);
    const body = renderComment(size, price(size.effectiveLines, deps.costPerMinute));
    await upsertStickyComment(deps.comments, deps.target, body);
}
