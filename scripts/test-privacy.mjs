import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'homepage-privacy-'));
const workDomain = ['ten', 'cent', '.com'].join('');
const workEmail = `fixture@${workDomain}`;
const publicLink = `https://${['ten', 'cent', '-hunyuan'].join('')}.github.io/Public-Paper/`;
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
for (const key of Object.keys(env)) {
  if (/^GIT_(?:AUTHOR|COMMITTER|CONFIG_KEY|CONFIG_VALUE|CONFIG_COUNT|DIR|WORK_TREE|INDEX_FILE|COMMON_DIR)/.test(key)) delete env[key];
}
function run(command, args, extra = {}) {
  return spawnSync(command, args, { cwd: temporary, env: { ...env, ...extra }, encoding: 'utf8' });
}
function git(...args) {
  const result = run('git', args);
  assert.equal(result.status, 0, `Fixture Git command failed: ${args[0]}`);
}
function check(args, expected, extra = {}) {
  const result = run(process.execPath, ['scripts/check-privacy.mjs', ...args], extra);
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}
function write(name, text) { fs.writeFileSync(path.join(temporary, name), text); }

try {
  fs.mkdirSync(path.join(temporary, 'scripts'));
  fs.mkdirSync(path.join(temporary, 'content'));
  fs.mkdirSync(path.join(temporary, 'dist/assets/brand'), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'public/assets/brand'), { recursive: true });
  fs.copyFileSync(path.join(source, 'check-privacy.mjs'), path.join(temporary, 'scripts/check-privacy.mjs'));
  write('content/publications.json', JSON.stringify([{ paper: publicLink }]));
  write('index.html', `<a href="${publicLink}">Public paper</a>`);
  const employer = ['Ten', 'cent ', 'We', 'Chat'].join('');
  const logo = `assets/brand/${['we', 'chat'].join('')}.svg`;
  const profile = { bio: `Algorithm intern at ${employer}.`, experience: [{ name: employer, logo }] };
  write('content/profile.json', JSON.stringify(profile));
  write('dist/index.html', `<h3>${employer}</h3><img src="${logo}">`);
  for (const directory of ['public', 'dist']) {
    write(`${directory}/${logo}`, `<svg><title>${['We', 'Chat'].join('')}</title></svg>`);
  }
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Public Author');
  git('config', 'user.email', 'author@example.org');
  git('add', '.');
  check(['--staged'], 0);
  git('commit', '-qm', 'Public source');
  check(['--history'], 0); // Public research links are allowed.

  // Allowing a public internship must not exempt the rest of the same file.
  write('content/profile.json', JSON.stringify({ ...profile, email: workEmail }));
  check([], 1);
  write('content/profile.json', JSON.stringify({ ...profile, project: ['WeGen', 'EditBench'].join('') }));
  check([], 1);
  write('content/profile.json', JSON.stringify(profile));
  write('dist/index.html', `<h3>${employer}</h3><p>${workEmail}</p>`);
  check([], 1);
  write('dist/index.html', `<h3>${employer}</h3><img src="${logo}">`);
  write('private-notes.txt', employer);
  check([], 1); // Employer mentions outside approved site files are still reviewed.
  fs.unlinkSync(path.join(temporary, 'private-notes.txt'));

  write('index.html', `Contact: ${workEmail}`);
  check([], 1);
  git('add', 'index.html');
  write('index.html', 'Clean working copy');
  check(['--staged'], 1); // A clean working copy cannot hide a dirty index.
  git('add', 'index.html');
  check(['--staged'], 1, { GIT_AUTHOR_EMAIL: workEmail });
  check(['--staged'], 1, { GIT_COMMITTER_EMAIL: workEmail });

  write('private.env', 'fixture'); // Test the conventional .env filename separately.
  write('.env', 'fixture');
  check([], 1);
  fs.unlinkSync(path.join(temporary, '.env'));
  fs.unlinkSync(path.join(temporary, 'private.env'));
  const chunk = Buffer.alloc(10);
  chunk.write('EXIF'); chunk.writeUInt32LE(2, 4);
  const header = Buffer.alloc(12);
  header.write('RIFF'); header.writeUInt32LE(14, 4); header.write('WEBP', 8);
  write('image.webp', Buffer.concat([header, chunk]));
  check([], 1);
  fs.unlinkSync(path.join(temporary, 'image.webp'));

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  write('image.png', png);
  check([], 0); // Transparent PNG assets are accepted without weakening metadata checks.
  write('image.png', png.subarray(0, png.length - 3));
  assert.match(check([], 1).stderr, /PNG/);
  write('image.png', Buffer.concat([png, Buffer.from(workEmail)]));
  assert.match(check([], 1).stderr, /PNG ending/);
  for (const kind of ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'caBX']) {
    const payload = Buffer.from(workEmail);
    const metadata = Buffer.alloc(payload.length + 12);
    metadata.writeUInt32BE(payload.length);
    metadata.write(kind, 4);
    payload.copy(metadata, 8);
    write('image.png', Buffer.concat([png.subarray(0, -12), metadata, png.subarray(-12)]));
    check([], 1); // Text, EXIF and ancillary provenance cannot hide a private identity.
  }
  fs.unlinkSync(path.join(temporary, 'image.png'));

  const commit = run('git', ['commit', '--allow-empty', '-qm', 'Fixture with wrong identity'], { GIT_COMMITTER_EMAIL: workEmail });
  assert.equal(commit.status, 0);
  git('commit', '--allow-empty', '-qm', 'Clean later commit');
  const history = check(['--history'], 1);
  assert.match(history.stderr, /Commit /); // History must catch an earlier bad committer.
  assert.ok(!history.stderr.includes(workEmail), 'Diagnostics must not echo sensitive values');
  console.log('Privacy regression checks passed: public links, content, index, both identities, history, env files and image metadata.');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
