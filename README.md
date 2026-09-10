# yf-log

Pretty git log tables for any repo.

Bare `yf-log` is **today’s commits**. Also a calendar day, SHA range, tags, and branch / worktree status. Local timezone; IANA name in the heading. Node 20+.

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

No install at all (npm fetches and runs the published package):

```bash
npx @yourfam/yf-log
npx yf-git-log
```

`npx yf-git-log` is the unscoped alias of `@yourfam/yf-log` (same CLI, same version). Both are yours. npm rejects unscoped `yf-log` as too similar to existing `yflog`.

## Usage

Exactly one view per run. Bare `yf-log` (no view flag, no SHAs) is today.

```bash
npx yf-git-log
npx yf-git-log --watch
npx yf-git-log --yday
npx yf-git-log --date 2026-09-09
npx yf-git-log --current
npx yf-git-log --hide-skip-ci
npx yf-git-log --tz America/New_York
npx yf-git-log --tz Kolkata
npx yf-git-log --tz-list

npx yf-git-log abc1234 def5678
npx yf-git-log abc1234..HEAD

npx yf-git-log --tags
npx yf-git-log --tags --watch

npx yf-git-log --branches
npx yf-git-log --branches --base main
npx yf-git-log --branches --watch
```

Friend one-liners: `npx @yourfam/yf-log` **and** `npx yf-git-log`. After `-g`, the command is `yf-log`.

Two SHAs = both ends; `A..B` = git.

`--watch` redraws every 60s on bare `yf-log`, `--tags`, and `--branches`. If stdout is not a TTY it still loops and does not ANSI-wipe.

## Timezone

The process timezone, not geolocation. Never defaults to `Asia/Kolkata`.

1. `--tz <value>` (IANA, typed loosely: `Kolkata` → `Asia/Kolkata`, `hong-kong` → `Asia/Hong_Kong`)
2. Else `TZ` if it is a valid IANA name
3. Else the OS zone from `Intl`
4. Else `UTC`

The heading always prints that IANA name. No `IST`, `EDT`, or other abbreviations. Dates are `YYYY-MM-DD`; times are 24-hour `17:21`.

`--tz-list` prints every IANA name and exits (no git). Unknown `--tz` prints the 3 closest names. Ambiguous values (`america`) print candidates. There is no “did you mean?” prompt.

## Columns

Commit tables: `# | SHA | Date* | Time | Tag | Branch | Commit`

Date is omitted on **today** (it is still in the heading). Shown on `--yday`, `--date`, and range.

Tag and Branch come from git decorations. Branch is often `-` in repos that do not decorate every commit. That is expected.

`--raw` (commit views): one line per commit, `SHA  HH:MM  subject`, with the same IANA heading above the list.

`--tags`: `Tag | SHA | Date | Time | Commit`

`--branches`: local + remote vs `--base` (default: `origin/HEAD` → `main` → `master`), ahead/behind, short hash, worktree directory name or `Idle`.

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
