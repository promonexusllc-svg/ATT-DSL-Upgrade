#!/usr/bin/env bun
/**
 * Business Intelligence Enrichment Script
 * 1. Classify business types from business names
 * 2. Fetch Census ACS demographics per zip code
 * 3. Fetch Census CBP business patterns per zip code
 * 4. Fetch FCC consumer complaints per zip code
 * 5. Fetch Reddit ISP sentiment per city
 * 6. Google Places verification (business status, rating, phone)
 */

import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "https://compassionate-wolverine-985.convex.cloud";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyBXMZDYg001yE4JyFZspC27y19-1Sxash0";
const client = new ConvexHttpClient(CONVEX_URL);

// ─── Business Type Classification ─────────────────────────────────

const BIZ_KEYWORDS: Record<string, string[]> = {
  "Auto/Mechanic": ["auto", "motor", "car wash", "car ", "tire", "mechanic", "body shop", "collision", "smog", "transmission", "muffler", "brake", "tow", "lube"],
  "Beauty/Salon": ["hair", "salon", "beauty", "barber", "nail", "spa ", "cosmetic", "lash", "brow", "wax"],
  "Restaurant/Food": ["restaurant", "pizza", "taco", "burger", "cafe", "grill", "bakery", "food", "kitchen", "deli", "sushi", "bbq", "wing", "donut", "coffee", "juice", "ice cream", "catering"],
  "Retail/Store": ["store", "shop", "market", "liquor", "grocer", "supply", "mart", "outlet", "boutique", "gift", "jewel", "furniture", "mattress"],
  "Medical/Health": ["medical", "dental", "clinic", "doctor", "health", "pharmacy", "chiropractic", "optom", "vision", "therapy", "rehab", "urgent", "veterinar", "vet "],
  "Services": ["service", "repair", "clean", "plumb", "electric", "hvac", "landscap", "pest", "roof", "paint", "lock", "carpet", "moving"],
  "Insurance/Finance": ["insurance", "tax", "account", "financ", "loan", "mortgage", "credit", "invest", "bank"],
  "Legal": ["law", "attorney", "legal", "notary"],
  "Real Estate": ["real estate", "realty", "property", "escrow"],
  "Church/NonProfit": ["church", "ministry", "temple", "mosque", "foundation", "charit", "mission"],
  "Education": ["school", "academy", "tutor", "learn", "daycare", "preschool", "childcare"],
  "Fitness/Recreation": ["gym", "fitness", "yoga", "martial", "dance", "karate", "boxing", "sport"],
  "Tech/IT": ["tech", "computer", "it ", "software", "web", "digital", "data"],
  "Construction": ["construct", "build", "concrete", "paving", "excavat", "demolit", "frame"],
  "Transportation": ["transport", "freight", "logistic", "trucking", "shipping", "courier"],
};

function classifyBusiness(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(BIZ_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return "Other";
}

// ─── Census ACS Data ──────────────────────────────────────────────

async function fetchCensusACS(zips: string[]) {
  const result = new Map<string, { medianIncome: number | null; population: number | null; internetPct: number | null }>();
  for (let i = 0; i < zips.length; i += 50) {
    const batch = zips.slice(i, i + 50);
    try {
      const url = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B01003_001E,B28002_001E,B28002_002E&for=zip+code+tabulation+area:${batch.join(",")}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        for (let j = 1; j < data.length; j++) {
          const row = data[j];
          const zip = row[4];
          const income = row[0] && row[0] !== "-666666666" ? parseInt(row[0]) : null;
          const pop = row[1] ? parseInt(row[1]) : null;
          const totalHH = row[2] ? parseInt(row[2]) : 0;
          const withInternet = row[3] ? parseInt(row[3]) : 0;
          const internetPct = totalHH > 0 ? Math.round((withInternet / totalHH) * 1000) / 10 : null;
          result.set(zip, { medianIncome: income, population: pop, internetPct });
        }
      }
      if ((Math.floor(i / 50) + 1) % 5 === 0) console.log(`  Census ACS: ${result.size} zips loaded...`);
    } catch (err) {
      console.error(`  Census ACS error:`, err);
    }
    await Bun.sleep(400);
  }
  return result;
}

