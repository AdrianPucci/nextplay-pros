"""Next Play web server. Run with:  python run.py   (then open http://127.0.0.1:8000)

Demo sign-in is a simple picker (choose a booker name, or "sign in as" an athlete). Real accounts are a
next step; the access rules (who can see a request, when contacts unlock) are enforced here on the server.
"""
import json

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import agents, store
from .config import DAILY_SPEND_CAP_USD, STATIC
from .guards import SAFETY_LOG, USAGE_LOG, redact_contacts, spent_today

app = FastAPI(title="Next Play")
store.init_db()


class ScoutIn(BaseModel):
    text: str
    budget: int | None = Field(None, ge=0)


class StoryIn(BaseModel):
    name: str
    sport: str
    level: str
    city: str
    notes: str


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


class RequestIn(BaseModel):
    athlete_id: str
    booker_id: str
    booker_name: str
    org: str
    event_type: str
    event_date: str = ""
    city: str = ""
    budget: int | None = Field(None, ge=0)
    message: str


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


@app.get("/api/cities")
def cities():
    return sorted(store.CITIES)


@app.get("/api/opportunities")
def opportunities():
    return json.loads((store.DATA / "opportunities.json").read_text(encoding="utf-8"))


# ------------------------------------------------------------------ agents

@app.post("/api/scout")
async def scout(body: ScoutIn):
    try:
        return await agents.scout(body.text, body.budget)
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
        "travel_miles": body.travel_miles,
    }
    for k in ("story", "bio", "headline", "career"):  # never let contact details into a public profile
        profile[k], _ = redact_contacts(profile[k])
    return store.add_athlete(profile, body.email, body.phone)


# ------------------------------------------------------------------ requests

@app.post("/api/requests")
async def send_request(body: RequestIn):
    a = store.get_athlete(body.athlete_id)
    if not a:
        raise HTTPException(404, "No such athlete")
    try:
        screening = await agents.screen_request(a, body.model_dump())
    except Exception as e:  # noqa: BLE001
        _err(e)
    form = body.model_dump()
    form["message"], _ = redact_contacts(form["message"])  # off-platform contact waits until accepted
    status = {"deliver": "pending", "flag": "flagged", "block": "blocked"}[screening["verdict"]]
    return store.create_request(body.athlete_id, body.booker_id, form, status, screening)


@app.get("/api/requests/athlete/{athlete_id}")
def athlete_inbox(athlete_id: str):
    return store.requests_for_athlete(athlete_id)


@app.get("/api/requests/booker/{booker_id}")
def booker_requests(booker_id: str):
    return store.requests_for_booker(booker_id)


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
    return FileResponse(STATIC / "index.html")
