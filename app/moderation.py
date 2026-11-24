"""Photo safety screen: every uploaded athlete photo is checked before anyone can see it.

Uses OpenAI's free moderation model (omni-moderation-latest), which reads images. Nudity / sexual content,
anything sexual involving minors, and graphic violence are blocked. If the check can't run (no key, network
error), the upload is refused: a photo is never published unchecked ("fail closed").
"""
import base64
import os

BLOCK = ("sexual", "sexual/minors", "violence/graphic", "self-harm/intent", "self-harm/instructions")
LABELS = {"sexual": "nudity or sexual content", "sexual/minors": "sexual content involving minors",
          "violence/graphic": "graphic violence", "self-harm/intent": "self-harm", "self-harm/instructions": "self-harm"}


def _client():
    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if key:
        return OpenAI(api_key=key)
    pk = os.getenv("PORTKEY_API_KEY", "").strip()
    if pk:
        headers = {"x-portkey-api-key": pk}
        if vk := os.getenv("PORTKEY_VIRTUAL_KEY", "").strip():
            headers["x-portkey-virtual-key"] = vk
        return OpenAI(api_key=pk, base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1").strip(), default_headers=headers)
    return None


def screen_image(jpeg: bytes) -> dict:
    """Returns {"ok": bool, "reason": str, "categories": [...]}. ok=False when blocked or when the check couldn't run."""
    client = _client()
    if client is None:
        return {"ok": False, "reason": "unavailable", "categories": []}
    try:
        url = "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()
        res = client.moderations.create(model="omni-moderation-latest",
                                        input=[{"type": "image_url", "image_url": {"url": url}}]).results[0]
        cats = res.categories.model_dump(by_alias=True) if hasattr(res.categories, "model_dump") else dict(res.categories)
        hits = [k for k in BLOCK if cats.get(k)]
        return {"ok": not hits, "reason": "blocked" if hits else "clean", "categories": hits}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": "unavailable", "categories": [], "error": type(e).__name__}


def refusal(result: dict) -> str:
    if result["reason"] == "unavailable":
        return "Our photo safety check couldn't run right now, so the photo wasn't posted. Please try again in a minute."
    what = ", ".join(sorted({LABELS.get(c, c) for c in result["categories"]}))
    return f"This photo can't be posted: our safety check flagged {what}. Please choose a different photo."
