"""
Extract AT&T account numbers from LeadGen API via browser session.
Saves progress incrementally so it can resume after timeouts.
"""
import asyncio
import json
import csv
import sys
import os

sys.path.insert(0, "/work")
from sdk.utils.browser import get_browser

OUTPUT_CSV = "/work/temp/leadgen_account_numbers.csv"
IDS_CACHE = "/work/temp/leadgen_lead_ids.json"
PROGRESS_FILE = "/work/temp/leadgen_acct_progress.json"
BASE = "https://leadgencall.cmcgroups.com"

async def main():
    browser = await get_browser("leadgen-extract5")
    
    # Step 1: Get all lead IDs (or load from cache)
    if os.path.exists(IDS_CACHE):
        with open(IDS_CACHE) as f:
            all_lead_ids = json.load(f)
        print(f"Loaded {len(all_lead_ids)} lead IDs from cache")
    else:
        print("Fetching all lead IDs...")
        all_lead_ids = []
        page = 1
        total_pages = 999
        
        while page <= total_pages:
            result = await browser.page.evaluate(
                """async ([baseUrl, pageNum, lim]) => {
                    try {
                        const resp = await fetch(baseUrl + '/api/leads?provider=att&product=att_dsl_slow,att_dsl_mid,att_dsl_fast,att_pots&status=new&order_status=cleared&limit=' + lim + '&page=' + pageNum);
                        const data = await resp.json();
                        return {
                            leads: data.leads.map(l => ({ id: l.id, biz_name: l.biz_name })),
                            total: data.total,
                            total_pages: data.total_pages,
                            page: data.page
                        };
                    } catch(e) {
                        return { error: e.message };
                    }
                }""",
                [BASE, page, 200]
            )
            
            if "error" in result:
                print(f"Error on page {page}: {result['error']}")
                break
            
            all_lead_ids.extend(result["leads"])
            total_pages = result["total_pages"]
            print(f"  Page {page}/{total_pages} - {len(all_lead_ids)} total")
            page += 1
        
        with open(IDS_CACHE, "w") as f:
            json.dump(all_lead_ids, f)
        print(f"Cached {len(all_lead_ids)} lead IDs")
    
    # Step 2: Load existing progress
    results = []
    processed_ids = set()
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            results = json.load(f)
        processed_ids = {r["id"] for r in results}
        print(f"Resuming from {len(results)} previously processed leads")
    
    # Step 3: Fetch remaining details
    remaining = [l for l in all_lead_ids if l["id"] not in processed_ids]
    print(f"\n{len(remaining)} leads remaining to process...")
    
    failed = 0
    BATCH = 10
    
    for i in range(0, len(remaining), BATCH):
        batch = remaining[i:i+BATCH]
        ids = [l["id"] for l in batch]
        
        try:
            batch_result = await browser.page.evaluate(
                """async ([baseUrl, ids]) => {
                    const results = [];
                    for (const id of ids) {
                        try {
                            const resp = await fetch(baseUrl + '/api/leads/' + id);
                            const data = await resp.json();
                            const orders = data.orders || [];
                            const acctNums = orders.map(o => o.account_number).filter(Boolean);
                            results.push({
                                id: id,
                                biz_name: data.lead?.biz_name || '',
                                account_numbers: acctNums,
                                existing_account_number: data.lead?.existing_account_number || null
                            });
                        } catch(e) {
                            results.push({ id: id, error: e.message });
                        }
                    }
                    return results;
                }""",
                [BASE, ids]
            )
            
            for r in batch_result:
                if r.get("error"):
                    failed += 1
                else:
                    results.append(r)
        except Exception as e:
            print(f"\nBrowser error at {len(results)}: {e}")
            break
        
        done = len(results)
        with_acct = sum(1 for r in results if r.get("account_numbers"))
        
        # Save progress every 500 leads
        if done % 500 < BATCH or i + BATCH >= len(remaining):
            with open(PROGRESS_FILE, "w") as f:
                json.dump(results, f)
            print(f"  {done}/{len(all_lead_ids)} processed, {with_acct} have acct#, {failed} failed [saved]")
        elif done % 100 < BATCH:
            print(f"  {done}/{len(all_lead_ids)} processed, {with_acct} have acct#, {failed} failed")
    
    # Step 4: Save to CSV
    print(f"\nWriting to {OUTPUT_CSV}...")
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["leadgen_id", "biz_name", "account_numbers", "existing_account_number"])
        for r in results:
            acct_nums = "|".join(r.get("account_numbers", []))
            writer.writerow([r["id"], r.get("biz_name", ""), acct_nums, r.get("existing_account_number", "")])
    
    # Save final progress
    with open(PROGRESS_FILE, "w") as f:
        json.dump(results, f)
    
    with_acct = sum(1 for r in results if r.get("account_numbers"))
    print(f"Done! {len(results)}/{len(all_lead_ids)} leads saved. {with_acct} have account numbers.")

asyncio.run(main())
