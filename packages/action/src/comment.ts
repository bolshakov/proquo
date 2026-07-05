import type {Price} from "@proquo/core";
import type {SizeResult} from "@proquo/core";

export const MARKER = "<!-- review-economy:price-tag -->";

const FORMULA_NOTE =
    "*Estimated from effective diff size with a superlinear curve — defect detection is known to collapse past " +
    "~400 changed lines. Generated files and lockfiles do not count toward the price.*";

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

export function renderComment(size: SizeResult, price: Price): string {
    const lines: string[] = [MARKER, "### Review price tag", ""];

    if (size.effectiveLines === 0) {
        lines.push("This PR has no effective source changes, so its review burden is negligible.");
    } else {
        lines.push(
            `**${formatNumber(size.effectiveLines)} effective changed lines** — estimated review burden ` +
            `**~${price.minutes} min** of focused reviewer attention.`,
        );
    }

    if (size.excludedFiles > 0) {
        const fileWord = size.excludedFiles === 1 ? "file" : "files";
        lines.push(
            "",
            `${formatNumber(size.excludedLines)} lines across ${size.excludedFiles} generated/lockfile ${fileWord} were excluded from the price.`,
        );
    }

    if (price.splitNudge) {
        lines.push(
            "",
            `**Worth splitting?** Review cost grows faster than size: two PRs of half the size would cost ` +
            `~${price.splitNudge.halfMinutes} min each, saving ~${price.splitNudge.savedMinutes} min of reviewer time in total.`,
        );
    }

    lines.push("", FORMULA_NOTE);
    return lines.join("\n");
}
