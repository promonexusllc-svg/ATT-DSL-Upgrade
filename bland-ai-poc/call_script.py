"""
AT&T DSL Upgrade Campaign - Bland.ai Call Script Generator
Generates customized AI call scripts per lead segment.
"""

def generate_call_task(lead: dict) -> str:
    """Generate a Bland.ai task prompt customized to the lead's profile."""
    
    biz_name = lead.get("biz_name", "your business")
    customer = lead.get("customer", "")
    packages = lead.get("all_packages", "")
    city = lead.get("city", "")
    state = lead.get("us_state", "")
    
    # Detect lead segment
    has_pots = "POTS" in packages.upper()
    has_low_speed = any(s in packages for s in ["1.5M", "25M"])
    has_mid_speed = any(s in packages for s in ["45M", "50M"])
    has_dtv = "DTV" in packages.upper() or "DIRECTV" in packages.upper()
    
    # Build the pain points
    pain_points = []
    if has_pots:
        pain_points.append("AT&T is retiring traditional copper phone lines (POTS) nationwide, which means their current phone service will be discontinued")
    if has_low_speed:
        pain_points.append("their current internet speed (1.5-25 Mbps) is significantly below what modern businesses need for card processing, cloud apps, and customer WiFi")
    elif has_mid_speed:
        pain_points.append("their current 45-50 Mbps speed may be limiting their business, especially with multiple devices and cloud services")
    
    pain_section = " AND ".join(pain_points) if pain_points else "AT&T is upgrading infrastructure in their area and they may qualify for faster, more reliable service"
    
    # Build the value proposition
    upgrade_benefits = []
    if has_low_speed or has_mid_speed:
        upgrade_benefits.append("speeds up to 1 Gbps (1000 Mbps) with AT&T Fiber — that's 40-600x faster than what they have now")
    upgrade_benefits.append("same or lower monthly cost in most cases")
    upgrade_benefits.append("no more dropped connections or slow card processing")
    if has_pots:
        upgrade_benefits.append("modern VoIP phone service to replace their copper line before it's discontinued")
    if has_dtv:
        upgrade_benefits.append("potential bundle savings on their existing DirecTV service")
    
    benefits_text = "\n".join(f"  - {b}" for b in upgrade_benefits)
    
    # First name extraction
    first_name = customer.split()[0].title() if customer else "there"
    
    task = f"""You are Alex from IMC Business Solutions, an authorized AT&T Business partner. You're calling {biz_name} in {city}, {state} about an important service upgrade.

BACKGROUND:
- This business currently has: {packages}
- Key situation: {pain_section}
- Customer name: {customer}

YOUR OBJECTIVE:
Your goal is to inform the customer about the upcoming changes, explain the upgrade benefits, and schedule an appointment with a specialist who can review their account and find them the best deal.

CONVERSATION FLOW:

1. OPENING (warm, professional):
   "Hi, is this {first_name}? Great! This is Alex calling from IMC Business Solutions — we're an authorized AT&T Business partner. I'm reaching out because we're helping businesses in {city} with some important service upgrades. Do you have just a quick minute?"

2. IDENTIFY THE PAIN (ask, don't tell):
   "I see you're currently on AT&T's legacy internet service. How has that been working for your business? Any issues with speed or reliability?"
   [Listen and acknowledge their response]

3. DELIVER THE VALUE:
   "The reason I'm calling is that AT&T has been rolling out major infrastructure upgrades in your area, and based on your location, you likely qualify for a significant upgrade. Here's what that could mean for {biz_name}:
{benefits_text}
   The best part is that many of our customers actually end up paying less than what they're paying now."

4. URGENCY (if they have POTS):
   {"'I do want to mention — AT&T is actively retiring copper phone lines, so your current landline service will be transitioning. We want to make sure you have a smooth upgrade path before any disruption to your business phone.' " if has_pots else "'These upgrade offers are available now, and I'd love to get you locked in at the current promotional rates before they change.'"}

5. CLOSE FOR APPOINTMENT:
   "What I'd like to do is schedule a quick 15-minute call with one of our specialists who can pull up your actual account, check exactly what upgrades are available at your address, and give you a no-obligation quote. Would [suggest a day this week] work for you, or is [suggest another day] better?"

6. IF THEY SAY YES:
   Collect their preferred day and time. Confirm their phone number and email for the appointment reminder.
   "Perfect! I've got you down for [day/time]. Our specialist [will call you / will be in touch]. They'll review everything and there's absolutely no obligation. Thanks so much, {first_name}!"

7. IF THEY'RE HESITANT:
   "I totally understand — you're busy running a business! This really is just a quick 15-minute review call, and honestly most of our customers are surprised by how much they can save. Can I at least send you some information by email so you can look at it when it's convenient?"

8. IF THEY SAY NO:
   "No problem at all, {first_name}. If anything changes or you start having issues with your current service, don't hesitate to reach out. Have a great day!"

TONE & RULES:
- Be warm, conversational, and professional — NOT pushy or salesy
- Listen more than you talk
- If they mention a competitor (Spectrum, Comcast, etc.), acknowledge it positively but emphasize AT&T Fiber's superior reliability and speed
- Never make specific price promises — say "in most cases" or "typically"
- If they ask technical questions you can't answer, say "That's a great question — our specialist can pull up the exact details for your address during the appointment"
- Maximum call duration: 4 minutes
- If you reach voicemail, leave a brief 20-second message and move on
"""
    return task


