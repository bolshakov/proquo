import {renderComment} from "./comment";
import {price, effectiveSize, type PrFile} from "@proquo/core";
import {upsertStickyComment, type IssueCommentsApi} from "./sticky";

export interface RunDeps {
    listPrFiles(): Promise<PrFile[]>;

    comments: IssueCommentsApi;
    target: { owner: string; repo: string; issueNumber: number };
}

export async function run(deps: RunDeps): Promise<void> {
    const files = await deps.listPrFiles();
    const size = effectiveSize(files);
    const body = renderComment(size, price(size.effectiveLines));
    await upsertStickyComment(deps.comments, deps.target, body);
}
