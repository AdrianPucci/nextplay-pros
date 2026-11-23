"""The roster, the search the Scout agent calls, booking requests, and the contact vault.

Contact details (email, phone) live ONLY in the `contacts` table. No agent tool reads that table.
The single place they leave it is `contact_for_booker()`, which returns them only when the athlete
has accepted that booker's request.
"""
import json
import math
import sqlite3
import threading
import uuid
from datetime import datetime, timezone

from . import payout, rider as riders
from .config import DATA, DATA_DIR

DB_PATH = DATA_DIR / "app.db"  # one database per roster folder
_lock = threading.Lock()
CITIES = json.loads((DATA / "cities.json").read_text(encoding="utf-8"))

STATE_NAMES = {"AZ": "Arizona", "CA": "California", "CO": "Colorado", "CT": "Connecticut", "FL": "Florida", "GA": "Georgia",
               "IL": "Illinois", "MA": "Massachusetts", "MN": "Minnesota", "MO": "Missouri", "NC": "North Carolina", "NV": "Nevada",
               "NY": "New York", "OH": "Ohio", "OR": "Oregon", "PA": "Pennsylvania", "TN": "Tennessee", "TX": "Texas",
               "UT": "Utah", "WA": "Washington"}
# Region -> cities. Colorado follows how locals talk about it; every other city is its own metro area for now.
REGION_GROUPS = {"CO": {"Denver Metro": ["Denver", "Englewood"], "Boulder & Northern Colorado": ["Boulder", "Fort Collins"],
                        "Colorado Springs & South": ["Colorado Springs"]}}


def regions() -> dict:
    """{state: {"name": ..., "regions": {region: [cities]}}} for every state in the city list."""
    out = {}
    for city, info in CITIES.items():
        st = info["state"]
        groups = REGION_GROUPS.get(st, {})
        region = next((r for r, cs in groups.items() if city in cs), f"{city} area")
        out.setdefault(st, {"name": STATE_NAMES.get(st, st), "regions": {}})["regions"].setdefault(region, []).append(city)
    return dict(sorted(out.items(), key=lambda kv: kv[1]["name"]))


def region_of(city: str) -> str | None:
    info = CITIES.get(city)
    if not info:
        return None
    return next((r for r, cs in REGION_GROUPS.get(info["state"], {}).items() if city in cs), f"{city} area")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(reset: bool = False) -> None:
    """Create the tables and load the seed roster on first run (or when reset=True)."""
    with _lock, connect() as c:
        if reset:
            c.executescript("DROP TABLE IF EXISTS athletes; DROP TABLE IF EXISTS contacts; DROP TABLE IF EXISTS requests;")
        c.executescript("""
            CREATE TABLE IF NOT EXISTS athletes (id TEXT PRIMARY KEY, data TEXT NOT NULL, source TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS contacts (athlete_id TEXT PRIMARY KEY, email TEXT, phone TEXT);
            CREATE TABLE IF NOT EXISTS requests (
                id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL, booker_id TEXT NOT NULL, booker_name TEXT,
                org TEXT, event_type TEXT, event_date TEXT, city TEXT, budget INTEGER, message TEXT,
                status TEXT NOT NULL, screening TEXT, created TEXT, decided TEXT);
        """)
        cols = {r[1] for r in c.execute("PRAGMA table_info(requests)")}
        for col in ("event_time", "checked_in"):  # added for the commitment rules
            if col not in cols:
                c.execute(f"ALTER TABLE requests ADD COLUMN {col} TEXT")
        if c.execute("SELECT COUNT(*) FROM athletes").fetchone()[0] == 0:
            athletes = json.loads((DATA_DIR / "athletes.json").read_text(encoding="utf-8"))
            contacts = json.loads((DATA_DIR / "contacts.json").read_text(encoding="utf-8"))
            for a in athletes:
                c.execute("INSERT INTO athletes VALUES (?, ?, 'seed')", (a["id"], json.dumps(a)))
                ct = contacts[a["id"]]
                c.execute("INSERT INTO contacts VALUES (?, ?, ?)", (a["id"], ct["email"], ct["phone"]))


# ------------------------------------------------------------------ roster

