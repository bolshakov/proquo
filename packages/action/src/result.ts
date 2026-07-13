import type {Price, SizeResult, Tier} from "@proquo/core";

export interface ComputeResult {
    version: 1;
    issueNumber: number;
    size: SizeResult;
    price: Price;
}

export function serializeComputeResult(result: ComputeResult): string {
    return JSON.stringify(result, null, 2);
}

function isTier(value: unknown): value is Tier {
    return value === "green" || value === "yellow" || value === "red";
}

function isSizeResult(value: unknown): value is SizeResult {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.effectiveLines === "number" &&
        typeof v.excludedLines === "number" &&
        typeof v.excludedFiles === "number" &&
        typeof v.pricedFiles === "number"
    );
}

function isPrice(value: unknown): value is Price {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.lowerMinutes === "number" &&
        typeof v.upperMinutes === "number" &&
        isTier(v.tier) &&
        typeof v.sessionFlag === "boolean" &&
        typeof v.splitNudge === "boolean"
    );
}

export function parseComputeResult(raw: string): ComputeResult | null {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof data !== "object" || data === null) return null;
    const v = data as Record<string, unknown>;
    if (v.version !== 1 || typeof v.issueNumber !== "number" || !isSizeResult(v.size) || !isPrice(v.price)) {
        return null;
    }
    return {version: 1, issueNumber: v.issueNumber, size: v.size, price: v.price};
}
