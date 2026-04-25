import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── User Management & Active Users List ─────────────────────────────────────

// Get the current authenticated user (with role info)
export const currentUserProfile = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "rep",           // default to "rep"
      isApproved: user.isApproved ?? true, // existing users default approved
    };
  },
});

// List all registered users (admin only)
export const listAllUsers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.string(),
    isApproved: v.boolean(),
    _creationTime: v.number(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const currentUser = await ctx.db.get(userId);
    // Only admins can list all users
    if (!currentUser || currentUser.role !== "admin") return [];

    const allUsers = await ctx.db.query("users").collect();
    return allUsers.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || "rep",
      isApproved: u.isApproved ?? true,
      _creationTime: u._creationTime,
    }));
  },
});

// Approve a user (admin only)
export const approveUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(userId, { isApproved: true });
    return null;
  },
});

// Deactivate / unapprove a user (admin only)
export const deactivateUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");

    // Can't deactivate yourself
    if (userId === adminId) throw new Error("Cannot deactivate your own account");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(userId, { isApproved: false });
    return null;
  },
});

// Set a user's role (admin only)
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("rep")),
  },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(userId, { role });
    return null;
  },
});

// Promote current user to admin (one-time bootstrap — only works if NO admin exists yet)
export const bootstrapAdmin = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if any admin exists
    const allUsers = await ctx.db.query("users").collect();
    const hasAdmin = allUsers.some(u => u.role === "admin");
    if (hasAdmin) {
      return { success: false, message: "An admin already exists. Contact them for access." };
    }

    await ctx.db.patch(userId, { role: "admin", isApproved: true });
    return { success: true, message: "You are now the admin." };
  },
});

// Delete account (existing — kept for backward compat)
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    const authSessions = await ctx.db
      .query("authSessions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(userId);

    return { success: true };
  },
});
