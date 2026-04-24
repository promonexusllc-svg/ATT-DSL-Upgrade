import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// Get leads that haven't been enriched yet, grouped by unique lat/lng
export const getUnenrichedLocations = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    // Get leads without ISP data
    const leads = await ctx.db
      .query("leads")
      .filter((q) => q.eq(q.field("ispLastChecked"), undefined))
      .take(5000);

    // Dedupe by lat/lng (round to 4 decimals for grouping)
    const seen = new Map<string, { lat: number; lng: number; leadIds: string[] }>();
    for (const lead of leads) {
      if (!lead.lat || !lead.lng) continue;
      const key = `${lead.lat.toFixed(4)},${lead.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.set(key, { lat: lead.lat, lng: lead.lng, leadIds: [] });
      }
      seen.get(key)!.leadIds.push(lead._id);
    }

    const locations = Array.from(seen.values()).slice(0, limit);
    return {
      locations,
      totalUnenriched: leads.length,
      uniqueLocations: seen.size,
    };
  },
});

// Store ISP results for a batch of leads at the same location
export const storeIspResults = internalMutation({
  args: {
    leadIds: v.array(v.id("leads")),
    ispData: v.string(),
    attFiberAvailable: v.boolean(),
    attAirAvailable: v.boolean(),
    providerCount: v.number(),
    checkedAt: v.string(),
    h3Hex: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    for (const leadId of args.leadIds) {
      await ctx.db.patch(leadId, {
        ispData: args.ispData,
        attFiberAvailable: args.attFiberAvailable,
        attAirAvailable: args.attAirAvailable,
        ispProviderCount: args.providerCount,
        ispLastChecked: args.checkedAt,
        h3Hex: args.h3Hex,
      });
    }

    // Also cache in ispHexCache if h3Hex provided
    if (args.h3Hex) {
      const existing = await ctx.db
        .query("ispHexCache")
        .withIndex("by_hex", (q) => q.eq("h3Hex", args.h3Hex!))
        .first();

      if (!existing) {
        await ctx.db.insert("ispHexCache", {
          h3Hex: args.h3Hex,
          providers: args.ispData,
          attFiberAvailable: args.attFiberAvailable,
          attAirAvailable: args.attAirAvailable,
          providerCount: args.providerCount,
          checkedAt: args.checkedAt,
        });
      }
    }

    return args.leadIds.length;
  },
});

// Batch update ISP inference data
export const setIspInference = internalMutation({
  args: {
    updates: v.array(
      v.object({
        leadId: v.id("leads"),
        inferredIsp: v.optional(v.string()),
        inferredIspSource: v.optional(v.string()),
        likelyIsp: v.optional(v.string()),
        likelyIspConfidence: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const update of args.updates) {
      const patch: Record<string, string | undefined> = {};
      if (update.inferredIsp !== undefined) patch.inferredIsp = update.inferredIsp;
      if (update.inferredIspSource !== undefined) patch.inferredIspSource = update.inferredIspSource;
      if (update.likelyIsp !== undefined) patch.likelyIsp = update.likelyIsp;
      if (update.likelyIspConfidence !== undefined) patch.likelyIspConfidence = update.likelyIspConfidence;
      await ctx.db.patch(update.leadId, patch);
      count++;
    }
    return count;
  },
});

// Get all leads for ISP inference (email + speed tier + ISP data)
export const getLeadsForInference = internalQuery({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const leads = await ctx.db.query("leads").collect();
    const start = args.offset || 0;
    const end = start + (args.limit || 500);
    return leads.slice(start, end).map((l) => ({
      _id: l._id,
      email: l.email,
      speedTier: l.speedTier,
      internetType: l.internetType,
      ispData: l.ispData,
      inferredIsp: l.inferredIsp,
    }));
  },
});

// Batch update business intelligence fields
export const setBizIntelligence = mutation({
  args: {
    updates: v.array(
      v.object({
        leadId: v.id("leads"),
        bizType: v.optional(v.string()),
        zipMedianIncome: v.optional(v.number()),
        zipPopulation: v.optional(v.number()),
        zipInternetPct: v.optional(v.number()),
        zipBizCount: v.optional(v.number()),
        zipBizEmployees: v.optional(v.number()),
        googlePlaceId: v.optional(v.string()),
        googleRating: v.optional(v.number()),
        googleReviewCount: v.optional(v.number()),
        googleBusinessStatus: v.optional(v.string()),
        googleTypes: v.optional(v.string()),
        businessPhone: v.optional(v.string()),
        fccSpeedComplaints: v.optional(v.number()),
        fccAvailComplaints: v.optional(v.number()),
        fccTotalComplaints: v.optional(v.number()),
        redditSentiment: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const update of args.updates) {
      const patch: Record<string, any> = {};
      if (update.bizType !== undefined) patch.bizType = update.bizType;
      if (update.zipMedianIncome !== undefined) patch.zipMedianIncome = update.zipMedianIncome;
      if (update.zipPopulation !== undefined) patch.zipPopulation = update.zipPopulation;
      if (update.zipInternetPct !== undefined) patch.zipInternetPct = update.zipInternetPct;
      if (update.zipBizCount !== undefined) patch.zipBizCount = update.zipBizCount;
      if (update.zipBizEmployees !== undefined) patch.zipBizEmployees = update.zipBizEmployees;
      if (update.googlePlaceId !== undefined) patch.googlePlaceId = update.googlePlaceId;
      if (update.googleRating !== undefined) patch.googleRating = update.googleRating;
      if (update.googleReviewCount !== undefined) patch.googleReviewCount = update.googleReviewCount;
      if (update.googleBusinessStatus !== undefined) patch.googleBusinessStatus = update.googleBusinessStatus;
      if (update.googleTypes !== undefined) patch.googleTypes = update.googleTypes;
      if (update.businessPhone !== undefined) patch.businessPhone = update.businessPhone;
      if (update.fccSpeedComplaints !== undefined) patch.fccSpeedComplaints = update.fccSpeedComplaints;
      if (update.fccAvailComplaints !== undefined) patch.fccAvailComplaints = update.fccAvailComplaints;
      if (update.fccTotalComplaints !== undefined) patch.fccTotalComplaints = update.fccTotalComplaints;
      if (update.redditSentiment !== undefined) patch.redditSentiment = update.redditSentiment;
      await ctx.db.patch(update.leadId, patch);
      count++;
    }
    return count;
  },
});

// Get all leads for biz intel enrichment
export const getLeadsForBizIntel = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const leads = await ctx.db.query("leads").collect();
    const start = args.offset || 0;
    const end = start + (args.limit || 1000);
    return leads.slice(start, end).map((l) => ({
      _id: l._id,
      bizName: l.bizName,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      lat: l.lat,
      lng: l.lng,
      phone: l.phone,
      bizType: l.bizType,
      zipMedianIncome: l.zipMedianIncome,
      googlePlaceId: l.googlePlaceId,
    }));
  },
});

// Get enrichment progress stats
export const getEnrichmentProgress = internalQuery({
  args: {},
  handler: async (ctx) => {
    const totalLeads = (await ctx.db.query("leads").collect()).length;
    const enrichedLeads = (await ctx.db
      .query("leads")
      .filter((q) => q.neq(q.field("ispLastChecked"), undefined))
      .collect()).length;
    const cachedHexes = (await ctx.db.query("ispHexCache").collect()).length;

    return {
      totalLeads,
      enrichedLeads,
      remainingLeads: totalLeads - enrichedLeads,
      cachedHexes,
      percentComplete: totalLeads > 0 ? Math.round((enrichedLeads / totalLeads) * 100) : 0,
    };
  },
});
