# Deploy notes

## seo-runtime (SEO hub integration)

`server/index.js` wires [`@omary98/seo-runtime-core`](https://www.npmjs.com/package/@omary98/seo-runtime-core)
directly into the existing zero-dependency `api()` router (no Express — this backend is
deliberately dependency-free, and the core package needs none). It gives the hub
`GET /api/seo/health`, `POST /api/seo/sync`, `GET /api/seo/pages`, the pending/approve/
reject/publish-now proxy, and `POST /api/articles`, all behind `Bearer SEO_HUB_SECRET`. The
site's own `/sitemap.xml` and `/robots.txt` (above `/api/`) are untouched.

Set these three env vars in Coolify (the hub owner does this after merge):

```
SEO_HUB_URL      https://<seo-hub-host>
SEO_HUB_SECRET   this site's runtime secret, registered in the hub
SEO_SITE_SLUG    lahmetna   (only required until the first successful sync)
```

The runtime's snapshot/article store is a `JsonFileStore` at `data/seo-runtime.json`,
alongside `data/lahmetna.db`.
