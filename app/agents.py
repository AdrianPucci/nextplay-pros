"""The three NextPlay Pros agents, all on gpt-6-luna through Portkey.

  Scout          booker's plain-English request -> searches the roster with a tool -> ranked matches
  Story Builder  athlete's rough notes -> a polished public profile (no tools)
  Gatekeeper     a booking request -> deliver / flag / block before the athlete sees it (no tools)

Each agent's instructions are a fixed file in prompts/, sent first and unchanged on every call, so the
provider's prompt cache can reuse them. Every run is logged to output/usage_log.json (tokens + cost)
and output/audit_trail.json (every tool call), and Python checks the model's output before it is used.
"""
import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import CachePoint, ModelRequest, ModelResponse, ThinkingPart, ToolCallPart, ToolReturnPart
from pydantic_ai.usage import UsageLimits

from . import rider as riders, store
from .config import MODEL_NAME, OUTPUT, PROMPTS, build_model, cost_usd
from .guards import (EMAIL, PHONE, URL, append_json, check_budget, check_length, log_safety, now,
                     redact_contacts, scan_text, untrusted)

USAGE_LOG = OUTPUT / "usage_log.json"
AUDIT_TRAIL = OUTPUT / "audit_trail.json"
Category = Literal["speaking", "appearance", "clinic", "mentoring", "endorsement", "comedy_entertainment"]
LIMITS = UsageLimits(request_limit=6, tool_calls_limit=4)  # stops runaway loops

_model = None


def model():
    global _model
    if _model is None:
        _model = build_model()
    return _model


# ================================================================== output types

class Brief(BaseModel):
    event_type: str = Field(description="e.g. keynote, youth clinic, grand opening, gala emcee")
    city: str | None = None
    audience: str | None = None
    themes: list[str] = Field(default_factory=list)
    budget_max: int | None = Field(None, description="Booker's max budget in dollars, if stated")
    date: str | None = None
    virtual_ok: bool | None = None


class Match(BaseModel):
    athlete_id: str = Field(description="The id exactly as returned by search_athletes")
    fit_score: int = Field(ge=1, le=10)
    why: str = Field(description="1-2 sentences tying this athlete's real story to this event")


class ScoutResult(BaseModel):
    brief: Brief
    matches: list[Match] = Field(default_factory=list, max_length=5)
    note: str | None = Field(None, description="A follow-up question, or why there are no matches")


class ProfileDraft(BaseModel):
    headline: str
    bio: str
    story: str
    topics: list[str]
    best_fit_events: list[str]
    categories: list[Category]
    claims_to_verify: list[str] = Field(default_factory=list)


class Screening(BaseModel):
    verdict: Literal["deliver", "flag", "block"]
    risk_flags: list[str] = Field(default_factory=list)
    rider_conflicts: list[str] = Field(default_factory=list,
                                       description="Each item on the athlete's 'will NOT do' list or rider that this request conflicts with")
    summary: str
    fee_note: str


# ================================================================== agents

@dataclass
class ScoutDeps:
    budget_cap: int | None = None
    seen_ids: set = field(default_factory=set)


def _prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


_agents: dict[str, Agent] = {}


def scout_agent() -> Agent:
    if "scout" not in _agents:
        agent = Agent(model(), name="Scout", deps_type=ScoutDeps, output_type=ScoutResult,
                      instructions=_prompt("scout"), retries=2)

        def search_athletes(ctx: RunContext[ScoutDeps], categories: list[Category] | None = None,
                            sport: str | None = None, near_city: str | None = None,
                            radius_miles: int | None = None, max_fee: int | None = None,
                            virtual_only: bool = False, keywords: list[str] | None = None,
                            day: str | None = None, time_of_day: str | None = None) -> str:
            cap = ctx.deps.budget_cap
            if cap is not None:  # the booker's budget is a hard limit, whatever the model asks for
                max_fee = cap if max_fee is None else min(max_fee, cap)
            rows = store.search(sport=sport, categories=categories, near_city=near_city, radius_miles=radius_miles,
                                max_fee=max_fee, virtual_only=virtual_only, keywords=keywords,
                                day=day, time_of_day=time_of_day)
            ctx.deps.seen_ids.update(r["id"] for r in rows)
            for r in rows:
                r["story"] = untrusted("athlete profile", r["story"])
            return json.dumps(rows) if rows else "No athletes matched. Try fewer filters."

        search_athletes.__doc__ = (
            "Search the NextPlay Pros roster. Returns up to 8 athletes with public profile fields "
            "(never contact details). near_city must be one of: " + ", ".join(store.CITIES) + ". "
            "day (mon-sun) and time_of_day (morning, afternoon, evening) keep only athletes available then.")
        agent.tool(search_athletes)
        _agents["scout"] = agent
    return _agents["scout"]


