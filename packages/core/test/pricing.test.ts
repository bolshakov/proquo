import {describe, expect, it} from "vitest";
import {price} from "../src/pricing";

describe("price", () => {
    it("prices an empty diff at zero with no flags", () => {
        expect(price(0)).toEqual({
            lowerMinutes: 0,
            upperMinutes: 0,
            tier: "green",
            sessionFlag: false,
            splitNudge: false,
        });
    });

    it("floors a trivial PR's lower bound at 5 minutes", () => {
        // lower = max(5, round(4/500*60=0.48)) = 5, upper = max(5, round(4/200*60=1.2)) = 5
        expect(price(4)).toEqual({
            lowerMinutes: 5,
            upperMinutes: 5,
            tier: "green",
            sessionFlag: false,
            splitNudge: false,
        });
    });

    it("prices a green-zone PR as a range with no flags", () => {
        // lower = max(5, round(50/500*60=6)) = 6, upper = max(6, round(50/200*60=15)) = 15
        expect(price(50)).toEqual({
            lowerMinutes: 6,
            upperMinutes: 15,
            tier: "green",
            sessionFlag: false,
            splitNudge: false,
        });
    });

    it("prices the green/yellow boundary", () => {
        // lower = max(5, round(200/500*60=24)) = 24, upper = max(24, round(200/200*60=60)) = 60
        expect(price(200)).toEqual({
            lowerMinutes: 24,
            upperMinutes: 60,
            tier: "green",
            sessionFlag: false,
            splitNudge: false,
        });
    });

    it("prices a yellow-zone PR and flags the session past 60 minutes", () => {
        // lower = max(5, round(321/500*60=38.52)) = 39, upper = max(39, round(321/200*60=96.3)) = 96
        expect(price(321)).toEqual({
            lowerMinutes: 39,
            upperMinutes: 96,
            tier: "yellow",
            sessionFlag: true,
            splitNudge: false,
        });
    });

    it("prices the yellow/red boundary without a split nudge", () => {
        // lower = max(5, round(400/500*60=48)) = 48, upper = max(48, round(400/200*60=120)) = 120
        expect(price(400)).toEqual({
            lowerMinutes: 48,
            upperMinutes: 120,
            tier: "yellow",
            sessionFlag: true,
            splitNudge: false,
        });
    });

    it("prices a red-zone PR and adds the split nudge", () => {
        // lower = max(5, round(800/500*60=96)) = 96, upper = max(96, round(800/200*60=240)) = 240
        expect(price(800)).toEqual({
            lowerMinutes: 96,
            upperMinutes: 240,
            tier: "red",
            sessionFlag: true,
            splitNudge: true,
        });
    });
});
