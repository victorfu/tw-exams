# SEO / GEO discovery and validation

## Public URL contract

| Route | Indexing | Content |
| --- | --- | --- |
| `/` | Self canonical | Product and current catalog coverage |
| `/past-exams` | Self canonical | Interactive exam browser, server rendered |
| `/past-exams/[collection]` | Self canonical | Complete collection, actual exam links, ItemList and breadcrumbs |
| `/past-exams/[collection]/[exam]` | Self canonical | Static exam facts, provenance, answer availability, downloads, LearningResource and breadcrumbs |
| `/past-exams?c=…&id=…` | Canonical to the matching exam detail | Existing viewer links continue to work |
| `/past-exams?c=…` | Canonical to the matching collection | Existing collection selection continues to work |
| `/past-exams` with nonempty `q`, `city`, `year`, or `type` | `noindex, follow`, no canonical | Filtered results are not equivalent to the full collection |
| `/past-exams` with invalid collection/exam selection | `noindex, follow` | Preserve the viewer's forgiving fallback without indexing a misleading URL |
| `/guides/practice-sheets` | Self canonical | Find, download, check answers, crop, compose, print and storage limits |
| `/my-exams` and child routes | `noindex, follow` | Per-tab temporary workspace; guide is the public search entry |
| `/exams/*` | Existing robots exclusion and file `X-Robots-Tag` | Catalog-whitelisted public files; HTML details are the index entry |

The sitemap lists only canonical public pages. Available exam IDs retain the provider prefix and are URL encoded, not title-derived. Unknown IDs, unavailable records and IDs under the wrong collection must return HTTP 404. All 852 currently available records are pre-rendered; adding catalog records adds their pages on the next build. Collection links disable prefetch for hundreds of exam detail/viewer URLs while retaining ordinary crawlable anchors.

## Evidence and content boundaries

- `question_file.source_url`, `source.provider`, and `source.collected_at` are retained from the existing catalog. Links accept only absolute HTTP(S) without credentials. Missing/invalid provenance is omitted, not invented.
- Collected dates are labeled as collection dates, never publication, exam or modification dates. Exam sitemap entries omit `lastModified` until an actual per-record change timestamp exists.
- Page text and structured data describe the same record. Missing answers and Word download-only behavior are explicit. Do not synthesize authors, school endorsement, ratings, licenses, answer keys or PDF transcriptions.
- PDF/Word contents are not transcribed into HTML. This change makes the existing catalog discoverable and citable; full question-text discovery would require a separate extraction/review pipeline.
- `llms.txt` is a supplementary navigation summary, not a ranking guarantee or a substitute for crawlable HTML. No special AI schema is claimed.
- `NEXT_PUBLIC_SITE_URL` must be the real production origin (default `https://tw-exams.vercel.app`), not a preview URL. Canonicals, sitemap, Open Graph and schema share it.

## Validation

```sh
npm ci
npm run catalog
npm test
npm run lint
npm run build
npm start
# In another terminal, using the production server:
npm run test:seo -- http://localhost:6789
```

The SEO smoke check requests actual HTTP responses without running browser JavaScript. It checks sitemap membership and uniqueness, static metadata, JSON-LD, source text, Word/answer variants, query canonicals/noindex, workspace noindex, robots and 404 responses. Unit tests additionally cover unsafe source URLs and unavailable/mismatched records.

Local builds do not include the private Blob credentials or PDF/Word binaries. File download and PDF rendering should also be checked in the configured Vercel preview. The smoke check intentionally validates file links, not the unavailable local file contents.

After merging/deploying, submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools, inspect the home/guide/collection/sample exam URLs, confirm CDN or deployment protection does not block crawlers, and monitor indexed pages, impressions and relevant search queries. These account-side actions are not performed by this PR. Search indexing and AI citations are not guaranteed by passing code checks.

The user-provided Search Console verification file is preserved verbatim at `public/googlef5650c4c1be55237.html`, served as `/googlef5650c4c1be55237.html`. After deployment, confirm that URL is public and select **Verify** in Search Console. Keep the file after successful verification. The smoke check also verifies its exact response body.

References: [Google AI features and websites](https://developers.google.com/search/docs/appearance/ai-features), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Next.js metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).