// ─── Census CBP ───────────────────────────────────────────────────

async function fetchCensusCBP(zips: string[]) {
  const result = new Map<string, { bizCount: number | null; employees: number | null }>();
  for (let i = 0; i < zips.length; i += 50) {
    const batch = zips.slice(i, i + 50);
    try {
      const url = `https://api.census.gov/data/2021/cbp?get=ESTAB,EMP&for=zip+code:${batch.join(",")}&NAICS2017=00`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        for (let j = 1; j < data.length; j++) {
          const row = data[j];
          const zip = row[3];
          result.set(zip, { bizCount: row[0] ? parseInt(row[0]) : null, employees: row[1] ? parseInt(row[1]) : null });
        }
      }
      if ((Math.floor(i / 50) + 1) % 5 === 0) console.log(`  Census CBP: ${result.size} zips loaded...`);
    } catch (err) {
      console.error(`  Census CBP error:`, err);
    }
    await Bun.sleep(400);
  }
  return result;
}

// ─── FCC Consumer Complaints ──────────────────────────────────────

async function fetchFCCComplaints() {
  const result = new Map<string, { speed: number; avail: number; total: number }>();

  console.log("  Fetching FCC speed complaints...");
  try {
    const speedResp = await fetch(
      `https://opendata.fcc.gov/resource/3xyp-aqkj.json?$select=zip,count(*)+as+cnt&$where=issue='Speed'&$group=zip&$limit=50000`
    );
    if (speedResp.ok) {
      const data = await speedResp.json();
      for (const row of data) {
        if (row.zip) {
          result.set(row.zip, { speed: parseInt(row.cnt) || 0, avail: 0, total: 0 });
        }
      }
      console.log(`    Speed: ${data.length} zips`);
    }
  } catch (err) { console.error("  FCC speed error:", err); }

  await Bun.sleep(1000);

  console.log("  Fetching FCC availability complaints...");
  try {
    const availResp = await fetch(
      `https://opendata.fcc.gov/resource/3xyp-aqkj.json?$select=zip,count(*)+as+cnt&$where=issue+in('Availability','Availability+(including+rural+call+completion)')&$group=zip&$limit=50000`
    );
    if (availResp.ok) {
      const data = await availResp.json();
      for (const row of data) {
        if (row.zip) {
          if (!result.has(row.zip)) result.set(row.zip, { speed: 0, avail: 0, total: 0 });
          result.get(row.zip)!.avail = parseInt(row.cnt) || 0;
        }
      }
      console.log(`    Availability: ${data.length} zips`);
    }
  } catch (err) { console.error("  FCC avail error:", err); }

  for (const [_, d] of result) d.total = d.speed + d.avail;
  console.log(`  FCC total: ${result.size} zips with complaint data`);
  return result;
}

// ─── Google Places ────────────────────────────────────────────────

interface GooglePlaceResult {
  placeId: string;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string;
  types: string[];
  businessPhone: string | null;
}

