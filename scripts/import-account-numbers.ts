/**
 * Import AT&T account numbers from LeadGen extraction CSV into Convex.
 * Matches leadgen_id → externalId in our leads table, then updates attAccountNumber field.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as fs from "fs";

const CONVEX_URL = "https://compassionate-wolverine-985.convex.cloud";
const CSV_PATH = "/work/temp/leadgen_account_numbers.csv";

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  // Parse CSV
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csv.trim().split("\n").slice(1); // skip header
  
  const acctMap = new Map<string, string>(); // leadgen_id → account_numbers
  for (const line of lines) {
    const parts = line.replace(/\r/g, "").split(",");
    const leadgenId = parts[0];
    const acctNums = parts[2]; // pipe-separated
    if (leadgenId && acctNums) {
      acctMap.set(leadgenId, acctNums);
    }
  }
  console.log(`Loaded ${acctMap.size} account numbers from CSV`);

  // Fetch all leads from Convex to get externalId → _id mapping
  // We need to paginate through all leads
  let cursor: string | null = null;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalNotFound = 0;
  let page = 0;

  // Get leads in batches using the list query
  while (true) {
    page++;
    const result = await client.query(api.leads.list, {
      limit: 200,
      cursor: cursor || undefined,
    });
    
    const leads = result.leads;
    if (leads.length === 0) break;
    
    // Match and update
    const updates: Array<{ id: any; acctNum: string }> = [];
    for (const lead of leads) {
      const externalId = (lead as any).externalId?.toString();
      if (externalId && acctMap.has(externalId)) {
        const acctNum = acctMap.get(externalId)!;
        // Only update if not already set
        if (!(lead as any).attAccountNumber) {
          updates.push({ id: lead._id, acctNum });
        } else {
          totalSkipped++;
        }
      }
    }
    
    // Batch update
    for (const upd of updates) {
      try {
        await client.mutation(api.leads.updateField, {
          id: upd.id,
          field: "attAccountNumber",
          value: upd.acctNum,
        });
        totalUpdated++;
      } catch (e) {
        console.error(`Failed to update ${upd.id}: ${e}`);
      }
    }
    
    console.log(`Page ${page}: ${leads.length} leads, ${updates.length} updated, ${totalUpdated} total updated`);
    
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  
  console.log(`\nDone! Updated: ${totalUpdated}, Skipped (already set): ${totalSkipped}`);
}

main().catch(console.error);
