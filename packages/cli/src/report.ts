import type {Price, SizeResult} from "@proquo/core";
import {fileSpreadNote as coreFileSpreadNote, footnoteParts, formatNumber, formatRange, SPLIT_NUDGE_BODY, SPLIT_NUDGE_LEAD} from "@proquo/core";

function fileSpreadNote(effectiveLines: number, pricedFiles: number): string | null {
    const note = coreFileSpreadNote(effectiveLines, pricedFiles);
    return note ? `${note.lead} ${note.body}` : null;
}

function tierLine(effectiveLines: number, price: Price): string {
    const n = formatNumber(effectiveLines);
    const range = formatRange(price.lowerMinutes, price.upperMinutes);

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
    return footnoteParts(price).join(" ");
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

    const spreadNote = fileSpreadNote(size.effectiveLines, size.pricedFiles);
    if (spreadNote) {
        lines.push(spreadNote);
    }

    if (price.splitNudge) {
        lines.push(`${SPLIT_NUDGE_LEAD} ${SPLIT_NUDGE_BODY}`);
    }

    lines.push(footnote(price));
    return lines.join("\n");
}
