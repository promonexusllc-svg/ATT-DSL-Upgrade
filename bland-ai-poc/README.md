# AT&T DSL Upgrade — AI Calling POC (Bland.ai)

## Overview
Automated AI phone calling system for the AT&T DSL upgrade campaign. Uses Bland.ai to call prioritized leads, deliver a customized upgrade pitch, and book appointments with sales specialists.

## Quick Start

### 1. Sign up for Bland.ai (free)
- Go to [app.bland.ai](https://app.bland.ai)
- Create account (no credit card needed)
- Copy your API key from Settings → API Keys

### 2. Set your API key
```bash
export BLAND_API_KEY="sk-your-key-here"
```

### 3. Test with your own phone first
```bash
cd bland-ai-poc
python bland_caller.py --test --test-phone +1XXXXXXXXXX
```
This sends one test call to YOUR phone so you can hear the script before deploying.

### 4. Preview the call list (dry run)
```bash
python bland_caller.py --dry-run --limit 50
```
Shows which 50 leads would be called, without actually calling.

### 5. Launch the campaign
```bash
python bland_caller.py --run --limit 50
```
Dispatches calls to the top 50 leads. You'll see a cost estimate and confirmation prompt.

### 6. Check results
```bash
python bland_caller.py --results
```
Shows call outcomes, dispositions, and appointments booked.

## Files

| File | Purpose |
|------|---------|
| `call_script.py` | Generates customized call scripts per lead segment |
| `bland_caller.py` | Main campaign runner — dispatches calls, tracks results |
| `results/call_log.json` | Call results and disposition tracking |
| `README.md` | This file |

## How It Works

### Lead Prioritization
Leads are scored and sorted by urgency:
- **+20 pts**: Has POTS line (AT&T retiring copper — highest urgency)
- **+15 pts**: Speeds 1.5-25 Mbps (extreme pain point)
- **+10 pts**: Speeds 45-50 Mbps (moderate pain)
- **+8 pts**: Retention department (at risk of churning)
- **+5 pts**: Verified data / has email
- **+3 pts**: Has secondary phone
- **+2 pts**: Never been called

### Call Script Segments
The AI adapts its pitch based on the lead's current services:
- **POTS + Low Speed**: Emphasizes urgency (copper retirement) + massive speed upgrade
- **Low Speed Only**: Focuses on business impact of slow internet
- **Mid Speed**: Positions as optimization opportunity
- **DirecTV Bundle**: Highlights potential bundle savings

### Dispositions
Each call is categorized:
- `appointment_booked` — 🎯 Primary goal
- `callback_requested` — Schedule follow-up
- `interested_send_info` — Send email with details
- `not_interested` — Mark and move on
- `voicemail_left` — Follow up in 2-3 days
- `wrong_number` / `business_closed` — Flag for data cleanup

## Configuration

Edit the top of `bland_caller.py`:

```python
VOICE = "mason"              # Voice: "mason", "maya", "josh", etc.
MAX_DURATION = 4             # Max call length in minutes
TRANSFER_PHONE_NUMBER = ""   # Set to closer's number for hot transfer
WEBHOOK_URL = ""             # Set for real-time result streaming
```

## Cost Estimate (Free Tier)
- **Free plan**: 100 calls/day, $0.14/min
- **50-call POC**: ~$14 (assuming avg 2 min/call)
- **Full 6,237 leads**: ~$1,746 on free tier, ~$1,497 on Build plan ($299/mo + $0.12/min)

## Next Steps After POC
1. Review call recordings and dispositions
2. Follow up on appointments booked
3. Tune the script based on common objections
4. Scale to Build plan for 2,000 calls/day
5. Add webhook integration to auto-update pipeline tracker
