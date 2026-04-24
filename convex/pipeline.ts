import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Auth ─────────────────────────────────────────────────────────
// Email + password auth for the pipeline tracker
// Username: eric.tomchik@businesssolutionprovider.org
// First login: user creates their own password

const AUTHORIZED_EMAIL = "eric.tomchik@businesssolutionprovider.org";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "__att_pipeline_salt_2026__");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Check if password has been set up yet
export const checkSetupStatus = query({
  args: {},
  returns: v.object({ isSetUp: v.boolean() }),
  handler: async (ctx) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    return { isSetUp: !!auth?.passwordHash && auth.passwordHash !== "" };
  },
});

// First-time password creation
export const createPassword = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true), token: v.string(), expiresAt: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, { email, password }) => {
    if (email.toLowerCase() !== AUTHORIZED_EMAIL) {
      return { success: false as const, error: "Unauthorized email address" };
    }
    if (password.length < 6) {
      return { success: false as const, error: "Password must be at least 6 characters" };
    }

    const existing = await ctx.db.query("pipelineAuth").first();
    if (existing?.passwordHash && existing.passwordHash !== "") {
      return { success: false as const, error: "Password already set. Use login instead." };
    }

    const hash = await hashPassword(password);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, { passwordHash: hash, sessionToken: token, sessionExpiresAt: expiresAt });
    } else {
      await ctx.db.insert("pipelineAuth", { passwordHash: hash, sessionToken: token, sessionExpiresAt: expiresAt });
    }

    return { success: true as const, token, expiresAt };
  },
});

// Login with existing password
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.union(
    v.object({ success: v.literal(true), token: v.string(), expiresAt: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, { email, password }) => {
    if (email.toLowerCase() !== AUTHORIZED_EMAIL) {
      return { success: false as const, error: "Unauthorized email address" };
    }

    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth?.passwordHash) {
      return { success: false as const, error: "No password set. Please create one first." };
    }

    const hash = await hashPassword(password);
    if (hash !== auth.passwordHash) {
      return { success: false as const, error: "Invalid password" };
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await ctx.db.patch(auth._id, { sessionToken: token, sessionExpiresAt: expiresAt });

    return { success: true as const, token, expiresAt };
  },
});

// Verify active session
export const verifySession = query({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { token }) => {
    if (!token) return false;
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return false;
    if (auth.sessionExpiresAt && new Date(auth.sessionExpiresAt) < new Date()) return false;
    return true;
  },
});

// Logout
export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (auth && auth.sessionToken === token) {
      await ctx.db.patch(auth._id, { sessionToken: undefined, sessionExpiresAt: undefined });
    }
    return null;
  },
});

// ─── Call Logging ─────────────────────────────────────────────────

export const logCall = mutation({
  args: {
    token: v.string(),
    leadId: v.id("leads"),
    outcome: v.string(),
    duration: v.optional(v.number()),
    notes: v.optional(v.string()),
    followUpDate: v.optional(v.string()),
    newStatus: v.optional(v.string()),
  },
  returns: v.id("callLogs"),
  handler: async (ctx, args) => {
    // Verify auth
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== args.token) throw new Error("Unauthorized");

    const now = new Date().toISOString();

    // Insert call log
    const logId = await ctx.db.insert("callLogs", {
      leadId: args.leadId,
      timestamp: now,
      duration: args.duration,
      outcome: args.outcome,
      notes: args.notes,
      followUpDate: args.followUpDate,
      statusChange: args.newStatus,
    });

    // Update lead pipeline fields
    const lead = await ctx.db.get(args.leadId);
    if (lead) {
      const updates: any = {
        lastContactAt: now,
        totalAttempts: (lead.totalAttempts || 0) + 1,
      };
      if (args.newStatus) {
        updates.pipelineStatus = args.newStatus;
      } else if (!lead.pipelineStatus || lead.pipelineStatus === "no_contact") {
        updates.pipelineStatus = "attempted";
      }
      if (args.followUpDate) {
        updates.nextFollowUp = args.followUpDate;
      }
      await ctx.db.patch(args.leadId, updates);
    }

    return logId;
  },
});

