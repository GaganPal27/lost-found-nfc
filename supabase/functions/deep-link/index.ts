import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "lost-post";
  const id   = url.searchParams.get("id") ?? "";

  if (!id) {
    return new Response("Missing id", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  }

  const appDeepLink = `lostfoundnfc://${type}/${id}`;
  const isGroup = type === "group";

  const title    = isGroup ? "Join a Community Group" : "View Lost Item";
  const emoji    = isGroup ? "&#x1F465;" : "&#x1F50D;";
  const heading  = isGroup
    ? "You've been invited to a group on Poki!"
    : "Someone shared a lost item with you.";
  const subtext  = isGroup
    ? "Tap below to open the group in the Poki Lost &amp; Found app."
    : "Tap below to view the item details in the Poki Lost &amp; Found app.";
  const btnLabel = isGroup ? "Open Group in App" : "View Lost Item in App";

  // NOTE: Pass html as a plain string — NOT TextEncoder().encode(html).
  // Passing Uint8Array makes Deno override Content-Type to application/octet-stream,
  // which causes browsers to display raw source instead of rendering the page.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Poki Lost &amp; Found</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:28px;padding:40px 32px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.15)}
.logo{font-size:56px;margin-bottom:16px;line-height:1.2}
h1{font-size:22px;font-weight:900;color:#0f172a;margin-bottom:8px}
p{font-size:14px;color:#64748b;line-height:1.6;margin-bottom:28px}
.btn{display:block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:16px 24px;border-radius:16px;font-size:16px;font-weight:800;margin-bottom:12px}
.sub{font-size:12px;color:#94a3b8;margin-top:20px}
</style>
</head>
<body>
<div class="card">
<div class="logo">${emoji}</div>
<h1>Poki Lost &amp; Found</h1>
<p>${heading}<br><br>${subtext}</p>
<a class="btn" href="${appDeepLink}">${btnLabel}</a>
<p class="sub">Requires the Poki Lost &amp; Found app to be installed on your device.</p>
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...CORS_HEADERS,
    },
  });
});
