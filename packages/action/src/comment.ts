import type {Price, Tier} from "@proquo/core";
import type {SizeResult} from "@proquo/core";
import {
    computeDelta,
    fileSpreadNote as coreFileSpreadNote,
    footnoteParts,
    formatNumber,
    formatRange,
    SPLIT_NUDGE_BODY,
    SPLIT_NUDGE_LEAD,
    tierTail,
    type PreviousPrice,
} from "@proquo/core";

export const MARKER = "<!-- proquo:price-tag -->";

function fileSpreadNote(effectiveLines: number, pricedFiles: number): string | null {
    const note = coreFileSpreadNote(effectiveLines, pricedFiles);
    return note ? `**${note.lead}** ${note.body}` : null;
}

const TIER_EMOJI = {green: "🟢", yellow: "🟡", red: "🔴"} as const;

function tierLine(effectiveLines: number, price: Price, deltaClause: string): string {
    const n = formatNumber(effectiveLines);
    const range = `**${formatRange(price.lowerMinutes, price.upperMinutes)}**${deltaClause}`;
    return `${TIER_EMOJI[price.tier]} **${n} effective lines** — about ${range} of focused review${tierTail(price.tier)}`;
}

export interface PriceSnapshot {
    effectiveLines: number;
    tier: Tier;
    lowerMinutes: number;
    upperMinutes: number;
    pricedFiles: number;
    at: string;
}

export interface PriceHistory {
    version: 1;
    first: PriceSnapshot;
    current: PriceSnapshot;
    revisions: number;
}

export function snapshotFrom(price: Price, size: SizeResult, at: string): PriceSnapshot {
    return {
        effectiveLines: size.effectiveLines,
        tier: price.tier,
        lowerMinutes: price.lowerMinutes,
        upperMinutes: price.upperMinutes,
        pricedFiles: size.pricedFiles,
        at,
    };
}

const PRICE_DATA_MARKER = "proquo:price-data";
const PRICE_DATA_PATTERN = new RegExp(`<!-- ${PRICE_DATA_MARKER} (.*?) -->`);

export function priceHistoryComment(history: PriceHistory): string {
    return `<!-- ${PRICE_DATA_MARKER} ${JSON.stringify(history)} -->`;
}

function isTier(value: unknown): value is Tier {
    return value === "green" || value === "yellow" || value === "red";
}

function isPriceSnapshot(value: unknown): value is PriceSnapshot {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.effectiveLines === "number" &&
        isTier(v.tier) &&
        typeof v.lowerMinutes === "number" &&
        typeof v.upperMinutes === "number" &&
        typeof v.pricedFiles === "number" &&
        typeof v.at === "string"
    );
}

export function parsePriceHistory(body: string): PriceHistory | null {
    const match = body.match(PRICE_DATA_PATTERN);
    if (!match) return null;
    try {
        const data = JSON.parse(match[1]) as Record<string, unknown>;
        if (
            typeof data !== "object" ||
            data === null ||
            data.version !== 1 ||
            !isPriceSnapshot(data.first) ||
            !isPriceSnapshot(data.current) ||
            typeof data.revisions !== "number"
        ) {
            return null;
        }
        return {version: 1, first: data.first, current: data.current, revisions: data.revisions};
    } catch {
        return null;
    }
}

export function buildPriceHistory(existing: PriceHistory | null, snapshot: PriceSnapshot): PriceHistory {
    if (!existing) {
        return {version: 1, first: snapshot, current: snapshot, revisions: 1};
    }
    return {version: 1, first: existing.first, current: snapshot, revisions: existing.revisions + 1};
}

function deltaClause(price: Price, previous: PreviousPrice): string {
    const delta = computeDelta(price, previous);
    if (!delta) return "";
    return ` (${delta.direction} from ${formatRange(delta.previous.lowerMinutes, delta.previous.upperMinutes)})`;
}

function footnote(price: Price): string {
    const body = footnoteParts(price).join("\n\n");
    return `<details>\n<summary>Why these numbers?</summary>\n\n${body}\n\n</details>`;
}

export function renderComment(
    size: SizeResult,
    price: Price,
    history: PriceHistory,
    previousPrice?: PreviousPrice | null,
): string {
    const lines: string[] = [MARKER, priceHistoryComment(history), "### Review price tag", ""];

    if (size.effectiveLines === 0) {
        lines.push("This PR has no effective source changes, so its review burden is negligible.");
    } else {
        const delta = previousPrice ? deltaClause(price, previousPrice) : "";
        lines.push(tierLine(size.effectiveLines, price, delta));
    }

    if (size.excludedFiles > 0) {
        const fileWord = size.excludedFiles === 1 ? "file" : "files";
        lines.push(
            "",
            `${formatNumber(size.excludedLines)} lines across ${size.excludedFiles} generated/lockfile ${fileWord} were excluded from the price.`,
        );
    }

    const spreadNote = fileSpreadNote(size.effectiveLines, size.pricedFiles);
    if (spreadNote) {
        lines.push("", spreadNote);
    }

    if (price.splitNudge) {
        lines.push("", `**${SPLIT_NUDGE_LEAD}** ${SPLIT_NUDGE_BODY}`);
    }

    lines.push("", footnote(price));
    return lines.join("\n");
}
