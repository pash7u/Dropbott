import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getEbayStatus, getEbayAuthUrl } from "@/lib/ebay.functions";

export const Route = createFileRoute("/settings/ebay")({
  head: () => ({
    meta: [
      { title: "eBay Connection — DropBot" },
      { name: "description", content: "Connect your eBay seller account to DropBot to post listings directly." },
      { property: "og:title", content: "eBay Connection — DropBot" },
      { property: "og:description", content: "Connect eBay to post listings from DropBot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EbaySettings,
});

function EbaySettings() {
  const fetchStatus = useServerFn(getEbayStatus);
  const fetchAuthUrl = useServerFn(getEbayAuthUrl);
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; sandbox: boolean } | null>(null);

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => setStatus(null));
  }, [fetchStatus]);

  async function connect() {
    try {
      const { url } = await fetchAuthUrl();
      window.location.href = url;
    } catch {
      alert("eBay keys are not set up yet. Add the secrets first (see below).");
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link to="/" className="text-sm text-primary hover:underline">← Back to DropBot</Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">eBay connection</h1>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Status</p>
        <p className="mt-1 text-lg font-semibold">
          {!status ? "Checking…"
            : !status.configured ? "Keys missing"
            : !status.connected ? "Keys saved — account not connected"
            : "Connected"}
        </p>
        {status?.sandbox && <p className="mt-1 text-xs text-accent">Sandbox mode is on — listings go to eBay's test site.</p>}
        <button
          onClick={connect}
          disabled={!status?.configured}
          className="mt-4 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          Connect eBay account
        </button>
      </section>

      <section className="mt-6 space-y-4 rounded-xl border bg-card p-5 text-sm">
        <h2 className="text-lg font-semibold">One-time setup</h2>
        <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
          <li>Go to <b className="text-foreground">developer.ebay.com</b>, sign in with your eBay account and create an app to get your <b className="text-foreground">App ID</b> and <b className="text-foreground">Cert ID</b>.</li>
          <li>
            In the eBay developer portal, add a redirect URL (RuName) pointing to:
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
              {origin}/api/public/ebay/callback
            </code>
          </li>
          <li>Save these secrets in Project → Settings → Secrets:
            <ul className="mt-1 list-disc pl-5">
              <li><code className="text-foreground">EBAY_CLIENT_ID</code> — your App ID</li>
              <li><code className="text-foreground">EBAY_CLIENT_SECRET</code> — your Cert ID</li>
              <li><code className="text-foreground">EBAY_RUNAME</code> — the RuName from step 2</li>
            </ul>
          </li>
          <li>Come back here and press <b className="text-foreground">Connect eBay account</b>. eBay will send you to a page showing one final token — save it as the <code className="text-foreground">EBAY_REFRESH_TOKEN</code> secret.</li>
          <li>Make sure your eBay Seller Hub has payment, return and shipping <b className="text-foreground">business policies</b> set up — eBay requires them to publish a listing.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Tip: add <code className="text-foreground">EBAY_SANDBOX=true</code> to test with eBay's sandbox before going live.</p>
      </section>
    </main>
  );
}
