import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  // Extend the auth users table with custom fields for role-based access
  users: defineTable({
    // Fields from @convex-dev/auth
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phoneVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
    // Custom fields
    role: v.optional(v.string()),           // "admin" | "rep"
    isApproved: v.optional(v.boolean()),    // whether account is active/approved
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  leads: defineTable({
    // Original CSV fields
    externalId: v.string(),
    attAccountNumber: v.optional(v.string()),   // AT&T account # from Orders (manually entered)
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
    rep: v.optional(v.string()),
    leadRep: v.optional(v.string()),
    woSaleDate: v.optional(v.string()),
    paymentCleared: v.optional(v.string()),
    leadTemperature: v.optional(v.string()),
    language: v.optional(v.string()),
    callAttempts: v.number(),
    lastCallAt: v.optional(v.string()),
    callable: v.boolean(),
    badPhone: v.boolean(),
    fgStatus: v.optional(v.string()),
    fgDepartment: v.optional(v.string()),
    fastgemId: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),

    // Parsed package fields for filtering
    speedTier: v.optional(v.string()),
    phoneType: v.optional(v.string()),
    internetType: v.optional(v.string()),
    tvService: v.optional(v.string()),
    hasPots: v.boolean(),

    // ISP Enrichment
    ispData: v.optional(v.string()),
    attFiberAvailable: v.optional(v.boolean()),
    attAirAvailable: v.optional(v.boolean()),
    ispProviderCount: v.optional(v.number()),
    ispLastChecked: v.optional(v.string()),
    h3Hex: v.optional(v.string()),

    // ISP Inference
    inferredIsp: v.optional(v.string()),
    inferredIspSource: v.optional(v.string()),
    likelyIsp: v.optional(v.string()),
    likelyIspConfidence: v.optional(v.string()),

    // Business intelligence
    bizType: v.optional(v.string()),          // "Auto/Mechanic", "Beauty/Salon", "Restaurant/Food", etc.
    
    // Census market intelligence (per zip)
    zipMedianIncome: v.optional(v.number()),
    zipPopulation: v.optional(v.number()),
    zipInternetPct: v.optional(v.number()),   // % households with internet subscription
    zipBizCount: v.optional(v.number()),      // total business establishments in zip
    zipBizEmployees: v.optional(v.number()),  // total employees in zip
    
    // Google Places verification
    googlePlaceId: v.optional(v.string()),
    googleRating: v.optional(v.number()),
    googleReviewCount: v.optional(v.number()),
    googleBusinessStatus: v.optional(v.string()),  // "OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"
    businessStatusOverride: v.optional(v.string()), // "open_verified" = manually verified as open
    googleTypes: v.optional(v.string()),            // JSON array of Google place types
    businessPhone: v.optional(v.string()),          // Business phone from Google (separate from owner cell)
    
    // FCC complaints (per zip)
    fccSpeedComplaints: v.optional(v.number()),
    fccAvailComplaints: v.optional(v.number()),
    fccTotalComplaints: v.optional(v.number()),
    
    // Reddit sentiment
    redditSentiment: v.optional(v.string()),  // JSON array of relevant posts

    // Conversion scoring
    conversionScore: v.optional(v.number()),      // 0-100
    heatClassification: v.optional(v.string()),    // "Lock", "Fire", "Hot", "Warm", "Cold"

    // Retention tracking
    lastRetentionDate: v.optional(v.string()),    // ISO date string — when this account was last retained

    // Lead claiming — multi-user ownership
    claimedBy: v.optional(v.id("users")),          // user ID who claimed this lead
    claimedByName: v.optional(v.string()),          // display name for quick rendering
    claimedAt: v.optional(v.string()),              // ISO datetime of claim

    // Pipeline tracking
    pipelineStatus: v.optional(v.string()),
    lastContactAt: v.optional(v.string()),
    nextFollowUp: v.optional(v.string()),
    totalAttempts: v.optional(v.number()),
  })
    .index("by_state", ["state"])
    .index("by_speedTier", ["speedTier"])
    .index("by_phoneType", ["phoneType"])
    .index("by_hasPots", ["hasPots"])
    .index("by_leadStatus", ["leadStatus"])
    .index("by_attFiber", ["attFiberAvailable"])
    .index("by_attAir", ["attAirAvailable"])
    .index("by_h3Hex", ["h3Hex"])
    .index("by_bizType", ["bizType"])
    .index("by_conversionScore", ["conversionScore"])
    .index("by_heatClassification", ["heatClassification"])
    .index("by_pipelineStatus", ["pipelineStatus"])
    .index("by_nextFollowUp", ["nextFollowUp"])
    .index("by_claimedBy", ["claimedBy"])
    .searchIndex("search_leads", {
      searchField: "bizName",
      filterFields: ["state", "speedTier", "phoneType", "hasPots", "leadStatus"],
    }),

  // Call log entries - each call attempt
  callLogs: defineTable({
    leadId: v.id("leads"),
    timestamp: v.string(),         // ISO datetime
    duration: v.optional(v.number()), // seconds
    outcome: v.string(),           // "no_answer", "voicemail", "busy", "wrong_number", "spoke_contact", "left_message", "callback_scheduled"
    notes: v.optional(v.string()),
    followUpDate: v.optional(v.string()), // scheduled follow-up
    statusChange: v.optional(v.string()), // if this call changed pipeline status
  })
    .index("by_lead", ["leadId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_lead_timestamp", ["leadId", "timestamp"]),

  // Lead notes - separate from call logs for general notes
  leadNotes: defineTable({
    leadId: v.id("leads"),
    timestamp: v.string(),
    text: v.string(),
    category: v.optional(v.string()), // "general", "follow_up", "objection", "interest", "info"
  })
    .index("by_lead", ["leadId"])
    .index("by_lead_timestamp", ["leadId", "timestamp"]),

  // Store ISP data per H3 hex to avoid redundant lookups
  ispHexCache: defineTable({
    h3Hex: v.string(),
    providers: v.string(),
    attFiberAvailable: v.boolean(),
    attAirAvailable: v.boolean(),
    providerCount: v.number(),
    checkedAt: v.string(),
  }).index("by_hex", ["h3Hex"]),

  // Track enrichment progress
  enrichmentStatus: defineTable({
    totalHexes: v.number(),
    completedHexes: v.number(),
    lastRunAt: v.optional(v.string()),
    status: v.string(),
  }),

  // Pipeline auth - simple password auth for Eric
  pipelineAuth: defineTable({
    passwordHash: v.string(),
    sessionToken: v.optional(v.string()),
    sessionExpiresAt: v.optional(v.string()),
  }),
});

export default schema;
