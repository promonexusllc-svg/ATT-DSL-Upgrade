"""
AT&T DSL Upgrade Campaign - Bland.ai Integration
Dispatches AI calls to leads and tracks results.

Usage:
  1. Set your API key:  export BLAND_API_KEY="sk-..."
  2. Test with 1 call:  python bland_caller.py --test
  3. Run top 50 POC:    python bland_caller.py --run --limit 50
  4. Check results:     python bland_caller.py --results
"""

import os
import sys
import csv
import json
import time
import argparse
import requests
from datetime import datetime, timezone
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────

BLAND_API_KEY = os.environ.get("BLAND_API_KEY", "")
BLAND_BASE_URL = "https://api.bland.ai/v1"
LEADS_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "leadgen_att_dsl_leads.csv")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
CALL_LOG_FILE = os.path.join(RESULTS_DIR, "call_log.json")

# Call settings
VOICE = "mason"  # Professional male voice — change to "maya" for female
MAX_DURATION = 4  # minutes
WAIT_FOR_GREETING = True
RECORD = True
NOISE_CANCELLATION = True

# Transfer number — set this to Eric's or the closer's direct line
TRANSFER_PHONE_NUMBER = ""  # e.g., "+15551234567"

# Webhook URL — set this if you have a server to receive call results in real-time
WEBHOOK_URL = ""

# ─── Import call script generator ────────────────────────────────────────────

from call_script import (
    generate_call_task,
    generate_first_sentence,
    generate_voicemail_message,
    generate_summary_prompt,
    DISPOSITIONS,
)


# ─── Lead Selection ──────────────────────────────────────────────────────────

def load_leads(csv_path: str = LEADS_CSV) -> list[dict]:
    """Load all leads from CSV."""
    with open(csv_path, "r") as f:
        return list(csv.DictReader(f))


def score_lead(lead: dict) -> int:
    """Score a lead for call priority (higher = call first)."""
    score = 0
    pkgs = lead.get("all_packages", "").upper()
    
    # POTS = urgent (AT&T discontinuing copper)
    if "POTS" in pkgs:
        score += 20
    
    # Low speed = high pain
    if "1.5M" in pkgs or "1.5M-25M" in pkgs:
        score += 15
    elif "45M" in pkgs or "50M" in pkgs:
        score += 10
    
    # Retention department = at risk
    if lead.get("fg_department") == "Retention":
        score += 8
    elif lead.get("fg_department") == "Verification":
        score += 5
    
    # Has email (can follow up)
    if lead.get("email", "").strip():
        score += 5
    
    # Has secondary phone
    if lead.get("secondary_phone", "").strip():
        score += 3
    
    # Never called = fresh
    if lead.get("call_attempts", "0") == "0":
        score += 2
    
    return score


def select_top_leads(leads: list[dict], limit: int = 50) -> list[dict]:
    """Select top N leads by priority score."""
    # Filter: callable, not bad phone, has phone, status=new
    candidates = [
        l for l in leads
        if l.get("callable") == "True"
        and l.get("bad_phone") == "False"
        and l.get("phone", "").strip()
        and l.get("lead_status") == "new"
    ]
    
    for c in candidates:
        c["_score"] = score_lead(c)
    
    candidates.sort(key=lambda x: x["_score"], reverse=True)
    return candidates[:limit]


# ─── Bland.ai API ────────────────────────────────────────────────────────────

def format_phone_e164(phone: str) -> str:
    """Format phone number to E.164 format."""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"


