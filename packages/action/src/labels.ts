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

export interface TierLabel {
    name: string;
    color: string;
    description: string;
}

export const TIER_LABELS: Record<Tier, TierLabel> = {
    green: {
        name: "proquo: small",
        color: "2ea44f",
        description: "ProQuo review price tier: small, up to 200 effective lines",
    },
    yellow: {
        name: "proquo: medium",
        color: "dbab09",
        description: "ProQuo review price tier: medium, 201–400 effective lines",
    },
    red: {
        name: "proquo: large",
        color: "d73a4a",
        description: "ProQuo review price tier: large, over 400 effective lines",
    },
};

const TIER_LABEL_NAMES = new Set(Object.values(TIER_LABELS).map((label) => label.name));

export async function syncTierLabel(
    api: IssuesLabelsApi,
    target: {owner: string; repo: string; issueNumber: number},
    tier: Tier,
): Promise<void> {
    const {owner, repo, issueNumber} = target;
    const desired = TIER_LABELS[tier];
    const {data} = await api.listLabelsOnIssue({owner, repo, issue_number: issueNumber, per_page: 100});
    const currentNames = data.map((label) => label.name);

    if (currentNames.includes(desired.name)) {
        return;
    }

    for (const name of currentNames) {
        if (TIER_LABEL_NAMES.has(name)) {
            await api.removeLabel({owner, repo, issue_number: issueNumber, name});
        }
    }

    try {
        await api.addLabels({owner, repo, issue_number: issueNumber, labels: [desired.name]});
    } catch {
        await api.createLabel({
            owner,
            repo,
            name: desired.name,
            color: desired.color,
            description: desired.description,
        });
        await api.addLabels({owner, repo, issue_number: issueNumber, labels: [desired.name]});
    }
}
