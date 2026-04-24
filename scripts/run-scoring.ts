import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://compassionate-wolverine-985.convex.cloud");

async function runScoring() {
  console.log("Starting scoring of all leads...");
  
  let totalScored = 0;
  let offset = 0;
  const batchSize = 500;
  
  while (true) {
    try {
      const result = await client.mutation(api.scoring.scoreLeadsBatch, { batchSize, offset });
      totalScored += result.scored;
      offset += batchSize;
      console.log(`Scored ${totalScored} leads so far (${result.remaining} remaining)`);
      
      if (result.remaining === 0 || result.scored === 0) {
        console.log(`\n✅ Done! Scored ${totalScored} leads total`);
        break;
      }
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`Error at offset ${offset}:`, err.message);
      // Wait and retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  // Print distribution
  const dist = await client.query(api.scoring.scoreDistribution, {});
  console.log("\nScore Distribution:");
  console.log(`  🔒 Lock: ${dist.lock}`);
  console.log(`  🔥 Fire: ${dist.fire}`);
  console.log(`  🔴 Hot: ${dist.hot}`);
  console.log(`  🟡 Warm: ${dist.warm}`);
  console.log(`  🔵 Cold: ${dist.cold}`);
  console.log(`  ⚪ Unscored: ${dist.unscored}`);
  console.log(`  Avg Score: ${dist.avgScore}`);
}

runScoring().catch(console.error);
