const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);

async function getGitApi() {
  const ext = vscode.extensions.getExtension('vscode.git');
  if (!ext) return null;
  if (!ext.isActive) await ext.activate();
  try {
    return ext.exports.getAPI(1);
  } catch {
    return null;
  }
}

// The menu may hand us spread resource states, an array of them, or raw Uris.
// Normalize all of those into a flat list of Uris.
function collectUris(args) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (x.resourceUri) out.push(x.resourceUri);
    else if (typeof x.fsPath === 'string') out.push(x);
  };
  args.forEach(walk);
  return out;
}

async function repoRootFor(uri, gitApi) {
  const repo = gitApi && gitApi.getRepository(uri);
  if (repo) return repo.rootUri.fsPath;
  // Fallback if the Git API can't resolve it: ask git directly.
  const { stdout } = await execFileP('git', ['rev-parse', '--show-toplevel'], {
    cwd: path.dirname(uri.fsPath),
  });
  return stdout.trim();
}

async function addToGitignore(rootPath, anchoredEntries) {
  const giPath = path.join(rootPath, '.gitignore');
  let existing = '';
  try {
    existing = await fs.readFile(giPath, 'utf8');
  } catch {
    /* no .gitignore yet — we'll create it */
  }
  const present = new Set(
    existing.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  );
  const toAdd = anchoredEntries.filter((e) => !present.has(e));
  if (toAdd.length === 0) return [];
  const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n');
  const block = (needsLeadingNewline ? '\n' : '') + toAdd.join('\n') + '\n';
  await fs.appendFile(giPath, block, 'utf8');
  return toAdd;
}

async function ignoreAndUntrack(...args) {
  const uris = collectUris(args);
  if (uris.length === 0) {
    vscode.window.showWarningMessage('Ignore & Untrack: no file was selected.');
    return;
  }

  const gitApi = await getGitApi();

  // Group selected files by their repository root (handles multi-repo selections).
  const byRepo = new Map(); // rootPath -> { relForGit: string[], entries: string[] }
  for (const uri of uris) {
    let root;
    try {
      root = await repoRootFor(uri, gitApi);
    } catch {
      vscode.window.showErrorMessage(
        `Ignore & Untrack: ${path.basename(uri.fsPath)} is not in a git repo.`
      );
      continue;
    }
    const rel = path.relative(root, uri.fsPath).split(path.sep).join('/');
    if (!byRepo.has(root)) byRepo.set(root, { relForGit: [], entries: [] });
    const g = byRepo.get(root);
    g.relForGit.push(rel);
    g.entries.push('/' + rel); // anchor to repo root: ignore exactly this path
  }

  let untracked = 0;
  const added = [];
  for (const [root, g] of byRepo) {
    try {
      // Remove from the index but keep the file on disk.
      // --ignore-unmatch keeps it quiet for files that aren't tracked yet.
      await execFileP(
        'git',
        ['rm', '--cached', '-r', '--ignore-unmatch', '--', ...g.relForGit],
        { cwd: root }
      );
      untracked += g.relForGit.length;
      const newlyAdded = await addToGitignore(root, g.entries);
      added.push(...newlyAdded);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Ignore & Untrack failed in ${path.basename(root)}: ${err.message}`
      );
    }
  }

  if (untracked > 0) {
    const ignoredNote =
      added.length > 0
        ? `, added ${added.length} to .gitignore`
        : ' (already in .gitignore)';
    vscode.window.showInformationMessage(
      `Stopped tracking ${untracked} file(s)${ignoredNote}. Commit to finalize.`
    );
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gitIgnoreUntrack.ignoreAndUntrack',
      ignoreAndUntrack
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };