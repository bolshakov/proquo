export interface SplitNudge {
    halfMinutes: number;
    savedMinutes: number;
}

export interface Price {
    minutes: number;
    splitNudge: SplitNudge | null;
}

const SPLIT_NUDGE_THRESHOLD = 400;

function minutesFor(effectiveLines: number): number {
    if (effectiveLines <= 0) return 0;
    return Math.max(1, Math.round((effectiveLines / 8) * (1 + effectiveLines / 400)));
}

export function price(effectiveLines: number): Price {
    const minutes = minutesFor(effectiveLines);
    let splitNudge: SplitNudge | null = null;
    if (effectiveLines > SPLIT_NUDGE_THRESHOLD) {
        const halfMinutes = minutesFor(Math.round(effectiveLines / 2));
        const savedMinutes = minutes - 2 * halfMinutes;
        if (savedMinutes > 0) splitNudge = {halfMinutes, savedMinutes};
    }
    return {minutes, splitNudge};
}
