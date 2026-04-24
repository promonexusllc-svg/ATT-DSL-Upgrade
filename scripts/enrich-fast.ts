/**
 * Fast ISP Enrichment Script
 * Tested: API allows ~2 req/sec without rate limiting
 * ~4,700 unique locations / 2 per sec = ~40 minutes total
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
const DELAY_MS = 600; // ~1.7 req/sec, conservative buffer
const BATCH_QUERY_SIZE = 500; // How many locations to fetch from Convex at once
const CONVEX_MUTATION_BATCH = 25; // How many mutations to fire concurrently

interface Provider {
  name: string;
  technology: string;
  technology_code: number;
  max_download_mbps: number;
  max_upload_mbps: number;
  provider_id: string | number;
}

async function queryApi(lat: number, lng: number, retries = 2): Promise<{ providers: Provider[]; h3Hex?: string }> {
  const url = `${API_BASE}?lat=${lat}&lng=${lng}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "ATT-DSL-Upgrade-Tool/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (resp.status === 429) {
        console.log("  ⚠️ Rate limited, backing off 30s...");
        await sleep(30_000);
        continue;
      }

      if (!resp.ok) {
        if (attempt < retries) { await sleep(2000); continue; }
        return { providers: [] };
      }

      const data = await resp.json();
      const providers = (data.providers || []).map((p: any) => ({
        name: p.name || "Unknown",
        technology: p.technology || "Unknown",
        technology_code: p.technology_code || 0,
        max_download_mbps: p.max_download_mbps || p.max_download_speed || 0,
        max_upload_mbps: p.max_upload_mbps || p.max_upload_speed || 0,
        provider_id: p.provider_id || "",
      }));

      return { providers, h3Hex: data.h3_hex };
    } catch (err) {
      if (attempt < retries) { await sleep(2000); continue; }
      return { providers: [] };
    }
  }
  return { providers: [] };
}

function classifyAtt(providers: Provider[]): { attFiber: boolean; attAir: boolean } {
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

  if (attFiber) attAir = false; // Fiber takes priority per AT&T rules
  return { attFiber, attAir };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("🚀 Fast ISP Enrichment\n");

  let totalProcessed = 0;
  let totalFiber = 0;
  let totalAir = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  // Process in waves
  while (true) {
    const { locations, totalUnenriched, uniqueLocations } = await client.query(
      internal.enrichment.getUnenrichedLocations,
      { limit: BATCH_QUERY_SIZE }
    );

    if (locations.length === 0) {
      console.log("\n✅ All locations enriched!");
      break;
    }

    console.log(`\n📍 Wave: ${locations.length} locations (${uniqueLocations} unique remaining, ${totalUnenriched} total leads)`);

    // Process each location with rate-limited delay
    const pendingMutations: Promise<any>[] = [];

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const timestamp = new Date().toISOString();

      const { providers, h3Hex } = await queryApi(loc.lat, loc.lng);
      const { attFiber, attAir } = classifyAtt(providers);

      if (attFiber) totalFiber++;
      if (attAir) totalAir++;
      if (providers.length === 0) totalErrors++;

      // Queue the Convex mutation (batch them)
      const mutationPromise = client.mutation(internal.enrichment.storeIspResults, {
        leadIds: loc.leadIds as any,
        ispData: JSON.stringify(providers),
        attFiberAvailable: attFiber,
        attAirAvailable: attAir,
        providerCount: providers.length,
        checkedAt: timestamp,
        h3Hex,
      });
      pendingMutations.push(mutationPromise);

      // Flush mutations in batches
      if (pendingMutations.length >= CONVEX_MUTATION_BATCH) {
        await Promise.all(pendingMutations);
        pendingMutations.length = 0;
      }

      totalProcessed++;

      // Progress every 50 locations
      if (totalProcessed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = totalProcessed / elapsed;
        const eta = uniqueLocations > 0 ? Math.round((uniqueLocations - totalProcessed) / rate / 60) : 0;
        console.log(`  [${totalProcessed}] ${providers.length} ISPs | Fiber: ${totalFiber} Air: ${totalAir} Errors: ${totalErrors} | ${rate.toFixed(1)}/s | ETA: ~${eta}min`);
      }

      await sleep(DELAY_MS);
    }

    // Flush remaining mutations
    if (pendingMutations.length > 0) {
      await Promise.all(pendingMutations);
    }

    console.log(`  Wave complete: ${locations.length} locations processed`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const progress = await client.query(internal.enrichment.getEnrichmentProgress, {});

  console.log(`\n${"━".repeat(50)}`);
  console.log(`📊 Enrichment Complete!`);
  console.log(`   Total processed: ${totalProcessed} unique locations`);
  console.log(`   AT&T Fiber: ${totalFiber} locations`);
  console.log(`   AT&T Air: ${totalAir} locations`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Time: ${(elapsed / 60).toFixed(1)} minutes`);
  console.log(`   Leads enriched: ${progress.enrichedLeads}/${progress.totalLeads} (${progress.percentComplete}%)`);
  console.log(`${"━".repeat(50)}`);
}

main().catch(console.error);
