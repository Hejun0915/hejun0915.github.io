# Jun He — academic homepage

A standalone academic homepage with pixel typography, four time-of-day themes, selected publications and public project statistics.

## Preview and validate

Requires Node.js 18 or later. No package installation is needed.

```sh
npm run dev
```

The default preview is http://127.0.0.1:4173. To produce the Pages build:

```sh
DEPLOY_TARGET=github-pages npm run build
npm run check
npm run check:privacy
npm run test:privacy
npm run test:themes
node scripts/test-metrics.mjs
node scripts/test-preview.mjs
```

## Content and assets

- `content/profile.json`: biography, education, news and public projects.
- `content/publications.json`: publications and external resources.
- `content/metrics-snapshot.json`: last successful public statistics and timestamps.
- `src/`: templates, styles and interaction code.
- `public/assets/`: locally hosted images, logos and fonts; keep font licenses.
- `scripts/`: build, preview, metrics and validation.
- `.github/workflows/pages.yml`: build from `main`, publish only `dist/`.

Only public academic information belongs in this repository. Public papers and their research/project/code links are retained; the approved public internship entry (employer, role, dates, logo and general research focus) is also retained. Work email addresses, internal projects, local paths and private documents are excluded.

Enable the local Git guards with `git config --local core.hooksPath .githooks`. The pre-commit hook checks the staged files and effective author/committer identity; the pre-push hook and Pages workflow also inspect reachable commit history. Keep an explicit personal `user.name` and `user.email` in this repository. The scanner checks known text patterns and WebP metadata; newly added images still need a visual review.

## Hosting

Use the standalone repository `Hejun0915/hejun0915.github.io` and select **Settings → Pages → Source: GitHub Actions**. A push to `main` builds and publishes the site; a separate `gh-pages` branch is unnecessary. See [the deployment guide](docs/GITHUB_PAGES.md).

GitHub stars are refreshed from public APIs when available. Scholar citations use the published snapshot; the scheduled workflow attempts a daily refresh. The visible “As of” date is the last verified reading, not the latest deployment. Upstream blocking or rate limits preserve the last successful value and timestamp, and the workflow reports the failed source in its summary. Saved data, CI cache and the last published snapshot are merged by verification time so older caches cannot overwrite newer readings. Open, visible tabs check the published snapshot every five minutes. No private API key is required.

To refresh from a local connection that can access Scholar, run `npm run refresh:metrics`, review `content/metrics-snapshot.json`, and commit that file before pushing. Only parsed public totals are saved; the Scholar page itself is not stored.

## Asset attribution

Publication illustrations belong to their respective authors and accompany the public research entries. The institution logos represent the listed education and approved public internship. Pixel illustrations were generated for this site. Font licenses are included under `public/assets/fonts/`.
