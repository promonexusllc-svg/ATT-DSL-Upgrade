/**
 * ISP Inference Script
 * Phase 1: Email domain → Inferred ISP (direct evidence)
 * Phase 2: Speed tier + available ISPs → Likely ISP (probabilistic)
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "";
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || "";
const client = new ConvexHttpClient(CONVEX_URL);
client.setAdminAuth(DEPLOY_KEY);

// ISP email domain mapping
const ISP_DOMAINS: Record<string, string> = {
  // AT&T family
  "att.net": "AT&T", "sbcglobal.net": "AT&T", "bellsouth.net": "AT&T",
  "pacbell.net": "AT&T", "ameritech.net": "AT&T", "swbell.net": "AT&T",
  "nvbell.net": "AT&T", "prodigy.net": "AT&T", "currently.com": "AT&T",
  "flash.net": "AT&T", "att.com": "AT&T",
  // Comcast
  "comcast.net": "Comcast/Xfinity", "xfinity.com": "Comcast/Xfinity",
  // Cox
  "cox.net": "Cox",
  // Spectrum
  "charter.net": "Spectrum", "spectrum.net": "Spectrum",
  "twc.com": "Spectrum", "roadrunner.com": "Spectrum", "rr.com": "Spectrum",
  "brighthouse.com": "Spectrum",
  // Verizon
  "verizon.net": "Verizon",
  // Frontier
  "frontier.com": "Frontier", "frontiernet.net": "Frontier",
  // CenturyLink
  "centurylink.net": "CenturyLink", "centurytel.net": "CenturyLink", "embarqmail.com": "CenturyLink",
  // Windstream
  "windstream.net": "Windstream",
  // EarthLink
  "earthlink.net": "EarthLink", "mindspring.com": "EarthLink",
  // Other
  "optimum.net": "Optimum", "optonline.net": "Optimum",
  "suddenlink.net": "Suddenlink", "mediacombb.net": "Mediacom",
  "cableone.net": "Cable One", "consolidated.net": "Consolidated",
  "wowway.com": "WOW!", "rcn.com": "RCN",
};

// Speed tier ranges in Mbps for matching
const SPEED_RANGES: Record<string, { min: number; max: number }> = {
  "1.5M-25M": { min: 1.5, max: 25 },
  "45M-50M": { min: 45, max: 50 },
  "75M-100M": { min: 75, max: 100 },
};

interface Provider {
  name: string;
  technology: string;
  technology_code: number;
  max_download_mbps: number;
}

/**
 * Given a speed tier and available ISPs, figure out which ISP most likely
 * provides their current plan based on matching speeds.
 */
function inferLikelyIsp(
  speedTier: string | undefined,
  internetType: string | undefined,
  ispDataStr: string | undefined,
): { likelyIsp: string; confidence: string } | null {
  if (!speedTier || !ispDataStr || speedTier === "Unknown") return null;

  let providers: Provider[];
  try {
    providers = JSON.parse(ispDataStr);
  } catch {
    return null;
  }

  if (!providers.length) return null;

  const range = SPEED_RANGES[speedTier];
  if (!range) return null;

  // Since these are AT&T DSL/U-Verse customers, they are on AT&T currently.
  // The "likely ISP" should reflect what they COULD switch to (competitors).
  // But Eric wants to know CURRENT ISP — these are all AT&T customers already.
  // So let's determine the most competitive threat instead.

  // For current ISP: Since they're in AT&T's retention list, they're almost
  // certainly currently on AT&T DSL/U-Verse. The interesting data is:
  // "Who is the strongest competitor at this address?"

  // Find AT&T entries
  const attProviders = providers.filter(p => {
    const name = p.name.toLowerCase();
    return name.includes("at&t") || name === "att";
  });

  // Find non-AT&T competitors
  const competitors = providers.filter(p => {
    const name = p.name.toLowerCase();
    return !name.includes("at&t") && name !== "att" &&
      !name.includes("starlink") && // exclude satellite
      p.technology_code !== 60 && p.technology_code !== 61; // exclude satellite
  });

  if (competitors.length === 0) {
    return { likelyIsp: "AT&T Only (no wired competitors)", confidence: "high" };
  }

  // Rank competitors by max download speed
  const sorted = competitors.sort((a, b) => b.max_download_mbps - a.max_download_mbps);
  const topCompetitor = sorted[0];

  // Determine confidence based on how many competitors and speed match
  let confidence = "medium";
  if (competitors.length === 1) {
    confidence = "high"; // only one alternative
  } else if (topCompetitor.max_download_mbps > 500) {
    confidence = "high"; // strong fiber competitor
  }

  return {
    likelyIsp: `Top: ${topCompetitor.name} (${topCompetitor.technology}, ${topCompetitor.max_download_mbps}Mbps)`,
    confidence,
  };
}

async function main() {
  console.log("🔍 ISP Inference Script\n");

  const BATCH_SIZE = 500;
  let offset = 0;
  let totalEmail = 0;
  let totalLikely = 0;
  let totalProcessed = 0;

  while (true) {
    const leads = await client.query(internal.enrichment.getLeadsForInference, {
      limit: BATCH_SIZE,
      offset,
    });

    if (leads.length === 0) break;

    const updates: {
      leadId: any;
      inferredIsp?: string;
      inferredIspSource?: string;
      likelyIsp?: string;
      likelyIspConfidence?: string;
    }[] = [];

    for (const lead of leads) {
      const update: typeof updates[0] = { leadId: lead._id };
      let hasUpdate = false;

      // Phase 1: Email domain → Inferred ISP
      if (lead.email && lead.email.includes("@")) {
        const domain = lead.email.split("@")[1].toLowerCase();
        const isp = ISP_DOMAINS[domain];
        if (isp) {
          update.inferredIsp = isp;
          update.inferredIspSource = `email:${domain}`;
          totalEmail++;
          hasUpdate = true;
        }
      }

      // Phase 2: Speed + availability → Likely ISP (top competitor)
      if (lead.ispData) {
        const result = inferLikelyIsp(lead.speedTier, lead.internetType, lead.ispData);
        if (result) {
          update.likelyIsp = result.likelyIsp;
          update.likelyIspConfidence = result.confidence;
          totalLikely++;
          hasUpdate = true;
        }
      }

      if (hasUpdate) {
        updates.push(update);
      }
    }

    // Batch write to Convex
    if (updates.length > 0) {
      // Split into chunks of 100 for mutation size limits
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        await client.mutation(internal.enrichment.setIspInference, { updates: chunk as any });
      }
    }

    totalProcessed += leads.length;
    console.log(`  Processed ${totalProcessed} leads (${updates.length} updated in this batch)`);

    offset += BATCH_SIZE;
  }

  console.log(`\n${"━".repeat(50)}`);
  console.log(`📊 ISP Inference Complete`);
  console.log(`   Total leads processed: ${totalProcessed}`);
  console.log(`   Email domain → ISP: ${totalEmail}`);
  console.log(`   Speed/availability → Top Competitor: ${totalLikely}`);
  console.log(`${"━".repeat(50)}`);
}

main().catch(console.error);