def story_agent() -> Agent:
    if "story" not in _agents:
        _agents["story"] = Agent(model(), name="StoryBuilder", output_type=ProfileDraft,
                                 instructions=_prompt("story_builder"), retries=2)
    return _agents["story"]


def gatekeeper_agent() -> Agent:
    if "gate" not in _agents:
        _agents["gate"] = Agent(model(), name="Gatekeeper", output_type=Screening,
                                instructions=_prompt("gatekeeper"), retries=2)
    return _agents["gate"]


# ================================================================== logging helpers

def _short(v, limit=200) -> str:
    t = v if isinstance(v, str) else json.dumps(v, default=str)
    t = " ".join(t.split())
    return t if len(t) <= limit else t[:limit] + "..."


def _tool_calls(messages) -> list[dict]:
    results = {p.tool_call_id: p.content for m in messages if isinstance(m, ModelRequest)
               for p in m.parts if isinstance(p, ToolReturnPart)}
    def count(content) -> int:  # how many athletes the tool really returned (the preview below is cut short)
        try:
            data = json.loads(content) if isinstance(content, str) else content
            return len(data) if isinstance(data, list) else 0
        except (TypeError, ValueError):
            return 0
    return [{"tool": p.tool_name, "arguments": p.args_as_dict(), "result": _short(results.get(p.tool_call_id, "")),
             "count": count(results.get(p.tool_call_id, ""))}
            for m in messages if isinstance(m, ModelResponse)
            for p in m.parts if isinstance(p, ToolCallPart) and p.tool_name != "final_result"]


async def _run(agent: Agent, agent_name: str, prompt: str, deps=None) -> tuple:
    """Run one agent with spend + loop limits; log tokens, cost, and tool calls. Returns (output, usage, run_id)."""
    check_budget()
    run_id = uuid.uuid4().hex[:10]
    start = time.perf_counter()
    # Explicit cache breakpoint right after the fixed instructions: every run shares that prefix, so later
    # runs read it from cache at 1/10 the price. Everything that changes per run comes after the breakpoint.
    content = [f"NextPlay Pros {agent_name} task.", CachePoint(), prompt]
    result = await agent.run(content, deps=deps, usage_limits=LIMITS,
                             model_settings={"openai_prompt_cache_key": f"nextplay-{agent_name}",
                                             # Speed: these are focused tasks (rank, write, screen), so low effort is enough;
                                             # Python still enforces the roster, budget, and safety rules after every run.
                                             "openai_reasoning_effort": os.getenv("NEXTPLAY_REASONING_EFFORT", "low"),
                                             "openai_reasoning_summary": "concise"})
    u = result.usage
    messages = result.all_messages()
    reasoning = [p.content.strip() for m in messages if isinstance(m, ModelResponse)
                 for p in m.parts if isinstance(p, ThinkingPart) and p.content.strip()]
    usage = {
        "run_id": run_id, "time": now(), "agent": agent_name, "model": MODEL_NAME,
        "requests": u.requests, "tool_calls": u.tool_calls,
        "input_tokens": u.input_tokens, "cached_input_tokens": u.cache_read_tokens,
        "cache_write_tokens": u.cache_write_tokens, "output_tokens": u.output_tokens,
        "reasoning_tokens": int((u.details or {}).get("reasoning_tokens", 0)),
        "cost_usd": round(cost_usd(u.input_tokens, u.cache_read_tokens, u.cache_write_tokens, u.output_tokens), 8),
        "seconds": round(time.perf_counter() - start, 2),
    }
    append_json(USAGE_LOG, usage)
    calls = _tool_calls(messages)
    append_json(AUDIT_TRAIL, {"run_id": run_id, "time": usage["time"], "agent": agent_name,
                              "input": _short(prompt, 2000), "tool_calls": calls, "reasoning": reasoning,
                              "output": result.output.model_dump()})
    usage["_calls"], usage["_reasoning"] = calls, reasoning  # removed again by glass()
    return result.output, usage, run_id


