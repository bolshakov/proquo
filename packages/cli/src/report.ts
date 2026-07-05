import type {Price, SizeResult} from "@proquo/core";

export function renderReport(size: SizeResult, price: Price): string {
    const lines: string[] = [];

    if (size.effectiveLines === 0) {
        lines.push("No effective source changes — review burden is negligible.");
    } else {
        lines.push(
            `${size.effectiveLines} effective changed lines — estimated review burden ~${price.minutes} min ` +
            `of focused reviewer attention.`,
        );
    }

    if (size.excludedFiles > 0) {
        const fileWord = size.excludedFiles === 1 ? "file" : "files";
        lines.push(
            `${size.excludedLines} lines across ${size.excludedFiles} generated/lockfile ${fileWord} were excluded.`,
        );
    }

    if (price.splitNudge) {
        lines.push(
            `Worth splitting? Two PRs of half the size would take ~${price.splitNudge.halfMinutes} min each, ` +
            `saving ~${price.splitNudge.savedMinutes} min of reviewer time overall.`,
        );
    }

    return lines.join("\n");
}
