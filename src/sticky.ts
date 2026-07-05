import {MARKER} from "./comment";

export interface IssueCommentsApi {
    listComments(params: { owner: string; repo: string; issue_number: number; per_page: number }): Promise<{
        data: Array<{ id: number; body?: string }>;
    }>;

    createComment(params: { owner: string; repo: string; issue_number: number; body: string }): Promise<unknown>;

    updateComment(params: { owner: string; repo: string; comment_id: number; body: string }): Promise<unknown>;
}

export async function upsertStickyComment(
    api: IssueCommentsApi,
    target: { owner: string; repo: string; issueNumber: number },
    body: string,
): Promise<void> {
    const {owner, repo, issueNumber} = target;
    const {data} = await api.listComments({owner, repo, issue_number: issueNumber, per_page: 100});
    const existing = data.find((c) => c.body?.includes(MARKER));
    if (existing) {
        await api.updateComment({owner, repo, comment_id: existing.id, body});
    } else {
        await api.createComment({owner, repo, issue_number: issueNumber, body});
    }
}