def glass(usage: dict, steps: list[tuple[str, str]]) -> dict:
    """The Glass box shown under every AI result: the meter numbers plus a plain-English trace of the run.
    steps are (kind, text) with kind in: read, tool, check, block, done."""
    calls, reasoning = usage.pop("_calls", []), usage.pop("_reasoning", [])
    trace = [{"kind": k, "text": t} for k, t in steps if k in ("read", "block")]
    for c in calls:
        args = ", ".join(f"{k}={v}" for k, v in c["arguments"].items() if v not in (None, [], False))
        n = c.get("count", 0)
        trace.append({"kind": "tool", "text": f"{c['tool']}({args}) → {n} athlete{'s' if n != 1 else ''}" if n else f"{c['tool']}({args}) → none"})
    trace += [{"kind": k, "text": t} for k, t in steps if k not in ("read", "block")]
    return {**usage, "tools": [c["tool"] for c in calls], "reasoning": reasoning, "trace": trace}


# ================================================================== public entry points

async def scout(request_text: str, budget: int | None = None, state: str | None = None, region: str | None = None) -> dict:
    check_length(request_text, "Request")
    clean, n = redact_contacts(request_text)
    if n:
        log_safety("redacted_contacts", "scout input", {"removed": n})
    flags = scan_text(request_text)
    if "prompt_injection" in flags or "contact_harvesting" in flags:
        log_safety("blocked_input", "scout input", {"flags": flags, "text": _short(request_text)})
        return {"blocked": True, "flags": flags, "matches": [], "brief": None,
                "glass": {"agent": "scout", "blocked": True, "trace": [
                    {"kind": "block", "text": f"Python rules caught: {', '.join(flags)}. The model was never called (0 tokens)."}]},
                "note": "This request was blocked: NextPlay Pros never shares athlete contact details, "
                        "and it does not take instructions that try to change how the assistant works."}

    deps = ScoutDeps(budget_cap=budget)
    prompt = f"Booking request:\n{untrusted('booker', clean)}"
    if budget is not None:
        prompt += f"\n\nThe booker's maximum budget is ${budget:,} (set in the app form)."
    if state:  # the booker chose to start local
        cities = store.regions().get(state, {}).get("regions", {}).get(region or "", []) if region else []
        where = f"{region}, {store.STATE_NAMES.get(state, state)}" if region else store.STATE_NAMES.get(state, state)
        prompt += (f"\n\nThe booker chose to start local: {where}. Search there first"
                   + (f" (use near_city='{cities[0]}')" if cities else f" (use state='{state}')")
                   + ". Only widen the search if fewer than 3 local athletes fit, and say so in note.")
    out, usage, run_id = await _run(scout_agent(), "scout", prompt, deps)

    cap = budget if budget is not None else out.brief.budget_max
    kept, dropped = [], []
    for m in sorted(out.matches, key=lambda m: -m.fit_score):
        a = store.get_athlete(m.athlete_id)
        if m.athlete_id not in deps.seen_ids or a is None:
            dropped.append({"athlete_id": m.athlete_id, "reason": "not returned by search (invented)"})
            continue
        if cap is not None and a["fee_min"] > cap:
            dropped.append({"athlete_id": m.athlete_id, "reason": f"fee_min ${a['fee_min']} over budget ${cap}"})
            continue
        kept.append({**m.model_dump(), "athlete": a})
    for d in dropped:
        log_safety("dropped_match", "scout output", {**d, "run_id": run_id})
    b = out.brief
    steps = [("read", f"Understood: {b.event_type}" + (f" in {b.city}" if b.city else "") +
              (f", budget ${b.budget_max:,}" if b.budget_max else "") +
              (f", themes: {', '.join(b.themes)}" if b.themes else ""))]
    if n:
        steps.insert(0, ("check", f"Removed {n} email/phone/link from the request before the AI saw it"))
    steps.append(("check", f"Python checked {len(out.matches)} picks against the search results and the budget"
                  + (f": dropped {len(dropped)} ({'; '.join(d['reason'] for d in dropped)})" if dropped else ": all passed")))
    steps.append(("done", f"Returned {len(kept)} ranked matches"))
    g = glass(usage, steps)
    return {"blocked": False, "brief": b.model_dump(), "matches": kept, "note": out.note,
            "dropped": dropped, "usage": g, "glass": g, "run_id": run_id}


