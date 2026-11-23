// NextPlay Pros front end: plain JS, no build step.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => (n == null ? "-" : "$" + Number(n).toLocaleString());
const CAT = { speaking: "Speaking", appearance: "Appearance", clinic: "Clinic", mentoring: "Mentoring", endorsement: "Endorsement", comedy_entertainment: "Comedy & Entertainment" };
const SPORT_ICON = { Football: "🏈", Soccer: "⚽", Basketball: "🏀", Skiing: "⛷️", "Track & Field": "🏃", Hockey: "🏒", Baseball: "⚾", Swimming: "🏊", Esports: "🎮", Volleyball: "🏐", "Figure Skating": "⛸️", Golf: "⛳", Boxing: "🥊", Lacrosse: "🥍", Tennis: "🎾", "Cross-Country Skiing": "🎿", Gymnastics: "🤸", Wrestling: "🤼", Softball: "🥎", Rowing: "🚣", Rodeo: "🤠", Climbing: "🧗", Fencing: "🤺", Triathlon: "🏅", MMA: "🥋", Cricket: "🏏", Bowling: "🎳", Snowboarding: "🏂", Skateboarding: "🛹" };

const state = {
  role: "booker", tab: "find", athletes: [], cities: [], lastScout: null,
  bookerId: localGet("np_booker") || "bk_" + Math.random().toString(36).slice(2, 10),
  bookerName: localGet("np_booker_name") || "",
  athleteId: localGet("np_athlete") || "ath_005",
};
localSet("np_booker", state.bookerId);

function localGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}
function openModal(html) { $("#modal-body").innerHTML = html; $("#modal").hidden = false; }
function closeModal() { $("#modal").hidden = true; }
$("#modal-close").onclick = closeModal;
$("#modal").onclick = (e) => { if (e.target.id === "modal") closeModal(); };

