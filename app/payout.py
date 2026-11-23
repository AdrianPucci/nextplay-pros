"""Commitment + pay rules: escrow, a 60-minute-early check-in, and payouts that reward showing up.

  Booker's fee is held in escrow when the athlete accepts.
  Athlete checks in at least 60 minutes before the start -> platform fee drops from 10% to 5% (athlete keeps more).
  Checked in, but less than 60 minutes early (before start) -> standard 10% fee.
  Checked in after the start (late) -> 25% of the fee goes back to the booker, then the 10% fee.
  No check-in / no-show -> booker refunded 100%, athlete gets $0 and a strike (2 strikes in 12 months = 90-day pause).
  Payout is released 48 hours after the event unless the booker opens a dispute.
"""
from datetime import datetime

STANDARD_FEE = 0.10
ON_TIME_FEE = 0.05
LATE_REFUND = 0.25
EARLY_MINUTES = 60


def start_of(req: dict) -> datetime | None:
    if not req.get("event_date"):
        return None
    try:
        return datetime.fromisoformat(f"{req['event_date']}T{req.get('event_time') or '00:00'}")
    except ValueError:
        return None


def checkin_status(req: dict) -> dict:
    """How the check-in compares to the start time (local time, demo)."""
    if not req.get("checked_in"):
        return {"status": "not_checked_in", "label": "Not checked in yet"}
    t = datetime.fromisoformat(req["checked_in"])
    start = start_of(req)
    if not start or not req.get("event_time"):
        return {"status": "checked_in", "label": f"Checked in {t:%b %d, %I:%M %p} (no start time set)"}
    early = (start - t).total_seconds() / 60
    if early > 12 * 60:
        return {"status": "checked_in_early_day", "label": f"Checked in {t:%b %d, %I:%M %p}, before event day (demo)"}
    if early >= EARLY_MINUTES:
        return {"status": "on_time", "label": f"✅ On time: checked in {early:.0f} min before start"}
    if early >= 0:
        return {"status": "arrived", "label": f"Arrived {early:.0f} min before start (rule: {EARLY_MINUTES})"}
    return {"status": "late", "label": f"Late: checked in {-early:.0f} min after start"}


def plan(req: dict) -> dict:
    """Payout preview for an accepted booking."""
    fee = float(req.get("budget") or 0)
    st = checkin_status(req)
    if st["status"] == "on_time":
        refund, rate = 0.0, ON_TIME_FEE
    elif st["status"] == "late":
        refund, rate = fee * LATE_REFUND, STANDARD_FEE
    else:
        refund, rate = 0.0, STANDARD_FEE
    platform = (fee - refund) * rate
    return {"fee": fee, "escrow": fee, "booker_refund": round(refund, 2), "platform_fee_rate": rate,
            "platform_fee": round(platform, 2), "athlete_payout": round(fee - refund - platform, 2),
            "on_time_payout": round(fee * (1 - ON_TIME_FEE), 2), "standard_payout": round(fee * (1 - STANDARD_FEE), 2),
            "checkin": st}
