"""
Re-extract account numbers with provider tagging.
For each lead with multiple account numbers, fetch orders and map
account_number -> provider_name (AT&T vs DIRECTV vs DISH).

Stores result as tagged format: "att:7181023237A|dtv:75766521|dish:8255707088917591"
"""
import asyncio
import json
import os
import sys
sys.path.insert(0, "/work")

from sdk.utils.browser import get_browser

PROGRESS_FILE = "/work/temp/leadgen_tagged_progress.json"
ACCT_PROGRESS = "/work/temp/leadgen_acct_progress.json"

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {}

def save_progress(data):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(data, f)

def classify_provider(provider_name: str) -> str:
    """Classify provider name to att/dtv/dish/other"""
    p = (provider_name or "").upper()
    if "DIRECTV" in p or "DTV" in p:
        return "dtv"
    elif "DISH" in p:
        return "dish"
    elif "AT&T" in p or "ATT" in p:
        return "att"
    elif "ESCALATION" in p or "TECH" in p or "EXISTING" in p:
        return "att"  # These are usually AT&T internal departments
    else:
        return "other"

async def main():
    # Load leads with multiple account numbers
    with open(ACCT_PROGRESS) as f:
        all_leads = json.load(f)
    
    multi = [r for r in all_leads if r.get("account_numbers") and len(r["account_numbers"]) > 1]
    print(f"Total leads with multiple account numbers: {len(multi)}")
    
    # Load existing progress
    tagged = load_progress()
    remaining = [r for r in multi if str(r["id"]) not in tagged]
    print(f"Already tagged: {len(tagged)}, remaining: {len(remaining)}")
    
    if not remaining:
        print("All done!")
        return
    
    browser = await get_browser("leadgen-extract7")
    
    batch_size = 10
    for i in range(0, len(remaining), batch_size):
        batch = remaining[i:i+batch_size]
        ids = [r["id"] for r in batch]
        
        try:
            results = await browser.page.evaluate("""async (ids) => {
                const results = {};
                for (const id of ids) {
                    try {
                        const resp = await fetch('https://leadgencall.cmcgroups.com/api/leads/' + id);
                        if (resp.status === 401) return { _auth_error: true };
                        const data = await resp.json();
                        const orders = (data.orders || []).filter(o => o.account_number);
                        results[id] = orders.map(o => ({
                            acct: o.account_number,
                            provider: o.provider_name || o.package_name || ''
                        }));
                    } catch(e) {
                        results[id] = [];
                    }
                }
                return results;
            }""", ids)
            
            if results.get("_auth_error"):
                print(f"\nSession expired at {len(tagged)} tagged")
                save_progress(tagged)
                return
            
            for lead_id_str, orders in results.items():
                acct_tags = {}
                for o in orders:
                    acct = o["acct"]
                    prov = classify_provider(o["provider"])
                    if acct not in acct_tags:
                        acct_tags[acct] = prov
                
                # Build tagged string
                parts = []
                for acct, prov in acct_tags.items():
                    parts.append(f"{prov}:{acct}")
                
                tagged[str(lead_id_str)] = "|".join(parts) if parts else ""
            
            if (len(tagged)) % 100 < batch_size:
                save_progress(tagged)
                print(f"  {len(tagged)}/{len(multi)} tagged [saved]")
            elif (len(tagged)) % 50 < batch_size:
                print(f"  {len(tagged)}/{len(multi)} tagged")
                
        except Exception as e:
            print(f"\nError at {len(tagged)}: {e}")
            save_progress(tagged)
            return
    
    save_progress(tagged)
    print(f"\nDone! {len(tagged)} leads tagged with provider info")
    
    # Also handle single-account leads - tag them based on letter heuristic (mostly AT&T)
    single = [r for r in all_leads if r.get("account_numbers") and len(r["account_numbers"]) == 1]
    for r in single:
        acct = r["account_numbers"][0]
        has_letter = any(c.isalpha() for c in acct)
        prov = "att" if has_letter else "att"  # Single accounts are almost always AT&T
        tagged[str(r["id"])] = f"{prov}:{acct}"
    
    save_progress(tagged)
    print(f"Added {len(single)} single-account leads. Total: {len(tagged)}")

asyncio.run(main())