function avatar(a) {
  const hue = [...a.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const init = a.name.replace(/".*?"/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("");
  return `<div class="avatar" style="background:hsl(${hue} 55% 42%)">${esc(init)}</div>`;
}
// Glass box: the token meter + a plain-English trace of what the agent did (one under every AI result).
const STEP_ICON = { read: "👀", tool: "🔧", check: "🛡️", block: "⛔", done: "✅" };
function usageLine(g, open = false) {
  if (!g) return "";
  const name = BOT_NAMES[g.agent] || g.agent;
  const trace = `<ol class="trace">${(g.trace || []).map((t) => `<li class="${t.kind}"><span>${STEP_ICON[t.kind] || "•"}</span>${esc(t.text)}</li>`).join("")}</ol>`;
  if (g.blocked) {
    return `<details class="glass" ${open ? "open" : ""}><summary>${bot(g.agent, "classic", 26)}<b>Glass box</b> · blocked by our rules · 0 tokens · $0</summary><div class="glass-body">${trace}</div></details>`;
  }
  const fresh = Math.max(g.input_tokens - g.cached_input_tokens, 0), total = g.input_tokens + g.output_tokens;
  const pct = (n) => (total ? (100 * n) / total : 0);
  const cachedPct = g.input_tokens ? Math.round((100 * g.cached_input_tokens) / g.input_tokens) : 0;
  return `<details class="glass" ${open ? "open" : ""}>
    <summary>${bot(g.agent, "happy", 26)}<b>Glass box</b> · ${total.toLocaleString()} tokens · ${cachedPct}% cached${g.reasoning_tokens ? ` · ${g.reasoning_tokens} reasoning` : ""}${(g.tools || []).length ? ` · ${[...new Set(g.tools)].join(", ")}` : ""} · $${g.cost_usd.toFixed(5)}</summary>
    <div class="glass-body">
      <div class="glass-who">${bot(g.agent, "classic", 64)}<div><b>${esc(name)}</b> measured this run<div class="meta">${g.requests} model call${g.requests === 1 ? "" : "s"} · ${g.tool_calls} tool call${g.tool_calls === 1 ? "" : "s"} · ${g.seconds}s · gpt-6-luna</div></div></div>
      <div class="meter" role="img" aria-label="Token meter: ${g.cached_input_tokens} cached input, ${fresh} fresh input, ${g.output_tokens} output">
        <i class="m-cached" style="width:${pct(g.cached_input_tokens)}%"></i><i class="m-fresh" style="width:${pct(fresh)}%"></i><i class="m-out" style="width:${pct(g.output_tokens)}%"></i>
      </div>
      <div class="meter-legend">
        <span><i class="m-cached"></i>Cached input <b>${g.cached_input_tokens.toLocaleString()}</b> <small>$0.01/1M</small></span>
        <span><i class="m-fresh"></i>Fresh input <b>${fresh.toLocaleString()}</b> <small>$0.10/1M</small></span>
        <span><i class="m-out"></i>Output <b>${g.output_tokens.toLocaleString()}</b>${g.reasoning_tokens ? ` <small>(${g.reasoning_tokens} reasoning)</small>` : ""} <small>$0.50/1M</small></span>
      </div>
      <div class="label">What ${esc(name)} did</div>${trace}
      <div class="label">Model's reasoning summary</div>
      ${(g.reasoning || []).length ? `<ol class="trace">${g.reasoning.map((r) => `<li><span>💭</span>${esc(r)}</li>`).join("")}</ol>` : `<p class="meta">No reasoning summary came back this run (structured answers usually skip it).</p>`}
    </div></details>`;
}
function thinking(agent, text) {
  return `<div class="thinking">${bot(agent, "thinking", 56, "bouncing")}<div>${esc(text)}<span class="dots"><i></i><i></i><i></i></span></div></div>`;
}
function photoBox(a, cls = "pro-photo") {
  const hue = [...a.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const init = a.name.replace(/".*?"/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("");
  return `<div class="${cls}" style="--h:${hue}">${a.photo ? `<img src="${esc(a.photo)}" alt="${esc(a.name)}">` : `<span class="ph-init">${esc(init)}</span><span class="ph-note">📷 Photo coming soon</span>`}</div>`;
}
function availLine(a) {
  const av = a.availability, o = state.riderOpts;
  if (!av || !o) return "";
  const days = av.days.length === 7 ? "Any day" : av.days.length === 2 && av.days.includes("sat") && av.days.includes("sun") ? "Weekends" : av.days.map((d) => o.days[d]).join(", ");
  const times = av.times.length === 3 ? "any time" : av.times.map((t) => o.times[t].split(" (")[0].toLowerCase()).join(", ");
  return `🗓️ ${esc(days)} · ${esc(times)} · ${av.notice_days} days' notice`;
}
function athleteCard(a, extra = "") {
  return `<div class="card pro">
    <div class="pro-top">${photoBox(a)}${extra.score || ""}</div>
    <div class="card-head"><div><div class="name">${esc(a.name)} ${SPORT_ICON[a.sport] || ""}</div>
      <div class="meta">${esc(a.level)} · ${esc(a.sport)} · ${esc(a.city)}, ${esc(a.state)}</div></div></div>
    ${extra.why || ""}
    ${a.headline ? `<div><b>${esc(a.headline)}</b></div>` : ""}
    <p class="story">${esc(a.story)}</p>
    <div>${a.categories.map((c) => `<span class="pill cat">${CAT[c] || c}</span>`).join("")}${a.topics.map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
    <div class="card-foot"><span class="fee">${money(a.fee_min)}–${money(a.fee_max)}</span>
      <span class="meta">${a.virtual_ok ? "Virtual OK · " : ""}travels ${a.travel_miles} mi</span></div>
    <div class="avail">${availLine(a)}</div>
    ${riderChips(a)}
    <button class="btn small" data-request="${a.id}">Request booking</button>
  </div>`;
}

// ---------------------------------------------------------------- tabs
const TABS = {
  booker: [["find", "Find talent"], ["browse", "Browse roster"], ["mine", "My requests"], ["board", "Opportunity board"], ["behind", "Behind the scenes"], ["terms", "Terms & Safety"], ["about", "About"]],
  athlete: [["inbox", "My inbox"], ["rider", "My profile & rider"], ["build", "Build my profile"], ["board", "Opportunity board"], ["behind", "Behind the scenes"], ["terms", "Terms & Safety"], ["about", "About"]],
};
const STAFF = new URLSearchParams(location.search).has("staff");  // ?staff=1 shows "Behind the scenes" (for grading)
function renderTabs() {
  $("#tabs").innerHTML = TABS[state.role].filter(([k]) => STAFF || k !== "behind").map(([k, l]) => `<button data-tab="${k}" class="${state.tab === k ? "active" : ""}">${l}</button>`).join("");
  document.querySelectorAll(".role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
}
document.querySelectorAll(".role-switch button").forEach((b) => (b.onclick = () => { state.role = b.dataset.role; state.tab = TABS[state.role][0][0]; render(); }));
$("#tabs").onclick = (e) => { const t = e.target.closest("[data-tab]"); if (t) { state.tab = t.dataset.tab; render(); } };
document.addEventListener("click", (e) => { const r = e.target.closest("[data-request]"); if (r) requestModal(r.dataset.request); });
// The 25-second story: full-screen, like a video, with subtitles
document.addEventListener("click", (e) => { if (e.target.closest("[data-story]")) openStory(); });
function openStory() {
  const o = document.createElement("div"); o.className = "story-overlay";
  o.innerHTML = `<iframe src="/static/story.html?autoplay=1&v=12" title="NextPlay Pros 20-second story" allow="autoplay"></iframe>`;
  document.body.appendChild(o);
  const close = () => { o.remove(); window.removeEventListener("message", onMsg); document.removeEventListener("keydown", onKey); };
  const onMsg = (m) => { if (m.data === "close-story") close(); };
  const onKey = (k) => { if (k.key === "Escape") close(); };
  window.addEventListener("message", onMsg); document.addEventListener("keydown", onKey);
}

function render() { renderTabs(); (VIEWS[state.tab] || VIEWS.find)(); }

// ---------------------------------------------------------------- booker: Scout
const EXAMPLES = [
  "Keynote for 250 credit-union employees in Denver in January about bouncing back from setbacks. Budget $5,000.",
  "Saturday basketball clinic for 60 kids ages 10-14 in Englewood. Nonprofit, can pay about $800.",
  "Funny emcee for a children's hospital charity gala in Dallas, clean material, up to $4,000.",
  "Virtual fireside chat on women in leadership for a business school club, budget $3,000.",
];
// ---------------------------------------------------------------- intro banner (home): crossfading athletes + tagline
const INTRO_SLIDES = [  // two photos per athlete where we have them: action shot first
  ["mg2.jpg", "MG Vellinga", "Pro boxer · Park City"],
  ["mg.jpg", "MG Vellinga", "Pro boxer · Park City"],
  ["okur.jpg", "Mehmet Okur", "NBA champion · Utah Jazz"],
  ["bloom.jpg", "Jeremy Bloom", "Olympic skier · NFL draft pick"],
  ["clark.jpg", "Wyndham Clark", "2x U.S. Open champion"],
  ["dauwalter.jpg", "Courtney Dauwalter", "Ultrarunner · former teacher"],
];
function introBanner() {
  const n = INTRO_SLIDES.length, step = 3;  // seconds per photo (faster, more action)
  const on = 100 / n, fade = Math.min(4, on / 3);  // keyframes scale with the number of photos
  const kf = `@keyframes introFade{0%{opacity:0}${fade.toFixed(2)}%{opacity:1}${on.toFixed(2)}%{opacity:1}${(on + fade).toFixed(2)}%{opacity:0}100%{opacity:0}}
    @keyframes introZoom{0%{transform:scale(1.12)}${(on + fade).toFixed(2)}%{transform:scale(1)}100%{transform:scale(1)}}`;
  return `<style>${kf}</style><section class="intro" style="--n:${n};--cycle:${n * step}s" aria-label="NextPlay Pros">
    <div class="intro-pics" aria-hidden="true">${INTRO_SLIDES.map(([img, name, role], i) =>
      `<figure style="animation-delay:${i * step - n * step}s"><img src="/static/img/${img}" alt=""><figcaption><b>${esc(name)}</b>${esc(role)}</figcaption></figure>`).join("")}</div>
    <div class="intro-copy">
      <h1>You were a star, <span>or you're becoming one.</span></h1>
      <p>Let us help you connect with your community, get paid, and inspire through your story.</p>
      <p class="intro-ask">They're waiting… are you ready?</p>
      <div class="intro-cta"><button class="btn" data-go-athlete>I'm ready: build my profile</button><button class="story-btn" data-story>▶ Watch our 20-second story</button></div>
    </div>
  </section>`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-go-athlete]")) { state.role = "athlete"; state.tab = "build"; render(); window.scrollTo(0, 0); }
});

function whoFor() {
  return `<section class="who" aria-label="Who NextPlay Pros is for">
    <div class="who-card athletes">
      <div class="who-kicker">For athletes</div>
      <h2>Rising, retired, or a local hero</h2>
      <ul>
        <li>💼 <b>Get paid</b> for talks, appearances, clinics, and events</li>
        <li>✍️ <b>A profile written for you</b> from your own story</li>
        <li>🛡️ <b>Your rules:</b> your rider, your schedule, your fees</li>
        <li>🔒 <b>Your contact stays private</b> until you say yes</li>
      </ul>
      <button class="btn" data-go-athlete>Build my profile</button>
    </div>
    <div class="who-card bookers">
      <div class="who-kicker">For communities &amp; bookers</div>
      <h2>Schools, teams, businesses, charities</h2>
      <ul>
        <li>🔎 <b>Describe your event</b> in plain English</li>
        <li>🎯 <b>Get athletes who fit</b> your theme, city, budget, and date</li>
        <li>💵 <b>Fair, clear fees</b> with no bureau markup</li>
        <li>🤝 <b>Protected bookings:</b> escrow, check-in, refunds</li>
      </ul>
      <button class="btn ghost-light" data-go-find>Find an athlete</button>
    </div>
  </section>`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-go-find]")) { const h = document.getElementById("find-hero"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => { const q = document.getElementById("q"); if (q) q.focus({ preventScroll: true }); }, 450); }
});

function howItWorks() {
  const step = (n, b, mood, title, who, text) => `<div class="how-step">
      <div class="how-num">${n}</div>${bot(b, mood, 120)}
      <h3>${title}</h3><div class="how-who">${who}</div><p>${text}</p></div>`;
  return `<section class="how" aria-label="How NextPlay Pros works">
    <div class="how-kicker">How it works</div>
    <h2>The team every pro has, now for every athlete</h2>
    <div class="how-steps">
      ${step(1, "scout", "happy", "Scouts", "Scout · your talent scout",
        "Reads what a school, team, business, or charity is planning and finds athletes whose story, city, budget, and schedule fit. Every match comes with a reason.")}
      ${step(2, "gatekeeper", "classic", "Booking agents &amp; protectors", "Gatekeeper · your appearance guardrails",
        "We screen every request for scams and tricks, check it against the athlete's rider, schedule, and NIL rules, and protect both sides with escrow, check-in, and refunds.")}
      ${step(3, "story_builder", "happy", "Promoters", "Story Builder · your publicist",
        "Turns an athlete's rough notes into a profile that sells, using only their own facts, so rising athletes and local heroes get noticed like the pros.")}
    </div>
    <div class="how-foot">You stay in charge: your contact details unlock only when you say yes.</div>
  </section>`;
}

function viewFind() {
  $("#view").innerHTML = `${introBanner()}${whoFor()}
  <div class="band" role="img" aria-label="Silhouettes of a basketball player, a golfer, a dancer, and a women's soccer player racing across the page"></div>
  <section class="hero" id="find-hero">
    <h1>Who do you want at your event?</h1>
    <p>Describe it like you'd tell a friend. Scout searches the roster, keeps you under budget, and explains every match.</p>
    <div class="team-strip">${bot("scout", "happy", 46)}<span><b>Scout</b> finds</span>${bot("story_builder", "happy", 46)}<span><b>Story Builder</b> writes</span>${bot("gatekeeper", "happy", 46)}<span><b>Gatekeeper</b> guards your rider</span></div>
    <div class="form">
      <div><label for="q">Your event</label><textarea id="q" placeholder="e.g. Motivational speaker for our 200-person sales kickoff in Denver, someone who came back from an injury">${esc(state.lastQuery || "")}</textarea></div>
      <div class="row"><div style="flex:0 1 200px"><label for="budget">Max budget (optional, enforced)</label><input id="budget" type="number" min="0" step="100" placeholder="5000" value="${esc(state.lastBudget || "")}"></div>
        <div style="flex:0 0 auto"><button class="btn" id="go">Find matches</button></div></div>
    </div>
    <div class="chips">${EXAMPLES.map((x, i) => `<button class="chip" data-ex="${i}">${esc(x.slice(0, 48))}…</button>`).join("")}</div>
  </section>
  <section id="results">${state.lastScout ? scoutResults(state.lastScout) : ""}</section>
  ${howItWorks()}`;
  document.querySelectorAll("[data-ex]").forEach((c) => (c.onclick = () => { $("#q").value = EXAMPLES[c.dataset.ex]; $("#budget").value = ""; }));
  $("#go").onclick = runScout;
  $("#q").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runScout(); };
}
async function runScout() {
  const text = $("#q").value.trim(); const b = $("#budget").value;
  if (!text) return toast("Describe your event first.");
  state.lastQuery = text; state.lastBudget = b;
  const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Scouting…`;
  $("#results").innerHTML = thinking("scout", `Scout is reading your request and searching ${state.athletes.length} athletes`);
  try {
    state.lastScout = await api("/api/scout", { method: "POST", body: { text, budget: b ? Number(b) : null } });
    $("#results").innerHTML = scoutResults(state.lastScout);
  } catch (err) { $("#results").innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
  btn.disabled = false; btn.textContent = "Find matches";
}
function scoutResults(r) {
  if (r.blocked) return `<div class="alert bad">🛡️ <b>Blocked.</b> ${esc(r.note)}<br><small>Flags: ${r.flags.map(esc).join(", ")}</small></div>${usageLine(r.glass, true)}`;
  const b = r.brief || {};
  const brief = [["Event", b.event_type], ["City", b.city], ["Audience", b.audience], ["Budget", b.budget_max != null ? money(b.budget_max) : null], ["Date", b.date], ["Themes", (b.themes || []).join(", ")]]
    .filter(([, v]) => v).map(([k, v]) => `<span><b>${k}:</b> ${esc(v)}</span>`).join("");
  const dropped = (r.dropped || []).length ? `<div class="note">🛡️ Safety check removed ${r.dropped.length} suggestion(s): ${r.dropped.map((d) => esc(d.reason)).join("; ")}</div>` : "";
  return `<h2>What Scout understood</h2><div class="brief">${brief}</div>
    ${r.note ? `<div class="note">💬 ${esc(r.note)}</div>` : ""}${dropped}${usageLine(r.usage)}
    <h2>${r.matches.length ? `Top ${r.matches.length} matches` : "No matches yet"}</h2>
    <div class="grid three">${r.matches.map((m) => athleteCard(m.athlete, {
      score: `<div class="score">${m.fit_score}<small>FIT /10</small></div>`,
      why: `<div class="why"><b>Why ${esc(m.athlete.name.split(" ")[0])}:</b> ${esc(m.why)}</div>` })).join("")}</div>`;
}

// ---------------------------------------------------------------- booker: browse
function viewBrowse() {
  const sports = [...new Set(state.athletes.map((a) => a.sport))].sort();
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>The roster</h1><p class="sub">${state.athletes.length} athletes. All demo profiles are fictional.</p>
    <div class="panel" style="margin-bottom:16px"><div class="row">
      <div><label>Sport</label><select id="f-sport"><option value="">Any</option>${sports.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      <div><label>Type</label><select id="f-cat"><option value="">Any</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>State</label><select id="f-state"><option value="">Any</option>${[...new Set(state.athletes.map((a) => a.state))].sort().map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div><label>Max fee</label><input id="f-fee" type="number" step="100" placeholder="any"></div>
      <div><label>Available on</label><select id="f-day"><option value="">Any day</option>${Object.entries(state.riderOpts.days).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>Time of day</label><select id="f-time"><option value="">Any time</option>${Object.entries(state.riderOpts.times).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
    </div></div><div class="grid three" id="roster"></div>`;
  const draw = () => {
    const s = $("#f-sport").value, c = $("#f-cat").value, st = $("#f-state").value, f = Number($("#f-fee").value) || Infinity;
    const dy = $("#f-day").value, tm = $("#f-time").value;
    const list = state.athletes.filter((a) => (!s || a.sport === s) && (!c || a.categories.includes(c)) && (!st || a.state === st) && a.fee_min <= f
      && (!dy || a.availability.days.includes(dy)) && (!tm || a.availability.times.includes(tm)));
    $("#roster").innerHTML = list.map((a) => athleteCard(a)).join("") || `<div class="empty">No one matches those filters.</div>`;
  };
  ["#f-sport", "#f-cat", "#f-state", "#f-fee", "#f-day", "#f-time"].forEach((id) => ($(id).oninput = draw));
  draw();
}

