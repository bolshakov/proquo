# 🏷️ ProQuo

A GitHub Action that comments the estimated review burden of every pull request, in minutes of focused reviewer
attention.

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
- The price is a range, not a point estimate: lower bound = lines / 500 x 60, upper bound = lines / 200 x 60,
  floored at 5 minutes — derived from published review inspection rates (200-500 effective lines/hour), not a
  prediction of how long a quick skim will take.
- PRs sit in one of three zones: green (up to 200 effective lines, the size band with the best per-line defect
  detection), yellow (201-400), or red (above 400, past the ceiling review studies recommend). Yellow and red
  also flag when the upper bound exceeds a 60-minute focused-review session.
- PRs in the red zone get a split suggestion: splitting into ≤200-line PRs restores per-line detection
  quality. It does not claim saved reviewer minutes — nothing in the evidence backs review time growing
  superlinearly with size, only detection quality falling.

See `.docs/decisions/2026-07-05-review-burden-estimate.md` and `.docs/decisions/2026-07-05-review-burden-presentation.md`
for the evidence and the copy this model is built from.

## Development

```bash
npm install
npm test
npm run build   # regenerates dist/, commit it
```
