/**
 * Slow & Steady ISP Enrichment Script
 * 1 request per 3 seconds with aggressive backoff on rate limits
 * Designed to complete without getting blocked
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "";
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || "";

if (!CONVEX_URL || !DEPLOY_KEY) {
  console.error("Set CONVEX_URL and CONVEX_DEPLOY_KEY");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
client.setAdminAuth(DEPLOY_KEY);

const API_BASE = "https://broadbandmap.com/api/v1/location/internet";
let currentDelay = 3000; // Start at 3s between requests

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryApi(lat: number, lng: number): Promise<{ providers: any[]; h3Hex?: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const resp = await fetch(`${API_BASE}?lat=${lat}&lng=${lng}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "application/json" },
        signal: AbortSignal.timeout(20000),
      });

      if (resp.status === 429) {
        // Exponential backoff: 60s, 120s, 240s...
        const backoff = 60_000 * Math.pow(2, attempt);
        console.log(`  ⚠️ Rate limited, backing off ${backoff/1000}s...`);
        currentDelay = Math.min(currentDelay * 1.5, 10000); // Slow down future requests too
        await sleep(backoff);
        continue;
      }

      if (!resp.ok) {
        if (attempt < 4) { await sleep(5000); continue; }
        return { providers: [] };
      }

      // Success — gradually speed back up
      currentDelay = Math.max(currentDelay * 0.95, 2000);

      const data = await resp.json();
      return {
        providers: (data.providers || []).map((p: any) => ({
          name: p.name || "Unknown",
          technology: p.technology || "Unknown",
          technology_code: p.technology_code || 0,
          max_download_mbps: p.max_download_mbps || p.max_download_speed || 0,
          max_upload_mbps: p.max_upload_mbps || p.max_upload_speed || 0,
          provider_id: p.provider_id || "",
        })),
        h3Hex: data.h3_hex,
      };
    } catch (err) {
      if (attempt < 4) { await sleep(5000); continue; }
      return { providers: [] };
    }
  }
  return { providers: [] };
}

function classifyAtt(providers: any[]): { attFiber: boolean; attAir: boolean } {
  let attFiber = false;
  let attAir = false;
  for (const p of providers) {
    const name = p.name.toLowerCase();
    const isAtt = name.includes("at&t") || name.includes("att ") || name === "att" ||
      name.includes("bellsouth") || name.includes("southwestern bell") || name.includes("pacific bell");
    if (isAtt) {
      if (p.technology_code === 50 || p.technology.toLowerCase().includes("fiber")) attFiber = true;
      if ([70, 71, 79].includes(p.technology_code) || p.technology.toLowerCase().includes("fixed wireless")) attAir = true;
    }
  }
  if (attFiber) attAir = false;
  return { attFiber, attAir };
}

async function main() {
  console.log("🐢 Slow & Steady ISP Enrichment\n");

  let totalProcessed = 0;
  let totalFiber = 0;
  let totalAir = 0;
  let consecutiveRateLimits = 0;
  const startTime = Date.now();

  while (true) {
    const { locations, uniqueLocations } = await client.query(
      internal.enrichment.getUnenrichedLocations,
      { limit: 100 }
    );

    if (locations.length === 0) {
      console.log("\n✅ All locations enriched!");
      break;
    }

    console.log(`\n📍 Batch: ${locations.length} locations (${uniqueLocations} unique remaining)`);

    for (const loc of locations) {
      const { providers, h3Hex } = await queryApi(loc.lat, loc.lng);
      
      if (providers.length === 0) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits > 10) {
          console.log("  ❌ Too many consecutive failures, pausing 5 min...");
          await sleep(300_000);
          consecutiveRateLimits = 0;
        }
      } else {
        consecutiveRateLimits = 0;
      }

      const { attFiber, attAir } = classifyAtt(providers);
      if (attFiber) totalFiber++;
      if (attAir) totalAir++;

      await client.mutation(internal.enrichment.storeIspResults, {
        leadIds: loc.leadIds as any,
        ispData: JSON.stringify(providers),
        attFiberAvailable: attFiber,
        attAirAvailable: attAir,
        providerCount: providers.length,
        checkedAt: new Date().toISOString(),
        h3Hex,
      });

      totalProcessed++;

      if (totalProcessed % 25 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = totalProcessed / elapsed;
        const remaining = uniqueLocations - totalProcessed;
        const eta = remaining > 0 ? Math.round(remaining / rate / 60) : 0;
        console.log(`  [${totalProcessed}] delay=${Math.round(currentDelay)}ms | Fiber:${totalFiber} Air:${totalAir} | ${rate.toFixed(2)}/s | ETA:~${eta}min`);
      }

      await sleep(currentDelay);
    }
  }

  console.log(`\n${"━".repeat(50)}`);
  console.log(`📊 Done! ${totalProcessed} locations | Fiber:${totalFiber} Air:${totalAir}`);
}

main().catch(console.error);
