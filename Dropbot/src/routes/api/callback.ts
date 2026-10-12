import { createFileRoute } from "@tanstack/react-router";

// eBay OAuth redirect target. The user finishes eBay sign-in here; we exchange
// the code for a refresh token and show it once so it can be saved as the
// EBAY_REFRESH_TOKEN secret. Public route — it only handles eBay's own code.
export const Route = createFileRoute("/api/public/ebay/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response("Missing code from eBay.", { status: 400 });
        }
        try {
          const { exchangeCode } = await import("@/lib/ebay.server");
          const { refreshToken } = await exchangeCode(code);
          const html = `<!doctype html><html><body style="font-family:system-ui;background:#0b0f1a;color:#e5e7eb;display:grid;place-items:center;min-height:100vh">
<div style="max-width:560px;padding:32px">
<h1 style="font-size:24px">eBay connected</h1>
<p>One last step: copy the token below and save it as the <b>EBAY_REFRESH_TOKEN</b> secret in your project settings (Project → Settings → Secrets). After that, "Post to eBay" works.</p>
<textarea readonly style="width:100%;height:120px;background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:8px">${refreshToken}</textarea>
<p style="color:#9ca3af;font-size:13px">This page is shown once. Keep the token private.</p>
</div></body></html>`;
          return new Response(html, { headers: { "Content-Type": "text/html" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          return new Response(`eBay connection failed: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
