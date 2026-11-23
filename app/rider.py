"""The athlete's Event Rider: safety + accommodation requirements, transportation, and a "won't do" list.

Bookers must agree to the rider before a request is sent. Gatekeeper (AI) and the rules below (plain Python)
both check each request against the athlete's "won't do" list.
"""
import re

SECURITY = {
    "escort": "Security escort on site",
    "green_room": "Private green room or quiet space",
    "no_one_on_one": "No unsupervised one-on-one time with attendees",
    "onsite_contact": "A named on-site contact person",
    "crowd_limit": "Crowd limit and a line manager for meet-and-greets",
}
ACCOMMODATIONS = {
    "accessibility": "Accessible venue and route",
    "dietary": "Meal provided (dietary needs shared in advance)",
    "hotel": "Hotel provided if travel is over 100 miles",
    "av": "Microphone and screen provided",
    "breaks": "A break at least every 60 minutes",
}
TRANSPORT = {
    "pickup": "Pick-up and drop-off required",
    "mileage": "Mileage reimbursed",
    "self": "I'll get myself there",
}
WONT_DO = {
    "alcohol": "Alcohol or bar promotion",
    "gambling": "Gambling or sports-betting promotion",
    "political": "Political events or endorsements",
    "media": "Media or press interviews",
    "photos_minors": "Photos with minors unless a guardian is present",
    "late": "Events ending after 10 pm",
    "overnight": "Overnight or multi-day travel",
}

# Plain-Python backstop: words that clearly hit a "won't do" item. Gatekeeper judges the subtler cases.
WONT_DO_RULES = {
    "alcohol": re.compile(r"\b(alcohol|beer|brew(ery|pub)|bar crawl|liquor|wine|happy hour|vodka|whiskey|tequila|cocktail)", re.I),
    "gambling": re.compile(r"\b(casino|gambl\w*|betting|sportsbook|wager\w*|poker|slots?)\b", re.I),
    "political": re.compile(r"\b(campaign rally|rally|candidate|political|election|super ?pac|fundraiser for (senator|governor|mayor))\b", re.I),
    "media": re.compile(r"\b(interview|press conference|podcast|reporter|on[- ]camera|tv segment)\b", re.I),
    "late": re.compile(r"\b(1[01]|12)(:\d\d)?\s?(pm|p\.m\.)|midnight|late[- ]night|after[- ]party", re.I),
    "overnight": re.compile(r"\b(overnight|two[- ]day|2[- ]day|multi[- ]day|stay the night|weekend trip)\b", re.I),
}

EMPTY = {"security": [], "accommodations": [], "transport": "self", "wont_do": [], "wont_do_other": "", "max_hours": 3}


def clean(rider: dict | None) -> dict:
    """Keep only known options; fill defaults."""
    r = {**EMPTY, **(rider or {})}
    return {
        "security": [k for k in r["security"] if k in SECURITY],
        "accommodations": [k for k in r["accommodations"] if k in ACCOMMODATIONS],
        "transport": r["transport"] if r["transport"] in TRANSPORT else "self",
        "wont_do": [k for k in r["wont_do"] if k in WONT_DO],
        "wont_do_other": str(r.get("wont_do_other") or "")[:300],
        "max_hours": max(1, min(12, int(r.get("max_hours") or 3))),
    }


def describe(rider: dict) -> str:
    """Plain-English rider for the Gatekeeper prompt and the booker."""
    r = clean(rider)
    lines = [f"Transportation: {TRANSPORT[r['transport']]}", f"Maximum time on site: {r['max_hours']} hours"]
    if r["security"]:
        lines.append("Security needs: " + "; ".join(SECURITY[k] for k in r["security"]))
    if r["accommodations"]:
        lines.append("Accommodations: " + "; ".join(ACCOMMODATIONS[k] for k in r["accommodations"]))
    wont = [WONT_DO[k] for k in r["wont_do"]] + ([r["wont_do_other"]] if r["wont_do_other"] else [])
    lines.append("Will NOT do: " + ("; ".join(wont) if wont else "nothing listed"))
    return "\n".join(lines)


def rule_conflicts(rider: dict, text: str) -> list[str]:
    """Which 'won't do' items the request text clearly hits (Python backstop to Gatekeeper)."""
    r = clean(rider)
    return [WONT_DO[k] for k in r["wont_do"] if k in WONT_DO_RULES and WONT_DO_RULES[k].search(text or "")]


def seed_rider(i: int, sport: str, level: str) -> dict:
    """A varied, realistic rider for demo athlete number i (deterministic)."""
    security = ["onsite_contact"]
    if sport in ("Boxing", "MMA", "Wrestling", "Football", "Basketball") or i % 3 == 0:
        security.append("escort")
    if i % 2 == 0:
        security.append("green_room")
    if level.startswith("Rising") or i % 4 == 1:
        security.append("no_one_on_one")
    if i % 5 == 0:
        security.append("crowd_limit")
    acc = ["av"] + (["hotel"] if i % 3 != 2 else []) + (["dietary"] if i % 2 else []) + (["breaks"] if i % 4 == 0 else [])
    if sport == "Swimming" or i % 9 == 0:
        acc.append("accessibility")
    transport = ["pickup", "mileage", "self"][i % 3]
    wont = ["political"]
    if level.startswith("Rising") or i % 2 == 0:
        wont.append("alcohol")
    if i % 3 != 1:
        wont.append("gambling")
    if i % 4 == 2:
        wont.append("media")
    if i % 5 == 3:
        wont.append("late")
    if i % 6 == 4:
        wont.append("overnight")
    wont.append("photos_minors") if i % 7 == 0 else None
    return clean({"security": security, "accommodations": acc, "transport": transport, "wont_do": wont,
                  "max_hours": [2, 3, 4][i % 3]})


# ---------------------------------------------------------------- NIL (college athletes)
NIL_INDUCEMENT = re.compile(
    r"\b(transfer\w*|commit(ment)? to|enroll\w* at|stay at|if you sign with|sign with (our|the) (school|program|university)|"
    r"booster|collective|play for|come play|recruit\w*|portal)\b", re.I)
SCHOOL_MARKS = re.compile(r"\b(in (your|team) uniform|wear (your|the) (jersey|uniform)|school logo|team logo|university logo)\b", re.I)


def is_college(athlete: dict) -> bool:
    return "college" in (athlete.get("level") or "").lower() and (athlete.get("level") or "").lower().startswith("rising")


def nil_flags(athlete: dict, text: str) -> list[str]:
    """Plain-Python NIL red flags for a request to a current college athlete."""
    if not is_college(athlete):
        return []
    flags = []
    if NIL_INDUCEMENT.search(text or ""):
        flags.append("possible_recruiting_inducement")
    if SCHOOL_MARKS.search(text or ""):
        flags.append("school_logo_or_uniform")
    return flags
