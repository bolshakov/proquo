import type {Price} from "@proquo/core";
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

export const MARKER = "<!-- review-economy:price-tag -->";

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

export type {PreviousPrice};

const PRICE_DATA_MARKER = "review-economy:price-data";
const PRICE_DATA_PATTERN = new RegExp(`<!-- ${PRICE_DATA_MARKER} (.*?) -->`);

function priceDataComment(price: Price): string {
    const data: PreviousPrice = {lowerMinutes: price.lowerMinutes, upperMinutes: price.upperMinutes};
    return `<!-- ${PRICE_DATA_MARKER} ${JSON.stringify(data)} -->`;
}

export function parsePreviousPrice(body: string): PreviousPrice | null {
    const match = body.match(PRICE_DATA_PATTERN);
    if (!match) return null;
    try {
        const data = JSON.parse(match[1]);
        if (typeof data.lowerMinutes !== "number" || typeof data.upperMinutes !== "number") return null;
        return {lowerMinutes: data.lowerMinutes, upperMinutes: data.upperMinutes};
    } catch {
        return null;
    }
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

export function renderComment(size: SizeResult, price: Price, previousPrice?: PreviousPrice | null): string {
    const lines: string[] = [MARKER, priceDataComment(price), "### Review price tag", ""];

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
