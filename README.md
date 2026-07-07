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

```yaml
name: 🏷️ ProQuo
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  price:
    name: Review Price Tag
    runs-on: ubuntu-latest
    steps:
      - uses: bolshakov/proquo@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Local CLI

Price a diff before you open the PR — a pre-push self-check:

```bash
npm run build --workspace @proquo/cli
node packages/cli/bin/proquo.mjs main...HEAD
```

With no range argument it prices the working-tree diff. The CLI and the GitHub Action share the same pricing engine (`@proquo/core`), so a diff prices identically whether you check it locally or in CI.

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

## Configuration

Drop a `.proquo.yml` in the repo root to tune what counts. Both the Action and the CLI read the same file.

```yaml
exclude:
  - "**/*.generated.ts"
  - "**/e2e/**"

weights:
  - pattern: "**/e2e/**"
    weight: 0.3
```

- `exclude`: extra glob patterns added to the built-in defaults (lockfiles, `node_modules`, `vendor`,
  `dist`/`build`, generated/snapshot files, minified assets). You cannot remove a built-in exclusion, only
  add to it.
- `weights`: glob patterns mapped to a per-line weight. Matched in order, with your patterns checked
  before the built-ins, so a rule here overrides a default for the same file. Defaults already down-weight
  test files (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `spec/`, `__tests__/`) at 0.5 — tests are still
  reviewed, just faster per line than core logic. Any file not matched by a pattern keeps a weight of 1.

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

## Development

```bash
npm install
npm test
npm run build   # regenerates dist/, commit it
```
