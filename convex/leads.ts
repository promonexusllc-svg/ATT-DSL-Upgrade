import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get leads with filtering and pagination
export const list = query({
  args: {
    state: v.optional(v.string()),
    speedTier: v.optional(v.string()),
    phoneType: v.optional(v.string()),
    hasPots: v.optional(v.boolean()),
    leadStatus: v.optional(v.string()),
    tvService: v.optional(v.string()),
    internetType: v.optional(v.string()),
    attFiberAvailable: v.optional(v.boolean()),
    attAirAvailable: v.optional(v.boolean()),
    bizType: v.optional(v.string()),
    heatClassification: v.optional(v.string()),
    showClosed: v.optional(v.boolean()),
    city: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: v.optional(v.string()), // "recommended" (default), "name_asc", "name_desc", "score_desc", "score_asc"
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    leads: v.array(v.object({
      _id: v.id("leads"),
      externalId: v.string(),
      bizName: v.string(),
      customer: v.string(),
      phone: v.string(),
      secondaryPhone: v.optional(v.string()),
      email: v.optional(v.string()),
      address: v.string(),
      address2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
      leadStatus: v.string(),
      allPackages: v.string(),
      speedTier: v.optional(v.string()),
      phoneType: v.optional(v.string()),
      internetType: v.optional(v.string()),
      tvService: v.optional(v.string()),
      hasPots: v.boolean(),
      rep: v.optional(v.string()),
      leadRep: v.optional(v.string()),
      fgStatus: v.optional(v.string()),
      fgDepartment: v.optional(v.string()),
      callAttempts: v.number(),
      callable: v.boolean(),
      badPhone: v.boolean(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      ispData: v.optional(v.string()),
      attFiberAvailable: v.optional(v.boolean()),
      attAirAvailable: v.optional(v.boolean()),
      ispProviderCount: v.optional(v.number()),
      ispLastChecked: v.optional(v.string()),
      inferredIsp: v.optional(v.string()),
      inferredIspSource: v.optional(v.string()),
      likelyIsp: v.optional(v.string()),
      likelyIspConfidence: v.optional(v.string()),
      conversionScore: v.optional(v.number()),
      heatClassification: v.optional(v.string()),
      googleBusinessStatus: v.optional(v.string()),
      businessStatusOverride: v.optional(v.string()),
      lastRetentionDate: v.optional(v.string()),
      claimedBy: v.optional(v.id("users")),
      claimedByName: v.optional(v.string()),
      claimedAt: v.optional(v.string()),
    })),
    nextCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const pageSize = args.limit || 50;

    // If there's a search query, use the search index
    if (args.search && args.search.trim().length > 0) {
      let searchQuery = ctx.db
        .query("leads")
        .withSearchIndex("search_leads", (q) => {
          let sq = q.search("bizName", args.search!);
          if (args.state) sq = sq.eq("state", args.state);
          if (args.speedTier) sq = sq.eq("speedTier", args.speedTier);
          if (args.phoneType) sq = sq.eq("phoneType", args.phoneType);
          if (args.hasPots !== undefined) sq = sq.eq("hasPots", args.hasPots);
          if (args.leadStatus) sq = sq.eq("leadStatus", args.leadStatus);
          return sq;
        });

      const results = await searchQuery.collect();
      
      // Apply remaining filters that search index can't handle
      let filtered = results;
      if (args.tvService) {
        filtered = filtered.filter(l => l.tvService === args.tvService);
      }
      if (args.internetType) {
        filtered = filtered.filter(l => l.internetType === args.internetType);
      }
      if (args.city) {
        filtered = filtered.filter(l => l.city?.toLowerCase().includes(args.city!.toLowerCase()));
      }
      if (args.attFiberAvailable !== undefined) {
        filtered = filtered.filter(l => l.attFiberAvailable === args.attFiberAvailable);
      }
      if (args.attAirAvailable !== undefined) {
        filtered = filtered.filter(l => l.attAirAvailable === args.attAirAvailable);
      }
      if (args.bizType) {
        filtered = filtered.filter(l => l.bizType === args.bizType);
      }
      if (args.heatClassification) {
        filtered = filtered.filter(l => l.heatClassification === args.heatClassification);
      }
      if (args.showClosed === true) {
        filtered = filtered.filter(l => l.googleBusinessStatus === "CLOSED_PERMANENTLY");
      }

      // Sort
      filtered = sortLeads(filtered, args.sortBy || "recommended");

      const totalCount = filtered.length;
      const startIdx = args.cursor ? parseInt(args.cursor) : 0;
      const page = filtered.slice(startIdx, startIdx + pageSize);
      const nextCursor = startIdx + pageSize < totalCount ? String(startIdx + pageSize) : null;

      return {
        leads: page.map(mapLead),
        nextCursor,
        totalCount,
      };
    }

    // No search — use regular query with appropriate index
    let allLeads;
    if (args.state) {
      allLeads = await ctx.db.query("leads").withIndex("by_state", q => q.eq("state", args.state!)).collect();
    } else if (args.speedTier) {
      allLeads = await ctx.db.query("leads").withIndex("by_speedTier", q => q.eq("speedTier", args.speedTier!)).collect();
    } else if (args.hasPots !== undefined) {
      allLeads = await ctx.db.query("leads").withIndex("by_hasPots", q => q.eq("hasPots", args.hasPots!)).collect();
    } else if (args.phoneType) {
      allLeads = await ctx.db.query("leads").withIndex("by_phoneType", q => q.eq("phoneType", args.phoneType!)).collect();
    } else if (args.leadStatus) {
      allLeads = await ctx.db.query("leads").withIndex("by_leadStatus", q => q.eq("leadStatus", args.leadStatus!)).collect();
    } else if (args.attFiberAvailable !== undefined) {
      allLeads = await ctx.db.query("leads").withIndex("by_attFiber", q => q.eq("attFiberAvailable", args.attFiberAvailable!)).collect();
    } else if (args.attAirAvailable !== undefined) {
      allLeads = await ctx.db.query("leads").withIndex("by_attAir", q => q.eq("attAirAvailable", args.attAirAvailable!)).collect();
    } else {
      allLeads = await ctx.db.query("leads").collect();
    }

    // Apply remaining filters
    let filtered = allLeads;
    if (args.state && !allLeads[0]?.state) {
      // Already filtered by index
    } else if (args.state) {
      filtered = filtered.filter(l => l.state === args.state);
    }
    if (args.speedTier && filtered === allLeads) {
      // not yet filtered
    } else if (args.speedTier) {
      filtered = filtered.filter(l => l.speedTier === args.speedTier);
    }
    // Apply all non-index filters
    if (args.phoneType) {
      filtered = filtered.filter(l => l.phoneType === args.phoneType);
    }
    if (args.hasPots !== undefined) {
      filtered = filtered.filter(l => l.hasPots === args.hasPots);
    }
    if (args.leadStatus) {
      filtered = filtered.filter(l => l.leadStatus === args.leadStatus);
    }
    if (args.tvService) {
      filtered = filtered.filter(l => l.tvService === args.tvService);
    }
    if (args.internetType) {
      filtered = filtered.filter(l => l.internetType === args.internetType);
    }
    if (args.city) {
      filtered = filtered.filter(l => l.city?.toLowerCase().includes(args.city!.toLowerCase()));
    }
    if (args.attFiberAvailable !== undefined) {
      filtered = filtered.filter(l => l.attFiberAvailable === args.attFiberAvailable);
    }
    if (args.attAirAvailable !== undefined) {
      filtered = filtered.filter(l => l.attAirAvailable === args.attAirAvailable);
    }
    if (args.bizType) {
      filtered = filtered.filter(l => l.bizType === args.bizType);
    }
    if (args.heatClassification) {
      filtered = filtered.filter(l => l.heatClassification === args.heatClassification);
    }
    if (args.showClosed === true) {
      filtered = filtered.filter(l => l.googleBusinessStatus === "CLOSED_PERMANENTLY" && l.businessStatusOverride !== "open_verified");
    }

    // Sort
    filtered = sortLeads(filtered, args.sortBy || "recommended");

    const totalCount = filtered.length;
    const startIdx = args.cursor ? parseInt(args.cursor) : 0;
    const page = filtered.slice(startIdx, startIdx + pageSize);
    const nextCursor = startIdx + pageSize < totalCount ? String(startIdx + pageSize) : null;

    return {
      leads: page.map(mapLead),
      nextCursor,
      totalCount,
    };
  },
});

function sortLeads(leads: any[], sortBy: string): any[] {
  switch (sortBy) {
    case "recommended":
    case "score_desc":
      return leads.sort((a, b) => (b.conversionScore ?? -1) - (a.conversionScore ?? -1));
    case "score_asc":
      return leads.sort((a, b) => (a.conversionScore ?? 999) - (b.conversionScore ?? 999));
    case "name_asc":
      return leads.sort((a, b) => a.bizName.localeCompare(b.bizName));
    case "name_desc":
      return leads.sort((a, b) => b.bizName.localeCompare(a.bizName));
    default:
      return leads.sort((a, b) => (b.conversionScore ?? -1) - (a.conversionScore ?? -1));
  }
}

function mapLead(l: any) {
  return {
    _id: l._id,
    externalId: l.externalId,
    bizName: l.bizName,
    customer: l.customer,
    phone: l.phone,
    secondaryPhone: l.secondaryPhone,
    email: l.email,
    address: l.address,
    address2: l.address2,
    city: l.city,
    state: l.state,
    zip: l.zip,
    leadStatus: l.leadStatus,
    allPackages: l.allPackages,
    speedTier: l.speedTier,
    phoneType: l.phoneType,
    internetType: l.internetType,
    tvService: l.tvService,
    hasPots: l.hasPots,
    rep: l.rep,
    leadRep: l.leadRep,
    fgStatus: l.fgStatus,
    fgDepartment: l.fgDepartment,
    callAttempts: l.callAttempts,
    callable: l.callable,
    badPhone: l.badPhone,
    lat: l.lat,
    lng: l.lng,
    ispData: l.ispData,
    attFiberAvailable: l.attFiberAvailable,
    attAirAvailable: l.attAirAvailable,
    ispProviderCount: l.ispProviderCount,
    ispLastChecked: l.ispLastChecked,
    inferredIsp: l.inferredIsp,
    inferredIspSource: l.inferredIspSource,
    likelyIsp: l.likelyIsp,
    likelyIspConfidence: l.likelyIspConfidence,
    conversionScore: l.conversionScore,
    heatClassification: l.heatClassification,
    googleBusinessStatus: l.googleBusinessStatus,
    businessStatusOverride: l.businessStatusOverride,
    // NEW: Retention date + claim fields
    lastRetentionDate: l.lastRetentionDate,
    claimedBy: l.claimedBy,
    claimedByName: l.claimedByName,
    claimedAt: l.claimedAt,
  };
}

// ─── Lead Claiming ────────────────────────────────────────────────────────────

// Claim a lead for the currently authenticated user
export const claimLead = mutation({
  args: {
    leadId: v.id("leads"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { leadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");

    // If already claimed by someone else, block it
    if (lead.claimedBy && lead.claimedBy !== userId) {
      return { success: false, error: `Already claimed by ${lead.claimedByName || "another user"}` };
    }
    // If already claimed by this user, it's a no-op
    if (lead.claimedBy === userId) {
      return { success: true };
    }

    // Look up user's display name
    const user = await ctx.db.get(userId);
    const displayName = user?.name || user?.email || "Unknown";

    await ctx.db.patch(leadId, {
      claimedBy: userId,
      claimedByName: displayName,
      claimedAt: new Date().toISOString(),
      // Also initialize pipeline status if not set
      pipelineStatus: lead.pipelineStatus || "no_contact",
    });

    return { success: true };
  },
});

// Unclaim / release a lead (only the claimer or an admin can do this)
export const unclaimLead = mutation({
  args: {
    leadId: v.id("leads"),
  },
  returns: v.null(),
  handler: async (ctx, { leadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("Lead not found");

    // Only the claimer (or admin) can release
    // For now, allow the claimer or if unclaimed
    if (lead.claimedBy && lead.claimedBy !== userId) {
      // Check if user is admin
      const user = await ctx.db.get(userId);
      if (user?.role !== "admin") {
        throw new Error("Only the claimer or an admin can release this lead");
      }
    }

    await ctx.db.patch(leadId, {
      claimedBy: undefined,
      claimedByName: undefined,
      claimedAt: undefined,
    });

    return null;
  },
});

// Get all leads claimed by the current user (for pipeline)
export const myClaimedLeads = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_claimedBy", q => q.eq("claimedBy", userId))
      .collect();

    return leads;
  },
});

// ─── Backfill: set lastRetentionDate from woSaleDate for existing leads ──────

export const backfillRetentionDates = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const leads = await ctx.db.query("leads").collect();
    let updated = 0;
    for (const lead of leads) {
      if (!lead.lastRetentionDate && lead.woSaleDate) {
        await ctx.db.patch(lead._id, { lastRetentionDate: lead.woSaleDate });
        updated++;
      }
    }
    return updated;
  },
});

