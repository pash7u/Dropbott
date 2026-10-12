import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export type Product = {
  name: string;
  category: string;
  why: string;
  supplierCost: number;
  ebayPrice: number;
  ebayFees: number;
  profit: number;
  demand: "High" | "Medium" | "Low";
  competition: "High" | "Medium" | "Low";
  ebayTitle: string;
  searchTerm: string;
};

const INSTRUCTIONS = `You are an expert eBay dropshipping product researcher.
Suggest products that sell well on eBay right now and can be sourced from suppliers like AliExpress, CJ Dropshipping or Amazon.
Avoid branded/counterfeit items, VeRO-risk brands, hazardous goods and oversized items.
Estimate eBay fees as about 13.5% of sale price plus $0.40. profit = ebayPrice - supplierCost - ebayFees.
Reply with ONLY a JSON array (no markdown fences) of exactly 8 objects with keys:
name, category, why (1 short sentence), supplierCost (USD number), ebayPrice (USD number), ebayFees (number), profit (number),
demand ("High"|"Medium"|"Low"), competition ("High"|"Medium"|"Low"), ebayTitle (SEO eBay listing title, max 80 chars), searchTerm (short supplier search phrase).`;

export async function findProducts(niche: string, budget: string): Promise<Product[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `Niche: ${niche || "any / all niches"}. Max supplier cost per item: ${budget || "any"}. Give me 8 winning products.`,
      },
    ],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text: string;
  try {
    text = await result.text;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("402")) throw new Error("Out of AI credits. Add credits in your workspace billing.");
    if (msg.includes("429")) throw new Error("Too many searches right now. Wait a moment and try again.");
    throw new Error("The product search failed. Please try again.");
  }
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Couldn't read the results. Try again.");
  const raw = JSON.parse(match[0]) as Product[];
  return raw.slice(0, 8).map((p) => {
    const fees = Math.round((p.ebayPrice * 0.135 + 0.4) * 100) / 100;
    return { ...p, ebayFees: fees, profit: Math.round((p.ebayPrice - p.supplierCost - fees) * 100) / 100 };
  });
}
