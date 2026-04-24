import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import * as fs from "node:fs";
import * as path from "node:path";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || "";
if (DEPLOY_KEY) {
  client.setAdminAuth(DEPLOY_KEY);
}

async function main() {
  const tempDir = "/work/temp";
  const chunkFiles = fs.readdirSync(tempDir)
    .filter(f => f.startsWith("leads_chunk_") && f.endsWith(".json"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

  console.log(`Found ${chunkFiles.length} chunk files`);
  let totalInserted = 0;

  for (const file of chunkFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(tempDir, file), "utf-8"));
    console.log(`Seeding chunk ${file}: ${data.length} rows...`);
    
    const count = await client.action(internal.seedLeads.seedFromData, { rows: data });
    totalInserted += count;
    console.log(`  Inserted ${count} rows (total: ${totalInserted})`);
  }

  console.log(`\nDone! Total inserted: ${totalInserted}`);
}

main().catch(console.error);
