import {describe, expect, it} from "vitest";
import {parseComputeResult, serializeComputeResult, type ComputeResult} from "../src/result";

const valid: ComputeResult = {
    version: 1,
    issueNumber: 42,
    size: {effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
    price: {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false},
};

describe("serializeComputeResult / parseComputeResult", () => {
    it("round-trips a valid ComputeResult", () => {
        expect(parseComputeResult(serializeComputeResult(valid))).toEqual(valid);
    });

    it("rejects malformed JSON", () => {
        expect(parseComputeResult("not json")).toBeNull();
    });

    it("rejects a payload missing required fields", () => {
        expect(parseComputeResult(JSON.stringify({version: 1, issueNumber: 42}))).toBeNull();
    });

    it("rejects an invalid tier value", () => {
        const tampered = {...valid, price: {...valid.price, tier: "blue"}};
        expect(parseComputeResult(JSON.stringify(tampered))).toBeNull();
    });

    it("rejects a non-numeric issueNumber", () => {
        const tampered = {...valid, issueNumber: "42"};
        expect(parseComputeResult(JSON.stringify(tampered))).toBeNull();
    });
});
