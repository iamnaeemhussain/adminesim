# Callbite eSIM Access — CORS-fixed production starter

## Why the previous browser-only HTML failed

eSIM Access documents its Partner API as POST endpoints and its authentication requires RT-AccessCode, RT-RequestID, RT-Timestamp and an HMAC-SHA256 signature. A browser calling `https://api.esimaccess.com` directly can be stopped by the browser's CORS policy before your JavaScript gets the response. HTTP 405 can also happen when the endpoint is called with the wrong method.

The correct production shape is:

Browser -> `/api/...` -> Callbite Worker -> eSIM Access

The Worker signs the request server-side, so the SecretKey never reaches the browser.

## Deploy

1. Install Cloudflare Wrangler.
2. Put `index.html` inside `public/index.html`.
3. Create the Worker:
   `wrangler deploy`
4. Set encrypted secrets:
   `wrangler secret put ESIM_ACCESS_CODE`
   `wrangler secret put ESIM_SECRET_KEY`
5. Open the Worker URL. The frontend already uses `/api` as its proxy path.

Do NOT put your real SecretKey in `index.html`, localStorage, GitHub, or client-side JavaScript.

## Important

The API documentation says:
- endpoints are POST;
- data is represented in bytes;
- balance is expressed multiplied by 10,000;
- rate limit is 8 requests/sec;
- usage is not real-time and is updated approximately every 2–3 hours;
- order profiles are allocated asynchronously and can take up to about 30 seconds.

This starter includes catalog, order, profile query, usage, suspend, unsuspend, cancel, revoke, top-up and SMS proxy routes. Extend the UI for any additional endpoints you need.
