# ProQuo

A GitHub Action that comments the estimated review burden of every pull request, in minutes of focused reviewer
attention. Part of the review-economy project (see `docs/`).

## Why

Review effort grows faster than diff size: defect detection collapses past ~400 changed lines. This action makes
the invisible cost of a PR visible at the moment it is created, which nudges authors toward smaller PRs.

## Usage

```yaml
name: price-tag
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  price:
    runs-on: ubuntu-latest
    steps:
      - uses: bolshakov/proquo@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How the price is computed

- Effective size = added + deleted lines, excluding lockfiles, vendored/build/generated paths, and minified
  artifacts. Pure renames count as zero.
- Minutes = (lines / 8) x (1 + lines / 400), floored at 1 minute — superlinear on purpose. The curve reflects
  how review quality degrades with size, and a trivial diff honestly prices as a one-minute read.
- PRs above 400 effective lines get a split suggestion showing the reviewer time a split would save.

## Development

```bash
npm install
npm test
npm run build   # regenerates dist/, commit it
```