def _with_rider(a: dict) -> dict:
    """Every athlete has an Event Rider. Demo athletes get a varied default until they edit theirs."""
    if "rider" not in a:
        n = int(a["id"].split("_")[1]) if a["id"].split("_")[1].isdigit() else 0
        a["rider"] = riders.seed_rider(n, a.get("sport", ""), a.get("level", "")) if n else dict(riders.EMPTY)
    a["rider"] = riders.clean(a["rider"])
    if "availability" not in a:
        n = int(a["id"].split("_")[1]) if a["id"].split("_")[1].isdigit() else 0
        a["availability"] = riders.seed_availability(n) if n else dict(riders.AVAIL_EMPTY)
    a["availability"] = riders.clean_availability(a["availability"])
    a.setdefault("photo", None)
    return a


def _save(a: dict) -> dict:
    with _lock, connect() as c:
        c.execute("UPDATE athletes SET data = ? WHERE id = ?", (json.dumps(a), a["id"]))
    return a


def update_availability(athlete_id: str, availability: dict) -> dict:
    a = get_athlete(athlete_id)
    if not a:
        raise ValueError("No such athlete")
    a["availability"] = riders.clean_availability(availability)
    return _save(a)


PHOTOS = DATA_DIR / "photos"


def save_photo(athlete_id: str, raw: bytes) -> dict:
    """Validate an uploaded image, square it up to a 3:4 portrait, and store it next to the roster."""
    import io
    from PIL import Image
    a = get_athlete(athlete_id)
    if not a:
        raise ValueError("No such athlete")
    if len(raw) > 6_000_000:
        raise ValueError("Photo is too large (max 6 MB).")
    try:
        im = Image.open(io.BytesIO(raw))
        im.verify()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise ValueError("That file isn't a photo we can read (use JPG or PNG).")
    w, h = im.size  # center-crop to 3:4, keep the top (faces)
    tw = min(w, int(h * 3 / 4))
    th = int(tw * 4 / 3)
    left = (w - tw) // 2
    im = im.crop((left, 0, left + tw, th)).resize((450, 600))
    PHOTOS.mkdir(exist_ok=True)
    name = f"{athlete_id}.jpg"
    im.save(PHOTOS / name, "JPEG", quality=85)
    a["photo"] = f"/photos/{name}?v={uuid.uuid4().hex[:6]}"
    return _save(a)


def all_athletes() -> list[dict]:
    with connect() as c:
        return [_with_rider(json.loads(r["data"])) for r in c.execute("SELECT data FROM athletes ORDER BY id")]


def get_athlete(athlete_id: str) -> dict | None:
    with connect() as c:
        row = c.execute("SELECT data FROM athletes WHERE id = ?", (athlete_id,)).fetchone()
    return _with_rider(json.loads(row["data"])) if row else None


def update_rider(athlete_id: str, rider: dict) -> dict:
    a = get_athlete(athlete_id)
    if not a:
        raise ValueError("No such athlete")
    a["rider"] = riders.clean(rider)
    with _lock, connect() as c:
        c.execute("UPDATE athletes SET data = ? WHERE id = ?", (json.dumps(a), athlete_id))
    return a


def add_athlete(profile: dict, email: str, phone: str) -> dict:
    """Save a new athlete. Contact details go to the vault table, never into the profile."""
    city = CITIES.get(profile.get("city", ""), {})
    profile = {**profile, "id": f"ath_u{uuid.uuid4().hex[:6]}", "state": city.get("state", profile.get("state", "")),
               "lat": city.get("lat"), "lon": city.get("lon")}
    with _lock, connect() as c:
        c.execute("INSERT INTO athletes VALUES (?, ?, 'user')", (profile["id"], json.dumps(profile)))
        c.execute("INSERT INTO contacts VALUES (?, ?, ?)", (profile["id"], email, phone))
    return profile


