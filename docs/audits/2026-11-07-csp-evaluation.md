# Content-Security-Policy evaluation (2026-11-07)

Status: **report-only**. The policy ships with the site and reports violations; it does not block anything yet.

This record closes finding H-04 in [`2026-11-07-repository-audit.md`](2026-11-07-repository-audit.md) for the design-and-report-only part of the phase. Enforcement is deliberately out of scope: it needs a report collector and a clean observation window first.

## Where the policy lives

`public/_headers` is the single source of truth. It contains one `Content-Security-Policy-Report-Only:` line next to the four existing baseline headers. Cloudflare Pages applies `_headers` in production, so the deployed site and the tests read the same bytes.

The preview server does not read `_headers` (that is a Cloudflare Pages convention), so `vite.config.ts` adds a `previewCsp()` plugin. It reads `public/_headers`, extracts the report-only line, throws if the line is missing, and attaches it in `configurePreviewServer`. `npm run preview` and the Playwright `webServer` therefore serve the same policy without a second copy to drift.

## Policy and why each directive is there

```text
default-src 'self'
script-src  'self' 'sha256-<inline theme bootstrap>' + the Google Analytics, AdSense and ad-serving hosts
style-src   'self' 'unsafe-inline'
img-src     'self' data: blob: + ad hosts
font-src    'self' data:
connect-src 'self' + Google Analytics and ad hosts
frame-src   googleads.g.doubleclick.net, tpc.googlesyndication.com, www.google.com
worker-src  'self' blob:
media-src   'self' blob:
object-src  'none'
base-uri    'self'
form-action 'self'
frame-ancestors 'self'
```

- **Only one inline script exists**: the theme bootstrap in `index.html` that sets `data-theme` before React mounts to avoid a light flash on `/game/*`. It is allowed by SHA-256 hash rather than `'unsafe-inline'`, so any new inline script fails the unit test until its hash is added deliberately.
- **No `'unsafe-eval'`**: Vite's production output and Three.js do not need `eval`. The browser test across a 3D route confirms it.
- **`worker-src blob:`** and **`img-src blob:`**: Three.js and the audio helpers create blob-backed workers, textures and media. `media-src blob:` covers generated clips.
- **`style-src 'unsafe-inline'`** stays because Tailwind and React write inline `style` attributes (theme tokens, layout variables). Style injection is not a script-execution vector; this is the one keyword concession and it is documented rather than hidden.
- **The Google hosts** are the minimum set the GA4 loader, AdSense loader and ad iframes need. They are inert unless the build is configured and the visitor grants the matching consent, which is proven separately in `e2e/privacy-configured.spec.ts`.
- **`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`** close plugin, base-tag and form-hijack vectors with no legitimate use in the app.
- **`frame-ancestors 'self'`** mirrors `X-Frame-Options: SAMEORIGIN` for browsers that prefer the CSP directive.

## The hash gotcha worth remembering

CSP hashes match the script text the HTML parser produces, and the parser normalises CRLF and lone CR to LF. A hash computed over a Windows CRLF checkout never matches in the browser. Both the unit test and the header therefore use the LF-normalised text. This was caught by the browser test: the first policy draft reported `script-src-elem` violations for the theme bootstrap on every route while the unit test passed on raw bytes.

## Verification

| Check | Command | Result |
|---|---|---|
| Header present, not enforced, hashes fresh, no unsafe keywords | `npx vitest run src/test/cspHeaders.test.ts` | 4 passed |
| Policy served by preview; five key routes clean in the default build; configured build clean with both consents allowed | `npx playwright test e2e/csp.spec.ts` | 3 passed |
| Full unit suite | `npm test` | reported in README snapshot |
| Full browser suite | `npx playwright test --workers=2` | reported in README snapshot |

The browser test carries violations across navigations in `sessionStorage`; a per-document array would only ever show the last route. It records directive, blocked URI, source file, line and sample so a failure is diagnosable without rerunning.

## Residual risk and the path to enforcement

- **No report endpoint.** Violations are visible only in tests and the browser console. Enforcing without collecting reports would be blind.
- **External game embeds.** `VITE_EXTERNAL_GAME_ORIGINS` can allowlist third-party game documents, but `frame-src` does not list arbitrary origins. While report-only nothing breaks; before enforcing, `frame-src` must be generated from the same allowlist or external embeds will stop loading.
- **`_headers` is a hosting convention.** A host that ignores it serves no CSP. The preview middleware proves the policy's content, not the host's behaviour.
- **Enforcement order.** Ship a collector, watch for clean reports across the five routes plus each game family, add the external-origin generation, then rename the header to `Content-Security-Policy`. The rename is the only change that makes violations blocking.