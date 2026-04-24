/**
 * ISP Enrichment Script
 * Queries broadbandmap.com API (wraps FCC BDC data) for each unique location
 * to determine ISP availability, AT&T Fiber vs Air eligibility.
 * 
 * Rate limit: ~60 requests/hour per IP
 * Strategy: batch by unique lat/lng, respect rate limits, store results
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "";
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || "";

if (!CONVEX_URL || !DEPLOY_KEY) {
  console.error("Missing VITE_CONVEX_URL or CONVEX_DEPLOY_KEY");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
client.setAdminAuth(DEPLOY_KEY);

const API_BASE = "https://broadbandmap.com/api/v1/location/internet";
const BATCH_SIZE = 55; // Stay under 60/hr limit
const DELAY_BETWEEN_REQUESTS_MS = 62_000; // ~62 seconds between requests to be safe

interface BroadbandProvider {
  name: string;
  technology: string;
  technology_code: number;
  max_download_mbps: number;
  max_upload_mbps: number;
  provider_id?: string;
}

async function queryBroadbandMap(lat: number, lng: number): Promise<BroadbandProvider[]> {
  const url = `${API_BASE}?lat=${lat}&lng=${lng}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ATT-DSL-Upgrade-Tool/1.0",
      "Accept": "application/json",
    },
  });

  if (response.status === 429) {
    console.log("  ⚠️ Rate limited, waiting 2 minutes...");
    await sleep(120_000);
    return queryBroadbandMap(lat, lng); // Retry
  }

  if (!response.ok) {
    console.error(`  ❌ API error ${response.status}: ${response.statusText}`);
    return [];
  }

  const data = await response.json();
  
  if (!data || !Array.isArray(data.providers)) {
    return [];
  }

  return data.providers.map((p: any) => ({
    name: p.name || p.provider_name || "Unknown",
    technology: p.technology || p.technology_name || "Unknown",
    technology_code: p.technology_code || 0,
    max_download_mbps: p.max_download_speed || p.max_download_mbps || 0,
    max_upload_mbps: p.max_upload_speed || p.max_upload_mbps || 0,
    provider_id: p.provider_id || p.frn || "",
  }));
}

function classifyAttAvailability(providers: BroadbandProvider[]): {
  attFiber: boolean;
  attAir: boolean;
} {
  let attFiber = false;
  let attAir = false;

  for (const p of providers) {
    const name = p.name.toLowerCase();
    const isAtt = name.includes("at&t") || name.includes("att") || name.includes("bellsouth") || name.includes("southwestern bell") || name.includes("pacific bell");
    
    if (isAtt) {
      // Technology code 50 = Fiber (FTTH/FTTP)
      if (p.technology_code === 50 || p.technology.toLowerCase().includes("fiber")) {
        attFiber = true;
      }
      // Technology code 70/71 = Fixed Wireless (AT&T Internet Air)
      if (p.technology_code === 70 || p.technology_code === 71 || p.technology_code === 79 || 
          p.technology.toLowerCase().includes("fixed wireless")) {
        attAir = true;
      }
    }
  }

  // Per AT&T rules: Fiber takes priority. If Fiber is available, Air is not offered.
  if (attFiber) {
    attAir = false;
  }

  return { attFiber, attAir };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 ISP Enrichment Starting...\n");

  // Get current progress
  const progress = await client.query(internal.enrichment.getEnrichmentProgress, {});
  console.log(`📊 Current progress: ${progress.enrichedLeads}/${progress.totalLeads} leads enriched (${progress.percentComplete}%)`);
  console.log(`   Cached hexes: ${progress.cachedHexes}\n`);

  // Get unenriched locations
  const { locations, totalUnenriched, uniqueLocations } = await client.query(
    internal.enrichment.getUnenrichedLocations,
    { limit: BATCH_SIZE }
  );

  console.log(`📍 ${uniqueLocations} unique locations remaining (${totalUnenriched} leads)`);
  console.log(`   Processing batch of ${locations.length} locations...\n`);

  if (locations.length === 0) {
    console.log("✅ All locations enriched!");
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const loc of locations) {
    processed++;
    const timestamp = new Date().toISOString();
    
    console.log(`[${processed}/${locations.length}] Querying (${loc.lat}, ${loc.lng}) — ${loc.leadIds.length} lead(s)...`);

    try {
      const providers = await queryBroadbandMap(loc.lat, loc.lng);
      const { attFiber, attAir } = classifyAttAvailability(providers);

      const ispDataStr = JSON.stringify(providers);

      // Store results in Convex
      await client.mutation(internal.enrichment.storeIspResults, {
        leadIds: loc.leadIds as any,
        ispData: ispDataStr,
        attFiberAvailable: attFiber,
        attAirAvailable: attAir,
        providerCount: providers.length,
        checkedAt: timestamp,
      });

      const attLabel = attFiber ? "🔵 Fiber" : attAir ? "📡 Air" : "⬜ No AT&T upgrade";
      console.log(`  ✅ ${providers.length} ISPs found | ${attLabel} | Updated ${loc.leadIds.length} leads`);

    } catch (err) {
      errors++;
      console.error(`  ❌ Error: ${err}`);
      
      // Store as checked but with empty data so we don't retry immediately
      try {
        await client.mutation(internal.enrichment.storeIspResults, {
          leadIds: loc.leadIds as any,
          ispData: "[]",
          attFiberAvailable: false,
          attAirAvailable: false,
          providerCount: 0,
          checkedAt: timestamp,
        });
      } catch {}
    }

    // Rate limit delay (skip on last request)
    if (processed < locations.length) {
      const waitSec = Math.round(DELAY_BETWEEN_REQUESTS_MS / 1000);
      process.stdout.write(`  ⏳ Waiting ${waitSec}s for rate limit...`);
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      process.stdout.write(" done\n");
    }
  }

  // Final progress
  const finalProgress = await client.query(internal.enrichment.getEnrichmentProgress, {});
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Batch Complete!`);
  console.log(`   Processed: ${processed} locations (${errors} errors)`);
  console.log(`   Total enriched: ${finalProgress.enrichedLeads}/${finalProgress.totalLeads} (${finalProgress.percentComplete}%)`);
  console.log(`   Remaining: ${finalProgress.remainingLeads} leads`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch(console.error);
