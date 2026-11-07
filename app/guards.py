"""Safety checks that run in plain Python, before and after the model.

- scan_text: rule-based red flags (injection phrases, contact harvesting, off-platform payment).
- redact_contacts: removes emails/phones/links from text before a model sees it.
- spend guard: refuses new AI runs once today's spend passes DAILY_SPEND_CAP_USD.
- log_safety: every guard that fires is appended to output/safety_log.json (evidence for the report).
"""
import json
import re
from datetime import datetime, timezone

from .config import DAILY_SPEND_CAP_USD, MAX_INPUT_CHARS, OUTPUT

SAFETY_LOG = OUTPUT / "safety_log.json"
USAGE_LOG = OUTPUT / "usage_log.json"

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
URL = re.compile(r"https?://\S+|www\.\S+", re.I)

RULES = {
    "prompt_injection": re.compile(
        r"ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules)|system prompt|you are now|"
        r"developer mode|disregard (your|the) (rules|instructions)|act as (an? )?(admin|system)|"
        r"reveal (the |your )?(instructions|prompt)|<\s*/?\s*(system|untrusted)", re.I),
    "contact_harvesting": re.compile(
        r"(send|give|share|list|tell) me (the |their |his |her |all )?(personal |private )?"
        r"(email|e-mail|phone|cell|number|address|contact)|contact (info|details) for (all|every)|home address", re.I),
    "off_platform_payment": re.compile(
        r"gift ?cards?|wire (transfer|the money)|crypto|bitcoin|zelle|cash ?app|western union|"
        r"pay (a |an )?(deposit|fee) (first|upfront|up front)|processing fee", re.I),
    "pressure_tactics": re.compile(r"\b(urgent|act now|today only|within the hour|don'?t tell)\b", re.I),
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def append_json(path, record: dict) -> None:
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    data.append(record)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def log_safety(guard: str, where: str, detail) -> dict:
    rec = {"time": now(), "guard": guard, "where": where, "detail": detail}
    append_json(SAFETY_LOG, rec)
    return rec


def scan_text(text: str) -> list[str]:
    """Names of every rule the text trips. Contact details inside a request are a flag too."""
    flags = [name for name, rx in RULES.items() if rx.search(text or "")]
    if EMAIL.search(text or "") or PHONE.search(text or "") or URL.search(text or ""):
        flags.append("contact_or_link_in_text")
    return flags


def redact_contacts(text: str) -> tuple[str, int]:
    """Replace emails, phone numbers, and links with placeholders. Returns (clean text, how many removed)."""
    count = 0
    for rx, label in ((EMAIL, "[email removed]"), (URL, "[link removed]"), (PHONE, "[phone removed]")):
        text, n = rx.subn(label, text)
        count += n
    return text, count


def check_length(text: str, field: str) -> None:
    if len(text or "") > MAX_INPUT_CHARS:
        log_safety("input_too_long", field, {"chars": len(text)})
        raise ValueError(f"{field} is too long ({len(text)} characters; max {MAX_INPUT_CHARS}).")


def spent_today() -> float:
    if not USAGE_LOG.exists():
        return 0.0
    today = now()[:10]
    return sum(r.get("cost_usd", 0) for r in json.loads(USAGE_LOG.read_text(encoding="utf-8"))
               if r.get("time", "").startswith(today))


def check_budget() -> None:
    spent = spent_today()
    if spent >= DAILY_SPEND_CAP_USD:
        log_safety("daily_spend_cap", "any agent", {"spent_usd": round(spent, 4), "cap_usd": DAILY_SPEND_CAP_USD})
        raise RuntimeError(f"Daily AI spend cap reached (${spent:.2f} of ${DAILY_SPEND_CAP_USD:.2f}). Try again tomorrow.")


def untrusted(label: str, text: str) -> str:
    """Wrap user-written text so the model treats it as data, not instructions."""
    safe = (text or "").replace("<untrusted", "&lt;untrusted").replace("</untrusted", "&lt;/untrusted")
    return f'<untrusted source="{label}">\n{safe}\n</untrusted>'
