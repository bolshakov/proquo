# Releasing

One version number covers the GitHub Action and the `proquo` npm package.

1. Open a pull request that bumps every package, and merge it:

   ```bash
   npm version 2.2.0 --workspaces --include-workspace-root --no-git-tag-version
   npm run build
   ```

   Commit the rebuilt `dist/index.mjs` too. CI fails when `dist/index.mjs` is stale or when the packages disagree on
   the version.
2. Publish a GitHub Release with a new tag such as `v2.2.0`, targeting the bump commit. Mark prereleases such as
   `v2.2.0-rc.1` as pre-releases.
3. The tag runs the Release workflow. It fails unless the tag matches every package version, runs the tests, checks
   that `proquo --version` prints the tag version, then publishes `proquo` to npm. Prereleases go to the `next`
   dist-tag, so `npm install proquo` keeps the last stable release.
4. The `npm` job waits for your approval in the `release` environment before it starts.

Move the floating `v2` tag by hand after a stable release. Only `vX.Y.Z` tags run the Release workflow.
