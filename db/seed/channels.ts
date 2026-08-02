import { db } from "../client";
import { channels } from "../schema";

/**
 * Fee figures reflect what's been confirmed in prior conversations.
 * Where a figure is an approximation rather than a confirmed rate,
 * it's noted below — check these before trusting net revenue numbers.
 */
const CHANNEL_SEED = [
  {
    key: "wix",
    name: "Wix",
    syncMode: "api",
    feePct: "0",
    feeFixed: "0",
    // PayPal's processor cut on Wix isn't confirmed yet — left at 0
    // rather than guessed. Net will read equal to gross until this
    // is filled in.
    processorPct: "0",
    processorFixed: "0",
    merchantOfRecord: false,
    currency: "USD",
  },
  {
    key: "gumroad",
    name: "Gumroad",
    syncMode: "api",
    // Gumroad's ~10% + $0.50 platform fee, stored combined with
    // processing since Gumroad doesn't separate them in the API response.
    // Effective rate confirmed at ~12.9%; Discover sales run 30% instead
    // but aren't distinguished by the sync yet.
    feePct: "0.129",
    feeFixed: "0",
    processorPct: "0",
    processorFixed: "0",
    merchantOfRecord: true,
    currency: "USD",
  },
  {
    key: "creative_market",
    name: "Creative Market",
    syncMode: "manual",
    feePct: "0.50",
    feeFixed: "0",
    processorPct: "0",
    processorFixed: "0",
    merchantOfRecord: false,
    currency: "USD",
  },
  {
    key: "behance",
    name: "Behance",
    syncMode: "manual",
    feePct: "0.30",
    feeFixed: "0",
    processorPct: "0.0349",
    processorFixed: "0.49",
    merchantOfRecord: false,
    currency: "USD",
  },
] as const;

async function main() {
  for (const c of CHANNEL_SEED) {
    await db
      .insert(channels)
      .values(c)
      .onConflictDoUpdate({ target: channels.key, set: c });
    console.log(`Seeded channel: ${c.name}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
