"""NextPlay Pros web server. Run with:  python run.py   (then open http://127.0.0.1:8000)

Demo sign-in is a simple picker (choose a booker name, or "sign in as" an athlete). Real accounts are a
next step; the access rules (who can see a request, when contacts unlock) are enforced here on the server.
"""
import json

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import address, agents, rider as riders, store
from .config import DAILY_SPEND_CAP_USD, STATIC
from .guards import SAFETY_LOG, USAGE_LOG, log_safety, redact_contacts, scan_text, spent_today

app = FastAPI(title="NextPlay Pros")
store.init_db()


class ScoutIn(BaseModel):
    text: str
    budget: int | None = Field(None, ge=0)
    state: str | None = None   # the booker's location filter (start local)
    region: str | None = None


class StoryIn(BaseModel):
    name: str
    sport: str
    level: str
    city: str
    notes: str
    off_limits: str = Field("", max_length=1000)  # topics the athlete won't discuss: kept out of the profile


class PublishIn(BaseModel):
    name: str
    sport: str
    level: str
    city: str
    career: str = ""
    draft: dict
    fee_min: int = Field(ge=0)
    fee_max: int = Field(ge=0)
    virtual_ok: bool = True
    travel_miles: int = 200
    email: str
    phone: str = ""
    rider: dict | None = None
    id_document: str = ""  # data URL of a government ID: required, stored in a private vault, never shown or sent to AI


class RequestIn(BaseModel):
    athlete_id: str
    booker_id: str
    booker_name: str
    org: str
    org_type: str = ""  # school, nonprofit, company, team, community, individual
    event_address: str = Field("", max_length=300)  # checked against the U.S. Census geocoder; unverified -> red flag
    event_type: str
    event_date: str = ""
    event_time: str = ""  # start time, HH:MM (for the 60-minutes-early check-in rule)
    city: str = ""
    budget: int | None = Field(None, ge=0)
    message: str
    agreed_terms: bool = False  # booker accepted the athlete's Event Rider + the Terms
    agreed_nil: bool = False  # college athletes only: booker confirms the NIL rules (no inducements, no school marks)
    transport_offered: str = ""  # what the booker offers for transportation
    prep_call: bool = False  # booker would like a short call before the athlete commits
    prep_slots: list[str] = Field(default_factory=list, max_length=3)  # up to 3 offered times (YYYY-MM-DDTHH:MM)


class RiderIn(BaseModel):
    athlete_id: str  # demo sign-in: the athlete editing their own rider
    rider: dict


class DecideIn(BaseModel):
    athlete_id: str
    accept: bool


def _err(e: Exception):
    if isinstance(e, PermissionError):
        raise HTTPException(403, str(e))
    if isinstance(e, ValueError):
        raise HTTPException(400, str(e))
    if isinstance(e, RuntimeError):
        raise HTTPException(429 if "cap" in str(e) else 500, str(e))
    raise HTTPException(500, f"Something went wrong: {type(e).__name__}")


# ------------------------------------------------------------------ roster

@app.get("/api/athletes")
def athletes():
    return store.all_athletes()


@app.get("/api/athletes/{athlete_id}")
def athlete(athlete_id: str):
    a = store.get_athlete(athlete_id)
    if not a:
        raise HTTPException(404, "No such athlete")
    return a


@app.put("/api/athletes/{athlete_id}/rider")
def save_rider(athlete_id: str, body: RiderIn):
    if body.athlete_id != athlete_id:  # demo sign-in: you can only edit your own rider
        raise HTTPException(403, "You can only edit your own Event Rider.")
    try:
        return store.update_rider(athlete_id, body.rider)
    except ValueError as e:
        raise HTTPException(404, str(e))


class AvailabilityIn(BaseModel):
    athlete_id: str
    availability: dict


@app.put("/api/athletes/{athlete_id}/availability")
def save_availability(athlete_id: str, body: AvailabilityIn):
    if body.athlete_id != athlete_id:
        raise HTTPException(403, "You can only edit your own availability.")
    try:
        return store.update_availability(athlete_id, body.availability)
    except ValueError as e:
        raise HTTPException(404, str(e))


