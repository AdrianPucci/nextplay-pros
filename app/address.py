"""Event address check: is the booking's address a real U.S. address, in the city the booker named?

Uses the free U.S. Census Bureau geocoder (no key). Anything other than a clean match (not found, a different
city, missing, or the service can't be reached) raises a red flag on the request so the athlete confirms the
location before committing. It never blocks on its own, and it never passes a request it couldn't check.
"""
import json
import urllib.parse
import urllib.request

CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
LABEL = {
    "verified": "Address verified",
    "not_found": "Address couldn't be verified: no match for this address",
    "city_mismatch": "Address is in a different city than the event",
    "missing": "No event address given",
    "unavailable": "Address couldn't be checked right now",
}


def _fetch(address: str) -> dict:
    q = urllib.parse.urlencode({"address": address, "benchmark": "Public_AR_Current", "format": "json"})
    with urllib.request.urlopen(f"{CENSUS}?{q}", timeout=8) as r:
        return json.loads(r.read())


_CACHE: dict = {}


def verify(address: str, city: str = "", fetch=None) -> dict:
    """Cached by (address, city), except "unavailable" so a brief outage isn't remembered."""
    key = ((address or "").strip().lower(), (city or "").strip().lower())
    if fetch is None and key in _CACHE:
        return _CACHE[key]
    r = _verify(address, city, fetch)
    if fetch is None and r["status"] != "unavailable":
        _CACHE[key] = r
    return r


def _verify(address: str, city: str = "", fetch=None) -> dict:
    address = (address or "").strip()
    if not address:
        return {"status": "missing", "label": LABEL["missing"], "matched": ""}
    if address.lower() in ("virtual", "online", "zoom", "remote"):
        return {"status": "verified", "label": "Virtual event (no address needed)", "matched": "Virtual"}
    try:
        data = (fetch or _fetch)(address)
        matches = data.get("result", {}).get("addressMatches", [])
    except Exception:  # noqa: BLE001
        return {"status": "unavailable", "label": LABEL["unavailable"], "matched": ""}
    if not matches:
        return {"status": "not_found", "label": LABEL["not_found"], "matched": ""}
    m = matches[0]
    found_city = (m.get("addressComponents") or {}).get("city", "")
    if city and found_city and city.strip().lower() not in found_city.lower() and found_city.lower() not in city.strip().lower():
        return {"status": "city_mismatch", "label": f"{LABEL['city_mismatch']} ({found_city.title()} vs. {city})", "matched": m.get("matchedAddress", "")}
    return {"status": "verified", "label": LABEL["verified"], "matched": m.get("matchedAddress", "")}


def apply(screening: dict, result: dict) -> dict:
    """Attach the address result to Gatekeeper's screening; anything but verified raises a red flag."""
    screening = {**screening, "address": result}
    if result["status"] != "verified":
        screening["rule_flags"] = list(screening.get("rule_flags") or []) + ["address_unverified"]
        if screening.get("verdict") == "deliver":
            screening["verdict"] = "flag"
    return screening
