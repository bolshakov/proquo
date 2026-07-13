# 🏷️ ProQuo

[![CI](https://github.com/bolshakov/proquo/actions/workflows/ci.yml/badge.svg)](https://github.com/bolshakov/proquo/actions/workflows/ci.yml)
[![Marketplace](https://img.shields.io/badge/marketplace-ProQuo-blue?logo=github)](https://github.com/marketplace/actions/proquo-review-price-tag)
[![License: MIT](https://img.shields.io/badge/license-MIT-informational)](LICENSE)

A GitHub Action that comments the estimated review burden of every pull request, in minutes of focused reviewer
attention.

## What it looks like

An example comment for a 133-effective-line PR (note, the message could drift slightly):

> ### Review price tag
>
> 🟢 **133 effective lines** — about **16–40 min** (down from 24–60 min) of focused review (based on 200–500
> lines/hour). This is within the range where reviewers find the most issues per line, and small changes usually
> receive feedback the fastest.
>
> 142 lines across 1 generated/lockfile file were excluded from the price.
>
> <details><summary>Why these numbers?</summary>
>
> These minutes are what careful defect-finding costs at 200–500 lines/hour — the rate review studies report, not
> how long a skim takes. "Effective lines" already exclude generated files and lockfiles. Treat the rates and the
> 200/400 thresholds as guardrails, not laws.
>
> </details>

## Why

Defect detection per line falls as a PR grows, and published review studies put a size ceiling around 400
changed lines. This action makes that cost visible at the moment a PR is created, which nudges authors toward
smaller PRs.

## Usage

ProQuo runs in two parts, so it works correctly on pull requests from forks (GitHub always forces
the automatic `GITHUB_TOKEN` to read-only for `pull_request`-triggered runs on fork PRs, so a single
job can never both read the PR and write a comment on it):

```yaml
name: 🏷️ ProQuo
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read      # read .proquo.yml config from a checkout (built-in defaults apply if absent)
  pull-requests: read # list the PR's changed files
jobs:
  price:
    name: Review Price Tag
    runs-on: ubuntu-latest
    steps:
      - uses: bolshakov/proquo@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: proquo-result
          path: proquo-result.json
```

```yaml
name: 🏷️ ProQuo Comment
on:
  workflow_run:
    workflows: ["🏷️ ProQuo"]
    types: [completed]
permissions:
  pull-requests: write # post/update the price comment
  issues: write         # create and apply the proquo: small/medium/large size labels
  actions: read         # download the compute job's artifact
jobs:
  comment:
    name: Post Price Tag Comment
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: proquo-result
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
      - uses: bolshakov/proquo@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Pin `actions/upload-artifact` and `actions/download-artifact` to a specific commit SHA in your own
workflow if your repo's supply-chain policy expects that.

The second workflow's `comment` job always runs the trusted published `bolshakov/proquo@...` ref —
never point it at a local/checked-out action reference, since that job is the one holding a
write-capable token.

Every `compute` run also logs a full calculation breakdown — per-file exclusion reasons, weights and
whether they came from `.proquo.yml` or a built-in default, and comment down-weighting — under a
collapsed "proquo: calculation breakdown" group in the workflow run's log. It doesn't appear in the
PR comment itself; expand the group in the Actions log when a result needs double-checking.

Every run also applies a size label to the PR — `proquo: small`, `proquo: medium`, or `proquo: large`,
matching the green/yellow/red tier — so PRs can be filtered or scanned by cost straight from the PR
list, without opening each one. Exactly one of these labels is kept on a PR at a time; it's removed and
replaced when the tier changes on a later push. The three labels are created automatically in the repo
the first time they're needed. Labeling requires the `issues: write` permission shown above — if it's
missing, ProQuo logs a warning in the Actions log and still posts the price comment normally.

## Local CLI

Price a diff before you open the PR — a pre-push self-check:

```bash
npm run build --workspace @proquo/cli
node packages/cli/bin/proquo.mjs main...HEAD
```

With no range argument it prices the working-tree diff. The CLI and the GitHub Action share the same pricing engine (`@proquo/core`), so a diff prices identically whether you check it locally or in CI.

Add `--explain` to see, per file, whether it was excluded (and by which pattern), what weight was applied
and whether it came from `.proquo.yml` or a built-in default, and how much comment down-weighting changed
its contribution:

```bash
node packages/cli/bin/proquo.mjs --explain main...HEAD
```

## How the price is computed

- Effective size = added + deleted lines, excluding lockfiles, vendored/build/generated paths, and minified
  artifacts. Pure renames count as zero.
- The price is a range: lower bound = effective lines / 500 x 60, upper bound = effective lines / 200 x 60,
  floored at 5 minutes. These reflect published review inspection rates of 200-500 effective lines/hour — the
  time a defect-finding review takes, not a guess at how fast a skim would go.
- PRs fall into three zones. Green (up to 200 effective lines) is the size band with the best per-line defect
  detection. Yellow (201-400) is within the ceiling review studies recommend, and also flags when its upper
  bound passes a 60-minute focused-review session. Red (above 400) is past that ceiling.
- Red-zone PRs get a split suggestion: breaking the PR into ≤200-line pieces restores per-line detection
  quality.
- PRs that touch an outlier number of files also get an informational note about the added review context —
  this never changes the minutes range or the tier.
- Comment-only lines within a change are also down-weighted, for the same reason test files are —
  reviewed, but faster per line than core logic — configurable in `.proquo.yml`.

## Configuration

Drop a `.proquo.yml` in the repo root to tune what counts. Both the Action and the CLI read the same file.

```yaml
exclude:
  - "**/*.generated.ts"
  - "**/e2e/**"

weights:
  - pattern: "**/e2e/**"
    weight: 0.3

commentWeight: 0.3
```

- `exclude`: extra glob patterns added to the built-in defaults (lockfiles, `node_modules`, `vendor`,
  `dist`/`build`, generated/snapshot files, minified assets). You cannot remove a built-in exclusion, only
  add to it.
- `weights`: glob patterns mapped to a per-line weight. Matched in order, with your patterns checked
  before the built-ins, so a rule here overrides a default for the same file. Defaults already down-weight
  test files (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `spec/`, `__tests__/`) at 0.5 — tests are still
  reviewed, just faster per line than core logic. Any file not matched by a pattern keeps a weight of 1.
- `commentWeight`: the weight applied to comment-only lines within a changed file, on top of that
  file's own weight (so a comment inside an already down-weighted test file counts even less).
  Defaults to `0.3`. Only applied when line-level diff content is available, the file's language
  is recognized, and the patch data is complete; otherwise the file's ordinary per-file weight is
  used, unchanged.

## Research

Published research backs why ProQuo prices by size and rate at all, not just the general instinct that
smaller PRs are easier to review.

- Cohen, Teleki & Brown, "Code Review at Cisco Systems," in *Best Kept Secrets of Peer Code Review*
  (SmartBear Software, 2006) — a vendor-published field study of 2,500 reviews across 3.2 million lines
  of code at Cisco, not a peer-reviewed paper. It found that defect detection falls once a review grows
  past a certain size, that reviewing too fast lowers the fraction of defects caught, and that a review
  session has a point past which attention degrades.
- The older, separate tradition of formal Fagan-style code inspections (e.g. Basili & Pericone; Russell,
  as summarized in McConnell's *Code Complete*) independently established that inspection rate strongly
  affects defects found per line — a second, earlier line of evidence pointing the same direction as the
  Cisco study.

ProQuo's specific size band, rate range, and session length are tuned from this literature, not copied
from it — the exact numbers live in the code, not here, so this section can't drift out of sync with it.

- Bosu, Greiler & Bird, "Characteristics of Useful Code Reviews: An Empirical Study at Microsoft" (MSR
  2015) — found that the proportion of useful review comments declines as a change touches more files, a
  direction-only finding with no reported magnitude or functional form, from a single company's internal
  tooling.
- Abdelsalam, Peitek, Bergum & Apel, "The Effect of Comments on Program Comprehension: An Eye-Tracking Study"
  (2025, eye-tracking study on how developers visually attend to comments vs. code) and
  Brysbaert, "How Many Words Do We Read per Minute?" (2019, reading-rate meta-analysis) — neither
  study measures comment down-weighting during code review directly. Combined, they bound a
  derived, triangulated estimate (roughly 0.05-0.29 from reading-rate ratios, up to ~0.5 from the
  eye-tracking attention ratio) that ProQuo's `commentWeight` default of `0.3` sits inside — a
  reasoned estimate, not a measured one.
- Sadowski et al., "Modern Code Review: A Case Study at Google" (ICSE-SEIP 2018) — found that the large
  majority of code changes touch only a handful of files, a distribution later independently confirmed on
  ordinary GitHub pull requests, which is what makes a change touching many files a genuine outlier rather
  than typical.

Together these say a many-file change is a genuine outlier, and outliers are harder to review — but
neither study hands us a formula, so ProQuo flags file spread as context for the reviewer rather than
pricing it. The exact threshold lives in the code, not here.

## Development

```bash
npm install
npm test
npm run build   # regenerates dist/, commit it
```
