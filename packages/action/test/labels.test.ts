import {describe, expect, it, vi} from "vitest";
import {syncTierLabel, TIER_LABELS} from "../src/labels";

const target = {owner: "o", repo: "r", issueNumber: 7};

function apiWith(currentLabels: string[]) {
    return {
        listLabelsOnIssue: vi.fn().mockResolvedValue({data: currentLabels.map((name) => ({name}))}),
        addLabels: vi.fn().mockResolvedValue({}),
        removeLabel: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
    };
}

describe("TIER_LABELS", () => {
    it("maps each tier to a self-explanatory size name and matching color", () => {
        expect(TIER_LABELS.green).toEqual({
            name: "proquo: small",
            color: "2ea44f",
            description: "ProQuo review price tier: small, up to 200 effective lines",
        });
        expect(TIER_LABELS.yellow).toEqual({
            name: "proquo: medium",
            color: "dbab09",
            description: "ProQuo review price tier: medium, 201–400 effective lines",
        });
        expect(TIER_LABELS.red).toEqual({
            name: "proquo: large",
            color: "d73a4a",
            description: "ProQuo review price tier: large, over 400 effective lines",
        });
    });
});

describe("syncTierLabel", () => {
    it("does nothing when the correct tier label is already on the PR", async () => {
        const api = apiWith(["proquo: small", "bug"]);
        await syncTierLabel(api, target, "green");
        expect(api.removeLabel).not.toHaveBeenCalled();
        expect(api.addLabels).not.toHaveBeenCalled();
        expect(api.createLabel).not.toHaveBeenCalled();
    });

    it("adds the label without creating it when it already exists at the repo level", async () => {
        const api = apiWith(["bug"]);
        await syncTierLabel(api, target, "green");
        expect(api.addLabels).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            issue_number: 7,
            labels: ["proquo: small"],
        });
        expect(api.createLabel).not.toHaveBeenCalled();
        expect(api.removeLabel).not.toHaveBeenCalled();
    });

    it("creates the label at the repo level then adds it when addLabels 404s", async () => {
        const api = apiWith([]);
        api.addLabels
            .mockRejectedValueOnce(new Error("Not Found"))
            .mockResolvedValueOnce({});
        await syncTierLabel(api, target, "red");
        expect(api.createLabel).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            name: "proquo: large",
            color: "d73a4a",
            description: "ProQuo review price tier: large, over 400 effective lines",
        });
        expect(api.addLabels).toHaveBeenCalledTimes(2);
        expect(api.addLabels).toHaveBeenNthCalledWith(2, {
            owner: "o",
            repo: "r",
            issue_number: 7,
            labels: ["proquo: large"],
        });
    });

    it("removes the stale tier label and adds the new one when the tier changes", async () => {
        const api = apiWith(["proquo: small", "bug"]);
        await syncTierLabel(api, target, "red");
        expect(api.removeLabel).toHaveBeenCalledTimes(1);
        expect(api.removeLabel).toHaveBeenCalledWith({owner: "o", repo: "r", issue_number: 7, name: "proquo: small"});
        expect(api.addLabels).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            issue_number: 7,
            labels: ["proquo: large"],
        });
    });
});