async function fetchGooglePlace(bizName: string, city: string, state: string): Promise<GooglePlaceResult | null> {
  try {
    // Step 1: Find the place
    const findResp = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
      `input=${encodeURIComponent(`${bizName} ${city} ${state}`)}&inputtype=textquery` +
      `&fields=place_id,name,rating,user_ratings_total,business_status,types` +
      `&key=${GOOGLE_API_KEY}`
    );
    if (!findResp.ok) return null;
    const findData = await findResp.json();
    if (findData.status !== "OK" || !findData.candidates?.length) return null;

    const candidate = findData.candidates[0];
    const placeId = candidate.place_id;

    // Step 2: Get phone number from Place Details
    let businessPhone: string | null = null;
    try {
      const detailResp = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&fields=formatted_phone_number` +
        `&key=${GOOGLE_API_KEY}`
      );
      if (detailResp.ok) {
        const detailData = await detailResp.json();
        if (detailData.status === "OK") {
          businessPhone = detailData.result?.formatted_phone_number || null;
        }
      }
    } catch {}

    return {
      placeId,
      rating: candidate.rating || null,
      reviewCount: candidate.user_ratings_total || null,
      businessStatus: candidate.business_status || "UNKNOWN",
      types: candidate.types || [],
      businessPhone,
    };
  } catch {
    return null;
  }
}

// ─── Reddit ISP Sentiment ─────────────────────────────────────────

async function fetchRedditSentiment(cities: string[]) {
  const result = new Map<string, any[]>();
  const relevantSubs = new Set(["att", "tmobile", "comcast", "spectrum", "verizon", "internetparents", "homenetworking", "nocontract", "rural_internet", "losangeles", "sandiego", "houston", "chicago", "dallas", "sanantonio", "miami", "smallbusiness"]);

  for (let i = 0; i < cities.length; i++) {
    const cityName = cities[i].split(",")[0].trim();
    try {
      const resp = await fetch(
        `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(`AT&T internet ${cityName}`)}&size=5&sort=score&sort_type=desc`
      );
      if (resp.ok) {
        const data = await resp.json();
        const posts: any[] = [];
        for (const post of data.data || []) {
          const sub = (post.subreddit || "").toLowerCase();
          const title = (post.title || "").toLowerCase();
          if (post.score >= 1 && (relevantSubs.has(sub) || title.includes("internet") || title.includes("isp") || title.includes("att") || title.includes("broadband"))) {
            posts.push({
              title: (post.title || "").slice(0, 120),
              subreddit: post.subreddit || "",
              score: post.score || 0,
              comments: post.num_comments || 0,
              url: `https://reddit.com${post.permalink || ""}`,
            });
          }
        }
        if (posts.length > 0) result.set(cities[i], posts.sort((a: any, b: any) => b.score - a.score).slice(0, 5));
      }
    } catch {}
    if ((i + 1) % 10 === 0) console.log(`  Reddit: ${i + 1}/${cities.length} cities, ${result.size} with posts`);
    await Bun.sleep(300);
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("=== Business Intelligence Enrichment ===\n");

  // 1. Fetch all leads
  console.log("Fetching leads...");
  let allLeads: any[] = [];
  let offset = 0;
  while (true) {
    const batch = await client.query(api.enrichment.getLeadsForBizIntel, { limit: 1000, offset });
    if (batch.length === 0) break;
    allLeads.push(...batch);
    offset += batch.length;
  }
  console.log(`Total leads: ${allLeads.length}\n`);

  // 2. Classify business types
  console.log("Step 1: Classifying business types...");
  const bizTypes = new Map<string, string>();
  const typeCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const bt = classifyBusiness(lead.bizName);
    bizTypes.set(lead._id, bt);
    typeCounts[bt] = (typeCounts[bt] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${(count / allLeads.length * 100).toFixed(1)}%)`);
  }

  // 3. Census ACS
  const uniqueZips = [...new Set(allLeads.map((l: any) => l.zip).filter(Boolean))];
  console.log(`\nStep 2: Census ACS for ${uniqueZips.length} zips...`);
  const censusACS = await fetchCensusACS(uniqueZips);
  console.log(`  ✅ ${censusACS.size} zips`);

  // 4. Census CBP
  console.log(`\nStep 3: Census CBP for ${uniqueZips.length} zips...`);
  const censusCBP = await fetchCensusCBP(uniqueZips);
  console.log(`  ✅ ${censusCBP.size} zips`);

  // 5. FCC
  console.log(`\nStep 4: FCC consumer complaints...`);
  const fccData = await fetchFCCComplaints();

  // 6. Reddit
  const cityCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const key = `${lead.city}, ${lead.state}`;
    cityCounts[key] = (cityCounts[key] || 0) + 1;
  }
  const topCities = Object.entries(cityCounts)
    .filter(([_, c]) => c >= 10)
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city);
  console.log(`\nStep 5: Reddit sentiment for ${topCities.length} cities...`);
  const redditData = await fetchRedditSentiment(topCities);
  console.log(`  ✅ ${redditData.size} cities with posts`);

  // 7. Google Places (rate-limited, ~10 req/sec to stay safe with $200 credit)
  console.log(`\nStep 6: Google Places verification for ${allLeads.length} leads...`);
  const googleResults = new Map<string, GooglePlaceResult>();
  let googleHits = 0;
  let googleMisses = 0;
  let googleClosed = 0;

  for (let i = 0; i < allLeads.length; i++) {
    const lead = allLeads[i];
    // Skip if already enriched
    if (lead.googlePlaceId) {
      googleHits++;
      continue;
    }
    
    const result = await fetchGooglePlace(lead.bizName, lead.city, lead.state);
    if (result) {
      googleResults.set(lead._id, result);
      googleHits++;
      if (result.businessStatus !== "OPERATIONAL") googleClosed++;
    } else {
      googleMisses++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  Google Places: ${i + 1}/${allLeads.length} (${googleHits} found, ${googleMisses} not found, ${googleClosed} closed)`);
    }
    // ~5 requests/sec (find + details = 2 calls per lead, so ~2.5 leads/sec)
    await Bun.sleep(200);
  }
  console.log(`  ✅ Google: ${googleHits} found, ${googleMisses} not found, ${googleClosed} closed/temp closed`);

  // 8. Upload everything to database
  console.log("\nStep 7: Uploading to database...");
  const redditByCity = new Map<string, string>();
  for (const [city, posts] of redditData) redditByCity.set(city, JSON.stringify(posts));

  const BATCH_SIZE = 50;
  let totalUpdated = 0;

  for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
    const batch = allLeads.slice(i, i + BATCH_SIZE);
    const updates = batch.map((lead: any) => {
      const update: any = { leadId: lead._id };

      // Biz type
      const bt = bizTypes.get(lead._id);
      if (bt) update.bizType = bt;

      // Census ACS
      const acs = censusACS.get(lead.zip);
      if (acs) {
        if (acs.medianIncome) update.zipMedianIncome = acs.medianIncome;
        if (acs.population) update.zipPopulation = acs.population;
        if (acs.internetPct) update.zipInternetPct = acs.internetPct;
      }

      // Census CBP
      const cbp = censusCBP.get(lead.zip);
      if (cbp) {
        if (cbp.bizCount) update.zipBizCount = cbp.bizCount;
        if (cbp.employees) update.zipBizEmployees = cbp.employees;
      }

      // FCC
      const fcc = fccData.get(lead.zip);
      if (fcc) {
        update.fccSpeedComplaints = fcc.speed;
        update.fccAvailComplaints = fcc.avail;
        update.fccTotalComplaints = fcc.total;
      }

      // Google Places
      const gp = googleResults.get(lead._id);
      if (gp) {
        update.googlePlaceId = gp.placeId;
        if (gp.rating) update.googleRating = gp.rating;
        if (gp.reviewCount) update.googleReviewCount = gp.reviewCount;
        update.googleBusinessStatus = gp.businessStatus;
        update.googleTypes = JSON.stringify(gp.types);
        if (gp.businessPhone) update.businessPhone = gp.businessPhone;
      }

      // Reddit
      const cityKey = `${lead.city}, ${lead.state}`;
      const reddit = redditByCity.get(cityKey);
      if (reddit) update.redditSentiment = reddit;

      return update;
    }).filter((u: any) => Object.keys(u).length > 1);

    if (updates.length > 0) {
      await client.mutation(api.enrichment.setBizIntelligence, { updates });
      totalUpdated += updates.length;
    }

    if ((i / BATCH_SIZE) % 25 === 0 || i + BATCH_SIZE >= allLeads.length) {
      console.log(`  DB upload: ${Math.min(i + BATCH_SIZE, allLeads.length)}/${allLeads.length} (${totalUpdated} updated)`);
    }
  }

  console.log(`\n========== COMPLETE ==========`);
  console.log(`Updated ${totalUpdated} leads with business intelligence:`);
  console.log(`  ✅ Business types: ${bizTypes.size} classified`);
  console.log(`  ✅ Census ACS: ${censusACS.size} zips (income, population, internet %)`);
  console.log(`  ✅ Census CBP: ${censusCBP.size} zips (biz count, employees)`);
  console.log(`  ✅ FCC complaints: ${fccData.size} zips (speed + availability)`);
  console.log(`  ✅ Google Places: ${googleResults.size} businesses verified`);
  console.log(`  ✅ Reddit sentiment: ${redditData.size} cities`);
}

main().catch(console.error);
