import type {Price, SizeResult} from "@proquo/core";

const SPLIT_NUDGE =
    "Worth splitting? Breaking this into ≤200-line PRs puts each piece back in the size band where reviewers " +
    "catch the most defects per line. The split buys detection quality, not saved review minutes.";

const FILE_SPREAD_THRESHOLD = 10;

const FILE_SPREAD_NOTE =
    "Spread across many files. This PR changes {fileCount} files — more than about 9 in 10 PRs touch. Each " +
    "extra file is another piece of context a reviewer has to load and hold at once, so a change spread this " +
    "wide is harder to review even when it isn't especially large.";

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

function fileSpreadNote(pricedFiles: number): string | null {
    if (pricedFiles < FILE_SPREAD_THRESHOLD) return null;
    return FILE_SPREAD_NOTE.replace("{fileCount}", formatNumber(pricedFiles));
}

function tierLine(effectiveLines: number, price: Price): string {
    const n = formatNumber(effectiveLines);
    const rangeBounds = price.lowerMinutes === price.upperMinutes ? price.lowerMinutes : `${price.lowerMinutes}–${price.upperMinutes}`;
    const range = `${rangeBounds} min`;

    switch (price.tier) {
        case "green":
            return (
                `${n} effective lines — about ${range} of focused review at evidence-based rates ` +
                "(200–500 lines/hour). That's inside the size band where reviewers catch the most defects " +
                "per line, and small changes get their first feedback fastest."
            );
        case "yellow":
            return (
                `${n} effective lines — about ${range} of focused review. Past ~200 lines, defects found ` +
                "per line start to drop, and 400 is the ceiling the largest industry review study recommends " +
                "never exceeding."
            );
        case "red":
            return (
                `${n} effective lines — about ${range} of focused review, more than fits one effective ` +
                "session. Above 400 lines reviewers stop finding defects at the small-change rate, and useful " +
                "comments per line taper off."
            );
    }
}

function footnote(price: Price): string {
    const parts = [FOOTNOTE_BASE];
    if (price.tier === "yellow" && price.sessionFlag) parts.push(SESSION_NOTE);
    return parts.join(" ");
}

export function renderReport(size: SizeResult, price: Price): string {
    const lines: string[] = [];

    if (size.effectiveLines === 0) {
        lines.push("No effective source changes — review burden is negligible.");
    } else {
        lines.push(tierLine(size.effectiveLines, price));
    }

    if (size.excludedFiles > 0) {
        const fileWord = size.excludedFiles === 1 ? "file" : "files";
        lines.push(
            `${formatNumber(size.excludedLines)} lines across ${size.excludedFiles} generated/lockfile ${fileWord} were excluded.`,
        );
    }

    const spreadNote = size.effectiveLines === 0 ? null : fileSpreadNote(size.pricedFiles);
    if (spreadNote) {
        lines.push(spreadNote);
    }

    if (price.splitNudge) {
        lines.push(SPLIT_NUDGE);
    }

    lines.push(footnote(price));
    return lines.join("\n");
}
