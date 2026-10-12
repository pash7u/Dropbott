import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { searchProducts } from "@/lib/finder.functions";
import { postToEbay } from "@/lib/ebay.functions";
import type { Product } from "@/lib/finder.server";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DropBot — AI eBay Dropshipping Product Finder" },
      { name: "description", content: "Find winning dropshipping products for eBay with profit estimates and ready-made listing titles." },
      { property: "og:title", content: "DropBot — AI eBay Product Finder" },
      { property: "og:description", content: "Winning eBay dropshipping products with profit math, in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NICHES = ["Any", "Home & Kitchen", "Pets", "Phone Accessories", "Fitness", "Car Accessories", "Beauty", "Toys"];

function levelClass(l: string, invert = false) {
  const good = invert ? l === "Low" : l === "High";
  const bad = invert ? l === "High" : l === "Low";
  return good ? "text-primary" : bad ? "text-destructive" : "text-accent";
}

function Index() {
  const search = useServerFn(searchProducts);
  const post = useServerFn(postToEbay);
  const [niche, setNiche] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);
  const [posted, setPosted] = useState<Record<string, string>>({});
  const [postError, setPostError] = useState<Record<string, string>>({});

  async function postListing(p: Product) {
    setPosting(p.name);
    setPostError((m) => ({ ...m, [p.name]: "" }));
    const sku = `DB-${Date.now().toString(36).toUpperCase()}`;
    const res = await post({
      data: {
        title: p.ebayTitle,
        description: `${p.name}\n\n${p.why}\n\nCategory: ${p.category}\n\nBrand new, ships fast. Sold by a DropBot seller.`,
        price: p.ebayPrice,
        sku,
      },
    }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
    if (res.ok) {
      setPosted((m) => ({ ...m, [p.name]: res.listingId }));
    } else {
      setPostError((m) => ({ ...m, [p.name]: res.error ?? "Posting failed." }));
    }
    setPosting(null);
  }

  async function run(n = niche) {
    setLoading(true);
    setError(null);
    const res = await search({ data: { niche: n === "Any" ? "" : n, budget } }).catch(() => ({
      products: [],
      error: "Couldn't reach the server. Try again.",
    }));
    setProducts(res.products);
    setError(res.error);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-10">
        <p className="mb-3 inline-block rounded-full border border-primary/40 px-3 py-1 text-xs font-medium tracking-wide text-primary">
          eBay dropshipping · AI product research
        </p>
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          Drop<span className="text-primary">Bot</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Finds products worth flipping on eBay, does the fee &amp; profit math, and writes your listing title.
        </p>
        <Link to="/settings/ebay" className="mt-4 inline-block text-sm text-primary hover:underline">
          eBay connection settings →
        </Link>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Niche (leave blank for all)"
            className="flex-1 rounded-lg border bg-background px-4 py-3 outline-none focus:border-primary"
          />
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Max cost, e.g. $15"
            className="rounded-lg border bg-background px-4 py-3 outline-none focus:border-primary md:w-44"
          />
          <button
            onClick={() => run()}
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Hunting…" : "Find products"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <button
              key={n}
              onClick={() => { setNiche(n === "Any" ? "" : n); run(n); }}
              disabled={loading}
              className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-muted"
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="mt-6 rounded-lg border border-destructive/50 p-4 text-destructive">{error}</p>}

      {loading && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <article key={p.name} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.category}</p>
                  <h2 className="mt-1 text-xl font-semibold">{p.name}</h2>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-profit">${p.profit.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">profit / sale</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.why}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
                <Stat label="Cost" value={`$${p.supplierCost.toFixed(2)}`} />
                <Stat label="Sell" value={`$${p.ebayPrice.toFixed(2)}`} />
                <Stat label="Demand" value={p.demand} cls={levelClass(p.demand)} />
                <Stat label="Comp." value={p.competition} cls={levelClass(p.competition, true)} />
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(p.ebayTitle); setCopied(p.name); }}
                className="mt-4 rounded-lg border border-dashed px-3 py-2 text-left text-sm hover:border-primary"
              >
                <span className="text-xs text-muted-foreground">{copied === p.name ? "Copied!" : "eBay title · click to copy"}</span>
                <br />
                {p.ebayTitle}
              </button>
              <div className="mt-4 flex gap-2 text-sm">
                <a target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-secondary py-2 text-center hover:bg-muted"
                  href={`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(p.searchTerm)}`}>Find supplier</a>
                <a target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-secondary py-2 text-center hover:bg-muted"
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p.searchTerm)}&LH_Sold=1&LH_Complete=1`}>Check eBay sold</a>
              </div>
              <button
                onClick={() => postListing(p)}
                disabled={posting === p.name || Boolean(posted[p.name])}
                className="mt-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {posted[p.name] ? `Posted ✓ (listing ${posted[p.name]})` : posting === p.name ? "Posting…" : "Post to eBay"}
              </button>
              {postError[p.name] && (
                <p className="mt-2 rounded-lg border border-destructive/50 p-2 text-xs text-destructive">
                  {postError[p.name]}{" "}
                  <Link to="/settings/ebay" className="underline">Open eBay settings</Link>
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && !error && (
        <p className="mt-12 text-center text-muted-foreground">Pick a niche or hit “Find products” to start.</p>
      )}
      <p className="mt-12 text-center text-xs text-muted-foreground">
        Numbers are AI estimates — always check eBay sold listings before you list.
      </p>
    </main>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