// Get filter option counts for the sidebar
export const filterCounts = query({
  args: {},
  returns: v.object({
    totalLeads: v.number(),
    states: v.array(v.object({ value: v.string(), count: v.number() })),
    speedTiers: v.array(v.object({ value: v.string(), count: v.number() })),
    phoneTypes: v.array(v.object({ value: v.string(), count: v.number() })),
    tvServices: v.array(v.object({ value: v.string(), count: v.number() })),
    internetTypes: v.array(v.object({ value: v.string(), count: v.number() })),
    leadStatuses: v.array(v.object({ value: v.string(), count: v.number() })),
    fgStatuses: v.array(v.object({ value: v.string(), count: v.number() })),
    bizTypes: v.array(v.object({ value: v.string(), count: v.number() })),
    heatClassifications: v.array(v.object({ value: v.string(), count: v.number() })),
    potsCount: v.number(),
    enrichedCount: v.number(),
    attFiberCount: v.number(),
    attAirCount: v.number(),
    closedCount: v.number(),
  }),
  handler: async (ctx) => {
    const allLeads = await ctx.db.query("leads").collect();
    
    const countBy = (field: string) => {
      const counts: Record<string, number> = {};
      for (const l of allLeads) {
        const val = (l as any)[field] || "Unknown";
        counts[val] = (counts[val] || 0) + 1;
      }
      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      totalLeads: allLeads.length,
      states: countBy("state"),
      speedTiers: countBy("speedTier"),
      phoneTypes: countBy("phoneType"),
      tvServices: countBy("tvService"),
      internetTypes: countBy("internetType"),
      leadStatuses: countBy("leadStatus"),
      fgStatuses: countBy("fgStatus"),
      bizTypes: countBy("bizType"),
      heatClassifications: countBy("heatClassification"),
      potsCount: allLeads.filter(l => l.hasPots).length,
      enrichedCount: allLeads.filter(l => l.ispLastChecked).length,
      attFiberCount: allLeads.filter(l => l.attFiberAvailable).length,
      attAirCount: allLeads.filter(l => l.attAirAvailable).length,
      closedCount: allLeads.filter(l => l.googleBusinessStatus === "CLOSED_PERMANENTLY" && l.businessStatusOverride !== "open_verified").length,
    };
  },
});

