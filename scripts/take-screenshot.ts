import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const TMP_DIR = join(projectRoot, "tmp");

async function waitForServer(url: string, maxWait: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 304) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const filename = process.argv[2] || "dashboard.png";
  
  console.log("🚀 Starting preview server...");
  const server = spawn("bun", ["run", "preview"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  server.stdout?.on("data", () => {});
  server.stderr?.on("data", () => {});

  try {
    const ready = await waitForServer(PREVIEW_URL, 15000);
    if (!ready) { console.error("❌ Server failed"); process.exit(1); }

    console.log("📸 Taking screenshot...");
    await mkdir(TMP_DIR, { recursive: true });
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    const path = join(TMP_DIR, filename);
    await page.screenshot({ path, fullPage: true });
    console.log(`✅ Screenshot saved: ${path}`);
    
    // Print page content for debugging
    const text = await page.locator("body").innerText();
    console.log("\nPage content:");
    console.log(text.substring(0, 2000));
    
    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch(console.error);