// ---------------------------------------------------------------- booker: request modal + my requests
function requestModal(athleteId) {
  const a = state.athletes.find((x) => x.id === athleteId);
  const b = state.lastScout?.brief || {};
  openModal(`<h2>Request ${esc(a.name)}</h2>
    <p class="sub">Their contact details stay private until they accept. Every request is screened by Gatekeeper before it reaches them.</p>
    <div class="form">
      <div class="row"><div><label>Your name</label><input id="r-name" value="${esc(state.bookerName)}"></div><div><label>Organization</label><input id="r-org"></div></div>
      <div class="row"><div><label>Type</label><select id="r-type">${a.categories.map((c) => `<option value="${c}">${CAT[c]}</option>`).join("")}</select></div>
        <div><label>Date</label><input id="r-date" type="date"></div><div><label>Start time</label><input id="r-time" type="time"></div></div>
      <div class="row"><div><label>City</label><input id="r-city" value="${esc(b.city || "")}"></div><div><label>Budget offered ($)</label><input id="r-budget" type="number" step="100" value="${esc(b.budget_max ?? state.lastBudget ?? "")}"></div></div>
      <div><label>Message</label><textarea id="r-msg" rows="4" placeholder="Tell ${esc(a.name.split(" ")[0])} about the event, audience, and what you'd like them to do."></textarea></div>
      <div class="meta">Fee range: ${money(a.fee_min)}–${money(a.fee_max)}</div>
      <div class="avail-req">${availLine(a)}<div id="r-avail-warn" class="conflict" hidden></div></div>
      ${riderBlock(a)}
      <div><label>Transportation you'll provide</label><select id="r-transport">
        <option value="Pick-up and drop-off provided">Pick-up and drop-off provided</option>
        <option value="Mileage reimbursed">Mileage reimbursed</option>
        <option value="Athlete arranges own transportation">Athlete arranges own transportation</option></select></div>
      ${isCollege(a) ? `<div class="nil-box"><b>🎓 ${esc(a.name.split(" ")[0])} is a current college athlete. NIL rules apply.</b>
        <ul><li>No offer can depend on enrolling at, transferring to, or staying at a school, or on game performance.</li>
        <li>No school logos, uniforms, or trademarks without the school's permission.</li>
        <li>Pay must match real work. Larger deals may need to be reported by the athlete (for Division I: NIL Go, $600+).</li></ul>
        <label class="agree"><input type="checkbox" id="r-nil"> I confirm this offer follows these NIL rules.</label></div>` : ""}
      <label class="agree"><input type="checkbox" id="r-agree"> I agree to ${esc(a.name.split(" ")[0])}'s Event Rider above and the
        <a href="#" id="r-terms">NextPlay Pros Terms</a> (including the no-show refund and cancellation policy).</label>
      <button class="btn" id="r-send" disabled>Send request</button><div id="r-out"></div>
    </div>`);
  if (a.rider && a.rider.transport === "pickup") $("#r-transport").value = "Pick-up and drop-off provided";
  const ready = () => ($("#r-send").disabled = !$("#r-agree").checked || ($("#r-nil") && !$("#r-nil").checked));
  $("#r-agree").onchange = ready;
  const checkAvail = () => {
    const w = availWarnings(a, $("#r-date").value, $("#r-time").value);
    $("#r-avail-warn").hidden = !w.length; $("#r-avail-warn").textContent = w.length ? "⚠️ " + w.join(" · ") + ". You can still send it, but the athlete will see this." : "";
  };
  $("#r-date").oninput = checkAvail; $("#r-time").oninput = checkAvail;
  if ($("#r-nil")) $("#r-nil").onchange = ready;
  $("#r-terms").onclick = (e) => { e.preventDefault(); closeModal(); state.tab = "terms"; render(); };
  $("#r-send").onclick = async () => {
    if (!$("#r-agree").checked) return toast("Please agree to the Event Rider and Terms first.");
    if ($("#r-nil") && !$("#r-nil").checked) return toast("Please confirm the NIL rules first.");
    const body = { agreed_nil: !!$("#r-nil"), agreed_terms: true, transport_offered: $("#r-transport").value, athlete_id: a.id, booker_id: state.bookerId, booker_name: $("#r-name").value.trim(), org: $("#r-org").value.trim(),
      event_type: $("#r-type").value, event_date: $("#r-date").value, event_time: $("#r-time").value, city: $("#r-city").value.trim(),
      budget: $("#r-budget").value ? Number($("#r-budget").value) : null, message: $("#r-msg").value.trim() };
    if (!body.booker_name || !body.org || !body.message) return toast("Name, organization, and message are required.");
    state.bookerName = body.booker_name; localSet("np_booker_name", body.booker_name);
    const btn = $("#r-send"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Gatekeeper is screening…`; $("#r-out").innerHTML = thinking("gatekeeper", "Gatekeeper is checking this request for scams");
    try {
      const r = await api("/api/requests", { method: "POST", body });
      const s = r.screening;
      $("#r-out").innerHTML = r.status === "blocked"
        ? `<div class="alert bad">🛡️ <b>Not delivered.</b> Gatekeeper blocked this request: ${esc((s.risk_flags.concat(s.rule_flags)).join(", "))}.</div>`
        : `<div class="alert good">✅ Sent to ${esc(a.name)}${r.status === "flagged" ? " (marked for a careful look)" : ""}. Track it under <b>My requests</b>.</div>`;
      $("#r-out").innerHTML += usageLine(s.usage);
      btn.textContent = "Sent";
    } catch (err) { $("#r-out").innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = "Send request"; }
  };
}

async function viewMine() {
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>My requests</h1><p class="sub">Contact details unlock only after an athlete accepts.</p><div id="list" class="grid"><div class="thinking"><span class="spinner"></span>Loading…</div></div>`;
  const list = await api(`/api/requests/booker/${state.bookerId}`);
  $("#list").innerHTML = list.length ? list.map((r) => `<div class="req">
    <div class="req-top"><div><b>${esc(r.athlete_name)}</b> · <span class="meta">${esc(CAT[r.event_type] || r.event_type)} · ${esc(r.event_date || "date TBD")} · ${money(r.budget)}</span></div><span class="status ${r.status}">${r.status}</span></div>
    <p class="msg">${esc(r.message)}</p>
    ${r.payout ? commitPanel(r, "booker") : ""}
    ${r.contact ? `<div class="contact">🔓 <b>Contact unlocked:</b> ${esc(r.contact.email)}${r.contact.phone ? " · " + esc(r.contact.phone) : ""}</div>`
      : r.status === "blocked" ? `<div class="alert bad">🛡️ Blocked by Gatekeeper: ${esc(r.screening.summary)}</div>`
      : `<div class="locked">🔒 Contact details stay private until ${esc(r.athlete_name.split(" ")[0])} accepts.</div>`}
  </div>`).join("") : `<div class="empty">No requests yet. Use <b>Find talent</b> to send one.</div>`;
}

// ---------------------------------------------------------------- athlete: inbox
async function viewInbox() {
  const opts = state.athletes.map((a) => `<option value="${a.id}" ${a.id === state.athleteId ? "selected" : ""}>${esc(a.name)} (${esc(a.sport)})</option>`).join("");
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><div class="row" style="margin-bottom:16px"><div><h1>My inbox</h1><p class="sub" style="margin:0">Every request is screened by Gatekeeper first. You decide who gets your contact info.</p></div>
    <div style="flex:0 1 280px"><label>Demo sign-in: viewing as</label><select id="who">${opts}</select></div></div><div id="inbox" class="grid"></div>`;
  $("#who").onchange = () => { state.athleteId = $("#who").value; localSet("np_athlete", state.athleteId); drawInbox(); };
  drawInbox();
}
async function drawInbox() {
  const who = state.athleteId;
  const list = await api(`/api/requests/athlete/${who}`);
  if (who !== state.athleteId || !$("#inbox")) return; // a newer selection already drew
  const open = list.filter((r) => r.status !== "blocked"), blocked = list.filter((r) => r.status === "blocked");
  const reqHtml = (r) => `<div class="req">
    <div class="req-top"><div><b>${esc(r.org)}</b> <span class="meta">· ${esc(r.booker_name)} · ${esc(r.city || "")} · ${esc(r.event_date || "date TBD")}</span></div><span class="status ${r.status}">${r.status}</span></div>
    <div class="gate"><div class="label">${bot("gatekeeper", r.status === "blocked" ? "classic" : "happy", 22)} Gatekeeper summary</div>${(r.screening.rider_conflicts || []).length ? `<div class="conflict">⚠️ Conflicts with your Event Rider: ${esc(r.screening.rider_conflicts.join("; "))}</div>` : ""}${esc(r.screening.summary)}<br><span class="meta">${esc(r.screening.fee_note)}</span>
      ${(r.screening.risk_flags || []).length || (r.screening.rule_flags || []).length ? `<br><span class="meta">⚠️ ${esc([...(r.screening.risk_flags || []), ...(r.screening.rule_flags || [])].join(", "))}</span>` : ""}</div>
    <details><summary>Read full message</summary><p class="msg">${esc(r.message)}</p></details>
    ${r.payout ? commitPanel(r, "athlete") : ""}
    ${["pending", "flagged"].includes(r.status) ? `<div class="row" style="justify-content:flex-start"><button class="btn good small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="1">Accept & share my contact</button><button class="btn ghost small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="0">Decline</button></div>` : ""}
  </div>`;
  $("#inbox").innerHTML = (open.map(reqHtml).join("") || `<div class="empty">No requests yet. Switch to <b>I'm booking talent</b> and send this athlete one.</div>`)
    + (blocked.length ? `<details><summary>🛡️ ${blocked.length} request(s) blocked by Gatekeeper</summary><div class="grid">${blocked.map(reqHtml).join("")}</div></details>` : "");
  document.querySelectorAll("[data-checkin]").forEach((b) => (b.onclick = async () => {
    try { await api(`/api/requests/${b.dataset.checkin}/checkin`, { method: "POST", body: { athlete_id: state.athleteId } });
      toast("Checked in. Thanks for being early!"); drawInbox(); } catch (err) { toast(err.message); }
  }));
  document.querySelectorAll("[data-decide]").forEach((b) => (b.onclick = async () => {
    try { await api(`/api/requests/${b.dataset.decide}/decide`, { method: "POST", body: { athlete_id: state.athleteId, accept: b.dataset.accept === "1" } });
      toast(b.dataset.accept === "1" ? "Accepted. The booker can now see your contact details." : "Declined."); drawInbox();
    } catch (err) { toast(err.message); }
  }));
}

// ---------------------------------------------------------------- athlete: Story Builder
function viewBuild() {
  const levels = ["Former Pro", "Former College", "Olympian", "Paralympian", "Current Pro", "Rising (College)", "Rising (Minor League)", "Rising (Pro-Am)"];
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>Build my profile</h1><p class="sub">No agent? No problem. Tell your story in your own words and Story Builder turns it into a profile bookers want to hire.</p>
  <div class="grid two"><div class="panel form">
    <div class="row"><div><label>Name</label><input id="s-name"></div><div><label>Sport</label><input id="s-sport"></div></div>
    <div class="row"><div><label>Level</label><select id="s-level">${levels.map((l) => `<option>${l}</option>`).join("")}</select></div>
      <div><label>Home city</label><select id="s-city">${state.cities.map((c) => `<option>${esc(c)}</option>`).join("")}</select></div></div>
    <div><label>Your story, in your own words</label><textarea id="s-notes" rows="8" placeholder="Where you played, the hardest moment, what you do now, what you'd love to talk about or do at events…"></textarea></div>
    <button class="btn" id="s-go">Write my profile</button>
  </div><div id="s-out" class="panel"><div class="empty">Your draft will appear here.</div></div></div>`;
  $("#s-city").value = "Denver";
  $("#s-go").onclick = async () => {
    const body = { name: $("#s-name").value.trim(), sport: $("#s-sport").value.trim(), level: $("#s-level").value, city: $("#s-city").value, notes: $("#s-notes").value.trim() };
    if (!body.name || !body.sport || body.notes.length < 30) return toast("Add your name, sport, and a few sentences about your story.");
    const btn = $("#s-go"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Writing…`;
    $("#s-out").innerHTML = thinking("story_builder", "Story Builder is writing your profile");
    try { const r = await api("/api/story", { method: "POST", body }); state.draft = { ...body, ...r }; drawDraft(); }
    catch (err) { $("#s-out").innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
    btn.disabled = false; btn.textContent = "Rewrite";
  };
}
function drawDraft() {
  const { draft: d, usage } = state.draft;
  $("#s-out").innerHTML = `${usageLine(usage)}
    <div class="form">
      <div><label>Headline</label><input id="d-headline" value="${esc(d.headline)}"></div>
      <div><label>Bio</label><textarea id="d-bio" rows="5">${esc(d.bio)}</textarea></div>
      <div><label>Intro story (what bookers see first)</label><textarea id="d-story" rows="3">${esc(d.story)}</textarea></div>
      <div><label>Topics</label>${d.topics.map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
      <div><label>Great for</label>${d.best_fit_events.map((t) => `<span class="pill cat">${esc(t)}</span>`).join("")}</div>
      ${d.claims_to_verify.length ? `<div class="note"><b>✔ Before going live, we'll verify:</b><ul style="margin:6px 0 0;padding-left:18px">${d.claims_to_verify.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      <div class="row"><div><label>Min fee ($)</label><input id="d-min" type="number" step="50" value="500"></div><div><label>Max fee ($)</label><input id="d-max" type="number" step="50" value="1500"></div></div>
      <div class="row"><div><label>Private email (vault)</label><input id="d-email" type="email"></div><div><label>Private phone (vault)</label><input id="d-phone"></div></div>
      <div class="meta">🔒 Email and phone go into the private vault. Nobody sees them, not even our team, until you accept a booking.</div>
      <button class="btn good" id="d-pub">Publish profile</button>
    </div>`;
  $("#d-pub").onclick = async () => {
    const s = state.draft;
    const body = { name: s.name, sport: s.sport, level: s.level, city: s.city, career: "",
      draft: { ...d, headline: $("#d-headline").value, bio: $("#d-bio").value, story: $("#d-story").value },
      fee_min: Number($("#d-min").value), fee_max: Number($("#d-max").value), email: $("#d-email").value.trim(), phone: $("#d-phone").value.trim() };
    if (!body.email) return toast("Add a private email so bookers can reach you after you accept.");
    try { const a = await api("/api/athletes", { method: "POST", body }); await loadRoster(); state.athleteId = a.id; localSet("np_athlete", a.id);
      toast(`Published! ${a.name} is now on the roster.`); state.tab = "inbox"; render();
    } catch (err) { toast(err.message); }
  };
}

// ---------------------------------------------------------------- opportunity board
async function viewBoard() {
  const list = await api("/api/opportunities");
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>Opportunity board</h1><p class="sub">Open gigs posted by local businesses, schools, and nonprofits.</p>
    <div class="grid two">${list.map((o) => `<div class="card"><div class="req-top"><b>${esc(o.title)}</b><span class="pill cat">${CAT[o.type]}</span></div>
      <div class="meta">${esc(o.org)} · ${esc(o.city)} · ${esc(o.date)}</div><p class="story">${esc(o.details)}</p>
      <div class="card-foot"><span class="fee">Up to ${money(o.budget_max)}</span>
      ${state.role === "booker" ? `<button class="btn small ghost" data-scout-opp="${o.id}">Find matches with Scout</button>` : ""}</div></div>`).join("")}</div>`;
  document.querySelectorAll("[data-scout-opp]").forEach((b) => (b.onclick = () => {
    const o = list.find((x) => x.id === b.dataset.scoutOpp);
    state.lastQuery = `${o.title} for ${o.org} in ${o.city} on ${o.date}. ${o.details}`; state.lastBudget = o.budget_max; state.lastScout = null;
    state.tab = "find"; render(); runScout();
  }));
}

// ---------------------------------------------------------------- behind the scenes
async function viewBehind() {
  $("#view").innerHTML = `<h1>Behind the scenes</h1><p class="sub">Every AI run's real token count and cost, and every safety guard that fired.</p><div id="bts"><div class="thinking"><span class="spinner"></span>Loading…</div></div>`;
  const [u, s] = await Promise.all([api("/api/usage"), api("/api/safety")]);
  const agents = Object.entries(u.by_agent);
  $("#bts").innerHTML = `
    <div class="grid three" style="margin-bottom:16px">
      <div class="stat"><div class="v">${u.runs.length ? Object.values(u.by_agent).reduce((n, a) => n + a.runs, 0) : 0}</div><div class="k">AI runs logged</div></div>
      <div class="stat"><div class="v">$${u.spent_today_usd.toFixed(4)}</div><div class="k">spent today (cap $${u.daily_cap_usd.toFixed(2)})</div></div>
      <div class="stat"><div class="v">${s.length}</div><div class="k">safety guards fired</div></div>
    </div>
    <div class="panel" style="margin-bottom:16px"><h2>Average per run, by agent</h2><div class="table-wrap"><table><tr><th>Agent</th><th class="num">Runs</th><th class="num">Input</th><th class="num">Cached</th><th class="num">Output</th><th class="num">Cost / run</th><th class="num">Seconds</th></tr>
      ${agents.map(([k, a]) => `<tr><td>${esc(k)}</td><td class="num">${a.runs}</td><td class="num">${a.avg_input_tokens}</td><td class="num">${a.avg_cached_input_tokens}</td><td class="num">${a.avg_output_tokens}</td><td class="num">$${a.avg_cost_usd.toFixed(6)}</td><td class="num">${a.avg_seconds}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No runs yet</td></tr>`}</table></div></div>
    <div class="panel" style="margin-bottom:16px"><h2>Safety log</h2><div class="table-wrap"><table><tr><th>Time (UTC)</th><th>Guard</th><th>Where</th><th>Detail</th></tr>
      ${s.map((r) => `<tr><td>${esc(r.time.replace("T", " ").slice(0, 19))}</td><td><b>${esc(r.guard)}</b></td><td>${esc(r.where)}</td><td><code>${esc(JSON.stringify(r.detail)).slice(0, 220)}</code></td></tr>`).join("") || `<tr><td colspan="4" class="empty">Nothing has fired yet</td></tr>`}</table></div></div>
    <div class="panel"><h2>Recent runs</h2><div class="table-wrap"><table><tr><th>Time (UTC)</th><th>Agent</th><th class="num">Calls</th><th class="num">Tools</th><th class="num">Input</th><th class="num">Cached</th><th class="num">Output</th><th class="num">Cost</th></tr>
      ${u.runs.map((r) => `<tr><td>${esc(r.time.replace("T", " ").slice(0, 19))}</td><td>${esc(r.agent)}</td><td class="num">${r.requests}</td><td class="num">${r.tool_calls}</td><td class="num">${r.input_tokens}</td><td class="num">${r.cached_input_tokens}</td><td class="num">${r.output_tokens}</td><td class="num">$${r.cost_usd.toFixed(6)}</td></tr>`).join("")}</table></div></div>`;
}


// ---------------------------------------------------------------- about
// Two real athletes from the founder's own circle, shown to illustrate who NextPlay Pros is for.
// Facts come from the public sources listed on the page. They are NOT in the demo roster (no fees, no contacts).
const FEATURED = [
  { name: "MG Vellinga", alt: "Maryguenn Vellinga", role: "Professional boxer · Park City, Utah", photo: "/static/img/mg.jpg", initials: "MG", hue: 330,
    credit: "Photo courtesy of MG Vellinga",
    facts: [
      "Started boxing at 28 and climbed to No. 2 nationally in the Elite Female 112-lb division at the 2017 USA Boxing National Championships [1]",
      "Competed for Utah at the 2018 National Golden Gloves, part of the first full Utah women's team sent to the tournament [2]",
      "Co-founded RISE Boxing in Park City, including therapeutic boxing classes for people living with Parkinson's disease [3]",
      "Runs Mountain Mettle, a charity boxing night that funds youth scholarships through the RISE Strong Foundation [4]",
    ],
    why: "A late starter who became a national contender, then built a business and a charity around the sport. That story fits keynotes on grit and second acts, women-in-sport panels, and hands-on clinics, and she is exactly the kind of athlete bookers don't know how to find." },
  { name: "Mehmet “Memo” Okur", alt: "Mehmet Okur", role: "Former NBA center · Utah Jazz 2004–2011", photo: "/static/img/okur.jpg", initials: "MO", hue: 210,
    credit: 'Photo: Lordcolus (Flickr), <a href="https://commons.wikimedia.org/wiki/File:Mehmo.jpg" target="_blank" rel="noopener">CC BY 2.0</a>',
    facts: [
      "NBA champion with the 2004 Detroit Pistons, then signed with the Utah Jazz in July 2004 and played seven seasons in Salt Lake City [5]",
      "2007 NBA All-Star [5]",
      "Named a Utah Jazz team ambassador after his playing career [6]",
    ],
    why: "A champion and All-Star whose name still means something in Utah and in Turkey, now well past his playing days. NextPlay Pros would put him in front of community events, youth clinics, and Turkish-American groups that would love to book him but have no idea how to reach him." },
  { name: "Jeremy Bloom", alt: "Jeremy Bloom", role: "Two-time Olympic skier · NFL draft pick · Colorado", photo: "/static/img/bloom.jpg", initials: "JB", hue: 200,
    credit: 'Photo: Web Summit / Sportsfile, <a href="https://commons.wikimedia.org/wiki/File:Sportsfile_(Web_Summit)_(15090782254).jpg" target="_blank" rel="noopener">CC BY 2.0</a>',
    facts: [
      "Born in Fort Collins and raised in Loveland; at 15, the youngest male freestyle skier ever named to the U.S. Ski Team [7]",
      "Two-time Olympian in moguls (2002, 2006), three-time World Champion, 11 World Cup wins; U.S. Ski Hall of Fame, 2013 [7]",
      "Freshman All-American receiver and return man at the University of Colorado; drafted by the Philadelphia Eagles in 2006 [7]",
      "Co-founded the marketing-tech company Integrate and founded Wish of a Lifetime, a nonprofit that grants wishes to seniors [7]",
    ],
    why: "Two sports, a business, and a charity: a story companies pay to hear at keynotes. NextPlay Pros would also put him within reach of the schools, senior centers, and local nonprofits that would never know how to book him." },
  { name: "Wyndham Clark", alt: "Wyndham Clark", role: "Two-time U.S. Open champion · Denver", photo: "/static/img/clark.jpg", initials: "WC", hue: 130,
    credit: 'Photo: Titleist, <a href="https://commons.wikimedia.org/wiki/File:Wyndham_Clark_2023_01.png" target="_blank" rel="noopener">CC BY 3.0</a>',
    facts: [
      "Born in Denver in 1993; played college golf at Oklahoma State and the University of Oregon [8]",
      "Turned pro in 2017 and broke through in 2023 with the Wells Fargo Championship and his first U.S. Open [8]",
      "Won his second U.S. Open in June 2026 at Shinnecock Hills, leading wire to wire [9]",
    ],
    why: "A Denver kid who became a two-time major champion. Even at the top of the game, his hometown's junior clinics, school assemblies, and charity events have no simple way to ask. That's the gap NextPlay Pros closes, and it's even bigger for local golf pros who never made the Tour."},
  { name: "Courtney Dauwalter", alt: "Courtney Dauwalter", role: "Ultrarunner · former teacher · Leadville, CO", photo: "/static/img/dauwalter.jpg", initials: "CD", hue: 20,
    credit: 'Photo: Heike Maria Seitz, <a href="https://commons.wikimedia.org/wiki/File:Courtney_Dauwalter_(2019).jpg" target="_blank" rel="noopener">CC BY-SA 4.0</a>',
    facts: [
      "Grew up in Minnesota, won four state titles in Nordic skiing, and skied for the University of Denver on scholarship [10]",
      "Taught middle and high school before running full time starting in 2017 [10]",
      "In 2023, became the first person to win Western States, Hardrock, and UTMB in the same year, with course records [10][11]",
    ],
    why: "A teacher who became the best in the world, and still talks like a teacher. Schools, running clubs, and companies would line up to hear that story, and local trail races would love her at the start line. NextPlay Pros makes that one request away." },
];
function viewAbout() {
  const card = (a) => `<article class="feature">
    <div class="feature-photo" style="--h:${a.hue}">
      <img src="${a.photo}" alt="${esc(a.alt)}" onerror="this.remove()">
      <span>${esc(a.initials)}</span>
    </div>
    <div class="feature-body">
      <h2>${esc(a.name)}</h2><div class="meta">${esc(a.role)}</div>
      <ul>${a.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <div class="why"><b>Why NextPlay Pros:</b> ${esc(a.why)}</div>
      ${a.credit ? `<div class="credit">${a.credit}</div>` : ""}
    </div></article>`;
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div>
  <section class="hero about-hero">
    <div class="about-crew">${bot("scout", "happy", 96)}${bot("story_builder", "happy", 96)}${bot("gatekeeper", "happy", 96)}</div>
    <h1>Every athlete's story deserves an audience</h1>
    <button class="story-btn" data-story>▶ Watch our 20-second story</button>
    <p>NextPlay Pros connects former, current, and rising athletes with the schools, companies, nonprofits, and local businesses that want them for talks, appearances, clinics, and events. We do the matching, the writing, and the scam screening. The athlete decides who gets their contact details.</p>
  </section>
  <h2 class="about-h">Meet your team</h2>
  <p class="sub">Every pro has a team: a scout, a publicist, security. Most athletes never get one. NextPlay Pros gives every athlete a team of three.</p>
  <div class="grid three team">
    <div class="card team-card">${bot("scout", "happy", 140)}<div><h3>Scout</h3><div class="role">Your talent scout</div><p>Reads what a booker is planning, searches the roster, and puts you forward when your story fits: the theme, the city, the budget, and the day you're free.</p></div></div>
    <div class="card team-card">${bot("story_builder", "happy", 140)}<div><h3>Story Builder</h3><div class="role">Your publicist</div><p>Turns your rough notes into a profile bookers want to hire, using only your facts, and flags every claim to verify before it goes live.</p></div></div>
    <div class="card team-card">${bot("gatekeeper", "happy", 140)}<div><h3>Gatekeeper</h3><div class="role">Your appearance guardrails</div><p>Checks every request against your rider, your schedule, and your safety rules before you see it, and stops scams, tricks, and NIL problems.</p></div></div>
  </div>
  <h2 class="about-h">Who it serves</h2>
  <div class="grid three serve">
    <div class="card"><div class="serve-ico">🏅</div><h3>Athletes</h3><p>Retired pros, college standouts, Olympians in smaller sports, and rising players with real stories and <b>no agent</b>. NextPlay Pros writes their profile, brings them paid gigs, and keeps them in control.</p></div>
    <div class="card"><div class="serve-ico">🏢</div><h3>Bookers</h3><p>Schools, companies, nonprofits, and local businesses that want a relatable athlete <b>nearby and in budget</b>, not a celebrity with a five-figure fee and a bureau in the middle.</p></div>
    <div class="card"><div class="serve-ico">🤝</div><h3>Communities</h3><p>Kids hear from someone who's been there, employees get a story that sticks, and local athletes stay connected to the places that cheered for them.</p></div>
  </div>
  <h2 class="about-h">The story in 30 seconds</h2>
  <ol class="story-steps">
    <li><b>The gap.</b> Only about 1–2% of college athletes reach a major pro league, and pro careers are short. Thousands of great stories never find an audience.</li>
    <li><b>The problem.</b> Bookers don't know how to reach these athletes, and athletes don't know the gigs exist. Bureaus serve the famous few and take 20–30%.</li>
    <li><b>The fix.</b> Describe your event in plain English. We find athletes who fit the story, city, and budget, screen every request for scams, and unlock contact details only when the athlete says yes.</li>
    <li><b>Why it matters.</b> Athletes earn from their story on their own terms, with their own rules for safety and travel. Bookers get the right person in minutes.</li>
  </ol>
  <div class="panel founder">
    <h2>Why I'm building this</h2>
    <p>I spent years doing design work alongside sports and event teams in Utah. Over and over I met athletes with incredible stories who were past their playing days, not household names, or still on the rise, and the businesses and events that would have loved to book them had no idea how to reach them. NextPlay Pros is the bridge I kept wishing existed.</p>
    <p class="meta">Adrian Pucci · Yale SOM · MGT 409 final project</p>
  </div>
  <h2 class="about-h">Athletes who show why</h2>
  <p class="sub">Real athletes who show who NextPlay Pros is for. MG and Memo are from my own circle; Jeremy, Wyndham, and Courtney are Colorado stories everyone here knows. They are shown to illustrate the idea, not as members: they are not in the demo roster, and no fees or contact details are listed.</p>
  <div class="grid">${FEATURED.map(card).join("")}</div>
  <div class="panel sources"><b>Sources</b><ol>
    <li><a href="https://www.sltrib.com/sports/2017/12/04/park-citys-maryguenn-vellinga-is-utahs-best-hope-for-glory-as-salt-palace-hosts-usa-boxing-national-championships-this-week" target="_blank" rel="noopener">Salt Lake Tribune, Dec 2017</a></li>
    <li><a href="https://www.sltrib.com/sports/2018/05/13/for-the-first-time-utah-is-sending-a-full-womens-team-to-the-national-golden-gloves-boxing-tournament" target="_blank" rel="noopener">Salt Lake Tribune, May 2018</a></li>
    <li><a href="https://www.kpcw.org/show/mountain-money/2024-10-28/local-boxing-gym-punches-back-against-parkinsons-disease" target="_blank" rel="noopener">KPCW, Oct 2024</a></li>
    <li><a href="https://townlift.com/2026/08/mountain-mettle-returns-aug-22-with-focus-on-youth-scholarships/" target="_blank" rel="noopener">TownLift, Aug 2026</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Mehmet_Okur" target="_blank" rel="noopener">Wikipedia: Mehmet Okur</a></li>
    <li><a href="https://www.deseret.com/2014/9/28/20549451/mehmet-okur-named-team-ambassador-for-utah-jazz" target="_blank" rel="noopener">Deseret News, Sep 2014</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Jeremy_Bloom" target="_blank" rel="noopener">Wikipedia: Jeremy Bloom</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Wyndham_Clark" target="_blank" rel="noopener">Wikipedia: Wyndham Clark</a></li>
    <li><a href="https://www.cbsnews.com/news/wyndham-clark-u-s-open-2026-golf/" target="_blank" rel="noopener">CBS News, Jun 2026</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Courtney_Dauwalter" target="_blank" rel="noopener">Wikipedia: Courtney Dauwalter</a></li>
    <li><a href="https://ultrarunning.com/featured/2023-ultrarunner-of-the-year-courtney-dauwalter/" target="_blank" rel="noopener">UltraRunning Magazine, 2023 Ultrarunner of the Year</a></li>
  </ol></div>`;
}

// ---------------------------------------------------------------- Event Rider (athlete-controlled parameters)
const isCollege = (a) => /^rising/i.test(a.level || "") && /college/i.test(a.level || "");
function riderChips(a) {
  const r = a.rider, o = state.riderOpts;
  if (!r || !o) return "";
  const chips = [];
  if (r.transport === "pickup") chips.push("🚗 Pick-up & drop-off");
  if (r.security.includes("escort")) chips.push("🛡️ Security escort");
  if (r.wont_do.length) chips.push(`⛔ ${r.wont_do.length + (r.wont_do_other ? 1 : 0)} won't-do`);
  chips.push(`⏱ ${r.max_hours} hr max`);
  if (isCollege(a)) chips.unshift("🎓 NIL rules apply");
  return `<div class="rider-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>`;
}
function riderBlock(a) {
  const r = a.rider, o = state.riderOpts;
  if (!r || !o) return "";
  const list = (keys, map) => keys.map((k) => `<li>${esc(map[k])}</li>`).join("");
  const wont = list(r.wont_do, o.wont_do) + (r.wont_do_other ? `<li>${esc(r.wont_do_other)}</li>` : "");
  return `<div class="rider-box"><div class="label">📋 ${esc(a.name.split(" ")[0])}'s Event Rider</div>
    <div class="rider-cols">
      <div><b>Must have</b><ul>${list(r.security, o.security)}${list(r.accommodations, o.accommodations)}
        <li>${esc(o.transport[r.transport])}</li><li>No more than ${r.max_hours} hours on site</li></ul></div>
      <div><b>Won't do</b><ul>${wont || "<li>Nothing listed</li>"}</ul></div>
    </div></div>`;
}
function viewRider() {
  const opts = state.athletes.map((a) => `<option value="${a.id}" ${a.id === state.athleteId ? "selected" : ""}>${esc(a.name)} (${esc(a.sport)})</option>`).join("");
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><div class="row" style="margin-bottom:16px"><div><h1>My event rider</h1><p class="sub" style="margin:0">Your rules for every booking. Bookers must agree to them before they can send you a request, and Gatekeeper flags any request that breaks them.</p></div>
    <div style="flex:0 1 280px"><label>Demo sign-in: viewing as</label><select id="who">${opts}</select></div></div><div id="rider-form"></div>`;
  $("#who").onchange = () => { state.athleteId = $("#who").value; localSet("np_athlete", state.athleteId); drawRiderForm(); };
  drawRiderForm();
}
function drawRiderForm() {
  const a = state.athletes.find((x) => x.id === state.athleteId) || state.athletes[0];
  const r = a.rider, o = state.riderOpts;
  const boxes = (name, map, sel) => Object.entries(map).map(([k, v]) =>
    `<label class="check"><input type="checkbox" name="${name}" value="${k}" ${sel.includes(k) ? "checked" : ""}> ${esc(v)}</label>`).join("");
  $("#rider-form").innerHTML = `<div class="grid two">
    <div class="panel profile-panel"><h2>📷 Profile photo</h2>
      <div class="photo-edit">${photoBox(a, "pro-photo small")}<div><p class="meta">Shown on your card to every booker. JPG or PNG, up to 6 MB. We crop it to a portrait.</p>
      <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp"><div id="photo-msg" class="meta"></div></div></div></div>
    <div class="panel profile-panel"><h2>🗓️ When I'm available</h2>
      <div class="day-grid">${Object.entries(o.days).map(([k, v]) => `<label class="check"><input type="checkbox" name="days" value="${k}" ${a.availability.days.includes(k) ? "checked" : ""}> ${v}</label>`).join("")}</div>
      <div style="margin-top:8px">${Object.entries(o.times).map(([k, v]) => `<label class="check"><input type="checkbox" name="times" value="${k}" ${a.availability.times.includes(k) ? "checked" : ""}> ${esc(v)}</label>`).join("")}</div>
      <div class="row" style="margin-top:8px"><div style="flex:0 1 220px"><label>Notice I need (days)</label><input id="notice-days" type="number" min="0" max="90" value="${a.availability.notice_days}"></div></div>
      <p class="meta" style="margin:6px 0 0">Bookers can filter by your days and times, Scout only suggests you when you're free, and Gatekeeper flags requests outside these.</p></div>
    <div class="panel"><h2>🛡️ Safety &amp; security</h2>${boxes("security", o.security, r.security)}
      <h2 style="margin-top:18px">🏨 Accommodations</h2>${boxes("accommodations", o.accommodations, r.accommodations)}
      <div class="row" style="margin-top:10px"><div style="flex:0 1 220px"><label>Most hours I'll be on site</label><input id="max-hours" type="number" min="1" max="12" value="${r.max_hours}"></div></div></div>
    <div class="panel"><h2>🚗 Transportation</h2>${Object.entries(o.transport).map(([k, v]) =>
      `<label class="check"><input type="radio" name="transport" value="${k}" ${r.transport === k ? "checked" : ""}> ${esc(v)}</label>`).join("")}
      <h2 style="margin-top:18px">⛔ I won't do</h2>${boxes("wont_do", o.wont_do, r.wont_do)}
      <label style="margin-top:8px">Anything else I won't do</label><input id="wont-other" maxlength="300" value="${esc(r.wont_do_other)}" placeholder="e.g. no events on Sundays, no tobacco or vape brands">
      <button class="btn good" id="rider-save" style="margin-top:14px">Save availability &amp; rider</button></div></div>`;
  $("#photo-file").onchange = async () => {
    const f = $("#photo-file").files[0]; if (!f) return;
    if (f.size > 6e6) return ($("#photo-msg").textContent = "That photo is over 6 MB.");
    $("#photo-msg").textContent = "Uploading…";
    const data_url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    try { await api(`/api/athletes/${a.id}/photo`, { method: "POST", body: { athlete_id: a.id, data_url } }); await loadRoster(); toast("Photo saved."); drawRiderForm(); }
    catch (err) { $("#photo-msg").textContent = err.message; }
  };
  $("#rider-save").onclick = async () => {
    const pick = (n) => [...document.querySelectorAll(`input[name="${n}"]:checked`)].map((i) => i.value);
    const rider = { security: pick("security"), accommodations: pick("accommodations"), wont_do: pick("wont_do"),
      transport: (document.querySelector('input[name="transport"]:checked') || {}).value || "self",
      wont_do_other: $("#wont-other").value.trim(), max_hours: Number($("#max-hours").value) || 3 };
    const availability = { days: pick("days"), times: pick("times"), notice_days: Number($("#notice-days").value) || 0 };
    try {
      await api(`/api/athletes/${a.id}/rider`, { method: "PUT", body: { athlete_id: a.id, rider } });
      await api(`/api/athletes/${a.id}/availability`, { method: "PUT", body: { athlete_id: a.id, availability } });
      await loadRoster(); toast("Saved. Bookers will see your availability and rider before they can send a request."); }
    catch (err) { toast(err.message); }
  };
}

// ---------------------------------------------------------------- Terms & Safety
function viewTerms() {
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>Terms &amp; Safety</h1>
  <p class="sub">Plain-English rules for everyone on NextPlay Pros. <b>Class-project draft:</b> these terms illustrate how the service would work and are not legal advice; a real launch would have them reviewed by a lawyer.</p>
  <div class="grid two">
    <div class="panel"><h2>For bookers</h2><ul class="terms">
      <li><b>No-show refund.</b> If the athlete does not show up, you get <b>100% of the fee back</b>.</li>
      <li><b>Cancellations.</b> Cancel 14+ days before the event: full refund. 7–13 days: 50% refund. Under 7 days: no refund unless the athlete agrees.</li>
      <li><b>Honor the Event Rider.</b> You agree to the athlete's security, accommodation, and transportation needs and their "won't do" list. If the rider is not honored, the athlete may leave and is still paid in full.</li>
      <li><b>Conduct.</b> No harassment, no recording or photos without consent, no requests to pay off-platform or share personal information.</li>
      <li><b>Accurate requests.</b> Describe the event honestly: audience, duration, sponsors, and anything involving alcohol, gambling, politics, or media.</li>
    </ul></div>
    <div class="panel"><h2>For athletes</h2><ul class="terms">
      <li><b>Independent contractor.</b> You work for yourself, not for NextPlay Pros. You set your fees and your rider.</li>
      <li><b>Accurate profile.</b> Your stats, teams, and titles must be true. Profiles we write for you flag every claim to verify before going live.</li>
      <li><b>Show up.</b> Accepting a request is a commitment. No-shows lose standing on the platform; real emergencies are handled case by case.</li>
      <li><b>Your safety comes first.</b> You can decline any request for any reason, and you can leave any event where you feel unsafe or your rider is not honored.</li>
      <li><b>Your contact details are yours.</b> They stay in a private vault and are shared only with a booker whose request you accept.</li>
    </ul></div>
  </div>
  <div class="panel" style="margin-top:16px"><h2>🤝 Commitment &amp; pay</h2><ul class="terms">
    <li><b>Escrow.</b> When an athlete accepts, the booker's full fee is held by NextPlay Pros. The money is real and waiting before anyone travels.</li>
    <li><b>Arrive one hour early.</b> Athletes check in with one tap at least <b>60 minutes before the start</b>.</li>
    <li><b>On-time reward.</b> Checking in on time cuts the athlete's platform fee from 10% to <b>5%</b>, so the athlete keeps more. On-time bookings build a reliability record that helps athletes get booked again.</li>
    <li><b>Late.</b> Checking in after the start sends <b>25% of the fee back to the booker</b>.</li>
    <li><b>No-show.</b> The booker gets <b>100% back</b>, the athlete gets nothing and a strike. Two strikes in 12 months pauses the account for 90 days. Real emergencies are reviewed case by case.</li>
    <li><b>Payout.</b> Released to the athlete 48 hours after the event unless the booker opens a dispute.</li>
  </ul></div>
  <div class="panel" style="margin-top:16px"><h2>🎓 NIL rules for college athletes</h2><ul class="terms">
    <li><b>18 and over only.</b> NextPlay Pros does not list high school or minor athletes.</li>
    <li><b>Your school's rules come first.</b> College athletes must follow their school, conference, and NCAA rules and tell their compliance office about NIL deals the way their school requires.</li>
    <li><b>Reporting.</b> Division I athletes must report third-party NIL deals worth $600 or more through NIL Go (College Sports Commission), within five business days of signing. Rules change often, so confirm with your compliance office.</li>
    <li><b>No pay-for-play or recruiting inducements.</b> No offer on NextPlay Pros may depend on enrolling at, transferring to, or staying at a school, or on athletic performance. Bookers confirm this for every college athlete, and Gatekeeper flags offers that look like inducements.</li>
    <li><b>No school marks without permission.</b> Bookers may not ask athletes to use school logos, uniforms, or trademarks unless the school has approved it.</li>
    <li><b>Banned categories.</b> Many schools ban NIL deals with alcohol, gambling, tobacco or vape, or adult products. Add these to your Event Rider so Gatekeeper flags them.</li>
    <li><b>International students.</b> Students on F-1 visas can put their visa status at risk by doing NIL work in the U.S. Talk to your international student office or an immigration attorney before accepting.</li>
    <li><b>Taxes.</b> NIL income is taxable. NextPlay Pros does not give legal, tax, or compliance advice.</li>
  </ul></div>
  <div class="panel" style="margin-top:16px"><h2>About the platform</h2><ul class="terms">
    <li><b>We connect, we're not a party to the booking.</b> NextPlay Pros introduces athletes and bookers. The agreement for each event is between the booker and the athlete.</li>
    <li><b>AI-assisted.</b> Matches, profiles, and request screening are produced by AI and checked by rules in code. AI can make mistakes; always confirm key details directly.</li>
    <li><b>Scam screening is a safety net, not a guarantee.</b> Never pay to be "selected," never send gift cards, and report anything suspicious.</li>
    <li><b>No endorsement.</b> Listing an athlete or booker does not mean we endorse them.</li>
    <li><b>Demo data.</b> The 40 athletes in this demo are fictional. Real athletes shown on the About page are there to illustrate the idea, with sources cited.</li>
  </ul></div>`;
}

// ---------------------------------------------------------------- commitment + pay (accepted bookings)
function commitPanel(r, side) {
  const p = r.payout, ci = p.checkin, when = [r.event_date, r.event_time].filter(Boolean).join(" at ") || "date TBD";
  const step = (done, txt) => `<li class="${done ? "done" : ""}">${done ? "✅" : "⬜"} ${txt}</li>`;
  const checked = ci.status !== "not_checked_in";
  return `<div class="commit"><div class="label">🤝 Commitment &amp; pay · ${esc(when)}</div>
    <ol class="steps">
      ${step(true, `Booker's ${money(p.escrow)} is held in escrow`)}
      ${step(checked, `Athlete checks in at least 60 minutes before the start <span class="meta">(${esc(ci.label)})</span>`)}
      ${step(false, "Payout released 48 hours after the event, unless the booker opens a dispute")}
    </ol>
    <div class="pay-grid">
      <div><b>${money(p.on_time_payout)}</b><span>athlete keeps if on time (5% fee)</span></div>
      <div><b>${money(p.standard_payout)}</b><span>if under 60 min early (10% fee)</span></div>
      <div><b>${money(Math.round(p.fee * 0.75 * 0.9))}</b><span>if late (25% back to booker)</span></div>
      <div><b>$0</b><span>no-show: booker refunded 100%, plus a strike</span></div>
    </div>
    ${side === "athlete" && !checked ? `<button class="btn good small" data-checkin="${r.id}">📍 I'm here: check in</button>` : ""}
    ${checked ? `<div class="meta">Current payout: <b>${money(p.athlete_payout)}</b>${p.booker_refund ? ` · ${money(p.booker_refund)} back to booker` : ""}</div>` : ""}
  </div>`;
}

function availWarnings(a, date, time) {
  const av = a.availability, o = state.riderOpts, out = [];
  if (!av) return out;
  if (date) {
    const d = new Date(date + "T12:00"), key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
    if (!av.days.includes(key)) out.push(`Not available on ${o.days[key]}s`);
    const lead = Math.round((d - new Date(new Date().toDateString())) / 864e5);
    if (lead >= 0 && lead < av.notice_days) out.push(`Needs ${av.notice_days} days' notice`);
  }
  if (time) {
    const h = Number(time.split(":")[0]), t = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    if (!av.times.includes(t)) out.push(`Not available ${o.times[t].split(" (")[0].toLowerCase()}`);
  }
  return out;
}

const VIEWS = { rider: viewRider, terms: viewTerms, about: viewAbout, find: viewFind, browse: viewBrowse, mine: viewMine, board: viewBoard, behind: viewBehind, inbox: viewInbox, build: viewBuild };

async function loadRoster() { state.athletes = await api("/api/athletes"); }
(async () => { [state.cities, state.riderOpts] = await Promise.all([api("/api/cities"), api("/api/rider-options"), loadRoster()]); render(); })();