// Get a single lead with full details
export const getById = query({
  args: { id: v.id("leads") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Update a single field on a lead
export const updateField = mutation({
  args: {
    id: v.id("leads"),
    field: v.string(),
    value: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, { id, field, value }) => {
    const lead = await ctx.db.get(id);
    if (!lead) throw new Error("Lead not found");
    await ctx.db.patch(id, { [field]: value });
    return null;
  },
});

// Batch insert leads (called from seed action)
export const batchInsert = internalMutation({
  args: {
    leads: v.array(v.any()),
  },
  returns: v.number(),
  handler: async (ctx, { leads }) => {
    let count = 0;
    for (const lead of leads) {
      await ctx.db.insert("leads", lead);
      count++;
    }
    return count;
  },
});

// Get unique cities for a given state
export const citiesForState = query({
  args: { state: v.string() },
  returns: v.array(v.object({ value: v.string(), count: v.number() })),
  handler: async (ctx, { state }) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_state", q => q.eq("state", state))
      .collect();
    
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const city = l.city || "Unknown";
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  },
});

// Count leads matching current filters (for export)
export const countFiltered = query({
  args: {
    state: v.optional(v.string()),
    speedTier: v.optional(v.string()),
    phoneType: v.optional(v.string()),
    hasPots: v.optional(v.boolean()),
    leadStatus: v.optional(v.string()),
    tvService: v.optional(v.string()),
    internetType: v.optional(v.string()),
    attFiberAvailable: v.optional(v.boolean()),
    attAirAvailable: v.optional(v.boolean()),
    city: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let allLeads;
    
    if (args.search && args.search.trim().length > 0) {
      allLeads = await ctx.db
        .query("leads")
        .withSearchIndex("search_leads", (q) => {
          let sq = q.search("bizName", args.search!);
          if (args.state) sq = sq.eq("state", args.state);
          if (args.speedTier) sq = sq.eq("speedTier", args.speedTier);
          if (args.phoneType) sq = sq.eq("phoneType", args.phoneType);
          if (args.hasPots !== undefined) sq = sq.eq("hasPots", args.hasPots);
          if (args.leadStatus) sq = sq.eq("leadStatus", args.leadStatus);
          return sq;
        })
        .collect();
    } else if (args.state) {
      allLeads = await ctx.db.query("leads").withIndex("by_state", q => q.eq("state", args.state!)).collect();
    } else {
      allLeads = await ctx.db.query("leads").collect();
    }

    let filtered = allLeads;
    if (args.speedTier) filtered = filtered.filter(l => l.speedTier === args.speedTier);
    if (args.phoneType) filtered = filtered.filter(l => l.phoneType === args.phoneType);
    if (args.hasPots !== undefined) filtered = filtered.filter(l => l.hasPots === args.hasPots);
    if (args.leadStatus) filtered = filtered.filter(l => l.leadStatus === args.leadStatus);
    if (args.tvService) filtered = filtered.filter(l => l.tvService === args.tvService);
    if (args.internetType) filtered = filtered.filter(l => l.internetType === args.internetType);
    if (args.city) filtered = filtered.filter(l => l.city?.toLowerCase().includes(args.city!.toLowerCase()));
    if (args.attFiberAvailable !== undefined) filtered = filtered.filter(l => l.attFiberAvailable === args.attFiberAvailable);
    if (args.attAirAvailable !== undefined) filtered = filtered.filter(l => l.attAirAvailable === args.attAirAvailable);

    return filtered.length;
  },
});

// Get ALL filtered leads for CSV export (no pagination)
export const exportFiltered = query({
  args: {
    state: v.optional(v.string()),
    speedTier: v.optional(v.string()),
    phoneType: v.optional(v.string()),
    hasPots: v.optional(v.boolean()),
    leadStatus: v.optional(v.string()),
    tvService: v.optional(v.string()),
    internetType: v.optional(v.string()),
    attFiberAvailable: v.optional(v.boolean()),
    attAirAvailable: v.optional(v.boolean()),
    city: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let allLeads;
    
    if (args.search && args.search.trim().length > 0) {
      allLeads = await ctx.db
        .query("leads")
        .withSearchIndex("search_leads", (q) => {
          let sq = q.search("bizName", args.search!);
          if (args.state) sq = sq.eq("state", args.state);
          return sq;
        })
        .collect();
    } else if (args.state) {
      allLeads = await ctx.db.query("leads").withIndex("by_state", q => q.eq("state", args.state!)).collect();
    } else {
      allLeads = await ctx.db.query("leads").collect();
    }

    let filtered = allLeads;
    if (args.speedTier) filtered = filtered.filter(l => l.speedTier === args.speedTier);
    if (args.phoneType) filtered = filtered.filter(l => l.phoneType === args.phoneType);
    if (args.hasPots !== undefined) filtered = filtered.filter(l => l.hasPots === args.hasPots);
    if (args.leadStatus) filtered = filtered.filter(l => l.leadStatus === args.leadStatus);
    if (args.tvService) filtered = filtered.filter(l => l.tvService === args.tvService);
    if (args.internetType) filtered = filtered.filter(l => l.internetType === args.internetType);
    if (args.city) filtered = filtered.filter(l => l.city?.toLowerCase().includes(args.city!.toLowerCase()));
    if (args.attFiberAvailable !== undefined) filtered = filtered.filter(l => l.attFiberAvailable === args.attFiberAvailable);
    if (args.attAirAvailable !== undefined) filtered = filtered.filter(l => l.attAirAvailable === args.attAirAvailable);

    return filtered;
  },
});

// Get stats that reflect the current active filters
export const filteredStats = query({
  args: {
    state: v.optional(v.string()),
    speedTier: v.optional(v.string()),
    phoneType: v.optional(v.string()),
    hasPots: v.optional(v.boolean()),
    leadStatus: v.optional(v.string()),
    tvService: v.optional(v.string()),
    internetType: v.optional(v.string()),
    attFiberAvailable: v.optional(v.boolean()),
    attAirAvailable: v.optional(v.boolean()),
    bizType: v.optional(v.string()),
    city: v.optional(v.string()),
    search: v.optional(v.string()),
    heatClassification: v.optional(v.string()),
    showClosed: v.optional(v.boolean()),
  },
  returns: v.object({
    total: v.number(),
    pots: v.number(),
    lowSpeed: v.number(),
    fiber: v.number(),
    air: v.number(),
    states: v.number(),
    closed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Check if any filters are active
    const hasFilters = args.state || args.speedTier || args.phoneType || args.hasPots !== undefined ||
      args.leadStatus || args.tvService || args.internetType || args.attFiberAvailable !== undefined ||
      args.attAirAvailable !== undefined || args.bizType || args.city || args.heatClassification || args.showClosed || (args.search && args.search.trim());
    
    if (!hasFilters) {
      // No filters — just return zeros, the global filterCounts will be used
      return { total: 0, pots: 0, lowSpeed: 0, fiber: 0, air: 0, states: 0, closed: 0 };
    }

    let allLeads;
    if (args.search && args.search.trim().length > 0) {
      allLeads = await ctx.db
        .query("leads")
        .withSearchIndex("search_leads", (q) => {
          let sq = q.search("bizName", args.search!);
          if (args.state) sq = sq.eq("state", args.state);
          if (args.speedTier) sq = sq.eq("speedTier", args.speedTier);
          if (args.phoneType) sq = sq.eq("phoneType", args.phoneType);
          if (args.hasPots !== undefined) sq = sq.eq("hasPots", args.hasPots);
          if (args.leadStatus) sq = sq.eq("leadStatus", args.leadStatus);
          return sq;
        }).collect();
    } else if (args.state) {
      allLeads = await ctx.db.query("leads").withIndex("by_state", q => q.eq("state", args.state!)).collect();
    } else if (args.speedTier) {
      allLeads = await ctx.db.query("leads").withIndex("by_speedTier", q => q.eq("speedTier", args.speedTier!)).collect();
    } else {
      allLeads = await ctx.db.query("leads").collect();
    }

    let filtered = allLeads;
    if (args.state && !args.search) filtered = filtered.filter(l => l.state === args.state);
    if (args.speedTier) filtered = filtered.filter(l => l.speedTier === args.speedTier);
    if (args.phoneType) filtered = filtered.filter(l => l.phoneType === args.phoneType);
    if (args.hasPots !== undefined) filtered = filtered.filter(l => l.hasPots === args.hasPots);
    if (args.leadStatus) filtered = filtered.filter(l => l.leadStatus === args.leadStatus);
    if (args.tvService) filtered = filtered.filter(l => l.tvService === args.tvService);
    if (args.internetType) filtered = filtered.filter(l => l.internetType === args.internetType);
    if (args.city) filtered = filtered.filter(l => l.city?.toLowerCase().includes(args.city!.toLowerCase()));
    if (args.attFiberAvailable !== undefined) filtered = filtered.filter(l => l.attFiberAvailable === args.attFiberAvailable);
    if (args.attAirAvailable !== undefined) filtered = filtered.filter(l => l.attAirAvailable === args.attAirAvailable);
    if (args.bizType) filtered = filtered.filter(l => l.bizType === args.bizType);
    if (args.heatClassification) filtered = filtered.filter(l => l.heatClassification === args.heatClassification);
    if (args.showClosed === true) filtered = filtered.filter(l => l.googleBusinessStatus === "CLOSED_PERMANENTLY" && l.businessStatusOverride !== "open_verified");

    const stateSet = new Set(filtered.map(l => l.state).filter(Boolean));
    return {
      total: filtered.length,
      pots: filtered.filter(l => l.hasPots).length,
      lowSpeed: filtered.filter(l => l.speedTier === "1.5M-25M").length,
      fiber: filtered.filter(l => l.attFiberAvailable === true).length,
      air: filtered.filter(l => l.attAirAvailable === true).length,
      states: stateSet.size,
      closed: filtered.filter(l => l.googleBusinessStatus === "CLOSED_PERMANENTLY" && l.businessStatusOverride !== "open_verified").length,
    };
  },
});
