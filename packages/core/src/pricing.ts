export type Tier = "green" | "yellow" | "red";

export interface Price {
    lowerMinutes: number;
    upperMinutes: number;
    tier: Tier;
    sessionFlag: boolean;
    splitNudge: boolean;
}

const GREEN_MAX_LINES = 200;
const YELLOW_MAX_LINES = 400;
const LOWER_BOUND_RATE = 500;
const UPPER_BOUND_RATE = 200;
const MINUTE_FLOOR = 5;
const SESSION_MINUTES = 60;

function tierFor(effectiveLines: number): Tier {
    if (effectiveLines <= GREEN_MAX_LINES) return "green";
    if (effectiveLines <= YELLOW_MAX_LINES) return "yellow";
    return "red";
}

export function price(effectiveLines: number): Price {
    if (effectiveLines <= 0) {
        return {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false};
    }

    const lowerMinutes = Math.max(MINUTE_FLOOR, Math.round((effectiveLines / LOWER_BOUND_RATE) * 60));
    const upperMinutes = Math.max(lowerMinutes, Math.round((effectiveLines / UPPER_BOUND_RATE) * 60));
    const tier = tierFor(effectiveLines);

    return {
        lowerMinutes,
        upperMinutes,
        tier,
        sessionFlag: upperMinutes > SESSION_MINUTES,
        splitNudge: tier === "red",
    };
}
