"""
AT&T DSL Upgrade — Lock Lead ISP Verification Tool
====================================================
Run this on your Windows 11 machine to automate ISP availability checks
for all 256 Lock-classified leads.

Requirements:
  - Python 3.10+ (https://python.org/downloads/)
  - Google Chrome installed
  - Run: pip install selenium webdriver-manager requests

Usage:
  python att_lock_lead_checker.py

What it does:
  1. Pulls all Lock leads from your database
  2. Opens each ISP serviceability checker in Chrome
  3. Auto-fills the address
  4. Waits for you to confirm the result (or auto-captures when possible)
  5. Saves results to a CSV file on your desktop
"""

import json
import time
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("\n❌ Missing required packages. Run this command first:")
    print("   pip install selenium webdriver-manager requests\n")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("\n❌ Missing 'requests' package. Run: pip install requests\n")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

CONVEX_URL = "https://compassionate-wolverine-985.convex.cloud"

# ISP Checkers - each with URL and auto-fill strategy
ISP_PROVIDERS = {
    "att": {
        "name": "AT&T Business",
        "url": "https://www.att.com/availability/",
        "icon": "🔵",
    },
    "comcast": {
        "name": "Comcast Business",
        "url": "https://business.comcast.com/shop/gateway",
        "icon": "🟣",
    },
    "spectrum": {
        "name": "Spectrum Business",
        "url": "https://business.spectrum.com/buy/internet",
        "icon": "🔴",
    },
    "frontier": {
        "name": "Frontier Business",
        "url": "https://business.frontier.com/availability",
        "icon": "🟢",
    },
    "optimum": {
        "name": "Optimum Business",
        "url": "https://business.optimum.com/",
        "icon": "🟡",
    },
}

# Results file location (Desktop)
DESKTOP = Path.home() / "Desktop"
RESULTS_FILE = DESKTOP / f"isp_verification_results_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

