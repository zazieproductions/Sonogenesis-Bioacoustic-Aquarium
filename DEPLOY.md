# Publish to GitHub and deploy

## Publish repository (macOS Terminal)

1. Download and unzip the project archive, then `cd` into the extracted `sonogenesis-project` folder.
2. Sign in to GitHub CLI once: `gh auth login`.
3. Run:

```bash
npm ci
npm run typecheck
npm run build
git init
git add .
git commit -m "Initial SONOGENESIS application"
git branch -M main
gh repo create zazieproductions/sonogenesis-artificial-life-simulator --public --source=. --remote=origin --push
```

If you prefer private source, change `--public` to `--private`.

## Cloudflare Pages

In Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git, select the repository, use build `npm run build` and output `dist`.

Alternatively, after `npm run build`:

```bash
npx wrangler login
npx wrangler pages deploy dist --project-name sonogenesis
```

If a Pages project already exists, use the same project name instead.
