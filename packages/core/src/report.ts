import type {Price, Tier} from "./pricing";

export const FILE_SPREAD_THRESHOLD = 10;

const FILE_SPREAD_LEAD = "Spread across many files.";

const FILE_SPREAD_BODY_TEMPLATE =
    "This PR changes {fileCount} files — more than about 9 in 10 PRs touch. Each extra file is another " +
    "piece of context a reviewer has to load and hold at once.";

export const SPLIT_NUDGE_LEAD = "Worth splitting?";

export const SPLIT_NUDGE_BODY =
    "Breaking this into ≤200-line PRs puts each piece back in the size band where reviewers catch the most " +
    "defects per line. The split buys detection quality, not saved review minutes.";

export const FOOTNOTE_BASE =
    "These minutes are what careful defect-finding costs at 200–500 lines/hour — the rate review studies " +
    'report, not how long a skim takes. "Effective lines" already exclude generated files and lockfiles. ' +
    "Treat the rates and the 200/400 thresholds as guardrails, not laws.";

export const SESSION_NOTE =
    "This estimate's upper bound also runs longer than the ~60-minute session after which reviewer attention " +
    "is known to fade — plan for a break or a second sitting.";

export function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

export function formatRange(lowerMinutes: number, upperMinutes: number): string {
    return lowerMinutes === upperMinutes ? `${lowerMinutes} min` : `${lowerMinutes}–${upperMinutes} min`;
}

export interface FileSpreadNote {
    lead: string;
    body: string;
}

export function fileSpreadNote(effectiveLines: number, pricedFiles: number): FileSpreadNote | null {
    if (effectiveLines === 0 || pricedFiles < FILE_SPREAD_THRESHOLD) return null;
    return {lead: FILE_SPREAD_LEAD, body: FILE_SPREAD_BODY_TEMPLATE.replace("{fileCount}", formatNumber(pricedFiles))};
}

export function footnoteParts(price: Price): string[] {
    const parts = [FOOTNOTE_BASE];
    if (price.tier === "yellow" && price.sessionFlag) parts.push(SESSION_NOTE);
    return parts;
}

export function tierTail(tier: Tier): string {
    switch (tier) {
        case "green":
            return (
                " (based on 200–500 lines/hour). This is within the range where reviewers find the most issues " +
                "per line, and small changes usually receive feedback the fastest."
            );
        case "yellow":
            return (
                ". Beyond ~200 lines, reviewers tend to find fewer issues per line, and 400 lines is the upper " +
                "limit recommended by the largest industry study on code reviews."
            );
        case "red":
            return (
                ", more than comfortably fits in a single review session. Beyond 400 lines, review effectiveness " +
                "drops and reviewers tend to leave fewer useful comments per line."
            );
    }
}

export type PreviousPrice = Pick<Price, "lowerMinutes" | "upperMinutes">;

export type Delta = {direction: "up" | "down"; previous: PreviousPrice};

const DELTA_THRESHOLD = 0.01;

export function computeDelta(price: Price, previous: PreviousPrice | null | undefined): Delta | null {
    if (!previous) return null;
    const currentAvg = (price.lowerMinutes + price.upperMinutes) / 2;
    const previousAvg = (previous.lowerMinutes + previous.upperMinutes) / 2;
    if (currentAvg === previousAvg) return null;
    if (previousAvg > 0 && Math.abs(currentAvg - previousAvg) / previousAvg <= DELTA_THRESHOLD) return null;
    return {direction: currentAvg < previousAvg ? "down" : "up", previous};
}
