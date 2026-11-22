# Next Play

**An AI booking desk that gets overlooked athletes (retired, mid-level, and rising) paid speaking, appearance, clinic, and entertainment gigs with the businesses, schools, and events that want them, with the athlete in control of who can reach them.**

MGT 409 Final Project · Adrian Pucci · Report: `report.html` · Slides: `slides.html`

---

## Run it (about 3 minutes)

You need **Python 3.11 or newer** and the course **Portkey key**.

1. **Clone and enter the folder**
   ```
   git clone <this repo's URL>
   cd <repo folder>
   ```
2. **Install** (a virtual environment is optional but recommended)
   ```
   python -m venv .venv
   .venv\Scripts\activate          (Windows)   |   source .venv/bin/activate   (Mac/Linux)
   pip install -r requirements.txt
   ```
3. **Add your key.** Copy `.env.example` to `.env` and fill in `PORTKEY_API_KEY`.
   The app looks for `.env` **in this folder first, then in the folder one level above it**, so a `.env` placed next to the cloned folder also works. A `PORTKEY_API_KEY` already set in your environment works too.
4. **Start it**
   ```
   python run.py
   ```
5. Open **http://127.0.0.1:8000**. (Port busy? `python run.py --port 8010`.)

The first start creates `data/app.db` and loads the demo roster. To reset the demo, stop the app and delete `data/app.db`.

## Try it (5 minutes)

1. **I'm booking talent → Find talent (AI Scout).** Click an example chip (or type your own event) → **Find matches**. Open the **Glass box** under the results to see tokens, cost, and each step Scout took.
2. Click **Request booking** on a match, fill in the form, and **Send request**. Gatekeeper screens it first.
   *Try a scam:* put "Pay the $150 processing fee by gift card today" in the message. It gets blocked.
3. **I'm an athlete → My inbox.** Pick that athlete in "viewing as" → **Accept**. Back in **I'm booking talent → My requests**, their contact details are now unlocked.
4. **I'm an athlete → Build my profile (AI).** Paste a few sentences of rough notes → Story Builder writes the profile → **Publish**.
5. **Behind the scenes:** real token counts and cost for every AI run, and every safety guard that fired.

## The agents (all gpt-6-luna through Portkey)

| Agent | Job | Tools | Guardrails |
|---|---|---|---|
| **Scout** | Plain-English event request → ranked, explained matches | `search_athletes` (Python search over the roster) | Python drops any athlete the search didn't return and anyone over budget |
| **Story Builder** | Athlete's rough notes → public profile | none | Contacts stripped before and after; new numbers flagged for checking |
| **Gatekeeper** | Screens every booking request: deliver / flag / block | none | Python scam rules can only make the verdict stricter |

Contact details live in a separate vault table that no agent can read. They reach a booker only after the athlete accepts that booker's request.

## Data: test set vs. your own

- **Default: the test dataset** in `data/`: 40 **fictional** athletes (`athletes.json`), their fake contacts (`contacts.json`, example.com emails and 555-01xx phones), and 6 sample gig posts (`opportunities.json`). Rebuild it with `python scripts/make_seed_data.py`.
- **Switch to other data:** make a folder with `athletes.json` and `contacts.json` in the same format (and optionally `opportunities.json`), then set `NEXTPLAY_DATA_DIR` to that folder in `.env`:
  ```
  NEXTPLAY_DATA_DIR=C:\path\to\my_roster
  ```
  Each roster folder gets its own database. Remove the line to go back to the test set.

## Tests and logs

- `python tests/run_safety_tests.py`: 17 safety tests (8 code checks + 9 live attacks on the agents, about $0.003). Results go to `output/safety_tests.json`. Add `--offline` to run only the free code checks (saved to `output/safety_tests_offline.json`).
- `python scripts/cache_probe.py`: runs each agent 3 times and prints cached-token numbers.
- Logs (created as you use the app): `output/usage_log.json` (tokens and cost per run), `output/audit_trail.json` (every tool call), `output/safety_log.json` (every guard that fired).

## Settings (`.env`, all optional except the key)

| Name | Default | What it does |
|---|---|---|
| `PORTKEY_API_KEY` | (required) | Course key for gpt-6-luna |
| `PORTKEY_BASE_URL` | `https://api.portkey.ai/v1` | Gateway URL |
| `DAILY_SPEND_CAP_USD` | `2.00` | AI runs stop for the day once this is spent |
| `NEXTPLAY_DATA_DIR` | `data/` | Roster folder (see above) |

## Troubleshooting

- **"PORTKEY_API_KEY is not set"**: the `.env` isn't in this folder or the one above, or the key line is empty.
- **Port 8000 in use**: `python run.py --port 8010`.
- **Old demo data**: delete `data/app.db` and restart.

*All people in the demo data are fictional. Next Play is a class project, not a live service.*
