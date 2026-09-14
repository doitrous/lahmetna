# Deploy notes

## seo-runtime (SEO hub integration)

`server/index.js` wires [`@omary98/seo-runtime-core`](https://www.npmjs.com/package/@omary98/seo-runtime-core)
directly into the existing zero-dependency `api()` router (no Express — this backend is
deliberately dependency-free, and the core package needs none). It gives the hub
`GET /api/seo/health`, `POST /api/seo/sync`, `GET /api/seo/pages`, the pending/approve/
reject/publish-now proxy, and `POST /api/articles`, all behind `Bearer SEO_HUB_SECRET`, plus
hub-pushed redirects (checked ahead of every other dispatch in the request handler, mirroring
`packages/express/src/index.ts`'s redirect middleware). The site's own `/sitemap.xml` and
`/robots.txt` (above `/api/`) are untouched.

### What this integration does NOT implement

Only the routes and behavior listed above are wired. Everything else CONTRACT.md describes is
out of scope for this pass and was never hand-wired here:

- **IndexNow** (`POST /api/seo/indexnow`) — not wired.
- **The web-vitals beacon** (`POST /api/seo/vitals`, `webVitalsSnippet()`) — not wired.
- **Authors/help/tools pages** (`/authors/:slug`, `/help/:slug`, `/tools/:slug`) — not
  rendered; the v2 `entity`/`authors`/`helpEntries`/`tools` snapshot fields are accepted and
  stored (sync never rejects them) but nothing serves those pages or their JSON-LD.
- **The minimal approval admin panel** (`GET /seo-admin` in the Express package) — not
  present; `/api/seo/pending`, `/approve`, `/reject`, `/publish-now` are wired as raw JSON
  proxies only, with no UI in front of them.
- **`crawlerPolicy` in `robots.txt`** (the v2 `allow`/`disallow` per-bot blocks) — this site's
  own `/robots.txt` route is untouched and has no knowledge of the hub's `crawlerPolicy`
  setting.
- **`verification` meta tags, `ga4MeasurementId` snippet** — not rendered anywhere.
- **`GET /api/seo/probe`** — not wired (nothing here calls `resolveSeo` at all; this site has
  no per-page SEO metadata resolution hooked up).

If any of these become needed, add the matching handler in the `seg[0] === 'seo'` block in
`server/index.js`, following the same pattern as `health`/`sync`/`pending`/`approve` there.

Set these three env vars in Coolify (the hub owner does this after merge):

```
SEO_HUB_URL      https://<seo-hub-host>
SEO_HUB_SECRET   this site's runtime secret, registered in the hub
SEO_SITE_SLUG    lahmetna   (only required until the first successful sync)
```

The runtime's snapshot/article store is a `JsonFileStore` at `data/seo-runtime.json`,
alongside `data/lahmetna.db`.