NUMBER = re.compile(r"\b\d[\d,.]*\b")


async def build_story(notes: str, basics: dict) -> dict:
    check_length(notes, "Notes")
    clean, n = redact_contacts(notes)
    if n:
        log_safety("redacted_contacts", "story builder input", {"removed": n})
    flags = scan_text(notes)
    if "prompt_injection" in flags:
        log_safety("injection_in_notes", "story builder input", {"text": _short(notes)})
    facts = (f"Name: {basics.get('name','')}\nSport: {basics.get('sport','')}\nLevel: {basics.get('level','')}\n"
             f"City: {basics.get('city','')}")
    prompt = f"Athlete basics:\n{untrusted('athlete form', facts)}\n\nAthlete notes:\n{untrusted('athlete notes', clean)}"
    off = (basics.get("off_limits") or "").strip()
    if off:
        off_clean, _ = redact_contacts(off)
        prompt += f"\n\nOFF THE TABLE (the athlete does not want these in the profile; never mention them):\n{untrusted('athlete off-limits', off_clean)}"
    out, usage, run_id = await _run(story_agent(), "story_builder", prompt)

    draft = out.model_dump()
    # Data-leak check: no contact details may appear in a public profile.
    for k in ("headline", "bio", "story"):
        cleaned, removed = redact_contacts(draft[k])
        if removed:
            draft[k] = cleaned
            log_safety("contact_in_profile_output", "story builder output", {"field": k, "run_id": run_id})
    # Off-limits check: if a word the athlete put off the table shows up in the public text, flag it for them.
    if off:
        stop = {"about", "their", "there", "would", "which", "these", "those", "never", "don't", "doesn't", "anything", "talk", "discuss"}
        terms = {w for w in re.findall(r"[a-zA-Z']{5,}", off.lower()) if w not in stop}
        public = " ".join(draft[k] for k in ("headline", "bio", "story")).lower() + " " + " ".join(draft["topics"]).lower()
        hits = sorted(t for t in terms if t in public)
        if hits:
            draft["claims_to_verify"].append(f"Mentions something you put off the table ({', '.join(hits)}). Edit it out before publishing.")
            log_safety("off_limits_in_profile", "story builder output", {"terms": hits, "run_id": run_id})
    # Invented-fact check: any number in the profile that is not in the athlete's own words gets flagged.
    source_numbers = set(NUMBER.findall(notes + " " + facts))
    new_numbers = sorted({x for k in ("headline", "bio", "story") for x in NUMBER.findall(draft[k])} - source_numbers)
    if new_numbers:
        draft["claims_to_verify"].append(f"Numbers not in your notes: {', '.join(new_numbers)}. Remove or confirm.")
        log_safety("possible_invented_fact", "story builder output", {"numbers": new_numbers, "run_id": run_id})
    steps = [("read", f"Read {len(notes.split())} words of notes about {basics.get('name') or 'the athlete'}")]
    if n:
        steps.append(("check", f"Removed {n} email/phone/link from the notes before the AI saw them"))
    if "prompt_injection" in flags:
        steps.append(("check", "Notes contained instructions aimed at the AI: treated as data, logged"))
    steps.append(("check", f"Fact check: {'new numbers flagged: ' + ', '.join(new_numbers) if new_numbers else 'no numbers added that are not in the notes'}"))
    steps.append(("done", f"Drafted a profile; {len(draft['claims_to_verify'])} claims to verify"))
    g = glass(usage, steps)
    return {"draft": draft, "usage": g, "glass": g, "run_id": run_id, "input_flags": flags}


