# Git: Ignore & Stop Tracking

Adds a **Ignore & Untrack** action to the Source Control context menu that, in one step:

1. Removes the selected file(s) from the git index (`git rm --cached`), keeping them on disk, and
2. Adds an anchored entry to your `.gitignore`.

This is the fix for the common "I committed a file I shouldn't have" situation — `.env`, `node_modules/`, build output, local config — where adding it to `.gitignore` alone isn't enough because git is already tracking it.

## Usage

1. Open the **Source Control** view.
2. Right-click one or more files under **Changes** (or any tracked file shown there).
3. Choose **Ignore & Untrack**.

The file stops being tracked and a `/path/to/file` entry is appended to `.gitignore`. Commit to finalize.

## Features

- **One step, no terminal** — no need to remember `git rm --cached` followed by editing `.gitignore`.
- **Multi-select aware** — select several files at once.
- **Multi-repo aware** — selections spanning more than one repository are grouped and handled per repo.
- **Anchored entries** — writes `/relative/path` so it ignores exactly that path from the repo root, not every file with the same name.
- **Idempotent** — won't add duplicate `.gitignore` lines, and stays quiet for files that weren't tracked yet.

## Requirements

- The built-in **Git** extension (`vscode.git`) must be enabled.
- `git` available on your `PATH`.

## How it works

For each selected file the extension runs `git rm --cached -r --ignore-unmatch` to drop it from the index without deleting it, then appends an anchored entry (e.g. `/src/secret.txt`) to the repository's `.gitignore`, creating the file if needed. Changes are staged but not committed — review and commit when you're ready.

## License

[0BSD](LICENSE)
