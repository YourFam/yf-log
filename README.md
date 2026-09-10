# yf-log

Pretty git log tables for any repo.

Three views: **today’s commits**, **all tags**, and **branch / worktree status**. Local timezone; IANA name in the heading. Node 20+.

Does **not** run your test suite. No GitHub token. No LLM.

- **Source / README:** https://github.com/YourFam/yf-log
- **npm:** https://www.npmjs.com/package/@yourfam/yf-log
- **Unscoped alias:** https://www.npmjs.com/package/yf-git-log
- **Issues:** https://github.com/YourFam/yf-log/issues

## Install

Node 20+.

```bash
npm install -g @yourfam/yf-log
```

Then from any git repo:

```bash
yf-log
```

The command is `yf-log`.

## Alternate modes of install

**-g** = on **your machine** (global).  
**-D** = in **this project** (devDependency).

| | `npm install -g @yourfam/yf-log` | `npm install -D @yourfam/yf-log` |
|---|---|---|
| Where it goes | Global npm prefix (your user/system) | `node_modules/` + `package.json` of the current repo |
| Command | `yf-log` from any folder | `npx yf-log` (or a script) **in that repo** |
| Other repos | Works | Not installed there |
| Git | Not committed | Listed in `package.json`; teammates get it with `npm install` |
| Typical use | A CLI you want everywhere | A tool this project uses in scripts/CI |

For `yf-log` as a daily command, use **-g**. Use **-D** only if this one repo should own the tool.

With **-D**, the binary lives in that repo’s `node_modules/.bin/`. Your shell PATH does not include that, so **plain `yf-log` will not work**. From that repo:

```bash
npx yf-log
```

No install (npm fetches the published package):

```bash
npx @yourfam/yf-log
npx yf-git-log
```

`npx yf-git-log` is the unscoped alias of `@yourfam/yf-log` (same CLI, same version). npm rejects unscoped `yf-log` as too similar to existing `yflog`. After `-g`, the command is `yf-log`.

## Main uses

Exactly one view per run.

### `yf-log`

Today’s commits, midnight → now in the process timezone.

Use this to see **what landed today**: short SHA, 24-hour time, tag, branch, subject. Oldest first. Date is in the heading, not a column.

```bash
yf-log
```

`# | SHA | Time | Tag | Branch | Commit`

Branch is git’s current decoration, not “committed on this branch.” It is often `-` unless that commit is still a branch tip.

Default is `--all` (every ref). `--current` is HEAD only. `--hide-skip-ci` drops subjects that match `[skip ci]`. `--raw` is one line per commit (`SHA  HH:MM  subject`) instead of a table.

### `yf-log --tags`

Every tag, newest creator date first.

Use this to see **what was tagged, when, and which commit it points at**. Annotated tags show the peeled commit SHA and the tag subject.

```bash
yf-log --tags
```

`Tag | SHA | Date | Time | Commit`

### `yf-log --branches`

Local and remote branches versus a **base** branch.

Use this to see **which branches are ahead or behind the default line**, the short hash, and whether the branch is checked out (`Idle` if not; otherwise the worktree directory name). The heading names the base: `BRANCH STATUS VS    main    Asia/Calcutta`.

```bash
yf-log --branches
```

Base resolution (no `--base`): `origin/HEAD` → `main` → `master`. Override with `--base staging`. Does not hardcode `staging`. Local row, then remote row; a local branch with no remote shows `No Remote`.

## Other arguments

| Argument | Applies to | What it does |
|---|---|---|
| `--yday` | commits | Yesterday’s calendar day (includes a Date column) |
| `--date YYYY-MM-DD` | commits | That calendar day |
| `abc def` | commits | Inclusive SHA range (both ends) |
| `abc..HEAD` / `abc..` | commits | Git range (excludes start; `abc..` is `abc..HEAD`) |
| `--watch` | today, `--tags`, `--branches` | Redraw every 60s. No TTY: still loops, no ANSI wipe. `--branches --watch` fetches at most once per hour |
| `--tz <IANA>` | all views | Timezone (`Kolkata` → `Asia/Kolkata`). Heading prints the IANA name, never IST/EDT |
| `--tz-list` | alone | Print all IANA names and exit (no git) |
| `--current` / `--all` | today, `--yday`, `--date` | HEAD only, or every ref (default `--all`) |
| `--hide-skip-ci` | today, `--yday`, `--date` | Hide `[skip ci]` subjects |
| `--raw` | commit views | SHA, time, subject; no table |
| `--base <branch>` | `--branches` | Ahead/behind base |
| `--help` | — | Usage |

Views are mutually exclusive. Two SHAs = both ends; `A..B` = git.

## Timezone

The process timezone, not geolocation. Never defaults to `Asia/Kolkata`.

1. `--tz <value>` (IANA, typed loosely)
2. Else `TZ` if it is a valid IANA name
3. Else the OS zone from `Intl`
4. Else `UTC`

Dates are `YYYY-MM-DD`. Times are 24-hour `17:21`. Unknown `--tz` prints the 3 closest names. Ambiguous values (`america`) print candidates. There is no “did you mean?” prompt.

ANSI color when stdout is a TTY. No color when piped or `NO_COLOR` is set.

## Development

This is the GitHub repo, not a second package. Docs and source live here; `npx` / `npm install` still install whatever version is **published on npm**.

```bash
git clone https://github.com/YourFam/yf-log.git
cd yf-log
npm test
node ./bin/yf-log.js --help
```

Maintainer: YourFam (`kamal-yourfam` on npm). MIT.

## Publish the unscoped alias (maintainers)

The GitHub repo publishes two npm packages at the same version:

1. `npm publish --access public` from the repo root → `@yourfam/yf-log`
2. Then from `alias/`, with matching `version` and `dependencies["@yourfam/yf-log"]`:

```bash
cd alias
npm publish --access public
```

That second package is named `yf-git-log` and only shims the scoped CLI so `npx yf-git-log` cannot be squatted. npm will not accept unscoped `yf-log` (too similar to `yflog`).

## License

MIT © 2026 YourFam. See [LICENSE](./LICENSE).