def generate_first_sentence(lead: dict) -> str:
    """Generate the opening line for the call."""
    customer = lead.get("customer", "")
    first_name = customer.split()[0].title() if customer else "there"
    return f"Hi, is this {first_name}? This is Alex from IMC Business Solutions, an authorized AT&T Business partner."


def generate_voicemail_message(lead: dict) -> str:
    """Generate voicemail message if the call goes to voicemail."""
    customer = lead.get("customer", "")
    biz_name = lead.get("biz_name", "your business")
    first_name = customer.split()[0].title() if customer else "there"
    
    return (
        f"Hi {first_name}, this is Alex from IMC Business Solutions, an authorized AT&T Business partner. "
        f"I'm calling about some important service upgrades available for {biz_name}. "
        f"AT&T has been upgrading infrastructure in your area and you may qualify for significantly faster internet "
        f"at the same or lower cost. I'd love to schedule a quick 15-minute review of your account. "
        f"Please give us a call back at your convenience. Thanks and have a great day!"
    )


def generate_summary_prompt() -> str:
    """Prompt for Bland.ai to generate a structured call summary."""
    return """Summarize this call with the following structure:
1. OUTCOME: One of [appointment_booked, callback_requested, interested_send_info, not_interested, wrong_number, no_answer, voicemail_left, gatekeeper_blocked]
2. APPOINTMENT: If booked, include preferred date/time
3. EMAIL: If customer provided or confirmed email
4. KEY_OBJECTIONS: Any concerns or objections raised
5. COMPETITOR_MENTIONED: If they mentioned another provider
6. NOTES: Any other important details about the business or contact
7. FOLLOW_UP: Recommended next action and timing"""


# Dispositions for call categorization
DISPOSITIONS = [
    "appointment_booked",
    "callback_requested", 
    "interested_send_info",
    "not_interested",
    "wrong_number",
    "no_answer",
    "voicemail_left",
    "gatekeeper_blocked",
    "already_upgraded",
    "business_closed",
]


if __name__ == "__main__":
    # Demo: generate script for a sample lead
    sample_lead = {
        "biz_name": "JDM ENGINE IMPORT",
        "customer": "JOHN DOE",
        "phone": "7043431988",
        "all_packages": "AT&T OFFICE@HAND (AT&T), AT&T POTS - 1 line (AT&T), AT&T UVERSE 1.5M – 25M (AT&T)",
        "city": "CHARLOTTE",
        "us_state": "NC",
    }
    print("=" * 80)
    print("SAMPLE CALL SCRIPT")
    print("=" * 80)
    print(generate_call_task(sample_lead))
    print("\n--- FIRST SENTENCE ---")
    print(generate_first_sentence(sample_lead))
    print("\n--- VOICEMAIL ---")
    print(generate_voicemail_message(sample_lead))
