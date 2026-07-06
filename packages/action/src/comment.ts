import type {Price} from "@proquo/core";
import type {SizeResult} from "@proquo/core";

export const MARKER = "<!-- review-economy:price-tag -->";

const SPLIT_NUDGE =
    "**Worth splitting?** Breaking this into ≤200-line PRs puts each piece back in the size band where " +
    "reviewers catch the most defects per line. The split buys detection quality, not saved review minutes.";

const FOOTNOTE_BASE =
    "These minutes are what careful defect-finding costs at 200–500 lines/hour — the rate review studies " +
    'report, not how long a skim takes. "Effective lines" already exclude generated files and lockfiles. ' +
    "Treat the rates and the 200/400 thresholds as guardrails, not laws.";

const SESSION_NOTE =
    "This estimate's upper bound also runs longer than the ~60-minute session after which reviewer attention " +
    "is known to fade — plan for a break or a second sitting.";

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function formatRange(lowerMinutes: number, upperMinutes: number): string {
    return lowerMinutes === upperMinutes ? `${lowerMinutes} min` : `${lowerMinutes}–${upperMinutes} min`;
}

function tierLine(effectiveLines: number, price: Price, deltaClause: string): string {
    const n = formatNumber(effectiveLines);
    const range = `**${formatRange(price.lowerMinutes, price.upperMinutes)}**${deltaClause}`;

    switch (price.tier) {
        case "green":
            return (
                `🟢 **${n} effective lines** — about ${range} of focused review at evidence-based rates ` +
                "(200–500 lines/hour). That's inside the size band where reviewers catch the most defects " +
                "per line, and small changes get their first feedback fastest."
            );
        case "yellow":
            return (
                `🟡 **${n} effective lines** — about ${range} of focused review. Past ~200 lines, defects ` +
                "found per line start to drop, and 400 is the ceiling the largest industry review study " +
                "recommends never exceeding."
            );
        case "red":
            return (
                `🔴 **${n} effective lines** — about ${range} of focused review, more than fits one effective ` +
                "session. Above 400 lines reviewers stop finding defects at the small-change rate, and useful " +
                "comments per line taper off."
            );
    }
}

export type PreviousPrice = Pick<Price, "lowerMinutes" | "upperMinutes">;

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

const DELTA_THRESHOLD = 0.01;

function deltaClause(price: Price, previous: PreviousPrice): string {
    const currentAvg = (price.lowerMinutes + price.upperMinutes) / 2;
    const previousAvg = (previous.lowerMinutes + previous.upperMinutes) / 2;
    if (currentAvg === previousAvg) return "";
    if (previousAvg > 0 && Math.abs(currentAvg - previousAvg) / previousAvg <= DELTA_THRESHOLD) return "";

    const direction = currentAvg < previousAvg ? "down" : "up";
    return ` (${direction} from ${formatRange(previous.lowerMinutes, previous.upperMinutes)})`;
}

function footnote(price: Price): string {
    const parts = [FOOTNOTE_BASE];
    if (price.tier === "yellow" && price.sessionFlag) parts.push(SESSION_NOTE);
    const body = parts.join("\n\n");
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

    if (price.splitNudge) {
        lines.push("", SPLIT_NUDGE);
    }

    lines.push("", footnote(price));
    return lines.join("\n");
}