def miles(lat1, lon1, lat2, lon2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def search(sport: str | None = None, categories: list[str] | None = None, near_city: str | None = None,
           radius_miles: int | None = None, state: str | None = None, max_fee: int | None = None,
           virtual_only: bool = False, keywords: list[str] | None = None, limit: int = 12,
           day: str | None = None, time_of_day: str | None = None) -> list[dict]:
    """Plain Python filter + keyword score over the roster. Returns public fields only (no contacts)."""
    origin = CITIES.get(near_city or "")
    results = []
    for a in all_athletes():
        if sport and sport.lower() not in a["sport"].lower():
            continue
        if categories and not set(categories) & set(a["categories"]):
            continue
        if max_fee is not None and a["fee_min"] > max_fee:
            continue
        if virtual_only and not a["virtual_ok"]:
            continue
        if day and day[:3].lower() not in a["availability"]["days"]:
            continue
        if time_of_day and time_of_day not in a["availability"]["times"]:
            continue
        if state and a["state"].upper() != state.upper():
            continue
        dist = None
        if origin and a.get("lat") is not None:
            dist = round(miles(origin["lat"], origin["lon"], a["lat"], a["lon"]))
            if radius_miles is not None and dist > radius_miles and not virtual_only:
                continue  # booker wants someone local
            if dist > a["travel_miles"] and not a["virtual_ok"]:
                continue  # too far for this athlete to travel, and they don't do virtual
        text = " ".join([a["story"], a["career"], " ".join(a["topics"]), a["level"]]).lower()
        score = sum(1 for k in (keywords or []) if k.lower() in text)
        results.append({
            "id": a["id"], "name": a["name"], "sport": a["sport"], "level": a["level"],
            "city": a["city"], "state": a["state"], "distance_miles": dist,
            "categories": a["categories"], "topics": a["topics"],
            "fee_range": f"${a['fee_min']:,}-${a['fee_max']:,}", "fee_min": a["fee_min"],
            "virtual_ok": a["virtual_ok"], "keyword_hits": score, "story": a["story"],
            "availability": riders.describe_availability(a["availability"]),
        })
    results.sort(key=lambda r: (-r["keyword_hits"], r["distance_miles"] if r["distance_miles"] is not None else 9999))
    return results[:limit]


# ------------------------------------------------------------------ requests + contact vault

def create_request(athlete_id: str, booker_id: str, form: dict, status: str, screening: dict) -> dict:
    rid = f"req_{uuid.uuid4().hex[:8]}"
    with _lock, connect() as c:
        c.execute("INSERT INTO requests (id, athlete_id, booker_id, booker_name, org, event_type, event_date, city, "
                  "budget, message, status, screening, created, decided, event_time, checked_in) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            rid, athlete_id, booker_id, form.get("booker_name"), form.get("org"), form.get("event_type"),
            form.get("event_date"), form.get("city"), form.get("budget"), form.get("message"),
            status, json.dumps(screening), now(), None, form.get("event_time") or None, None))
    return get_request(rid)