export const getCallLogs = query({
  args: { token: v.string(), leadId: v.id("leads") },
  returns: v.any(),
  handler: async (ctx, { token, leadId }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return [];
    return await ctx.db
      .query("callLogs")
      .withIndex("by_lead_timestamp", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

// ─── Notes ────────────────────────────────────────────────────────

export const addNote = mutation({
  args: {
    token: v.string(),
    leadId: v.id("leads"),
    text: v.string(),
    category: v.optional(v.string()),
  },
  returns: v.id("leadNotes"),
  handler: async (ctx, args) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== args.token) throw new Error("Unauthorized");

    return await ctx.db.insert("leadNotes", {
      leadId: args.leadId,
      timestamp: new Date().toISOString(),
      text: args.text,
      category: args.category || "general",
    });
  },
});

export const getNotes = query({
  args: { token: v.string(), leadId: v.id("leads") },
  returns: v.any(),
  handler: async (ctx, { token, leadId }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return [];
    return await ctx.db
      .query("leadNotes")
      .withIndex("by_lead_timestamp", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

// ─── Pipeline Status ──────────────────────────────────────────────

export const updatePipelineStatus = mutation({
  args: {
    token: v.string(),
    leadId: v.id("leads"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { token, leadId, status }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) throw new Error("Unauthorized");
    await ctx.db.patch(leadId, { pipelineStatus: status });
    return null;
  },
});

// ─── Follow-Up Queue ──────────────────────────────────────────────

export const getFollowUps = query({
  args: { token: v.string() },
  returns: v.any(),
  handler: async (ctx, { token }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return [];

    const now = new Date().toISOString();
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_nextFollowUp")
      .collect();

    return leads
      .filter((l) => l.nextFollowUp && l.nextFollowUp <= now)
      .sort((a, b) => (a.nextFollowUp || "").localeCompare(b.nextFollowUp || ""))
      .slice(0, 50)
      .map((l) => ({
        _id: l._id,
        bizName: l.bizName,
        customer: l.customer,
        phone: l.phone,
        city: l.city,
        state: l.state,
        pipelineStatus: l.pipelineStatus,
        nextFollowUp: l.nextFollowUp,
        totalAttempts: l.totalAttempts,
        speedTier: l.speedTier,
        attFiberAvailable: l.attFiberAvailable,
        attAirAvailable: l.attAirAvailable,
      }));
  },
});

// ─── Performance Metrics ──────────────────────────────────────────

export const getMetrics = query({
  args: { token: v.string(), dateRange: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, { token, dateRange }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return null;

    // Get date range
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // all time
    }
    const startStr = startDate.toISOString();

    // Get all call logs in range
    const allLogs = await ctx.db.query("callLogs").withIndex("by_timestamp").collect();
    const logs = allLogs.filter((l) => l.timestamp >= startStr);

    // Get pipeline status counts
    const allLeads = await ctx.db.query("leads").collect();
    const statusCounts: Record<string, number> = {};
    for (const lead of allLeads) {
      const s = lead.pipelineStatus || "no_contact";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    // Calls per day
    const callsByDay: Record<string, number> = {};
    const contactsByDay: Record<string, number> = {};
    for (const log of logs) {
      const day = log.timestamp.slice(0, 10);
      callsByDay[day] = (callsByDay[day] || 0) + 1;
      if (log.outcome === "spoke_contact") {
        contactsByDay[day] = (contactsByDay[day] || 0) + 1;
      }
    }

    // Outcome breakdown
    const outcomes: Record<string, number> = {};
    for (const log of logs) {
      outcomes[log.outcome] = (outcomes[log.outcome] || 0) + 1;
    }

    // Calculate rates
    const totalCalls = logs.length;
    const contacts = logs.filter((l) => l.outcome === "spoke_contact").length;
    const uniqueLeadsContacted = new Set(logs.filter((l) => l.outcome === "spoke_contact").map((l) => l.leadId)).size;

    return {
      totalCalls,
      contacts,
      uniqueLeadsContacted,
      contactRate: totalCalls > 0 ? Math.round((contacts / totalCalls) * 100) : 0,
      pipeline: {
        no_contact: statusCounts["no_contact"] || 0,
        attempted: statusCounts["attempted"] || 0,
        contacted: statusCounts["contacted"] || 0,
        interested: statusCounts["interested"] || 0,
        not_interested: statusCounts["not_interested"] || 0,
        verified: statusCounts["verified"] || 0,
        converted: statusCounts["converted"] || 0,
      },
      callsByDay,
      contactsByDay,
      outcomes,
      totalLeads: allLeads.length,
      followUpsToday: allLeads.filter((l) => l.nextFollowUp && l.nextFollowUp.slice(0, 10) <= now.toISOString().slice(0, 10)).length,
    };
  },
});

// ─── Pipeline-aware lead list ─────────────────────────────────────

export const getPipelineLeads = query({
  args: {
    token: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, { token, status, limit }) => {
    const auth = await ctx.db.query("pipelineAuth").first();
    if (!auth || auth.sessionToken !== token) return [];

    let leads;
    if (status) {
      leads = await ctx.db
        .query("leads")
        .withIndex("by_pipelineStatus", (q) => q.eq("pipelineStatus", status))
        .collect();
    } else {
      leads = await ctx.db.query("leads").collect();
    }

    return leads
      .filter((l) => l.pipelineStatus && l.pipelineStatus !== "no_contact")
      .sort((a, b) => (b.lastContactAt || "").localeCompare(a.lastContactAt || ""))
      .slice(0, limit || 100)
      .map((l) => ({
        _id: l._id,
        bizName: l.bizName,
        customer: l.customer,
        phone: l.phone,
        email: l.email,
        city: l.city,
        state: l.state,
        speedTier: l.speedTier,
        pipelineStatus: l.pipelineStatus,
        lastContactAt: l.lastContactAt,
        nextFollowUp: l.nextFollowUp,
        totalAttempts: l.totalAttempts,
        attFiberAvailable: l.attFiberAvailable,
        attAirAvailable: l.attAirAvailable,
        inferredIsp: l.inferredIsp,
      }));
  },
});
