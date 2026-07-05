import * as core from "@actions/core";
import * as github from "@actions/github";
import {run} from "./run";

async function main(): Promise<void> {
    const context = github.context;
    const pr = context.payload.pull_request;
    if (!pr) {
        core.info("Not a pull_request event, skipping.");
        return;
    }
    const octokit = github.getOctokit(core.getInput("github-token", {required: true}));
    await run({
        listPrFiles: async () =>
            octokit.paginate(octokit.rest.pulls.listFiles, {
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                per_page: 100,
            }),
        comments: octokit.rest.issues,
        target: {owner: context.repo.owner, repo: context.repo.repo, issueNumber: pr.number},
    });
}

main().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
