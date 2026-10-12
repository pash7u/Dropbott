import { createServerFn } from "@tanstack/react-start";

export const getEbayStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { ebayConfigured } = await import("./ebay.server");
  return {
    configured: ebayConfigured(),
    connected: Boolean(process.env["EBAY_REFRESH_TOKEN"]),
    sandbox: process.env["EBAY_SANDBOX"] === "true",
    callbackUrl: "/api/public/ebay/callback",
  };
});

export const getEbayAuthUrl = createServerFn({ method: "GET" }).handler(async () => {
  const { ebayConfigured, buildAuthUrl } = await import("./ebay.server");
  if (!ebayConfigured()) throw new Error("eBay keys are not set up yet.");
  return { url: buildAuthUrl() };
});

export const postToEbay = createServerFn({ method: "POST" })
  .inputValidator((input: { title: string; description: string; price: number; sku: string }) => ({
    title: String(input.title ?? "").slice(0, 80),
    description: String(input.description ?? "").slice(0, 4000),
    price: Math.max(0.99, Number(input.price) || 0),
    sku: String(input.sku ?? "")
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, 50),
  }))
  .handler(async ({ data }) => {
    const { ebayConfigured, publishListing } = await import("./ebay.server");
    if (!ebayConfigured()) {
      return { ok: false as const, error: "eBay keys are not set up yet. Add them in Settings." };
    }
    if (!process.env["EBAY_REFRESH_TOKEN"]) {
      return { ok: false as const, error: "Connect your eBay account first (Settings → eBay)." };
    }
    try {
      const { listingId } = await publishListing(data);
      return { ok: true as const, listingId, error: null as string | null };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Posting failed." };
    }
  });
