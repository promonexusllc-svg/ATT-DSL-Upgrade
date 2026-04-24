/**
 * Import provider-tagged account numbers into Convex.
 * Replaces existing attAccountNumber with tagged format: "att:XXX|dtv:YYY|dish:ZZZ"
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as fs from "fs";

const CONVEX_URL = "https://compassionate-wolverine-985.convex.cloud";
const TAGGED_FILE = "/work/temp/leadgen_tagged_progress.json";

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  // Load tagged data: leadgen_id -> "att:XXX|dtv:YYY"
  const tagged: Record<string, string> = JSON.parse(fs.readFileSync(TAGGED_FILE, "utf-8"));
  console.log(`Loaded ${Object.keys(tagged).length} tagged account numbers`);

  let cursor: string | null = null;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let page = 0;

  while (true) {
    page++;
    const result = await client.query(api.leads.list, {
      limit: 200,
      cursor: cursor || undefined,
    });

    const leads = result.leads;
    if (leads.length === 0) break;

    for (const lead of leads) {
      const externalId = (lead as any).externalId?.toString();
      if (externalId && tagged[externalId]) {
        const newValue = tagged[externalId];
        const currentValue = (lead as any).attAccountNumber;
        
        // Only update if different from current
        if (currentValue !== newValue) {
          try {
            await client.mutation(api.leads.updateField, {
              id: lead._id,
              field: "attAccountNumber",
              value: newValue,
            });
            totalUpdated++;
          } catch (e) {
            console.error(`Failed: ${externalId}: ${e}`);
          }
        } else {
          totalSkipped++;
        }
      }
    }

    console.log(`Page ${page}: ${leads.length} leads, ${totalUpdated} updated total`);

    cursor = result.nextCursor;
    if (!cursor) break;
  }

  console.log(`\nDone! Updated: ${totalUpdated}, Skipped (same): ${totalSkipped}`);
}

main().catch(console.error);
