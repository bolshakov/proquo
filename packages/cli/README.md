# 🏷️ proquo

Price a git diff in minutes of focused reviewer attention, before you open the pull request.

```console
$ npx proquo main...HEAD
457 effective lines — about 55–137 min of focused review, more than comfortably fits in a single review session.
198 lines across 2 generated/lockfile files were excluded.
...
```

Lockfiles, generated files, and build output don't count. Tests and comments count for less. Up to 200 effective lines
is green, up to 400 is yellow, and above 400 is red.

## Install

```bash
npm install --global proquo
```

Or run it without installing: `npx proquo`. Needs Node.js 20 or later.

## Usage

```bash
proquo                       # price the working-tree diff
proquo main...HEAD           # price a git range
proquo --explain main...HEAD # show per-file exclusions and weights
proquo --version
```

## Configuration

Put a `.proquo.yml` in the repo root:

```yaml
exclude:
  - "**/*.generated.ts"
weights:
  - pattern: "**/e2e/**"
    weight: 0.3
commentWeight: 0.3
failOn: red
```

All keys are optional. See the [configuration docs](https://github.com/bolshakov/proquo#configuration) for details.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The diff was priced, and it is below `failOn`, or `failOn` is not set. |
| `1` | The diff reached the `failOn` tier. |
| `2` | ProQuo could not run, such as on an invalid `.proquo.yml` or a bad git range. |

This makes it work as a `pre-push` hook that blocks oversized pushes:

```sh
#!/bin/sh
proquo origin/main...HEAD
[ $? -ne 1 ]
```

## GitHub Action

The same pricing engine runs as a GitHub Action that comments the price on every pull request and labels it by size.
See [bolshakov/proquo](https://github.com/bolshakov/proquo).

## License

MIT
