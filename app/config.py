"""Settings, the .env lookup, the gpt-6-luna model, and the price table.

The .env file is looked for in the repo folder first, then one folder up (course rule).
A key in a .env file wins over one already set in the environment (so a stale Windows key can't block a new one).
"""
import json
import os
from pathlib import Path

from dotenv import dotenv_values

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUTPUT = ROOT / "output"
PROMPTS = ROOT / "prompts"
STATIC = ROOT / "static"
OUTPUT.mkdir(exist_ok=True)

for env_file in (ROOT.parent / ".env", ROOT / ".env"):  # folder above first, so the repo's own .env wins
    if env_file.exists():
        for name, value in dotenv_values(env_file).items():
            if value and value.strip():  # a filled-in .env value beats an old key saved in Windows; blanks are ignored
                os.environ[name] = value.strip()

MODEL_NAME = "gpt-6-luna"  # the only model allowed on the course key
PRICES = json.loads((DATA / "prices.json").read_text(encoding="utf-8"))[MODEL_NAME]

# Safety limits (can be changed in .env)
DAILY_SPEND_CAP_USD = float(os.getenv("DAILY_SPEND_CAP_USD", "2.00"))
MAX_INPUT_CHARS = int(os.getenv("MAX_INPUT_CHARS", "2000"))
# Which roster to load. Default: the 40-athlete fictional test set in data/. To use other data, point
# NEXTPLAY_DATA_DIR at a folder with athletes.json + contacts.json (+ optional opportunities.json) in the same format.
DATA_DIR = Path(os.getenv("NEXTPLAY_DATA_DIR", "").strip() or DATA).resolve()


def build_model():
    """gpt-6-luna through Portkey. The key comes from the environment and is never printed or logged."""
    from openai import AsyncOpenAI
    from pydantic_ai.models.openai import OpenAIResponsesModel
    from pydantic_ai.providers.openai import OpenAIProvider

    # Default: the course Portkey key. Fallback (course rules allow it, at your own cost): your own OpenAI key,
    # same model, used when MODEL_PROVIDER=openai or when no Portkey key is set.
    provider = os.getenv("MODEL_PROVIDER", "").strip().lower()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if provider == "openai" or (not os.getenv("PORTKEY_API_KEY", "").strip() and openai_key):
        if not openai_key:
            raise RuntimeError("MODEL_PROVIDER=openai but OPENAI_API_KEY is not set.")
        return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=AsyncOpenAI(api_key=openai_key)))
    api_key = os.getenv("PORTKEY_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set. Put it in .env (this folder or the one above it).")
    base_url = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1").strip()
    headers = {"x-portkey-api-key": api_key}
    if virtual_key := os.getenv("PORTKEY_VIRTUAL_KEY", "").strip():
        headers["x-portkey-virtual-key"] = virtual_key
    client = AsyncOpenAI(api_key=api_key, base_url=base_url, default_headers=headers)
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))


def cost_usd(input_tokens: int, cache_read: int, cache_write: int, output_tokens: int) -> float:
    """Dollar cost of one run. The API's input count already includes cached tokens."""
    uncached = max(input_tokens - cache_read - cache_write, 0)
    return (uncached * PRICES["input_per_1m"]
            + cache_read * PRICES["cached_input_per_1m"]
            + cache_write * PRICES["cache_write_per_1m"]
            + output_tokens * PRICES["output_per_1m"]) / 1_000_000