def send_call(lead: dict) -> dict:
    """Send a single AI call via Bland.ai."""
    if not BLAND_API_KEY:
        raise ValueError("BLAND_API_KEY environment variable not set. Get yours at https://app.bland.ai")
    
    phone = format_phone_e164(lead["phone"])
    task = generate_call_task(lead)
    first_sentence = generate_first_sentence(lead)
    voicemail_msg = generate_voicemail_message(lead)
    summary_prompt = generate_summary_prompt()
    
    payload = {
        "phone_number": phone,
        "task": task,
        "first_sentence": first_sentence,
        "voice": VOICE,
        "model": "enhanced",
        "language": "en-US",
        "wait_for_greeting": WAIT_FOR_GREETING,
        "max_duration": MAX_DURATION,
        "record": RECORD,
        "noise_cancellation": NOISE_CANCELLATION,
        "temperature": 0.7,
        "interruption_threshold": 100,
        "voicemail": {
            "voicemail_action": "leave_message",
            "voicemail_message": voicemail_msg,
        },
        "summary_prompt": summary_prompt,
        "dispositions": DISPOSITIONS,
        "metadata": {
            "lead_id": lead.get("id", ""),
            "biz_name": lead.get("biz_name", ""),
            "campaign": "att_dsl_upgrade_poc",
        },
    }
    
    # Add transfer number if configured
    if TRANSFER_PHONE_NUMBER:
        payload["transfer_phone_number"] = TRANSFER_PHONE_NUMBER
    
    # Add webhook if configured
    if WEBHOOK_URL:
        payload["webhook"] = WEBHOOK_URL
    
    headers = {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
    }
    
    response = requests.post(
        f"{BLAND_BASE_URL}/calls",
        json=payload,
        headers=headers,
    )
    
    result = response.json()
    result["_lead_id"] = lead.get("id", "")
    result["_biz_name"] = lead.get("biz_name", "")
    result["_phone"] = phone
    result["_sent_at"] = datetime.now(timezone.utc).isoformat()
    
    return result


def get_call_details(call_id: str) -> dict:
    """Retrieve call details and transcript from Bland.ai."""
    headers = {"Authorization": BLAND_API_KEY}
    response = requests.get(f"{BLAND_BASE_URL}/calls/{call_id}", headers=headers)
    return response.json()


def get_call_transcript(call_id: str) -> dict:
    """Retrieve call transcript."""
    headers = {"Authorization": BLAND_API_KEY}
    response = requests.get(f"{BLAND_BASE_URL}/calls/{call_id}/transcript", headers=headers)
    return response.json()


# ─── Results Tracking ────────────────────────────────────────────────────────

def load_call_log() -> list[dict]:
    """Load existing call log."""
    if os.path.exists(CALL_LOG_FILE):
        with open(CALL_LOG_FILE, "r") as f:
            return json.load(f)
    return []


