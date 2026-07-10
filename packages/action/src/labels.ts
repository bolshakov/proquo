import type {Tier} from "@proquo/core";

export interface IssuesLabelsApi {
    listLabelsOnIssue(params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page: number;
    }): Promise<{data: Array<{name: string}>}>;

    addLabels(params: {owner: string; repo: string; issue_number: number; labels: string[]}): Promise<unknown>;

    removeLabel(params: {owner: string; repo: string; issue_number: number; name: string}): Promise<unknown>;

    createLabel(params: {
        owner: string;
        repo: string;
        name: string;
        color: string;
        description: string;
    }): Promise<unknown>;
}

export const TIER_LABELS: Record<Tier, {name: string; color: string; description: string}> = {
    green: {
        name: "proquo: small",
        color: "2ea44f",
        description: "ProQuo review price tier: small",
    },
    yellow: {
        name: "proquo: medium",
        color: "dbab09",
        description: "ProQuo review price tier: medium",
    },
    red: {
        name: "proquo: large",
        color: "d73a4a",
        description: "ProQuo review price tier: large",
    },
};

const TIER_LABEL_NAMES = new Set(Object.values(TIER_LABELS).map((label) => label.name));

function isNotFoundError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "status" in error && (error as {status: unknown}).status === 404;
}

export async function syncTierLabel(
    api: IssuesLabelsApi,
    target: {owner: string; repo: string; issueNumber: number},
    tier: Tier,
): Promise<void> {
    const {owner, repo, issueNumber} = target;
    const desired = TIER_LABELS[tier];
    const {data} = await api.listLabelsOnIssue({owner, repo, issue_number: issueNumber, per_page: 100});
    const currentNames = data.map((label) => label.name);

    // Add the desired label before removing stale ones: if the add fails, the PR keeps whatever
    // tier label it already had rather than being stripped bare.
    if (!currentNames.includes(desired.name)) {
        await addLabel(api, target, desired);
    }

    for (const name of currentNames) {
        if (name !== desired.name && TIER_LABEL_NAMES.has(name)) {
            await api.removeLabel({owner, repo, issue_number: issueNumber, name});
        }
    }
}

async function addLabel(
    api: IssuesLabelsApi,
    target: {owner: string; repo: string; issueNumber: number},
    label: {name: string; color: string; description: string},
): Promise<void> {
    const {owner, repo, issueNumber} = target;
    try {
        await api.addLabels({owner, repo, issue_number: issueNumber, labels: [label.name]});
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }
        await api.createLabel({owner, repo, name: label.name, color: label.color, description: label.description});
        await api.addLabels({owner, repo, issue_number: issueNumber, labels: [label.name]});
    }
}
