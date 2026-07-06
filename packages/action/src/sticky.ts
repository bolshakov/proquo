import {MARKER} from "./comment";

export interface IssueCommentsApi {
    listComments(params: { owner: string; repo: string; issue_number: number; per_page: number }): Promise<{
        data: Array<{ id: number; body?: string }>;
    }>;

    createComment(params: { owner: string; repo: string; issue_number: number; body: string }): Promise<unknown>;

    updateComment(params: { owner: string; repo: string; comment_id: number; body: string }): Promise<unknown>;
}

export interface StickyComment {
    id: number;
    body: string;
}

export async function findStickyComment(
    api: IssueCommentsApi,
    target: { owner: string; repo: string; issueNumber: number },
): Promise<StickyComment | null> {
    const {owner, repo, issueNumber} = target;
    const {data} = await api.listComments({owner, repo, issue_number: issueNumber, per_page: 100});
    const existing = data.find((c) => c.body?.includes(MARKER));
    return existing?.body != null ? {id: existing.id, body: existing.body} : null;
}

export async function upsertStickyComment(
    api: IssueCommentsApi,
    target: { owner: string; repo: string; issueNumber: number },
    body: string,
    existing: StickyComment | null,
): Promise<void> {
    const {owner, repo, issueNumber} = target;
    if (existing) {
        await api.updateComment({owner, repo, comment_id: existing.id, body});
    } else {
        await api.createComment({owner, repo, issue_number: issueNumber, body});
    }
}
