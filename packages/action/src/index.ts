import {readFileSync, statSync, writeFileSync} from "node:fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {runCompute} from "./run";
import {serializeComputeResult} from "./result";
import {verifyIssueNumber} from "./pr-lookup";
import {runCommentPipeline, MAX_ARTIFACT_BYTES} from "./comment-pipeline";

const RESULT_PATH = "proquo-result.json";

async function runComputeMode(octokit: ReturnType<typeof github.getOctokit>): Promise<void> {
    const context = github.context;
    const pr = context.payload.pull_request;
    if (!pr) {
        core.info("Not a pull_request event, skipping.");
        return;
    }
    const result = await runCompute({
        listPrFiles: async () =>
            octokit.paginate(octokit.rest.pulls.listFiles, {
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                per_page: 100,
            }),
        issueNumber: pr.number,
        logGroup: (title, lines) => {
            core.startGroup(title);
            lines.forEach((line) => core.info(line));
            core.endGroup();
        },
    });
    writeFileSync(RESULT_PATH, serializeComputeResult(result));
}

async function runCommentMode(octokit: ReturnType<typeof github.getOctokit>): Promise<void> {
    const context = github.context;
    const workflowRun = context.payload.workflow_run as {head_sha: string} | undefined;
    if (!workflowRun) {
        core.setFailed("Unexpected: workflow_run event payload is missing its data.");
        return;
    }
    const target = {owner: context.repo.owner, repo: context.repo.repo, headSha: workflowRun.head_sha};
    const outcome = await runCommentPipeline({
        artifact: {
            size: () => statSync(RESULT_PATH).size,
            contents: () => readFileSync(RESULT_PATH, "utf8"),
        },
        maxArtifactBytes: MAX_ARTIFACT_BYTES,
        verify: (verifyTarget, issueNumber) =>
            verifyIssueNumber(
                () =>
                    octokit.paginate(octokit.rest.repos.listPullRequestsAssociatedWithCommit, {
                        owner: verifyTarget.owner,
                        repo: verifyTarget.repo,
                        commit_sha: verifyTarget.headSha,
                        per_page: 100,
                    }),
                issueNumber,
            ),
        target,
        comments: octokit.rest.issues,
        now: () => new Date(),
    });

    switch (outcome.status) {
        case "missing-artifact":
            core.setFailed(`Could not read the compute artifact at ${RESULT_PATH}.`);
            break;
        case "malformed-artifact":
            core.warning("Artifact is malformed or too large; skipping comment.");
            break;
        case "unverified":
            core.warning(
                `Artifact claims issueNumber ${outcome.issueNumber}, which is not uniquely associated with commit ${outcome.headSha}; skipping comment.`,
            );
            break;
        case "posted":
            break;
    }
}

async function main(): Promise<void> {
    const octokit = github.getOctokit(core.getInput("github-token", {required: true}));
    const eventName = github.context.eventName;

    if (eventName === "pull_request") {
        await runComputeMode(octokit);
    } else if (eventName === "workflow_run") {
        await runCommentMode(octokit);
    } else {
        core.setFailed(`Unsupported event "${eventName}". Expected "pull_request" or "workflow_run".`);
    }
}

main().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
