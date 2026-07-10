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
    it("maps each tier to a self-explanatory size name", () => {
        expect(TIER_LABELS.green.name).toBe("proquo: small");
        expect(TIER_LABELS.yellow.name).toBe("proquo: medium");
        expect(TIER_LABELS.red.name).toBe("proquo: large");
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
            .mockRejectedValueOnce(Object.assign(new Error("Not Found"), {status: 404}))
            .mockResolvedValueOnce({});
        await syncTierLabel(api, target, "red");
        expect(api.createLabel).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            name: "proquo: large",
            color: "d73a4a",
            description: "ProQuo review price tier: large",
        });
        expect(api.addLabels).toHaveBeenCalledTimes(2);
        expect(api.addLabels).toHaveBeenNthCalledWith(2, {
            owner: "o",
            repo: "r",
            issue_number: 7,
            labels: ["proquo: large"],
        });
    });

    it("rethrows a non-404 addLabels error without creating the label", async () => {
        const api = apiWith([]);
        const forbidden = Object.assign(new Error("Forbidden"), {status: 403});
        api.addLabels.mockRejectedValueOnce(forbidden);
        await expect(syncTierLabel(api, target, "red")).rejects.toThrow("Forbidden");
        expect(api.createLabel).not.toHaveBeenCalled();
    });

    it("keeps the current tier label when adding the new one fails", async () => {
        const api = apiWith(["proquo: small"]);
        api.addLabels.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), {status: 403}));
        await expect(syncTierLabel(api, target, "red")).rejects.toThrow("Forbidden");
        expect(api.removeLabel).not.toHaveBeenCalled();
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
