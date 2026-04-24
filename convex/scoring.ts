import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Conversion Score Algorithm (0-100)
 * 
 * Scoring factors and weights:
 * 
 * HIGH WEIGHT (up to 60 points total):
 *   - AT&T Fiber/Air available (0-25 pts) — Can't upgrade without it
 *   - Speed tier / pain level (0-15 pts) — Lower speed = more pain
 *   - POTS line detected (0-10 pts) — AT&T discontinuing copper
 *   - Google verified OPERATIONAL (0-10 pts) — Business still active
 * 
 * MEDIUM WEIGHT (up to 30 points total):
 *   - FCC complaint density (0-8 pts) — Frustrated area
 *   - Competitor ISP / not on AT&T (0-7 pts) — Win-back opportunity  
 *   - Median income (0-5 pts) — Can afford upgrade
 *   - Google reviews/rating (0-5 pts) — Established business
 *   - Business type bandwidth needs (0-5 pts)
 * 
 * LOW WEIGHT (up to 10 points total):
 *   - Callable + not bad phone (0-4 pts) — Can reach them
 *   - Internet subscription % in ZIP (0-3 pts) — Area values connectivity
 *   - Has email (0-3 pts) — Additional contact method
 */

function calculateConversionScore(lead: any): { score: number; classification: string } {
  let score = 0;

  // ===== HIGH WEIGHT (60 pts max) =====

  // 1. AT&T Fiber/Air availability (25 pts)
  if (lead.attFiberAvailable === true) {
    score += 25; // Fiber is the gold standard
  } else if (lead.attAirAvailable === true) {
    score += 18; // Air is good but not as compelling as Fiber
  } else if (lead.ispLastChecked) {
    score += 0; // Checked but no availability — can't upgrade
  } else {
    score += 8; // Not checked yet — unknown potential
  }

  // 2. Speed tier / pain level (15 pts)
  if (lead.speedTier === "1.5M-25M") {
    score += 15; // Extreme pain point — barely functional
  } else if (lead.speedTier === "45M-50M") {
    score += 10; // Moderate pain — noticeable limitations
  } else if (lead.speedTier === "75M-100M") {
    score += 5;  // Some pain — could still benefit
  } else {
    score += 3;  // Unknown speed
  }

  // 3. POTS line detected (10 pts)
  if (lead.hasPots) {
    score += 10; // AT&T is actively discontinuing POTS — urgency
  }

  // 4. Google verified OPERATIONAL (10 pts)
  if (lead.googleBusinessStatus === "OPERATIONAL") {
    score += 10; // Confirmed active business
  } else if (lead.googleBusinessStatus === "CLOSED_PERMANENTLY") {
    score -= 15; // Dead business — massive negative signal
  } else if (lead.googleBusinessStatus === "CLOSED_TEMPORARILY") {
    score += 2;  // Might reopen
  } else if (!lead.googleBusinessStatus) {
    score += 4;  // No data — neutral assumption
  }

  // ===== MEDIUM WEIGHT (30 pts max) =====

  // 5. FCC complaint density (8 pts)
  const fccTotal = lead.fccTotalComplaints || 0;
  if (fccTotal >= 50) {
    score += 8;  // Heavy complaint area — customers are frustrated
  } else if (fccTotal >= 20) {
    score += 6;
  } else if (fccTotal >= 5) {
    score += 3;
  } else if (fccTotal > 0) {
    score += 1;
  }

  // 6. Competitor ISP / not on AT&T (7 pts)
  if (lead.inferredIsp) {
    if (!lead.inferredIsp.includes("AT&T")) {
      score += 7; // Confirmed on competitor — AT&T can win them back with upgrade
    } else {
      score += 3; // Already on AT&T — loyal customer, easier sell
    }
  } else if (lead.likelyIsp) {
    if (lead.likelyIspConfidence === "high") {
      score += 5;
    } else if (lead.likelyIspConfidence === "medium") {
      score += 3;
    } else {
      score += 2;
    }
  }

  // 7. Median income (5 pts)
  const income = lead.zipMedianIncome || 0;
  if (income >= 100000) {
    score += 5;  // High income area — can afford premium plans
  } else if (income >= 75000) {
    score += 4;
  } else if (income >= 50000) {
    score += 3;
  } else if (income >= 30000) {
    score += 2;
  } else if (income > 0) {
    score += 1;
  }

  // 8. Google reviews/rating (5 pts) — established business signal
  if (lead.googleRating && lead.googleReviewCount) {
    const ratingScore = Math.min(2, (lead.googleRating / 5) * 2); // 0-2 pts for rating
    const reviewScore = Math.min(3, Math.log10(Math.max(1, lead.googleReviewCount)) * 1.5); // 0-3 pts for volume
    score += Math.round(ratingScore + reviewScore);
  }

  // 9. Business type bandwidth needs (5 pts)
  const highBandwidthTypes = ["Medical/Health", "Restaurant/Food", "Retail/Store", "Hotel/Lodging"];
  const medBandwidthTypes = ["Auto/Mechanic", "Beauty/Salon", "Fitness/Sports", "Education/School"];
  if (highBandwidthTypes.includes(lead.bizType)) {
    score += 5; // POS systems, patient records, customer WiFi — need bandwidth
  } else if (medBandwidthTypes.includes(lead.bizType)) {
    score += 3; // Some bandwidth needs
  } else if (lead.bizType && lead.bizType !== "Other") {
    score += 2; // Classified business type
  } else {
    score += 1; // Unknown type
  }

  // ===== LOW WEIGHT (10 pts max) =====

  // 10. Callable + not bad phone (4 pts)
  if (lead.callable && !lead.badPhone) {
    score += 4;
  } else if (lead.callable) {
    score += 2;
  } else if (!lead.badPhone) {
    score += 1;
  }

  // 11. Internet subscription % in ZIP (3 pts)
  const internetPct = lead.zipInternetPct || 0;
  if (internetPct >= 90) {
    score += 3;
  } else if (internetPct >= 75) {
    score += 2;
  } else if (internetPct >= 50) {
    score += 1;
  }

  // 12. Has email for additional contact (3 pts)
  if (lead.email && lead.email.trim()) {
    score += 3;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Classify
  let classification: string;
  if (score >= 85) {
    classification = "Lock";
  } else if (score >= 70) {
    classification = "Fire";
  } else if (score >= 50) {
    classification = "Hot";
  } else if (score >= 30) {
    classification = "Warm";
  } else {
    classification = "Cold";
  }

  return { score, classification };
}

// Score all leads in batch (called from script)
export const scoreLeadsBatch = mutation({
  args: {
    batchSize: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    scored: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 500;
    const allLeads = await ctx.db.query("leads").collect();
    
    const start = args.offset || 0;
    const batch = allLeads.slice(start, start + batchSize);
    
    for (const lead of batch) {
      const { score, classification } = calculateConversionScore(lead);
      await ctx.db.patch(lead._id, {
        conversionScore: score,
        heatClassification: classification,
      });
    }

    return {
      scored: batch.length,
      remaining: Math.max(0, allLeads.length - start - batchSize),
    };
  },
});

// Score a single lead (for real-time updates)
export const scoreSingleLead = mutation({
  args: { leadId: v.id("leads") },
  returns: v.object({
    score: v.number(),
    classification: v.string(),
  }),
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");
    
    const { score, classification } = calculateConversionScore(lead);
    await ctx.db.patch(leadId, {
      conversionScore: score,
      heatClassification: classification,
    });
    
    return { score, classification };
  },
});

// Get score distribution (for analytics)
export const scoreDistribution = query({
  args: {},
  returns: v.object({
    lock: v.number(),
    fire: v.number(),
    hot: v.number(),
    warm: v.number(),
    cold: v.number(),
    unscored: v.number(),
    avgScore: v.number(),
  }),
  handler: async (ctx) => {
    const allLeads = await ctx.db.query("leads").collect();
    
    let lock = 0, fire = 0, hot = 0, warm = 0, cold = 0, unscored = 0;
    let totalScore = 0, scoredCount = 0;
    
    for (const l of allLeads) {
      if (l.heatClassification === "Lock") lock++;
      else if (l.heatClassification === "Fire") fire++;
      else if (l.heatClassification === "Hot") hot++;
      else if (l.heatClassification === "Warm") warm++;
      else if (l.heatClassification === "Cold") cold++;
      else unscored++;
      
      if (l.conversionScore !== undefined) {
        totalScore += l.conversionScore;
        scoredCount++;
      }
    }
    
    return {
      lock, fire, hot, warm, cold, unscored,
      avgScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
    };
  },
});
