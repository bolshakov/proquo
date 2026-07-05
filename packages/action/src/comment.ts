import type {Price} from "@proquo/core";
import type {SizeResult} from "@proquo/core";

export const MARKER = "<!-- review-economy:price-tag -->";

const SPLIT_NUDGE =
    "**Worth splitting?** Breaking this into ≤200-line PRs puts each piece back in the size band where " +
    "reviewers catch the most defects per line. The split buys detection quality, not saved review minutes.";

const FOOTNOTE_BASE =
    'This range is what a defect-finding review needs at published inspection rates (200–500 lines/hour) — ' +
    'not a prediction of how long a quick skim will take. "Effective lines" discounts generated files and ' +
    "lockfiles, which don't count toward the range. The rates and the 200/400 thresholds are heuristics drawn " +
    "from published review studies, applied to modern PRs — useful guardrails, not laws.";

const SESSION_NOTE =
    "This estimate's upper bound also runs longer than the ~60-minute session after which reviewer attention " +
    "is known to fade — plan for a break or a second sitting.";

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function tierLine(effectiveLines: number, price: Price): string {
    const n = formatNumber(effectiveLines);
    const range = `**${price.lowerMinutes}–${price.upperMinutes} min**`;

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

function footnote(price: Price): string {
    const parts = [FOOTNOTE_BASE];
    if (price.tier === "yellow" && price.sessionFlag) parts.push(SESSION_NOTE);
    return `*${parts.join(" ")}*`;
}

export function renderComment(size: SizeResult, price: Price): string {
    const lines: string[] = [MARKER, "### Review price tag", ""];

    if (size.effectiveLines === 0) {
        lines.push("This PR has no effective source changes, so its review burden is negligible.");
    } else {
        lines.push(tierLine(size.effectiveLines, price));
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
