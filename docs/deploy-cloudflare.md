# Deploying to Cloudflare Pages

https://agenti.cash is served by Cloudflare Pages.

| | |
|---|---|
| Live site | https://agenti.cash and https://www.agenti.cash |
| Pages project | `agenti-cash` (https://agenti-cash.pages.dev) |
| Source | Jekyll site in `docs/` (GitHub Pages defaults, no Gemfile) |
| Build | `actions/jekyll-build-pages (source docs)` |
| Output directory | `_site` |
| Workflow | [`.github/workflows/cloudflare-pages.yml`](https://github.com/nirholas/agenti/blob/main/.github/workflows/cloudflare-pages.yml) |

## DNS

- The domain is registered at Namecheap, with its nameservers set to Cloudflare (`adaline.ns.cloudflare.com`, `greg.ns.cloudflare.com`).
- The Cloudflare zone `agenti.cash` has proxied `CNAME` records for `agenti.cash` and `www.agenti.cash`, both pointing to `agenti-cash.pages.dev`.
- Both hostnames are attached to the Pages project under **Custom domains**, and Cloudflare issues their TLS certificates.

To add a hostname, add it in **Workers & Pages → agenti-cash → Custom domains**. Cloudflare creates the DNS record for you.

## Automatic deploys

Every push to `main` builds the site and uploads it with `wrangler pages deploy`. You can also start a deploy with **Actions → Deploy to Cloudflare Pages → Run workflow**. The workflow reads two repository secrets:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with the **Account → Cloudflare Pages → Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID (from the dashboard sidebar) |

To set them without putting the values in shell history:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo nirholas/agenti   # paste the value when prompted
gh secret set CLOUDFLARE_ACCOUNT_ID --repo nirholas/agenti
```

## Manual deploy

Run these from the repository root. Export `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` first:

```bash
docker run --rm -u "$(id -u):$(id -g)" \
  -v "$PWD:/github/workspace" \
  -e INPUT_SOURCE=docs -e INPUT_DESTINATION=_site \
  -e INPUT_FUTURE=false -e INPUT_VERBOSE=false -e INPUT_BUILD_REVISION="$(git rev-parse HEAD)" \
  -e INPUT_TOKEN="$(gh auth token)" -e GITHUB_WORKSPACE=/github/workspace \
  -e GITHUB_REPOSITORY=nirholas/agenti -e PAGES_REPO_NWO=nirholas/agenti -e JEKYLL_ENV=production \
  ghcr.io/actions/jekyll-build-pages:v1.0.13
npx wrangler pages deploy _site --project-name agenti-cash --branch main
```

`--branch main` publishes to production (the custom domains). Any other branch name creates a preview at `https://<branch>.agenti-cash.pages.dev`.

## Rollback

Open **Workers & Pages → agenti-cash → Deployments**, choose an earlier deployment and select **Rollback to this deployment**.
