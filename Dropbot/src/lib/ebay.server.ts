// eBay OAuth + Inventory API helpers. Server-only.
// Activates once EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME secrets are set.
// Set EBAY_SANDBOX=true to post to the eBay sandbox instead of production.

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
].join(" ");

function base() {
  return process.env["EBAY_SANDBOX"] === "true"
    ? { api: "https://api.sandbox.ebay.com", auth: "https://auth.sandbox.ebay.com" }
    : { api: "https://api.ebay.com", auth: "https://auth.ebay.com" };
}

export function ebayConfigured(): boolean {
  return Boolean(
    process.env["EBAY_CLIENT_ID"] && process.env["EBAY_CLIENT_SECRET"] && process.env["EBAY_RUNAME"],
  );
}

function creds() {
  const id = process.env["EBAY_CLIENT_ID"]!;
  const secret = process.env["EBAY_CLIENT_SECRET"]!;
  const runame = process.env["EBAY_RUNAME"]!;
  return { id, secret, runame, basic: Buffer.from(`${id}:${secret}`).toString("base64") };
}

export function buildAuthUrl(): string {
  const { id, runame } = creds();
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: runame,
    response_type: "code",
    scope: SCOPES,
  });
  return `${base().auth}/oauth2/authorize?${q}`;
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string }> {
  const { basic, runame } = creds();
  const res = await fetch(`${base().api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: runame,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`eBay sign-in failed [${res.status}]: ${body}`);
  const json = JSON.parse(body) as { refresh_token?: string };
  if (!json.refresh_token) throw new Error("eBay did not return a refresh token.");
  return { refreshToken: json.refresh_token };
}

async function accessToken(): Promise<string> {
  const refresh = process.env["EBAY_REFRESH_TOKEN"];
  if (!refresh) throw new Error("eBay account not connected yet.");
  const { basic } = creds();
  const res = await fetch(`${base().api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      scope: SCOPES,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`eBay token refresh failed [${res.status}]: ${body}`);
  return (JSON.parse(body) as { access_token: string }).access_token;
}

async function ebayApi(path: string, method: string, token: string, payload?: unknown) {
  const res = await fetch(`${base().api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
      Accept: "application/json",
    },
    body: payload ? JSON.stringify(payload) : null,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`eBay API error [${res.status}] on ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Creates (or updates) an inventory item + offer and publishes it.
// Returns the live listing id. Requires the seller to have payment/return/fulfillment
// business policies — we fetch the first of each and use it.
export async function publishListing(input: {
  title: string;
  description: string;
  price: number;
  sku: string;
}): Promise<{ listingId: string; offerId: string }> {
  const token = await accessToken();

  const [payments, returns, fulfillments] = await Promise.all([
    ebayApi("/sell/account/v1/payment_policy?marketplace_id=EBAY_US", "GET", token),
    ebayApi("/sell/account/v1/return_policy?marketplace_id=EBAY_US", "GET", token),
    ebayApi("/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US", "GET", token),
  ]);
  const paymentId = payments.paymentPolicies?.[0]?.paymentPolicyId;
  const returnId = returns.returnPolicies?.[0]?.returnPolicyId;
  const fulfillmentId = fulfillments.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
  if (!paymentId || !returnId || !fulfillmentId) {
    throw new Error(
      "Your eBay seller account needs payment, return and shipping policies set up first (eBay Seller Hub → Business policies).",
    );
  }

  const locations = await ebayApi("/sell/inventory/v1/location", "GET", token);
  const locationKey = locations.locations?.[0]?.merchantLocationKey;
  if (!locationKey) {
    throw new Error(
      "Your eBay account needs an inventory location first (eBay Seller Hub → add a warehouse/location).",
    );
  }

  await ebayApi(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, "PUT", token, {
    product: { title: input.title.slice(0, 80), description: input.description },
    condition: "NEW",
    availability: { shipToLocationAvailability: { quantity: 5 } },
  });

  const offer = await ebayApi("/sell/inventory/v1/offer", "POST", token, {
    sku: input.sku,
    marketplaceId: "EBAY_US",
    format: "FIXED_PRICE",
    listingDescription: input.description,
    availableQuantity: 5,
    quantityLimitPerBuyer: 3,
    merchantLocationKey: locationKey,
    pricingSummary: { price: { currency: "USD", value: input.price.toFixed(2) } },
    listingPolicies: {
      paymentPolicyId: paymentId,
      returnPolicyId: returnId,
      fulfillmentPolicyId: fulfillmentId,
    },
  });
  const offerId = offer.offerId as string;

  const published = await ebayApi(`/sell/inventory/v1/offer/${offerId}/publish`, "POST", token);
  return { listingId: String(published.listingId ?? ""), offerId };
}