class PhotoIn(BaseModel):
    athlete_id: str
    data_url: str  # "data:image/jpeg;base64,..."
    slot: int = 0  # 0 = current photo, 1-2 = optional extra photos


@app.post("/api/athletes/{athlete_id}/photo")
def upload_photo(athlete_id: str, body: PhotoIn):
    import base64
    if body.athlete_id != athlete_id:
        raise HTTPException(403, "You can only change your own photo.")
    try:
        raw = base64.b64decode(body.data_url.split(",", 1)[-1], validate=True)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Couldn't read that upload.")
    try:
        return store.save_photo(athlete_id, raw, body.slot)
    except ValueError as e:
        raise HTTPException(400, str(e))


class PhotoRemoveIn(BaseModel):
    athlete_id: str
    slot: int


@app.post("/api/athletes/{athlete_id}/photo/remove")
def remove_photo(athlete_id: str, body: PhotoRemoveIn):
    if body.athlete_id != athlete_id:
        raise HTTPException(403, "You can only change your own photos.")
    try:
        return store.remove_photo(athlete_id, body.slot)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/photos/{name}")
def photo(name: str):
    path = (store.PHOTOS / name).resolve()
    if path.parent != store.PHOTOS.resolve() or not path.exists():  # no path tricks
        raise HTTPException(404, "No such photo")
    return FileResponse(path)


@app.get("/api/rider-options")
def rider_options():
    return {"security": riders.SECURITY, "accommodations": riders.ACCOMMODATIONS,
            "transport": riders.TRANSPORT, "wont_do": riders.WONT_DO,
            "days": riders.DAYS, "times": riders.TIMES}


@app.get("/api/regions")
def regions():
    return store.regions()


@app.get("/api/cities")
def cities():
    return sorted(store.CITIES)