SEVERE = {"prompt_injection", "contact_harvesting", "off_platform_payment"}
RANK = {"deliver": 0, "flag": 1, "block": 2}


async def screen_request(athlete: dict, form: dict) -> dict:
    """Gatekeeper + Python rules. Python can only make the verdict stricter, never looser."""
    msg = form.get("message", "")
    check_length(msg, "Message")
    rule_flags = scan_text(msg + " " + form.get("org", "") + " " + form.get("booker_name", ""))
    text = (f"Organization: {form.get('org','')}\nContact name: {form.get('booker_name','')}\n"
            f"Event type: {form.get('event_type','')}\nDate: {form.get('event_date','')}\n"
            f"City: {form.get('city','')}\nBudget offered: ${form.get('budget') or 0:,}\n\nMessage:\n{msg}")
    rider = athlete.get("rider") or {}
    text += f"\n\nTransportation offered by booker: {form.get('transport_offered') or 'not stated'}"
    prompt = (f"Athlete receiving this: {athlete['name']} ({athlete['sport']}, {athlete['level']}), "
              f"fee range ${athlete['fee_min']:,}-${athlete['fee_max']:,}.\n"
              f"The athlete's Event Rider (set by the athlete; the booker agreed to it):\n{riders.describe(rider)}\n\n"
              + ("This athlete is a CURRENT COLLEGE athlete, so NIL rules apply (see your instructions).\n\n"
                 if riders.is_college(athlete) else "")
              + f"Booking request:\n{untrusted('booker', text)}")
    out, usage, run_id = await _run(gatekeeper_agent(), "gatekeeper", prompt)

    verdict = out.verdict
    rule_rider = riders.rule_conflicts(rider, msg + " " + form.get("org", ""))
    rule_rider += riders.availability_conflicts(athlete.get("availability"), form.get("event_date"), form.get("event_time"))
    nil = riders.nil_flags(athlete, msg)
    if nil:
        rule_flags = rule_flags + nil
    conflicts = sorted(set(out.rider_conflicts) | set(rule_rider))
    if rule_rider:
        rule_flags = rule_flags + ["rider_conflict"]
    floor = "block" if SEVERE & set(rule_flags) else "flag" if rule_flags or conflicts else "deliver"
    if RANK[floor] > RANK[verdict]:
        log_safety("rules_raised_verdict", "gatekeeper", {"model": verdict, "rules": floor, "flags": rule_flags,
                                                          "run_id": run_id})
        verdict = floor
    if verdict == "block":
        log_safety("request_blocked", "gatekeeper", {"flags": sorted(set(out.risk_flags) | set(rule_flags)),
                                                     "run_id": run_id, "message": _short(msg)})
    steps = [("read", f"Screened a request from {form.get('org') or 'unknown org'} for {athlete['name']}"),
             ("check", f"AI verdict: {out.verdict}" + (f" ({', '.join(out.risk_flags)})" if out.risk_flags else "")),
             ("check", "Event Rider: " + ("conflicts with " + "; ".join(conflicts) if conflicts else "no conflicts")),
             ("check", f"Python rules: {', '.join(rule_flags) if rule_flags else 'nothing found'}"
                       + (f" → raised verdict to {verdict}" if verdict != out.verdict else "")),
             ("done", {"deliver": "Delivered to the athlete's inbox", "flag": "Delivered, marked for a careful look",
                       "block": "Blocked: the athlete never sees it"}[verdict])]
    g = glass(usage, steps)
    screening = {**out.model_dump(), "rider_conflicts": conflicts, "verdict": verdict, "model_verdict": out.verdict, "rule_flags": rule_flags,
                 "run_id": run_id, "usage": g, "glass": g}
    return screening
