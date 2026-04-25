import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Parse the all_packages field into structured categories
function parsePackages(allPackages: string) {
  const pkgs = allPackages.toUpperCase();
  
  // Speed tier
  let speedTier = "Unknown";
  if (pkgs.includes("1.5M - 25M") || pkgs.includes("1.5M – 25M")) {
    speedTier = "1.5M-25M";
  } else if (pkgs.includes("25M - 50M") || pkgs.includes("25M – 50M")) {
    speedTier = "25M-50M";
  } else if (pkgs.includes("45M - 50M") || pkgs.includes("45M – 50M")) {
    speedTier = "45M-50M";
  } else if (pkgs.includes("75M - 100M") || pkgs.includes("75M – 100M")) {
    speedTier = "75M-100M";
  } else if (pkgs.includes("100M") || pkgs.includes("GPON")) {
    speedTier = "100M+";
  } else if (pkgs.includes("DSL")) {
    speedTier = "DSL (Unknown Speed)";
  }

  // Phone type
  const hasPots = pkgs.includes("POTS");
  const hasVoip = pkgs.includes("VOIP");
  let phoneType = "None";
  if (hasPots && hasVoip) phoneType = "POTS+VOIP";
  else if (hasPots) phoneType = "POTS";
  else if (hasVoip) phoneType = "VOIP";

  // Internet type
  let internetType = "Unknown";
  if (pkgs.includes("GPON")) internetType = "Fiber (GPON)";
  else if (pkgs.includes("UVERSE")) internetType = "U-Verse";
  else if (pkgs.includes("DSL")) internetType = "DSL";
  else if (pkgs.includes("RETENTION") || pkgs.includes("RET ")) internetType = "Retention";

  // TV service
  let tvService = "None";
  if (pkgs.includes("DTV") || pkgs.includes("DIRECTV")) tvService = "DirecTV";
  else if (pkgs.includes("DISH")) tvService = "DISH";

  return { speedTier, phoneType, internetType, tvService, hasPots };
}

export const seedFromData = internalAction({
  args: {
    rows: v.array(v.object({
      id: v.string(),
      biz_name: v.string(),
      customer: v.string(),
      phone: v.string(),
      secondary_phone: v.string(),
      email: v.string(),
      address: v.string(),
      address2: v.string(),
      city: v.string(),
      us_state: v.string(),
      zip: v.string(),
      lead_status: v.string(),
      all_packages: v.string(),
      rep: v.string(),
      lead_rep: v.string(),
      wo_sale_date: v.string(),
      payment_cleared: v.string(),
      lead_temperature: v.string(),
      language: v.string(),
      call_attempts: v.string(),
      last_call_at: v.string(),
      callable: v.string(),
      bad_phone: v.string(),
      fg_status: v.string(),
      fg_department: v.string(),
      fastgem_id: v.string(),
      lat: v.string(),
      lng: v.string(),
      created_at: v.string(),
      updated_at: v.string(),
    })),
  },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const leads = batch.map(row => {
        const parsed = parsePackages(row.all_packages);
        return {
          externalId: row.id,
          bizName: row.biz_name,
          customer: row.customer,
          phone: row.phone,
          secondaryPhone: row.secondary_phone || undefined,
          email: row.email || undefined,
          address: row.address,
          address2: row.address2 || undefined,
          city: row.city,
          state: row.us_state,
          zip: row.zip,
          leadStatus: row.lead_status,
          allPackages: row.all_packages,
          rep: row.rep || undefined,
          leadRep: row.lead_rep || undefined,
          woSaleDate: row.wo_sale_date || undefined,
          paymentCleared: row.payment_cleared || undefined,
          leadTemperature: row.lead_temperature || undefined,
          language: row.language || undefined,
          callAttempts: parseInt(row.call_attempts) || 0,
          lastCallAt: row.last_call_at || undefined,
          callable: row.callable === "True",
          badPhone: row.bad_phone === "True",
          fgStatus: row.fg_status || undefined,
          fgDepartment: row.fg_department || undefined,
          fastgemId: row.fastgem_id || undefined,
          lat: row.lat ? parseFloat(row.lat) : undefined,
          lng: row.lng ? parseFloat(row.lng) : undefined,
          speedTier: parsed.speedTier,
          phoneType: parsed.phoneType,
          internetType: parsed.internetType,
          tvService: parsed.tvService,
          hasPots: parsed.hasPots,
          // NEW: Use woSaleDate as the initial lastRetentionDate
          lastRetentionDate: row.wo_sale_date || undefined,
        };
      });

      const count = await ctx.runMutation(internal.leads.batchInsert, { leads });
      totalInserted += count;
    }

    return totalInserted;
  },
});
