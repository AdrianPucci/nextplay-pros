"""Quick end-to-end check of the three agents (uses real gpt-6-luna calls, a fraction of a cent)."""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import agents, store

async def main():
    store.init_db()
    r = await agents.scout("Keynote for 250 credit-union employees in Denver in January about bouncing back "
                           "from setbacks. Budget $5,000.", None)
    print("SCOUT brief:", r["brief"]); print("note:", r["note"]); print("dropped:", r["dropped"])
    for m in r["matches"]:
        print(f"  {m['fit_score']}/10 {m['athlete']['name']} (${m['athlete']['fee_min']}) - {m['why']}")
    print("usage:", r["usage"])
    s = await agents.build_story("played d2 soccer at regis, tore my acl senior year, now i coach u12 girls and "
                                 "work as a nurse. want to talk to schools about injuries and nursing. "
                                 "email me at kim@gmail.com", {"name": "Kim Lee", "sport": "Soccer",
                                 "level": "Former College", "city": "Denver"})
    print("\nSTORY:", json.dumps(s["draft"], indent=1)); print("usage:", s["usage"])
    a = store.get_athlete("ath_005")
    g = await agents.screen_request(a, {"booker_name": "Ted", "org": "Prime Talent LLC", "event_type": "appearance",
        "event_date": "2026-12-01", "city": "Denver", "budget": 5000, "message": "Congrats! You're selected for a "
        "paid ad. Just pay the $150 processing fee by gift card today and send me your home address."})
    print("\nGATE scam:", g["verdict"], g["risk_flags"], g["rule_flags"], "| model said:", g["model_verdict"])
    g2 = await agents.screen_request(a, {"booker_name": "Pat Ruiz", "org": "Fort Collins Running Co.",
        "event_type": "appearance", "event_date": "2027-01-10", "city": "Fort Collins", "budget": 500,
        "message": "We'd love you at our store's 10th anniversary 5K: start the race, sign posters for an hour."})
    print("GATE legit:", g2["verdict"], g2["summary"], "|", g2["fee_note"])

asyncio.run(main())
