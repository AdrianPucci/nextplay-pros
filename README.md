# Next Play

An AI booking desk that connects former, current, and rising athletes with businesses, schools, nonprofits, and events that want speakers, appearances, clinics, mentors, and entertainers. Athletes' contact details stay private until they accept a request.

## Run it (about 3 minutes)
1. Python 3.11+.
2. Install:
   ```
   pip install -r requirements.txt
   ```
3. Put your key in a `.env` file **in this folder or the folder above it** (see `.env.example`):
   ```
   PORTKEY_API_KEY=your-key
   ```
4. Start:
   ```
   python run.py
   ```
5. Open http://127.0.0.1:8000

The first run creates `data/app.db` and loads the 40-athlete demo roster. To reset the demo, delete `data/app.db`.

## Try it
- **I'm booking talent → Find talent:** click an example (or type your own event) → **Find matches** → **Request booking**.
- **I'm an athlete → My inbox:** pick the athlete in the "viewing as" box → **Accept** → back on the booker side, **My requests** now shows their contact details.
- **I'm an athlete → Build my profile:** paste rough notes → Story Builder writes the profile → **Publish**.
- **Behind the scenes:** real token counts and cost for every AI run, plus every safety guard that fired.

## The agents (all gpt-6-luna via Portkey)
| Agent | Job | Tools |
|---|---|---|
| Scout | Plain-English event request → ranked, explained matches under budget | `search_athletes` |
| Story Builder | Athlete's rough notes → polished public profile | none |
| Gatekeeper | Screens each booking request: deliver / flag / block | none |

## Data
All athletes and contacts in `data/` are fictional (emails use example.com, phones use 555-01xx). Rebuild them with `python scripts/make_seed_data.py`.

## Logs
- `output/usage_log.json`: tokens and cost per AI run
- `output/audit_trail.json`: every tool call per run
- `output/safety_log.json`: every guardrail that fired
