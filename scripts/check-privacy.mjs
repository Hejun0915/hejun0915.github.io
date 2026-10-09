import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Split policy terms so the scanner's own source is not mistaken for site content.
const privateTerms = new RegExp([
  ['ten', 'cent'].join(''), ['微', '信'].join(''), ['腾', '讯'].join(''),
  ['we', 'chat'].join(''), ['top', 'azhe'].join(''), ['WeGen', 'EditBench'].join(''),
  ['WeGen', 'EvoStudio'].join(''), ['Code', 'Buddy'].join(''), ['Editing', '_Benchmark'].join(''),
].join('|'), 'i');
const credentials = /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/;
const localPaths = /(?:file:\/\/\/|\/Users\/[^\s/]+\/|\/home\/[^\s/]+\/|[A-Z]:\\Users\\)/i;
const sensitiveFile = /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|\.DS_Store)$|\.(?:pem|key|p12|pfx|pdf|docx?|pptx?|xlsx?|zip|tar|gz|bak|backup|log)$/i;
const binaryExtensions = new Set(['.webp', '.ttf', '.woff2']);
const skippedDirectories = new Set(['.git', 'node_modules', '.cache', '.qa', '.idea', '.vscode']);
const problems = [];
let checked = 0;
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const fail = (label, reason) => problems.push(`${label}: ${reason}`);

function publicationLinks(json) {
  return new Set(JSON.parse(json).flatMap(p => [p.paper, p.projectUrl, p.githubUrl]).filter(value => {
    if (!value) return false;
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password &&
      /^(?:github\.com|[a-z0-9-]+\.github\.io|arxiv\.org|openreview\.net|openaccess\.thecvf\.com|neurips\.cc)$/.test(u.hostname);
  }));
}

function textIssues(label, value, links = new Set()) {
  if (credentials.test(value)) fail(label, 'possible credential (value withheld)');
  if (localPaths.test(value)) fail(label, 'private local path');
  const withoutPublicLinks = value.replace(/https?:\/\/[^\s"'<>`]+/g, url =>
    links.has(url.replaceAll('&amp;', '&')) ? '[public research link]' : url);
  if (privateTerms.test(withoutPublicLinks)) fail(label, 'work identity or internal project reference');
}

function inspect(name, data, links, label = name) {
  checked++;
  textIssues(`${label} (filename)`, name);
  if (sensitiveFile.test(name)) fail(label, 'private/document/archive file needs manual review');
  const extension = path.extname(name).toLowerCase();
  if (extension === '.webp') {
    if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
      fail(label, 'invalid WebP'); return;
    }
    for (let offset = 12; offset + 8 <= data.length;) {
      const kind = data.toString('ascii', offset, offset + 4);
      const size = data.readUInt32LE(offset + 4);
      if (['EXIF', 'XMP '].includes(kind)) fail(label, 'image metadata needs review/removal');
      if (offset + 8 + size > data.length) { fail(label, 'invalid WebP chunk'); break; }
      offset += 8 + size + size % 2;
    }
  } else if (!binaryExtensions.has(extension)) {
    if (data.includes(0)) fail(label, 'unrecognized binary file needs manual review');
    else textIssues(label, data.toString('utf8'), links);
  }
}

function walk(folder, links) {
  for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
    const name = path.posix.join(folder, entry.name);
    if (entry.isSymbolicLink()) { fail(name, 'symbolic links are not published'); continue; }
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) walk(name, links);
    } else inspect(name, fs.readFileSync(path.join(root, name)), links);
  }
}

function inspectEntries(entries, links, label = '') {
  for (const entry of entries.filter(Boolean)) {
    const tab = entry.indexOf('\t'), name = entry.slice(tab + 1);
    const [mode, , oid] = entry.slice(0, tab).split(' ');
    if (!['100644', '100755'].includes(mode)) { fail(name, 'unsupported Git entry'); continue; }
    inspect(name, git('cat-file', 'blob', oid), links, `${label}${name}`);
  }
}

try {
  const args = new Set(process.argv.slice(2));
  if (args.has('--staged')) {
    const links = publicationLinks(git('show', ':content/publications.json').toString());
    // Check the actual index, not just the working copy.
    const entries = git('ls-files', '--stage', '-z').toString().split('\0').filter(Boolean).map(e => {
      const tab = e.indexOf('\t'), [mode, oid, stage] = e.slice(0, tab).split(' ');
      if (stage !== '0') fail(e.slice(tab + 1), 'unresolved index entry');
      return `${mode} blob ${oid}${e.slice(tab)}`;
    });
    inspectEntries(entries, links);
    for (const key of ['user.name', 'user.email']) {
      const value = git('config', '--local', '--get', key).toString().trim();
      if (!value) fail('Git configuration', 'explicit personal name/email required');
      textIssues('Git configuration', value);
    }
    for (const kind of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) textIssues(kind, git('var', kind).toString());
  } else {
    walk('', publicationLinks(fs.readFileSync(path.join(root, 'content/publications.json'), 'utf8')));
    if (args.has('--history')) {
      const commits = git('rev-list', '--all').toString().trim().split('\n').filter(Boolean);
      const seenTrees = new Set();
      for (const commit of commits) {
        textIssues(`Commit ${commit.slice(0, 8)}`, git('show', '-s', '--format=%an <%ae>%n%cn <%ce>%n%B', commit).toString());
        const tree = git('rev-parse', `${commit}^{tree}`).toString().trim();
        if (seenTrees.has(tree)) continue;
        seenTrees.add(tree);
        const links = publicationLinks(git('show', `${commit}:content/publications.json`).toString());
        inspectEntries(git('ls-tree', '-r', '-z', commit).toString().split('\0'), links, `${commit.slice(0, 8)}:`);
      }
      console.log(`Checked ${commits.length} reachable commit(s), including author and committer.`);
    }
  }
} catch (error) {
  // Do not echo command output: it may contain the very data this guard protects.
  fail('Privacy check', 'could not complete a required file/Git check; review repository configuration');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Privacy check passed: ${checked} file versions. Public research links retained.`);