@app.get("/api/opportunities")
def opportunities():
    path = store.DATA_DIR / "opportunities.json"
    if not path.exists():
        path = store.DATA / "opportunities.json"
    return json.loads(path.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ agents

@app.post("/api/scout")
async def scout(body: ScoutIn):
    try:
        return await agents.scout(body.text, body.budget, body.state, body.region)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.post("/api/story")
async def story(body: StoryIn):
    try:
        return await agents.build_story(body.notes, body.model_dump())
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.post("/api/athletes")
def publish(body: PublishIn):
    if body.fee_max < body.fee_min:
        raise HTTPException(400, "Max fee must be at least the min fee.")
    d = body.draft
    profile = {
        "name": body.name, "sport": body.sport, "level": body.level, "career": body.career or d.get("headline", ""),
        "city": body.city, "categories": d.get("categories", []), "topics": d.get("topics", []),
        "story": d.get("story", ""), "bio": d.get("bio", ""), "headline": d.get("headline", ""),
        "fee_min": body.fee_min, "fee_max": body.fee_max, "virtual_ok": body.virtual_ok,
        "travel_miles": body.travel_miles, "rider": riders.clean(body.rider),
    }
    for k in ("story", "bio", "headline", "career"):  # never let contact details into a public profile
        profile[k], _ = redact_contacts(profile[k])
    import base64
    if not body.id_document:
        raise HTTPException(400, "Please add a photo of your government ID. It stays private and is never shown to bookers.")
    try:
        id_raw = base64.b64decode(body.id_document.split(",", 1)[-1], validate=True)
        store.check_id_document(id_raw)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Couldn't read that ID upload.")
    a = store.add_athlete(profile, body.email, body.phone)
    return store.save_id_document(a["id"], id_raw)


# ------------------------------------------------------------------ requests

@app.post("/api/requests")
async def send_request(body: RequestIn):
    a = store.get_athlete(body.athlete_id)
    if not a:
        raise HTTPException(404, "No such athlete")
    if not body.agreed_terms:  # enforced on the server, not just the checkbox
        raise HTTPException(400, "Please agree to the athlete's Event Rider and the NextPlay Pros Terms before sending.")
    if riders.is_college(a) and not body.agreed_nil:
        raise HTTPException(400, "This is a current college athlete. Please confirm the Name, Image & Likeness (NIL) rules before sending.")
    try:
        screening = await agents.screen_request(a, body.model_dump())
    except Exception as e:  # noqa: BLE001
        _err(e)
    form = body.model_dump()
    form["message"], _ = redact_contacts(form["message"])  # off-platform contact waits until accepted
    if screening.get("verdict") != "block":  # address check: anything but a clean match is a red flag for the athlete
        screening = address.apply(screening, address.verify(body.event_address, body.city))
    status = {"deliver": "pending", "flag": "flagged", "block": "blocked"}[screening["verdict"]]
    req = store.create_request(body.athlete_id, body.booker_id, form, status, screening)
    if body.prep_call and status != "blocked" and any(body.prep_slots):
        req = store.prep_action(req["id"], "booker", body.booker_id, "request", body.prep_slots)
    return req


class PrepIn(BaseModel):
    actor: str  # "athlete" or "booker" (demo sign-in)
    actor_id: str
    action: str  # "request" (offer times), "confirm" (pick one of the other side's times), or "note"
    slots: list[str] = Field(default_factory=list, max_length=3)
    time: str = ""
    note: str = Field("", max_length=500)


@app.post("/api/requests/{rid}/prep")
def prep_call(rid: str, body: PrepIn):
    """Ask for, or confirm, a short prep call before committing. Notes get the same scam/injection screen as requests."""
    note = body.note.strip()
    if note:
        flags = [f for f in scan_text(note) if f != "contact_or_link_in_text"]
        if flags:
            log_safety("prep_note_blocked", "prep_call", {"rid": rid, "flags": flags})
            raise HTTPException(400, "That note was blocked by Gatekeeper's safety rules. Keep prep notes about the event.")
        note, removed = redact_contacts(note)
        if removed:
            log_safety("redacted_contact", "prep_call", {"rid": rid, "removed": removed})
    try:
        return store.prep_action(rid, body.actor, body.actor_id, body.action, body.slots, body.time, note)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.get("/api/requests/athlete/{athlete_id}")
def athlete_inbox(athlete_id: str):
    return store.requests_for_athlete(athlete_id)


@app.get("/api/requests/booker/{booker_id}")
def booker_requests(booker_id: str):
    return store.requests_for_booker(booker_id)


class CheckInIn(BaseModel):
    athlete_id: str


@app.post("/api/requests/{rid}/checkin")
def checkin(rid: str, body: CheckInIn):
    try:
        return store.check_in(rid, body.athlete_id)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.post("/api/requests/{rid}/decide")
def decide(rid: str, body: DecideIn):
    try:
        return store.decide(rid, body.athlete_id, body.accept)
    except Exception as e:  # noqa: BLE001
        _err(e)


# ------------------------------------------------------------------ usage + safety (evidence for the report)

def _load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


@app.get("/api/usage")
def usage():
    rows = _load(USAGE_LOG)
    by_agent = {}
    for r in rows:
        s = by_agent.setdefault(r["agent"], {"runs": 0, "input_tokens": 0, "cached_input_tokens": 0,
                                             "output_tokens": 0, "cost_usd": 0.0, "seconds": 0.0})
        s["runs"] += 1
        for k in ("input_tokens", "cached_input_tokens", "output_tokens", "cost_usd", "seconds"):
            s[k] += r.get(k, 0) or 0
    for s in by_agent.values():
        n = s["runs"]
        s.update({f"avg_{k}": round(s[k] / n, 6 if k == "cost_usd" else 1)
                  for k in ("input_tokens", "cached_input_tokens", "output_tokens", "cost_usd", "seconds")})
    return {"runs": rows[-50:][::-1], "by_agent": by_agent, "spent_today_usd": round(spent_today(), 6),
            "daily_cap_usd": DAILY_SPEND_CAP_USD}


@app.get("/api/safety")
def safety():
    return _load(SAFETY_LOG)[-100:][::-1]


# ------------------------------------------------------------------ front end

app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})