def _row(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["screening"] = json.loads(d["screening"] or "{}")
    a = get_athlete(d["athlete_id"])
    d["athlete_name"] = a["name"] if a else d["athlete_id"]
    if d["status"] == "accepted":
        d["payout"] = payout.plan(d)
    return d


def check_in(rid: str, athlete_id: str) -> dict:
    """The athlete taps "I'm here". Only the booked athlete, only on an accepted booking, only once."""
    req = get_request(rid)
    if not req or req["athlete_id"] != athlete_id:
        raise PermissionError("This booking isn't yours.")
    if req["status"] != "accepted":
        raise ValueError("You can only check in to an accepted booking.")
    if req.get("checked_in"):
        raise ValueError("Already checked in.")
    from datetime import datetime
    with _lock, connect() as c:
        c.execute("UPDATE requests SET checked_in = ? WHERE id = ?", (datetime.now().isoformat(timespec="minutes"), rid))
    return get_request(rid)


def get_request(rid: str) -> dict | None:
    with connect() as c:
        r = c.execute("SELECT * FROM requests WHERE id = ?", (rid,)).fetchone()
    return _row(r) if r else None


def requests_for_athlete(athlete_id: str) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM requests WHERE athlete_id = ? ORDER BY created DESC", (athlete_id,)).fetchall()
    if not rows and get_athlete(athlete_id):  # demo: nobody opens an empty inbox
        demo_request(athlete_id)
        with connect() as c:
            rows = c.execute("SELECT * FROM requests WHERE athlete_id = ? ORDER BY created DESC", (athlete_id,)).fetchall()
    return [_row(r) for r in rows]


# Demo inbox: one realistic, already-screened request per athlete so every inbox has something to open.
# Clearly marked as demo (booker_id "demo_booker", screening.demo = true); it skips the AI call, so it costs nothing.
DEMO_BOOKERS = {
    "speaking": [("Jordan Ellis", "{city} Public Schools", "School assembly", "Our middle school is holding a spring assembly on resilience and goal setting for about 400 students. Your story would mean a lot to our kids. Could you speak for 30 minutes plus Q&A?"),
                 ("Priya Shah", "Front Range Credit Union", "Corporate keynote", "We're planning our annual all-staff kickoff (about 150 people) and want a keynote on teamwork and bouncing back from setbacks. 40 minutes, then a short meet-and-greet.")],
    "clinic": [("Coach Dana Ruiz", "{city} Youth Sports League", "Youth clinic", "We'd love you to run a two-hour Saturday clinic for about 40 kids, ages 10 to 14. Parents and coaches will be there; we'll handle the field, water, and check-in.")],
    "mentoring": [("Marcus Green", "Boys & Girls Club of {city}", "Mentoring session", "Our teen leadership group (15 students) meets weekly. Could you join one session to talk about discipline, school, and life after sports?")],
    "appearance": [("Lauren Kim", "Summit Sporting Goods", "Store appearance", "We're celebrating our store's 10-year anniversary and would love you to sign autographs and take photos with customers for two hours.")],
    "endorsement": [("Lauren Kim", "Summit Sporting Goods", "Local campaign", "We're a family-owned sporting goods store looking for a local athlete for a small spring social campaign: one photo shoot and three posts.")],
    "comedy_entertainment": [("Sam Ortiz", "Mile High Charity Gala", "Emcee", "Our children's hospital gala needs a fun, warm emcee for the evening program (about 2 hours, 300 guests).")],
}


def demo_request(athlete_id: str) -> dict:
    from datetime import timedelta
    a = get_athlete(athlete_id)
    cat = next((c for c in a.get("categories", []) if c in DEMO_BOOKERS), "speaking")
    pick = DEMO_BOOKERS[cat][sum(map(ord, athlete_id)) % len(DEMO_BOOKERS[cat])]
    city = a.get("city") or "Denver"
    lo, hi = int(a.get("fee_min") or 1000), int(a.get("fee_max") or a.get("fee_min") or 2000)
    budget = int(round(((lo + hi) / 2) / 100) * 100)
    days = 21 + sum(map(ord, athlete_id)) % 21
    date = (datetime.now() + timedelta(days=days)).date().isoformat()
    screening = {"verdict": "deliver", "demo": True, "risk_flags": [], "rule_flags": [], "rider_conflicts": [],
                 "summary": "Looks legitimate: a named organization, a clear event and audience, and no requests for money, gift cards, or off-platform payment. (Demo request.)",
                 "fee_note": f"Offer of ${budget:,} is inside your ${lo:,}–${hi:,} range.", "usage": {}}
    form = {"booker_name": pick[0], "org": pick[1].format(city=city), "event_type": pick[2], "event_date": date,
            "event_time": "10:00", "city": city, "budget": budget, "message": pick[3]}
    return create_request(athlete_id, "demo_booker", form, "pending", screening)


def requests_for_booker(booker_id: str) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM requests WHERE booker_id = ? ORDER BY created DESC", (booker_id,)).fetchall()
    out = []
    for r in rows:
        d = _row(r)
        d["contact"] = contact_for_booker(d["id"], booker_id)  # None unless accepted
        out.append(d)
    return out


def decide(rid: str, athlete_id: str, accept: bool) -> dict:
    """Only the athlete the request was sent to can accept or decline it, and only while it is pending."""
    req = get_request(rid)
    if not req or req["athlete_id"] != athlete_id:
        raise PermissionError("This request was not sent to you.")
    if req["status"] not in ("pending", "flagged"):
        raise ValueError(f"Request is already {req['status']}.")
    with _lock, connect() as c:
        c.execute("UPDATE requests SET status = ?, decided = ? WHERE id = ?",
                  ("accepted" if accept else "declined", now(), rid))
    return get_request(rid)


def contact_for_booker(rid: str, booker_id: str) -> dict | None:
    """THE ONLY WAY contact details leave the vault: an accepted request, asked for by its own booker."""
    req = get_request(rid)
    if not req or req["booker_id"] != booker_id or req["status"] != "accepted":
        return None
    with connect() as c:
        row = c.execute("SELECT email, phone FROM contacts WHERE athlete_id = ?", (req["athlete_id"],)).fetchone()
    return dict(row) if row else None
