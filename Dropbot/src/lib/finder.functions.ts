import { createServerFn } from "@tanstack/react-start";

export const searchProducts = createServerFn({ method: "POST" })
  .inputValidator((input: { niche: string; budget: string }) => ({
    niche: String(input.niche ?? "").slice(0, 100),
    budget: String(input.budget ?? "").slice(0, 20),
  }))
  .handler(async ({ data }) => {
    const { findProducts } = await import("./finder.server");
    try {
      return { products: await findProducts(data.niche, data.budget), error: null as string | null };
    } catch (e) {
      return { products: [], error: e instanceof Error ? e.message : "Something went wrong." };
    }
  });