# ═══════════════════════════════════════════════════════════════════
# DATABASE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def fetch_lock_leads():
    """Fetch all Lock-classified leads from Convex."""
    print("\n📡 Fetching Lock leads from database...")

    # Use Convex HTTP action to query leads
    url = f"{CONVEX_URL}/api/query"
    payload = {
        "path": "leads:list",
        "args": {
            "heatClassification": "Lock",
            "sortBy": "recommended",
            "showClosed": False,
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            leads = data.get("value", {}).get("leads", [])
            print(f"✅ Found {len(leads)} Lock leads")
            return leads
        else:
            print(f"⚠️  API returned status {resp.status_code}")
            print("   Falling back to local CSV method...")
            return None
    except Exception as e:
        print(f"⚠️  Could not reach database: {e}")
        print("   Falling back to local CSV method...")
        return None


def load_leads_from_csv():
    """Fallback: load leads from a local CSV file."""
    csv_path = input("\n📁 Enter path to your CSV file (or drag & drop): ").strip().strip('"')
    if not os.path.exists(csv_path):
        print(f"❌ File not found: {csv_path}")
        sys.exit(1)

    leads = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            leads.append({
                "bizName": row.get("biz_name", row.get("bizName", "")),
                "address": row.get("address", ""),
                "city": row.get("city", ""),
                "state": row.get("state", ""),
                "zip": row.get("zip", ""),
                "customer": row.get("customer", ""),
                "phone": row.get("phone", ""),
                "conversionScore": row.get("conversionScore", ""),
            })
    print(f"✅ Loaded {len(leads)} leads from CSV")
    return leads


# ═══════════════════════════════════════════════════════════════════
# BROWSER AUTOMATION
# ═══════════════════════════════════════════════════════════════════

def setup_chrome():
    """Set up Chrome browser with optimal settings."""
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # Don't use headless — we need the human to see and verify results
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    # Remove webdriver flag to reduce bot detection
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """
    })

    return driver


def copy_to_clipboard(driver, text):
    """Copy text to system clipboard via JS."""
    # Use a temporary textarea to copy
    escaped = text.replace("'", "\\'").replace("\n", "\\n")
    driver.execute_script(f"""
        const ta = document.createElement('textarea');
        ta.value = '{escaped}';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    """)


def check_att(driver, address, wait):
    """Check AT&T availability."""
    driver.get("https://www.att.com/availability/")
    time.sleep(3)

    try:
        # Find address input
        addr_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[data-testid='addressInput'], input[placeholder*='address' i], input[id*='address' i], input[type='text']")
        ))
        addr_input.clear()
        addr_input.send_keys(address)
        time.sleep(2)

        # Try to click autocomplete suggestion
        try:
            suggestion = wait.until(EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "li[role='option'], .pac-item, [class*='suggestion'], [class*='autocomplete'] li")
            ))
            suggestion.click()
        except TimeoutException:
            addr_input.send_keys(Keys.ARROW_DOWN)
            time.sleep(0.5)
            addr_input.send_keys(Keys.ENTER)

        time.sleep(2)

        # Click check availability button
        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[data-testid='submitButton'], button[type='submit']")
            btn.click()
        except NoSuchElementException:
            addr_input.send_keys(Keys.ENTER)

        return True
    except Exception as e:
        print(f"    ⚠️  AT&T auto-fill failed: {e}")
        return False


def check_comcast(driver, address, wait):
    """Check Comcast Business availability."""
    driver.get("https://business.comcast.com/shop/gateway")
    time.sleep(4)

    # Close popup if present
    try:
        close_btn = driver.find_element(By.CSS_SELECTOR, "button[class*='No thanks'], button[aria-label*='close' i]")
        close_btn.click()
        time.sleep(1)
    except NoSuchElementException:
        pass

    try:
        addr_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input")
        ))
        addr_input.clear()
        addr_input.send_keys(address)
        time.sleep(3)

        # Try autocomplete
        try:
            addr_input.send_keys(Keys.ARROW_DOWN)
            time.sleep(0.5)
            addr_input.send_keys(Keys.ENTER)
        except Exception:
            pass

        time.sleep(2)

        # Click check availability
        try:
            btn = driver.find_element(By.XPATH, "//button[contains(text(), 'CHECK AVAILABILITY')]")
            btn.click()
        except NoSuchElementException:
            pass

        return True
    except Exception as e:
        print(f"    ⚠️  Comcast auto-fill failed: {e}")
        return False


def check_spectrum(driver, address, wait):
    """Check Spectrum Business availability."""
    driver.get("https://business.spectrum.com/buy/internet")
    time.sleep(3)

    try:
        addr_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[placeholder*='address' i], input[type='text'], input[id*='address' i]")
        ))
        addr_input.clear()
        addr_input.send_keys(address)
        time.sleep(2)

        try:
            addr_input.send_keys(Keys.ARROW_DOWN)
            time.sleep(0.5)
            addr_input.send_keys(Keys.ENTER)
        except Exception:
            pass

        time.sleep(1)

        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], button[class*='search']")
            btn.click()
        except NoSuchElementException:
            addr_input.send_keys(Keys.ENTER)

        return True
    except Exception as e:
        print(f"    ⚠️  Spectrum auto-fill failed: {e}")
        return False


def check_frontier(driver, address, wait):
    """Check Frontier Business availability."""
    driver.get("https://business.frontier.com/availability")
    time.sleep(3)

    try:
        addr_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[placeholder*='address' i], input[type='text'], input[id*='address' i]")
        ))
        addr_input.clear()
        addr_input.send_keys(address)
        time.sleep(2)

        try:
            addr_input.send_keys(Keys.ARROW_DOWN)
            time.sleep(0.5)
            addr_input.send_keys(Keys.ENTER)
        except Exception:
            pass

        time.sleep(1)

        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            btn.click()
        except NoSuchElementException:
            addr_input.send_keys(Keys.ENTER)

        return True
    except Exception as e:
        print(f"    ⚠️  Frontier auto-fill failed: {e}")
        return False


def check_optimum(driver, address, wait):
    """Check Optimum Business availability."""
    driver.get("https://business.optimum.com/")
    time.sleep(3)

    try:
        addr_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[placeholder*='address' i], input[type='text']")
        ))
        addr_input.clear()
        addr_input.send_keys(address)
        time.sleep(2)

        try:
            addr_input.send_keys(Keys.ARROW_DOWN)
            time.sleep(0.5)
            addr_input.send_keys(Keys.ENTER)
        except Exception:
            pass

        time.sleep(1)

        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            btn.click()
        except NoSuchElementException:
            addr_input.send_keys(Keys.ENTER)

        return True
    except Exception as e:
        print(f"    ⚠️  Optimum auto-fill failed: {e}")
        return False


ISP_CHECK_FUNCTIONS = {
    "att": check_att,
    "comcast": check_comcast,
    "spectrum": check_spectrum,
    "frontier": check_frontier,
    "optimum": check_optimum,
}


# ═══════════════════════════════════════════════════════════════════
# RESULT COLLECTION
# ═══════════════════════════════════════════════════════════════════

def get_user_result():
    """Prompt the user to record what they see on the ISP checker page."""
    print("\n    ┌──────────────────────────────────────────┐")
    print("    │  What do you see on the ISP checker?     │")
    print("    │                                          │")
    print("    │  [1] Available - No existing account     │")
    print("    │  [2] Available - Has existing account    │")
    print("    │  [3] Not Available at this address       │")
    print("    │  [4] Page error / couldn't check         │")
    print("    │  [5] Skip this provider                  │")
    print("    │  [Q] Quit checking this lead             │")
    print("    └──────────────────────────────────────────┘")

    while True:
        choice = input("    Your choice (1-5 or Q): ").strip().upper()
        if choice == "1":
            return "available_no_account"
        elif choice == "2":
            return "available_has_account"
        elif choice == "3":
            return "not_available"
        elif choice == "4":
            return "error"
        elif choice == "5":
            return "skipped"
        elif choice == "Q":
            return "quit_lead"
        else:
            print("    ⚠️  Enter 1, 2, 3, 4, 5, or Q")


# ═══════════════════════════════════════════════════════════════════
# MAIN WORKFLOW
# ═══════════════════════════════════════════════════════════════════

def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🔒 AT&T DSL Upgrade — Lock Lead ISP Verification Tool     ║
║                                                              ║
║   Automates ISP availability checks for your Lock leads     ║
║   through AT&T, Comcast, Spectrum, Frontier & Optimum       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """)


def select_providers():
    """Let user choose which ISP providers to check."""
    print("\n📋 Which ISP providers do you want to check?")
    print("   [A] All 5 providers (AT&T, Comcast, Spectrum, Frontier, Optimum)")
    print("   [S] Select specific providers")
    print()

    choice = input("   Your choice (A/S): ").strip().upper()

    if choice == "S":
        selected = []
        for key, info in ISP_PROVIDERS.items():
            yn = input(f"   Include {info['icon']} {info['name']}? (Y/N): ").strip().upper()
            if yn == "Y":
                selected.append(key)
        return selected
    else:
        return list(ISP_PROVIDERS.keys())


def main():
    print_banner()

    # 1. Load leads
    leads = fetch_lock_leads()
    if leads is None:
        leads = load_leads_from_csv()

    if not leads:
        print("❌ No leads found. Exiting.")
        sys.exit(1)

    # 2. Select providers
    providers = select_providers()
    if not providers:
        print("❌ No providers selected. Exiting.")
        sys.exit(1)

    provider_names = [ISP_PROVIDERS[p]["name"] for p in providers]
    print(f"\n✅ Will check {len(leads)} leads against: {', '.join(provider_names)}")

    # 3. Check for existing results file to resume
    completed = set()
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = f"{row.get('business_name', '')}|{row.get('provider', '')}"
                completed.add(key)
        print(f"📁 Found existing results file with {len(completed)} entries — will resume from where you left off")

    # 4. Set up Chrome
    print("\n🌐 Launching Chrome browser...")
    driver = setup_chrome()
    wait = WebDriverWait(driver, 10)

    # 5. Open results CSV for appending
    file_exists = RESULTS_FILE.exists()
    results_csv = open(RESULTS_FILE, 'a', newline='', encoding='utf-8')
    writer = csv.DictWriter(results_csv, fieldnames=[
        "timestamp", "business_name", "customer", "address", "city", "state", "zip",
        "phone", "score", "provider", "result", "notes"
    ])
    if not file_exists:
        writer.writeheader()

    # 6. Process each lead
    total = len(leads)
    quit_all = False

    try:
        for i, lead in enumerate(leads):
            if quit_all:
                break

            biz = lead.get("bizName", lead.get("biz_name", "Unknown"))
            addr = lead.get("address", "")
            city = lead.get("city", "")
            state = lead.get("state", "")
            zip_code = lead.get("zip", "")
            full_address = f"{addr}, {city}, {state} {zip_code}"
            score = lead.get("conversionScore", "?")

            print(f"\n{'='*60}")
            print(f"  📍 Lead {i+1}/{total}: {biz}")
            print(f"  📫 {full_address}")
            print(f"  📊 Score: {score}")
            print(f"{'='*60}")

            # Copy address to clipboard for manual paste if needed
            try:
                copy_to_clipboard(driver, full_address)
                print(f"  📋 Address copied to clipboard")
            except Exception:
                pass

            for provider_key in providers:
                check_key = f"{biz}|{ISP_PROVIDERS[provider_key]['name']}"
                if check_key in completed:
                    print(f"\n  ⏭️  {ISP_PROVIDERS[provider_key]['icon']} {ISP_PROVIDERS[provider_key]['name']} — already checked, skipping")
                    continue

                provider_info = ISP_PROVIDERS[provider_key]
                print(f"\n  {provider_info['icon']} Checking {provider_info['name']}...")

                # Auto-fill the address
                check_fn = ISP_CHECK_FUNCTIONS.get(provider_key)
                if check_fn:
                    success = check_fn(driver, full_address, wait)
                    if success:
                        print(f"    ✅ Address auto-filled — waiting for page to load...")
                    else:
                        print(f"    📋 Address is on clipboard — paste it manually")

                # Wait for page to load
                time.sleep(5)

                # Get user's assessment
                result = get_user_result()

                if result == "quit_lead":
                    print(f"\n  ⏭️  Skipping remaining providers for {biz}")
                    break

                # Ask for optional notes
                notes = ""
                if result == "available_has_account":
                    notes = input("    📝 Account info / notes (or Enter to skip): ").strip()
                elif result in ("available_no_account", "not_available"):
                    notes_in = input("    📝 Any notes? (or Enter to skip): ").strip()
                    if notes_in:
                        notes = notes_in

                # Save result
                row = {
                    "timestamp": datetime.now().isoformat(),
                    "business_name": biz,
                    "customer": lead.get("customer", ""),
                    "address": addr,
                    "city": city,
                    "state": state,
                    "zip": zip_code,
                    "phone": lead.get("phone", ""),
                    "score": score,
                    "provider": provider_info["name"],
                    "result": result,
                    "notes": notes,
                }
                writer.writerow(row)
                results_csv.flush()

                result_display = {
                    "available_no_account": "✅ Available (No Account)",
                    "available_has_account": "⚠️  Has Existing Account",
                    "not_available": "❌ Not Available",
                    "error": "⚠️  Error",
                    "skipped": "⏭️  Skipped",
                }
                print(f"    → {result_display.get(result, result)}")

            # After all providers for this lead
            print(f"\n  ✓ Done with {biz}")

            # Ask if user wants to continue
            if i < total - 1:
                cont = input(f"\n  Continue to next lead? (Y/N/J=Jump to #): ").strip().upper()
                if cont == "N":
                    quit_all = True
                elif cont.startswith("J"):
                    try:
                        jump_to = int(cont.replace("J", "").strip()) - 1
                        if 0 <= jump_to < total:
                            leads = leads[jump_to:]
                            print(f"  ⏭️  Jumping to lead #{jump_to + 1}")
                    except ValueError:
                        pass

    except KeyboardInterrupt:
        print("\n\n⚡ Interrupted by user")
    finally:
        results_csv.close()
        print(f"\n{'='*60}")
        print(f"  📁 Results saved to: {RESULTS_FILE}")
        print(f"{'='*60}")

        keep = input("\n  Keep browser open? (Y/N): ").strip().upper()
        if keep != "Y":
            driver.quit()

    print("\n✅ Done! Import the CSV results back into the dashboard when ready.")
    print(f"   File: {RESULTS_FILE}\n")


if __name__ == "__main__":
    main()
