const API_BASE = "https://api.esimaccess.com/api/v1/open";

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8", ...extra}
  });
}

function corsHeaders(origin) {
  // Same-origin deployments do not need CORS. These headers also make a separately
  // hosted frontend usable when ALLOWED_ORIGIN is configured.
  const allowed = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Callbite-Dev-Access",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    {name:"HMAC", hash:"SHA-256"}, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("").toLowerCase();
}

async function proxy(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request.headers.get("Origin"))});
  if (url.pathname === "/health") return json({ok:true,service:"callbite-esim-proxy"});
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  if (request.method !== "POST") return json({success:false,errorMessage:"Use POST for eSIM Access API endpoints."},405);

  const path = url.pathname.slice("/api/".length);
  const allowed = new Set([
    "balance/query","package/list","esim/order","esim/query","esim/usage/query",
    "esim/suspend","esim/unsuspend","esim/cancel","esim/revoke",
    "esim/topup","esim/sendSms","location/list"
  ]);
  if (!allowed.has(path)) return json({success:false,errorMessage:"Endpoint not allowed by Callbite proxy."},403);

  // Credentials MUST be Worker secrets. Do not put them in index.html or localStorage.
  const access = env.ESIM_ACCESS_CODE;
  const secret = env.ESIM_SECRET_KEY;
  if (!access || !secret) return json({success:false,errorMessage:"Callbite proxy credentials are not configured."},500);

  let bodyText = await request.text();
  if (!bodyText) bodyText = "{}";
  try { JSON.parse(bodyText); } catch { return json({success:false,errorMessage:"Invalid JSON body."},400); }

  const requestId = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const signData = timestamp + requestId + access + bodyText;
  const signature = await hmacHex(signData, secret);

  let upstream;
  try {
    upstream = await fetch(`${API_BASE}/${path}`, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "RT-AccessCode":access,
        "RT-RequestID":requestId,
        "RT-Timestamp":timestamp,
        "RT-Signature":signature
      },
      body:bodyText
    });
  } catch (e) {
    return json({success:false,errorMessage:"Unable to reach eSIM Access upstream API."},502);
  }

  const text = await upstream.text();
  const headers = {"content-type":upstream.headers.get("content-type") || "application/json",...corsHeaders(request.headers.get("Origin"))};
  return new Response(text,{status:upstream.status,headers});
}

export default {
  async fetch(request, env, ctx) {
    return proxy(request, env);
  }
};