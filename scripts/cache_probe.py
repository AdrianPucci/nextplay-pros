"""Run each agent 3 times back to back and print the cache numbers the API reports.
    python scripts/cache_probe.py        -> also saved to output/cache_probe.json
"""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import agents, store
from app.config import OUTPUT

async def main():
    store.init_db()
    a = store.get_athlete("ath_001")
    rows = []
    for i in range(3):
        r = await agents.scout(f"Saturday basketball clinic for 60 kids ages 10-14 in Englewood, about $800. (run {i})", None)
        rows.append(r["usage"])
    for i in range(3):
        g = await agents.screen_request(a, {"booker_name": "Pat", "org": "Acme", "event_type": "speaking",
            "event_date": "2027-02-01", "city": "Denver", "budget": 3000, "message": f"Keynote for our team offsite #{i}."})
        rows.append(g["usage"])
    for i in range(3):
        s = await agents.build_story(f"Played D-II soccer, tore my ACL senior year, now a nurse and youth coach. Version {i}.",
                                     {"name": "Kim Lee", "sport": "Soccer", "level": "Former College", "city": "Denver"})
        rows.append(s["usage"])
    for u in rows:
        print(f"{u['agent']:14} calls {u['requests']}  in {u['input_tokens']:5}  cached {u['cached_input_tokens']:5}  "
              f"write {u['cache_write_tokens']:5}  out {u['output_tokens']:4}  ${u['cost_usd']:.6f}")
    (OUTPUT / "cache_probe.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
asyncio.run(main())