def save_call_log(log: list[dict]):
    """Save call log."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(CALL_LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)


def check_results():
    """Check results for all dispatched calls."""
    log = load_call_log()
    if not log:
        print("No calls dispatched yet.")
        return
    
    print(f"\n{'='*80}")
    print(f"  AT&T DSL UPGRADE — AI CALLING RESULTS")
    print(f"  {len(log)} calls dispatched")
    print(f"{'='*80}\n")
    
    completed = 0
    dispositions = {}
    
    for entry in log:
        call_id = entry.get("call_id")
        if not call_id:
            continue
        
        try:
            details = get_call_details(call_id)
            entry["_status"] = details.get("queue_status", "unknown")
            entry["_completed"] = details.get("completed", False)
            entry["_answered_by"] = details.get("answered_by", "unknown")
            entry["_duration"] = details.get("call_length", 0)
            entry["_disposition"] = details.get("disposition_tag", "")
            entry["_summary"] = details.get("summary", "")
            
            if details.get("completed"):
                completed += 1
                disp = details.get("disposition_tag", "unknown")
                dispositions[disp] = dispositions.get(disp, 0) + 1
            
            status_icon = "✅" if details.get("completed") else "⏳"
            disp_text = details.get("disposition_tag", "pending")
            duration = details.get("call_length", 0)
            
            print(f"  {status_icon} {entry.get('_biz_name', 'Unknown'):<35} "
                  f"{disp_text:<25} {duration:.1f}min  "
                  f"({details.get('answered_by', '?')})")
            
        except Exception as e:
            print(f"  ❌ {entry.get('_biz_name', 'Unknown'):<35} Error: {e}")
    
    # Save updated log
    save_call_log(log)
    
    # Summary
    print(f"\n{'─'*80}")
    print(f"  SUMMARY: {completed}/{len(log)} completed")
    if dispositions:
        print(f"\n  Dispositions:")
        for disp, count in sorted(dispositions.items(), key=lambda x: -x[1]):
            pct = count / completed * 100 if completed else 0
            print(f"    {disp:<30} {count:>3} ({pct:.0f}%)")
    
    # Appointments
    appointments = [e for e in log if e.get("_disposition") == "appointment_booked"]
    if appointments:
        print(f"\n  🎯 APPOINTMENTS BOOKED: {len(appointments)}")
        for a in appointments:
            print(f"    • {a.get('_biz_name')} — {a.get('_phone')}")
            if a.get("_summary"):
                print(f"      {a['_summary'][:100]}...")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AT&T DSL Upgrade — Bland.ai Caller")
    parser.add_argument("--test", action="store_true", help="Test with a single call (your phone)")
    parser.add_argument("--test-phone", type=str, help="Phone number for test call (E.164 format)")
    parser.add_argument("--run", action="store_true", help="Run the campaign on top leads")
    parser.add_argument("--limit", type=int, default=50, help="Number of leads to call (default: 50)")
    parser.add_argument("--results", action="store_true", help="Check call results")
    parser.add_argument("--delay", type=int, default=2, help="Seconds between calls (default: 2)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be called without calling")
    args = parser.parse_args()
    
    if args.results:
        check_results()
        return
    
    if args.test:
        if not args.test_phone:
            print("❌ Please provide --test-phone YOUR_PHONE_NUMBER for the test call")
            print("   Example: python bland_caller.py --test --test-phone +15551234567")
            sys.exit(1)
        
        print(f"📞 Sending test call to {args.test_phone}...")
        test_lead = {
            "id": "TEST",
            "biz_name": "TEST CALL",
            "customer": "Eric",
            "phone": args.test_phone,
            "all_packages": "AT&T POTS - 1 line (AT&T), AT&T UVERSE 1.5M – 25M (AT&T)",
            "city": "Dallas",
            "us_state": "TX",
            "email": "test@example.com",
        }
        result = send_call(test_lead)
        print(f"  Result: {json.dumps(result, indent=2)}")
        
        if result.get("status") == "success":
            print(f"\n✅ Test call dispatched! Call ID: {result.get('call_id')}")
            print("   Your phone should ring within 30 seconds.")
            print(f"   Check results: python bland_caller.py --results")
            
            log = load_call_log()
            log.append(result)
            save_call_log(log)
        else:
            print(f"\n❌ Call failed: {result.get('message', 'Unknown error')}")
        return
    
    if args.run or args.dry_run:
        print(f"📋 Loading leads from {LEADS_CSV}...")
        leads = load_leads()
        top_leads = select_top_leads(leads, limit=args.limit)
        print(f"   Selected {len(top_leads)} leads (sorted by priority score)\n")
        
        if args.dry_run:
            print(f"{'#':<4} {'Business':<35} {'Phone':<15} {'City':<20} {'Score':<6}")
            print(f"{'─'*80}")
            for i, lead in enumerate(top_leads, 1):
                print(f"{i:<4} {lead['biz_name'][:34]:<35} {lead['phone']:<15} "
                      f"{lead['city'][:19]:<20} {lead.get('_score', 0):<6}")
            print(f"\n   To execute these calls: remove --dry-run flag")
            return
        
        # Confirm before calling
        print(f"⚠️  About to dispatch {len(top_leads)} AI calls.")
        print(f"   Estimated cost: ~${len(top_leads) * 0.14 * 2:.2f} (avg 2 min/call at $0.14/min)")
        confirm = input("   Type 'GO' to proceed: ")
        if confirm.strip() != "GO":
            print("   Cancelled.")
            return
        
        log = load_call_log()
        success = 0
        errors = 0
        
        for i, lead in enumerate(top_leads, 1):
            try:
                print(f"  [{i}/{len(top_leads)}] Calling {lead['biz_name'][:30]} at {lead['phone']}...", end=" ")
                result = send_call(lead)
                
                if result.get("status") == "success":
                    print(f"✅ {result.get('call_id', '')[:12]}...")
                    success += 1
                else:
                    print(f"❌ {result.get('message', 'Unknown error')}")
                    errors += 1
                
                log.append(result)
                
                # Rate limiting
                if i < len(top_leads):
                    time.sleep(args.delay)
                    
            except Exception as e:
                print(f"❌ Error: {e}")
                errors += 1
        
        save_call_log(log)
        
        print(f"\n{'='*50}")
        print(f"  ✅ Dispatched: {success}")
        print(f"  ❌ Errors: {errors}")
        print(f"  📊 Check results in ~10min: python bland_caller.py --results")
        return
    
    # No args — show help
    parser.print_help()


if __name__ == "__main__":
    main()
