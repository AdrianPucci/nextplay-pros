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
  if (!STAFF) {  // public view: a short, plain line; the full Glass box (trace + model reasoning) is for staff/grading
    if (g.blocked) return `<div class="glass-lite">${uiIcon("shield", 14)} Stopped by our safety rules before any AI ran.</div>`;
    const LITE = { scout: "Every match is checked against the real roster, your budget, and our safety rules.",
      story_builder: "Written only from your own notes. Anything to double-check is flagged for you.",
      gatekeeper: "Screened against the athlete's rider and our safety rules." };
    return `<div class="glass-lite">${uiIcon("shield", 14)} ${LITE[g.agent] || "Checked by our safety rules."}</div>`;
  }
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
// Loading message; pass a list of steps and it walks through them while the agent works.
function thinking(agent, text) {
  const steps = Array.isArray(text) ? text : [text];
  return `<div class="thinking" data-steps='${esc(JSON.stringify(steps))}' data-i="0">${thinkStage(agent)}<div><span class="t-step">${esc(steps[0])}</span><span class="dots"><i></i><i></i><i></i></span></div></div>`;
}
// Each agent acts out its job while it works: Scout scans the field, Story Builder spins words, Gatekeeper scans the request.
function thinkStage(agent) {
  const b = bot(agent, "thinking", 64, "bouncing");
  if (agent === "scout") {
    const icons = ["Basketball", "Soccer", "Football", "Tennis", "Golf", "Hockey"];
    return `<div class="stage st-scout" aria-hidden="true"><span class="radar"></span><span class="radar r2"></span>
      <div class="orbit">${icons.map((n, i) => `<span class="orb" style="--a:${i * 60}deg">${sportSvg(n, 18)}</span>`).join("")}</div>${b}</div>`;
  }
  if (agent === "story_builder") {
    const words = ["comeback", "hometown hero", "leader", "#1", "never quit", "inspire"];
    return `<div class="stage st-story" aria-hidden="true">${words.map((w, i) => `<span class="word-float" style="--d:${i * 0.55}s;--x:${(i % 3) * 22 - 10}px">${w}</span>`).join("")}
      <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>${b}</div>`;
  }
  if (agent === "gatekeeper") {
    return `<div class="stage st-gate" aria-hidden="true">${b}<div class="doc"><i></i><i></i><i></i><i></i><span class="beam"></span><span class="ok">✓</span></div></div>`;
  }
  return b;
}
setInterval(() => document.querySelectorAll(".thinking[data-steps]").forEach((el) => {
  const steps = JSON.parse(el.dataset.steps), i = Math.min(Number(el.dataset.i) + 1, steps.length - 1);
  if (i === Number(el.dataset.i)) return;
  el.dataset.i = i; const t = el.querySelector(".t-step"); if (t) t.textContent = steps[i];
}), 2200);
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
    <div class="pro-top">${photoBox(a)}${(a.photos_extra || []).filter(Boolean).length ? `<div class="pro-extras">${a.photos_extra.filter(Boolean).map((u) => `<img src="${esc(u)}" alt="">`).join("")}</div>` : ""}${extra.score || ""}</div>
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
// Layered menus: "My dashboard" (signed in) -> numbered steps -> "more" tabs on the right.
const TABS = {
  booker: [["about", "About"], ["home", "My dashboard"], ["find", "1 · Find talent"], ["mine", "2 · Requests & bookings"], ["|"], ["browse", "Browse roster"], ["board", "Opportunity board"], ["behind", "Behind the scenes"], ["terms", "Terms & Safety"]],
  athlete: [["about", "About"], ["home", "My dashboard"], ["board", "1 · Find gigs"], ["build", "2 · Build my profile"], ["rider", "3 · Rider & availability"], ["inbox", "4 · Requests & bookings"], ["|"], ["behind", "Behind the scenes"], ["terms", "Terms & Safety"]],
};
const firstTab = (role) => (state.user ? "home" : TABS[role].find(([, l]) => /^\d/.test(l || ""))[0]);
const tabLabel = (l) => { const m = /^(\d) · (.*)$/.exec(l); return m ? `<i>${m[1]}</i>${m[2]}` : l; };
const STAFF = new URLSearchParams(location.search).has("staff");
{ const go = new URLSearchParams(location.search).get("go");  // links from the story video's end card
  if (go === "build") { state.role = "athlete"; state.tab = "build"; } else if (go === "find") { state.role = "booker"; state.tab = "find"; state.bookingHero = true; }
  if (go) history.replaceState(null, "", location.pathname + location.search.replace(/[?&]go=[^&]*/, "").replace(/^&/, "?") + location.hash); }  // ?staff=1 shows "Behind the scenes" (for grading)
function renderTabs() {
  if (state.user && state.role !== state.user.role) { state.role = state.user.role; if (!TABS[state.role].some(([k]) => k === state.tab)) state.tab = "home"; }
  const sw = document.querySelector(".role-switch");
  if (sw) {
    sw.hidden = !!state.user;
    let lbl = document.getElementById("role-label");
    if (!lbl) { lbl = document.createElement("div"); lbl.id = "role-label"; lbl.className = "role-label"; sw.after(lbl); }
    lbl.hidden = !state.user;
    if (state.user) lbl.innerHTML = state.user.role === "athlete"
      ? `${uiIcon("star", 14)} Athlete account` : `${uiIcon("search", 14)} Booking account${state.user.org ? " · " + esc(state.user.org) : ""}`;
    lbl.title = "Signed in. To use the other side of NextPlay Pros, sign out first.";
  }
  $("#tabs").innerHTML = TABS[state.role].filter(([k]) => (STAFF || k !== "behind") && (k !== "home" || state.user))
    .map(([k, l]) => k === "|" ? `<span class="tab-sep" aria-hidden="true"></span>`
      : `<button data-tab="${k}" class="${state.tab === k ? "active" : ""} ${/^\d/.test(l) ? "step-tab" : ""}">${tabLabel(l)}</button>`).join("");
  document.querySelectorAll(".role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
  const tabsEl = document.getElementById("tabs"), at = tabsEl.querySelector(".active");  // keep the current tab in view on phones
  if (at) tabsEl.scrollLeft = at.offsetLeft - tabsEl.clientWidth / 2 + at.clientWidth / 2;
}
document.querySelectorAll(".role-switch button").forEach((b) => (b.onclick = () => { state.role = b.dataset.role; state.tab = firstTab(state.role); render(); }));
$("#tabs").onclick = (e) => { const t = e.target.closest("[data-tab]"); if (t) { state.tab = t.dataset.tab; render(); } };
document.addEventListener("click", (e) => { const r = e.target.closest("[data-request]"); if (r) requestModal(r.dataset.request); });
// The 25-second story: full-screen, like a video, with subtitles
document.addEventListener("click", (e) => { if (e.target.closest("[data-story]")) openStory(); });
function openStory() {
  const o = document.createElement("div"); o.className = "story-overlay";
  o.innerHTML = `<iframe src="/static/story.html?autoplay=1&v=14" title="NextPlay Pros story" allow="autoplay"></iframe>`;
  document.body.appendChild(o);
  const close = () => { o.remove(); window.removeEventListener("message", onMsg); document.removeEventListener("keydown", onKey); };
  const onMsg = (m) => { if (m.data === "close-story") close(); };
  const onKey = (k) => { if (k.key === "Escape") close(); };
  window.addEventListener("message", onMsg); document.addEventListener("keydown", onKey);
}

function drawFooter() { const f = $("#foot"); if (f && !f.innerHTML) f.innerHTML = `<div class="foot-brand">${XO(56)}<div><b>NextPlay <span>Pros</span></b><small>Get booked. Get paid. Inspire.</small></div></div>${playbook(false)}<div class="foot-fine">MGT 409 · Yale SOM · Adrian Vellinga · All roster profiles are fictional demo data.</div>`; }
function render() { drawFooter(); if ($("#acct")) drawAcct(); renderTabs(); drawStepper(); (VIEWS[state.tab] || VIEWS.find)(); drawInspire(); }
function drawInspire() {
  const el = $("#inspire"); if (!el) return;
  const role = state.role, tab = state.tab;
  const pages = role === "athlete" ? ["home", "board", "build", "rider", "inbox"] : ["home", "mine"];  // booker "find" shows it inline
  el.innerHTML = pages.includes(tab) && isReturning(role) ? inspireBanner(role) : "";
}

// ---------------------------------------------------------------- step guide + dashboard
const STEPS = {
  booker: [["find", "Describe your event", "Scout finds athletes who fit"], ["find", "Send a request", "Agree to their rider"],
           ["mine", "Prep call", "Optional: talk before committing"], ["mine", "Athlete accepts", "Your fee is held in escrow"], ["mine", "Event day", "Athlete checks in early"]],
  athlete: [["board", "Find gigs", "See what organizations need"], ["build", "Build your profile", "We write it from your story"],
            ["rider", "Set your rules", "Rider, fees, and availability"], ["inbox", "Answer requests", "Prep call, then accept"], ["inbox", "Show up, get paid", "Check in 60 minutes early"]],
};
async function loadProgress() {
  try {
    const list = state.role === "athlete" ? await api(`/api/requests/athlete/${state.athleteId}`) : await api(`/api/requests/booker/${state.bookerId}`);
    state.progress = { role: state.role, list };
  } catch { state.progress = { role: state.role, list: [] }; }
  return state.progress;
}
function stepsDone(role, list) {
  const any = (f) => list.some(f);
  const acc = any((r) => r.status === "accepted"), chk = any((r) => r.checked_in), prep = any((r) => r.prep_status === "scheduled");
  if (role === "booker") { const sent = list.length > 0; return [sent || !!state.lastScout, sent, prep || acc, acc, chk]; }
  return [!!localGet("np_seen_board"), !!localGet("np_published"), !!localGet("np_rider_saved"), acc, chk];
}
async function drawStepper() {
  const el = $("#stepper"); if (!el) return;
  const role = state.role, tab = state.tab;
  if (!STEPS[role].some(([t]) => t === tab)) { el.innerHTML = ""; return; }
  if (tab === "board") localSet("np_seen_board", "1");
  const { list } = (state.progress && state.progress.role === role) ? state.progress : await loadProgress();
  if (state.role !== role || state.tab !== tab) return;  // user moved on while loading
  const done = stepsDone(role, list), next = done.indexOf(false);
  el.innerHTML = `<div class="stepper" role="list" aria-label="Your steps">${STEPS[role].map(([t, title, hint], i) =>
    `<button role="listitem" class="step ${done[i] ? "done" : ""} ${i === next ? "next" : ""} ${tab === t ? "here" : ""}" data-step-tab="${t}">
      <span class="num">${done[i] ? "✓" : i + 1}</span><span class="txt"><b>${title}</b><small>${i === next ? "Next: " : ""}${hint}</small></span></button>`).join('<span class="step-line" aria-hidden="true"></span>')}</div>`;
  el.querySelectorAll("[data-step-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.stepTab; render(); window.scrollTo(0, 0); }));
  const here = el.querySelector(".step.here"), bar = el.querySelector(".stepper");  // keep the current step in view on phones
  if (here && bar) bar.scrollLeft = here.offsetLeft - bar.clientWidth / 2 + here.clientWidth / 2;
  loadProgress();  // refresh quietly for next time
}
async function viewHome() {
  if (!state.user) { state.tab = firstTab(state.role); return render(); }
  const u = state.user, role = state.role;
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>Welcome back, ${esc(u.name.split(" ")[0])}</h1>
    <p class="sub">${role === "athlete" ? "Here's what needs you as an athlete." : esc(u.org ? `Booking for ${u.org}. Here's what needs you.` : "Here's what needs you.")} Every step is also in the tabs above.</p>
    <div id="dash" class="grid"><div class="thinking"><span class="spinner"></span>Loading…</div></div>`;
  const { list } = await loadProgress();
  const done = stepsDone(role, list), next = done.indexOf(false);
  const card = (icon, n, title, text, tab, btn) => `<div class="dash-card ${n ? "hot" : ""}"><span class="ic-badge">${uiIcon(icon)}</span><div>${n === null ? "" : `<div class="dash-n">${n}</div>`}<b>${title}</b><p>${text}</p></div><button class="btn small ${n ? "" : "ghost"}" data-dash-tab="${tab}">${btn}</button></div>`;
  const pending = list.filter((r) => ["pending", "flagged"].includes(r.status));
  const prepToPick = list.filter((r) => r.prep_status === "requested" && r.prep_by !== role);
  const prepSet = list.filter((r) => r.prep_status === "scheduled");
  const booked = list.filter((r) => r.status === "accepted");
  const t = role === "athlete" ? "inbox" : "mine";
  const cards = role === "athlete" ? [
    card("mic", pending.length, "New requests", "Read Gatekeeper's summary, ask for a prep call, then accept or decline.", t, "Open requests"),
    card("target", prepToPick.length, "Prep calls to schedule", "A booker offered times. Pick one and you both get the video link.", t, "Pick a time"),
    card("shield", booked.length, "Upcoming bookings", "Fee secured in escrow. Check in 60 minutes early to keep 95%.", t, "See bookings"),
    card("pen", null, "Your profile & rider", "Keep your story, fees, and availability current so the right gigs find you.", "rider", "Edit"),
  ] : [
    card("search", pending.length, "Waiting on athletes", "Requests the athlete hasn't answered yet.", t, "See requests"),
    card("target", prepToPick.length, "Prep calls to schedule", "An athlete asked to talk first. Pick a time.", t, "Pick a time"),
    card("shield", booked.length, "Confirmed bookings", "Funds secured in escrow; contact details unlocked.", t, "See bookings"),
    card("tag", null, "Book another athlete", "Describe your next event and Scout will match you.", "find", "Find talent"),
  ];
  $("#dash").innerHTML = `${next >= 0
      ? `<div class="dash-next">${uiIcon("star", 18)} <b>Your next step:</b> ${STEPS[role][next][1]} <span class="meta">· ${STEPS[role][next][2]}</span> <button class="btn small" data-dash-tab="${STEPS[role][next][0]}">Go</button></div>`
      : `<div class="dash-next">${uiIcon("star", 18)} <b>You're all set.</b> Nice work.</div>`}
    <div class="dash-grid">${cards.join("")}</div>
    ${prepSet.length ? `<div class="panel"><h2>Prep calls on the calendar</h2>${prepSet.map((r) => `<div class="prep-on">${uiIcon("mic", 16)} ${esc(fmtTime(r.prep_time))} · ${esc(role === "athlete" ? r.org : r.athlete_name)} · <a href="${esc(r.prep_link)}" target="_blank" rel="noopener">Join video call</a></div>`).join("")}</div>` : ""}`;
  document.querySelectorAll("[data-dash-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.dashTab; render(); window.scrollTo(0, 0); }));
}

// ---------------------------------------------------------------- booker: Scout
const EXAMPLES = [
  "Keynote for 250 credit-union employees in Denver in January about bouncing back from setbacks. Budget $5,000.",
  "Saturday basketball clinic for 60 kids ages 10-14 in Englewood. Nonprofit, can pay about $800.",
  "Funny emcee for a children's hospital charity gala in Dallas, clean material, up to $4,000.",
  "Virtual fireside chat on women in leadership for a business school club, budget $3,000.",
];
// ---------------------------------------------------------------- intro banner (home): crossfading athletes + tagline
const INTRO_SLIDES = [  // generated images: athlete types, not names, no one looking at the camera
  ["gen/mg.jpg", "MG Vellinga", "Pro boxer · Park City, Utah"],
  ["gen/boxer2.jpg", "Boxing", "Fighters with comeback stories"],
  ["gen/basketball.jpg", "Basketball", "Former college & pro players"],
  ["gen/wheelchair.jpg", "Adaptive sports", "Paralympians & wheelchair athletes"],
  ["gen/skier.jpg", "Alpine skiing", "Olympians & mountain locals"],
  ["gen/runner2.jpg", "Track", "Rising stars & record holders"],
  ["gen/golfer2.jpg", "Golf", "Tour pros & club champions"],
  ["gen/soccer.jpg", "Soccer", "Women's soccer leaders"],
  ["gen/dancer.jpg", "Dance", "Performers & coaches"],
  ["gen/hockey.jpg", "Hockey", "Hometown heroes"],
  ["gen/runner.jpg", "Track", "Distance & mountain runners"],
];
const BOOK_SLIDES = [  // booking landing (from the story video's "Find an athlete" link)
  ["gen/book_speaking.jpg", "Keynotes & school talks", "Stories that stick with an audience"],
  ["gen/book_autographs.jpg", "Autograph signings", "Store openings, fan days, fundraisers"],
  ["gen/book_clinic.jpg", "Youth clinics & camps", "Real athletes coaching your kids"],
];
function introBanner() {
  const booking = !!state.bookingHero;
  const SLIDES = booking ? BOOK_SLIDES : INTRO_SLIDES;
  const n = SLIDES.length, step = booking ? 3 : 1.6;  // seconds per photo: under 2 s per athlete
  const on = 100 / n, fade = Math.min(3, on / 4);  // keyframes scale with the number of photos
  const kf = `@keyframes introFade{0%{opacity:0}${fade.toFixed(2)}%{opacity:1}${on.toFixed(2)}%{opacity:1}${(on + fade).toFixed(2)}%{opacity:0}100%{opacity:0}}
    @keyframes introZoom{0%{transform:scale(1.12)}${(on + fade).toFixed(2)}%{transform:scale(1)}100%{transform:scale(1)}}`;
  return `<style>${kf}</style><section class="intro" style="--n:${n};--cycle:${n * step}s" aria-label="NextPlay Pros">
    <div class="intro-pics" aria-hidden="true">${SLIDES.map(([img, name, role], i) =>
      `<figure style="animation-delay:${i * step - n * step}s"><img src="/static/img/${img}" alt=""><figcaption><b>${esc(name)}</b>${esc(role)}</figcaption></figure>`).join("")}</div>
    ${booking ? `<div class="intro-copy">
      <div class="intro-kicker">For schools, businesses &amp; charities</div>
      <h1>Bring a real athlete <span>to your event.</span></h1>
      <p>Keynotes, autograph signings, youth clinics, and charity appearances, from athletes near you and in your budget.</p>
      <p class="intro-ask">Describe your event and we'll match you in seconds.</p>
      <div class="intro-cta"><button class="btn" data-go-find>Find an athlete</button><button class="story-btn" data-story>▶ Watch our story</button></div>
      <button class="intro-switch" data-go-athlete>Are you an athlete? Build your profile →</button>
    </div>` : `<div class="intro-copy">
      <h1>You were a star, <span>or you're becoming one.</span></h1>
      <p>Let us help you connect with your community, get paid, and inspire through your story.</p>
      <p class="intro-ask">They're waiting… are you ready?</p>
      <div class="intro-cta"><button class="btn" data-go-athlete>I'm ready: build my profile</button><button class="story-btn" data-story>▶ Watch our story</button></div>
    </div>`}
  </section>`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-go-athlete]")) { state.role = "athlete"; state.tab = "build"; render(); window.scrollTo(0, 0); }
});

// ---------------------------------------------------------------- Brand: the X-and-O play + sport symbols (line art)
const XO = (size = 64, cls = "") => `<svg class="xo ${cls}" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"><path d="M5 20 L11 26 M11 20 L5 26"/><circle cx="24.5" cy="8" r="4.2"/><path d="M9 17 Q 10.5 10.5 16.8 10.2" stroke-width="2" stroke-dasharray="2.4 2.4"/><path d="M15 7.9 L18 10.2 L15.2 12.5" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
const SPORT_SVG = {
  Basketball: '<circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4v24M7.5 7.5c4 4 4 13 0 17M24.5 7.5c-4 4-4 13 0 17"/>',
  Soccer: '<circle cx="16" cy="16" r="12"/><path d="M16 10l5 3.6-1.9 5.9h-6.2L11 13.6z"/><path d="M16 10V4.5M21 13.6l5.5-1.8M19.1 19.5l3.3 4.6M12.9 19.5l-3.3 4.6M11 13.6l-5.5-1.8"/>',
  Football: '<path d="M5 27C3 18 9 5 27 5c2 9-4 22-22 22z"/><path d="M11 21l10-10M13 15l4 4M15.5 12.5l4 4M10.5 17.5l4 4"/>',
  Baseball: '<circle cx="16" cy="16" r="12"/><path d="M9 6.5c3 3 3 16 0 19M23 6.5c-3 3-3 16 0 19"/><path d="M9.5 10l2-1M10.5 14h2M10.5 18h2M9.5 22l2 1M22.5 10l-2-1M21.5 14h-2M21.5 18h-2M22.5 22l-2 1" stroke-width="1.6"/>',
  Hockey: '<path d="M9 3l7 19c.6 1.6 2 2.5 3.6 2.5H27"/><ellipse cx="9" cy="25.5" rx="5" ry="2"/>',
  Tennis: '<circle cx="16" cy="16" r="12"/><path d="M6 8c6 4 6 12 0 16M26 8c-6 4-6 12 0 16"/>',
  Golf: '<path d="M11 28V4l12 5-12 5"/><ellipse cx="16" cy="28" rx="10" ry="2"/>',
  Skiing: '<circle cx="21" cy="5.5" r="2.5"/><path d="M4 22l24 8M8 10l8 3 2 6-5 4M16 13l5-4 4 4"/>',
  Track: '<circle cx="19" cy="5" r="2.5"/><path d="M8 13l6-3 5 3 3 5M14 10l-2 8-6 4M12 18l6 3v7"/>',
  Volleyball: '<circle cx="16" cy="16" r="12"/><path d="M16 4c-2 7 2 12 9.5 14M6 9c7-1 11 3 12 10M8 25c3-6 9-8 16-6"/>',
  Boxing: '<path d="M9 14V9a6 6 0 0 1 6-6h5a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-9a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4h6"/><path d="M10 23v6h12v-6"/>',
};
const sportSvg = (name, size = 34) => `<svg class="sport-ic" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SPORT_SVG[name]}</g></svg>`;
function playbook(label = true) {
  const names = Object.keys(SPORT_SVG);
  const items = names.map((n, i) => `<span class="pb-item" title="${n}">${sportSvg(n)}${label ? `<small>${n}</small>` : ""}</span>${i % 4 === 3 && i < names.length - 1 ? `<span class="pb-xo">${XO(30)}</span>` : ""}`).join("");
  return `<div class="playbook" aria-label="Sports on NextPlay Pros">${items}</div>`;
}

// ---------------------------------------------------------------- UI line icons (replace emoji)
const UI_ICON = {
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>',
  hands: '<path d="M2.5 12l4-4 3 1.5 3-2.5 3 1 6 4"/><path d="M7 14.5l2.5 2.5a1.5 1.5 0 0 0 2.2 0l3.3-3.3"/><path d="M2.5 12l4.5 4.5M21.5 12L17 16.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};
const uiIcon = (k, size = 20) => `<svg class="ui-ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${UI_ICON[k]}</g></svg>`;
const li = (k, html) => `<li><span class="ic-badge">${uiIcon(k)}</span><span>${html}</span></li>`;

const ORG_TYPES = [["school", "School or university"], ["nonprofit", "Nonprofit or charity"], ["company", "Company or business"],
  ["team", "Team, league, or club"], ["community", "Community group (Rotary, chamber, church)"], ["individual", "Individual / private event"]];
const ORG_LABEL = { school: "School", nonprofit: "Nonprofit", company: "Company", team: "Team / league", community: "Community group", individual: "Private event" };
function whoFor() {
  return `<section class="who" aria-label="Who NextPlay Pros is for">
    <div class="who-card athletes">
      <div class="who-kicker">For athletes</div>
      <h2>Rising, retired, or a local hero</h2>
      <ul>
        ${li("pay", "<b>Get paid</b> for talks, appearances, clinics, and events")}
        ${li("pen", "<b>A profile written for you</b> from your own story")}
        ${li("shield", "<b>Your rules:</b> your rider, your schedule, your fees")}
        ${li("lock", "<b>Your contact stays private</b> until you say yes")}
      </ul>
      <button class="btn" data-go-athlete>Build my profile</button>
    </div>
    <div class="who-card bookers">
      <div class="who-kicker">For communities &amp; bookers</div>
      <h2>Schools, teams, businesses, charities</h2>
      <ul>
        ${li("search", "<b>Describe your event</b> in plain English")}
        ${li("target", "<b>Get athletes who fit</b> your theme, city, budget, and date")}
        ${li("tag", "<b>Fair, clear fees</b> with no bureau markup")}
        ${li("hands", "<b>Protected bookings:</b> escrow, check-in, refunds")}
      </ul>
      <button class="btn ghost-light" data-go-find>Find an athlete</button>
    </div>
  </section>`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-go-find]")) { const h = document.getElementById("find-hero"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => { const q = document.getElementById("q"); if (q) q.focus({ preventScroll: true }); }, 450); }
});

// Returning users don't need "How it works" again: they get an inspiring closing banner instead.
const isReturning = (role) => role === "athlete"
  ? !!(localGet("np_published") || (state.user && state.user.role === "athlete"))
  : !!(localGet("np_sent_request") || (state.user && state.user.role === "booker"));
const INSPIRE = {
  booker: { imgs: [["gen/book_speaking.jpg", "62% 35%", "Keynotes & school talks"], ["gen/book_clinic.jpg", "70% 40%", "Youth clinics"], ["gen/crowd_glory.jpg", "center 40%", "Game-day energy, in your room"]], kicker: "Why it matters",
    title: "A real story, <span>told in the room.</span>",
    text: "The athlete you book doesn't just fill a slot on the agenda. They give your audience a story they'll carry out the door.",
    tips: ["Ask for a prep call to shape the talk", "Share your run of show and audience", "Post a photo after and tag your athlete"],
    cta: ["find", "Book another athlete"] },
  athlete: { imgs: [["gen/book_autographs.jpg", "70% 40%", "Back in the community"], ["gen/crowd_glory.jpg", "center 40%", "They remember you"], ["gen/older_bball.jpg", "60% 20%", "Still got it"]], kicker: "Your next play",
    title: "Your story still <span>moves people.</span>",
    text: "Every booking is a chance to inspire someone new: a kid at a clinic, a team at a kickoff, a fan who never forgot.",
    tips: ["Answer requests within a day", "Check in 60 minutes early (keep 95%)", "Post a recap and thank your host"],
    cta: ["board", "Find gigs"] },
};
function inspireBanner(role) {
  const c = INSPIRE[role];
  return `<section class="inspire">
    <div class="inspire-pics" aria-hidden="true">${c.imgs.map(([src, pos, cap], i) =>
      `<figure style="animation-delay:${i * 4}s"><img src="/static/img/${src}" alt="" style="object-position:${pos}"><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>
    <div class="inspire-copy"><div class="inspire-kicker">${c.kicker}</div><h2>${c.title}</h2><p>${esc(c.text)}</p>
      <ul>${c.tips.map((t) => `<li>${uiIcon("star", 14)} ${esc(t)}</li>`).join("")}</ul>
      <button class="btn" data-inspire-tab="${c.cta[0]}">${c.cta[1]}</button></div></section>`;
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-inspire-tab]"); if (b) { state.tab = b.dataset.inspireTab; render(); window.scrollTo(0, 0); } });

function howItWorks() {
  const step = (n, b, mood, title, who, text) => `<div class="how-step">
      <div class="how-num">${n}</div>${bot(b, mood, 120)}
      <h3>${title}</h3><div class="how-who">${who}</div><p>${text}</p></div>`;
  return `<section class="how" aria-label="How NextPlay Pros works">
    <div class="how-xo">${XO(84)}</div>
    <div class="how-kicker">How it works</div>
    <h2>The team every pro has, now for every athlete</h2>
    <div class="how-steps">
      ${step(1, "scout", "happy", "Scouts", "Scout · your talent scout",
        "Reads what a school, team, business, or charity is planning and finds athletes whose story, city, budget, and schedule fit. Every match comes with a reason.")}
      ${step(2, "gatekeeper", "classic", "Booking agents &amp; protectors", "Gatekeeper · your appearance guardrails",
        "We screen every request for scams and tricks, check it against the athlete's rider, schedule, and Name, Image &amp; Likeness (NIL) rules for college athletes, and protect both sides with escrow, check-in, and refunds.")}
      ${step(3, "story_builder", "happy", "Promoters", "Story Builder · your promoter",
        "She turns an athlete's rough notes into a profile that sells and puts it in front of the right bookers, using only their own facts, so rising athletes and local heroes get noticed like the pros.")}
    </div>
    ${playbook()}
    <div class="how-foot">You stay in charge: your contact details unlock only when you say yes.</div>
  </section>`;
}

// ---------------------------------------------------------------- "Start local": State -> City region (remembered)
state.loc = (() => { try { return JSON.parse(localGet("np_loc")) || { st: "CO", rg: "" }; } catch { return { st: "CO", rg: "" }; } })();
function regionOf(city, st) {
  const regs = (state.regions && state.regions[st] && state.regions[st].regions) || {};
  return Object.keys(regs).find((r) => regs[r].includes(city)) || "";
}
function inLoc(a) {
  const { st, rg } = state.loc;
  if (!st) return true;
  if (a.state !== st) return false;
  return !rg || regionOf(a.city, a.state) === rg;
}
function locLabel() {
  const { st, rg } = state.loc;
  if (!st || !state.regions || !state.regions[st]) return "everywhere";
  return rg ? `${rg}, ${state.regions[st].name}` : state.regions[st].name;
}
function locationBar(id = "loc") {
  if (!state.regions) return "";
  const { st, rg } = state.loc;
  const regs = st ? Object.keys(state.regions[st].regions) : [];
  const count = state.athletes.filter(inLoc).length;
  return `<div class="loc-bar" id="${id}">
    <div class="loc-title">📍 <b>Start local</b><span>Where's your event, or where are you based?</span></div>
    <div class="loc-picks">
      <select data-loc="st" aria-label="State"><option value="">Anywhere in the U.S.</option>${Object.entries(state.regions).map(([k, v]) => `<option value="${k}" ${k === st ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>
      <select data-loc="rg" aria-label="City region" ${st ? "" : "disabled"}><option value="">${st ? "All of " + esc(state.regions[st].name) : "Pick a state first"}</option>${regs.map((r) => `<option ${r === rg ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <span class="loc-count"><b>${count}</b> athlete${count === 1 ? "" : "s"} ${st ? "here" : "total"}</span>
    </div></div>`;
}
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-loc]"); if (!sel) return;
  if (sel.dataset.loc === "st") state.loc = { st: sel.value, rg: "" }; else state.loc = { ...state.loc, rg: sel.value };
  localSet("np_loc", JSON.stringify(state.loc));
  render();
});

// ---------------------------------------------------------------- Sign-in (demo: email link, no passwords stored)
state.user = (() => { try { return JSON.parse(localGet("np_user")) || null; } catch { return null; } })();
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
function drawAcct() {
  const u = state.user;
  $("#acct").innerHTML = u
    ? `<button class="acct-btn" id="acct-btn" aria-haspopup="true"><span class="avatar">${esc(initials(u.name))}</span><span class="acct-name">${esc(u.name.split(" ")[0])}</span></button>`
    : `<button class="signin-btn" id="acct-btn">Sign in</button>`;
  $("#acct-btn").onclick = () => (state.user ? acctMenu() : signIn());
}
function acctMenu() {
  const u = state.user;
  openModal(`<div class="signin"><span class="avatar big">${esc(initials(u.name))}</span><h2>${esc(u.name)}</h2>
    <p class="sub">${esc(u.email)} · ${u.role === "athlete" ? "Athlete" : esc([u.org, ORG_LABEL[u.org_type]].filter(Boolean).join(" · ") || "Booking talent")}</p>
    <p class="fine">This is ${u.role === "athlete" ? "an athlete" : "a booking"} account. To ${u.role === "athlete" ? "book talent" : "use the athlete side"}, sign out and continue as the other role.</p>
    <div class="row-btns"><button class="btn" data-acct-go>${u.role === "athlete" ? "Go to my inbox" : "Go to my requests"}</button><button class="btn ghost" data-signout>Sign out</button></div></div>`);
}
function signIn(opts = {}) {
  const { title = "Sign in to NextPlay Pros", lead = "Track your requests, replies, and bookings from any device.", name = "", role = state.role } = opts;
  openModal(`<div class="signin">
    <div class="signin-logo">${$(".brand .logo").outerHTML}</div>
    <h2>${esc(title)}</h2><p class="sub">${esc(lead)}</p>
    <div class="seg" role="tablist"><button data-seg="booker" class="${role === "booker" ? "active" : ""}">Booking talent for an event</button><button data-seg="athlete" class="${role === "athlete" ? "active" : ""}">I'm an athlete</button></div>
    <label>Your name</label><input id="si-name" autocomplete="name" value="${esc(name)}" placeholder="First and last name">
    <div id="si-org" ${role === "athlete" ? "hidden" : ""}><label>Booking as</label><select id="si-orgtype">${ORG_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <label>School or organization name</label><input id="si-orgname" placeholder="e.g. Lakewood Middle School"></div>
    <label>Email</label><input id="si-email" type="email" autocomplete="email" placeholder="you@school.org">
    <button class="btn wide" id="si-go">Email me a sign-in link</button>
    <div class="or"><span>or</span></div>
    <button class="btn ghost wide" id="si-google" title="Coming at launch">Continue with Google</button>
    <p class="fine">No passwords. We email a one-time link, and your contact details stay private until you accept a booking.
      <br><b>Class demo:</b> no email is sent; the link is simulated on the next screen.</p></div>`);
  let r = role;
  document.querySelectorAll("[data-seg]").forEach((b) => (b.onclick = () => { r = b.dataset.seg; document.querySelectorAll("[data-seg]").forEach((x) => x.classList.toggle("active", x === b)); $("#si-org").hidden = r === "athlete"; }));
  $("#si-google").onclick = () => toast("Google sign-in comes at launch. Use the email link for now.");
  $("#si-go").onclick = () => {
    const n = $("#si-name").value.trim(), e = $("#si-email").value.trim(), ot = $("#si-orgtype").value, on = $("#si-orgname").value.trim();
    if (!n) return toast("Add your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Add a valid email.");
    $("#modal-body").innerHTML = `<div class="signin"><div class="mail">✉️</div><h2>Check your email</h2>
      <p class="sub">We sent a sign-in link to <b>${esc(e)}</b>. It works once and expires in 15 minutes.</p>
      <button class="btn wide" id="si-link">Open the link (demo)</button>
      <p class="fine">In the real app this button is the link in your inbox.</p></div>`;
    $("#si-link").onclick = () => {
      state.user = { name: n, email: e, role: r, org_type: r === "booker" ? ot : "", org: r === "booker" ? on : "" };
      localSet("np_user", JSON.stringify(state.user));
      if (r === "booker") { state.bookerName = n; localSet("np_booker_name", n); }
      $("#modal").hidden = true; drawAcct();
      state.role = r; state.tab = "home";
      render(); toast(`Welcome, ${n.split(" ")[0]}! You're signed in.`);
    };
  };
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-signout]")) { state.user = null; try { localStorage.removeItem("np_user"); } catch {} $("#modal").hidden = true; if (state.tab === "home") state.tab = firstTab(state.role); drawAcct(); render(); toast("Signed out."); }
  if (e.target.closest("[data-acct-go]")) { $("#modal").hidden = true; state.role = state.user.role; state.tab = state.role === "athlete" ? "inbox" : "mine"; render(); }
  if (e.target.closest("[data-signin]")) signIn();
});
// After the first fill-in (a request sent or a profile published), ask them to make an account to follow up.
function celebrate({ title, sub, steps, primary, secondary, kind, name }) {
  const confetti = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.12}s;--c:${["#ff5a1f", "#9fdcec", "#e6c27a", "#12865b"][i % 4]}"></i>`).join("");
  openModal(`<div class="celebrate"><div class="confetti" aria-hidden="true">${confetti}</div>
    <div class="cel-badge">${XO(46)}</div><h2>${title}</h2><p class="sub">${sub}</p>
    <div class="cel-next"><div class="cel-k">What's next</div><ol>${steps.map((t) => `<li>${t}</li>`).join("")}</ol></div>
    <div class="row-btns"><button class="btn" data-cel-go="${primary[0]}">${primary[1]}</button>${secondary ? `<button class="btn ghost" data-cel-go="${secondary[0]}">${secondary[1]}</button>` : ""}</div>
    ${state.user ? "" : `<p class="fine"><button class="linkish" data-cel-save>Save this to a free account</button> so you can check in from any device.</p>`}</div>`);
  document.querySelectorAll("[data-cel-go]").forEach((b) => (b.onclick = () => {
    $("#modal").hidden = true; state.tab = b.dataset.celGo; render(); window.scrollTo(0, 0);
    if (state.tab === "rider") setTimeout(() => { const ph = document.querySelector(".photo-slots"); if (ph) ph.scrollIntoView({ behavior: "smooth", block: "center" }); }, 700);
  }));
  const sv = document.querySelector("[data-cel-save]"); if (sv) sv.onclick = () => askToSave(kind, name, true);
}
function askToSave(kind, name, now = false) {
  if (state.user) return;
  setTimeout(() => signIn({ title: kind === "athlete" ? "You're live! Save your profile" : "Request sent! Save it to your account",
    lead: kind === "athlete" ? "Create your free account so you can see requests, accept bookings, and get paid." : "Create your free account to see the athlete's reply and unlock their contact details when they accept.",
    name, role: kind }), now ? 0 : 1400);
}
function signInGate(what) {
  return `<div class="signin-gate card"><div class="gate-icon">🔒</div><h3>Sign in to see ${esc(what)}</h3>
    <p class="sub">Your requests and bookings are private to your account.</p><button class="btn" data-signin>Sign in</button></div>`;
}

function viewFind() {
  $("#view").innerHTML = `${introBanner()}${locationBar()}${whoFor()}
  <div class="band" role="img" aria-label="Silhouettes of a basketball player, a golfer, a dancer, and a women's soccer player racing across the page"></div>
  <section class="hero" id="find-hero">
    <h1>Who do you want at your event?</h1>
    <p>Describe it like you'd tell a friend. Scout searches the roster, keeps you under budget, and explains every match.</p>
    <div class="team-strip"><div class="ts">${bot("scout", "happy", 46)}<span><b>Scout</b> finds</span></div><div class="ts">${bot("story_builder", "happy", 46)}<span><b>Story Builder</b> promotes</span></div><div class="ts">${bot("gatekeeper", "happy", 46)}<span><b>Gatekeeper</b> guards your rider</span></div></div>
    <div class="form">
      <div><label for="q">Your event</label><textarea id="q" placeholder="e.g. Motivational speaker for our 200-person sales kickoff in Denver, someone who came back from an injury">${esc(state.lastQuery || "")}</textarea></div>
      <div class="row"><div style="flex:0 1 240px"><label for="budget">Your budget, up to (optional)</label><input id="budget" type="number" min="0" step="100" placeholder="$5,000" value="${esc(state.lastBudget || "")}"><small class="budget-hint">We only show athletes whose fee fits.</small></div>
        <div style="flex:0 0 auto"><button class="btn" id="go">Find matches</button></div></div>
    </div>
    <div class="chips">${EXAMPLES.map((x, i) => `<button class="chip" data-ex="${i}">${esc(x.slice(0, 48))}…</button>`).join("")}</div>
  </section>
  <section id="results">${state.lastScout ? scoutResults(state.lastScout) : ""}</section>
  ${isReturning("booker") ? inspireBanner("booker") : howItWorks()}`;
  document.querySelectorAll("[data-ex]").forEach((c) => (c.onclick = () => { $("#q").value = EXAMPLES[c.dataset.ex]; $("#budget").value = ""; }));
  $("#go").onclick = runScout;
  $("#q").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runScout(); };
}
async function runScout() {
  const text = $("#q").value.trim(); const b = $("#budget").value;
  if (!text) return toast("Describe your event first.");
  state.lastQuery = text; state.lastBudget = b;
  const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Scouting…`;
  $("#results").innerHTML = thinking("scout", ["Scout is reading your event", `Searching ${state.athletes.length} athletes near you`, "Checking availability and budget", "Ranking the best fits and writing why", "Almost there"]);
  try {
    state.lastScout = await api("/api/scout", { method: "POST", body: { text, budget: b ? Number(b) : null, state: state.loc.st || null, region: state.loc.rg || null } });
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
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>The roster</h1><p class="sub">Showing athletes in <b>${esc(locLabel())}</b>. All demo profiles are fictional.</p>${locationBar()}
    <div class="panel" style="margin-bottom:16px"><div class="row">
      <div><label>Sport</label><select id="f-sport"><option value="">Any</option>${sports.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      <div><label>Type</label><select id="f-cat"><option value="">Any</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>Max fee</label><input id="f-fee" type="number" step="100" placeholder="any"></div>
      <div><label>Available on</label><select id="f-day"><option value="">Any day</option>${Object.entries(state.riderOpts.days).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>Time of day</label><select id="f-time"><option value="">Any time</option>${Object.entries(state.riderOpts.times).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
    </div></div><div class="grid three" id="roster"></div>`;
  const draw = () => {
    const s = $("#f-sport").value, c = $("#f-cat").value, f = Number($("#f-fee").value) || Infinity;
    const dy = $("#f-day").value, tm = $("#f-time").value;
    const list = state.athletes.filter((a) => (!s || a.sport === s) && (!c || a.categories.includes(c)) && inLoc(a) && a.fee_min <= f
      && (!dy || a.availability.days.includes(dy)) && (!tm || a.availability.times.includes(tm)));
    $("#roster").innerHTML = list.map((a) => athleteCard(a)).join("") || `<div class="empty">No one matches here yet. Try <b>All of ${esc(state.loc.st ? state.regions[state.loc.st].name : "the U.S.")}</b> or <b>Anywhere</b> above.</div>`;
  };
  ["#f-sport", "#f-cat", "#f-fee", "#f-day", "#f-time"].forEach((id) => ($(id).oninput = draw));
  draw();
}

// ---------------------------------------------------------------- booker: request modal + my requests
function requestModal(athleteId) {
  const a = state.athletes.find((x) => x.id === athleteId);
  const b = state.lastScout?.brief || {};
  openModal(`<h2>Request ${esc(a.name)}</h2>
    <p class="sub">Their contact details stay private until they accept. Every request is screened by Gatekeeper before it reaches them.</p>
    <div class="form">
      <div class="row"><div><label>Your name</label><input id="r-name" value="${esc(state.bookerName)}"></div><div><label>Organization</label><input id="r-org" value="${esc((state.user && state.user.org) || "")}"></div><div><label>Booking as</label><select id="r-orgtype">${ORG_TYPES.map(([k, l]) => `<option value="${k}" ${state.user && state.user.org_type === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <div class="row"><div><label>Type</label><select id="r-type">${a.categories.map((c) => `<option value="${c}">${CAT[c]}</option>`).join("")}</select></div>
        <div><label>Date</label><input id="r-date" type="date"></div><div><label>Start time</label><input id="r-time" type="time"></div></div>
      <div class="row"><div><label>City</label><input id="r-city" value="${esc(b.city || "")}"></div><div><label>Budget offered ($)</label><input id="r-budget" type="number" step="100" value="${esc(b.budget_max ?? state.lastBudget ?? "")}"></div></div>
      <div class="prep-ask"><label class="agree"><input type="checkbox" id="r-prep"> I'd like a <b>15-minute prep call</b> before ${esc(a.name.split(" ")[0])} commits</label>
        <div id="r-prep-slots" class="prep-slots" hidden><span class="meta">Offer up to three times:</span>
          <input type="datetime-local" class="r-slot"><input type="datetime-local" class="r-slot"><input type="datetime-local" class="r-slot"></div></div>
      <div><label>Message</label><textarea id="r-msg" rows="4" placeholder="Tell ${esc(a.name.split(" ")[0])} about the event, audience, and what you'd like them to do."></textarea></div>
      <div class="meta">Fee range: ${money(a.fee_min)}–${money(a.fee_max)}</div>
      <div class="avail-req">${availLine(a)}<div id="r-avail-warn" class="conflict" hidden></div></div>
      ${riderBlock(a)}
      <div><label>Transportation you'll provide</label><select id="r-transport">
        <option value="Pick-up and drop-off provided">Pick-up and drop-off provided</option>
        <option value="Mileage reimbursed">Mileage reimbursed</option>
        <option value="Athlete arranges own transportation">Athlete arranges own transportation</option></select></div>
      ${isCollege(a) ? `<div class="nil-box"><b>🎓 ${esc(a.name.split(" ")[0])} is a current college athlete. Name, Image &amp; Likeness (NIL) rules apply.</b>
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
  $("#r-prep").onchange = () => ($("#r-prep-slots").hidden = !$("#r-prep").checked);
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
    const body = { agreed_nil: !!$("#r-nil"), agreed_terms: true, transport_offered: $("#r-transport").value, athlete_id: a.id, booker_id: state.bookerId, booker_name: $("#r-name").value.trim(), org: $("#r-org").value.trim(), org_type: $("#r-orgtype").value,
      prep_call: $("#r-prep").checked, prep_slots: $("#r-prep").checked ? [...document.querySelectorAll(".r-slot")].map((x) => x.value).filter(Boolean) : [],
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
      if (r.status !== "blocked") {
        localSet("np_sent_request", "1");
        const first = esc(a.name.split(" ")[0]);
        setTimeout(() => celebrate({ kind: "booker", name: body.booker_name,
          title: `Request sent to ${first}!`,
          sub: r.status === "flagged" ? `Gatekeeper screened it and marked one thing for ${first} to look at. You're all set on your side.` : "Gatekeeper screened it and it's on its way. You're all set on your side.",
          steps: [`${first} reviews it, usually within a day, and may ask for a quick prep call.`, "When they accept, your fee is held safely in escrow and their contact details unlock.",
                  `On event day, ${first} checks in 60 minutes early. You'll see it under Requests & bookings.`],
          primary: ["mine", "Track my request"], secondary: ["find", "Find another athlete"] }), 900);
      }
    } catch (err) { $("#r-out").innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = "Send request"; }
  };
}

// ---------------------------------------------------------------- prep call before committing (both sides)
const fmtTime = (t) => { try { return new Date(t).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return t; } };
function prepPanel(r, side) {
  if (!["pending", "flagged", "accepted"].includes(r.status)) return "";
  const other = side === "athlete" ? (r.org || "the booker") : r.athlete_name.split(" ")[0];
  const notes = (r.prep_notes || []).map((n) => `<div class="prep-note"><b>${n.by === side ? "You" : esc(other)}:</b> ${esc(n.text)}</div>`).join("");
  let body;
  if (r.prep_status === "scheduled") {
    body = `<div class="prep-on">${uiIcon("mic", 16)} <b>Prep call set:</b> ${esc(fmtTime(r.prep_time))} · <a href="${esc(r.prep_link)}" target="_blank" rel="noopener">Join video call</a></div>`;
  } else if (r.prep_status === "requested" && r.prep_by !== side) {
    body = `<div><b>${esc(other)} asked for a prep call before committing.</b> Pick a time:</div>
      <div class="prep-times">${r.prep_slots.map((t) => `<button class="btn small ghost" data-prep-confirm="${r.id}" data-time="${esc(t)}">${esc(fmtTime(t))}</button>`).join("")}</div>`;
  } else if (r.prep_status === "requested") {
    body = `<div>${uiIcon("mic", 16)} You asked for a prep call. Waiting for ${esc(other)} to pick: ${r.prep_slots.map((t) => esc(fmtTime(t))).join(" · ")}</div>`;
  } else {
    body = `<button class="btn small ghost" data-prep-open="${r.id}">${uiIcon("mic", 15)} ${side === "athlete" ? "Ask for a prep call first" : "Request a prep call"}</button>
      <div class="prep-form" id="pf-${r.id}" hidden><span class="meta">Offer up to three times, and add questions to prepare:</span>
        <div class="prep-slots"><input type="datetime-local" class="pf-slot"><input type="datetime-local" class="pf-slot"><input type="datetime-local" class="pf-slot"></div>
        <textarea class="pf-note" rows="2" maxlength="500" placeholder="${side === "athlete" ? "e.g. How old is the audience? Will there be a mic? What should I focus on?" : "e.g. We'd love to walk through the run of show and what our kids are working on."}"></textarea>
        <button class="btn small" data-prep-send="${r.id}">Send request</button></div>`;
  }
  return `<div class="prep" data-side="${side}"><div class="prep-k">Prep call · before anyone commits</div>${body}${notes ? `<div class="prep-notes">${notes}</div>` : ""}</div>`;
}
function wirePrep(side, redraw) {
  const actor_id = side === "athlete" ? state.athleteId : state.bookerId;
  const send = async (rid, payload) => {
    try { await api(`/api/requests/${rid}/prep`, { method: "POST", body: { actor: side, actor_id, ...payload } }); toast(payload.action === "confirm" ? "Prep call scheduled. The video link is on the request." : "Prep call requested."); redraw(); }
    catch (err) { toast(err.message); }
  };
  document.querySelectorAll("[data-prep-open]").forEach((b) => (b.onclick = () => { const f = $(`#pf-${b.dataset.prepOpen}`); f.hidden = !f.hidden; }));
  document.querySelectorAll("[data-prep-send]").forEach((b) => (b.onclick = () => {
    const f = $(`#pf-${b.dataset.prepSend}`);
    const slots = [...f.querySelectorAll(".pf-slot")].map((x) => x.value).filter(Boolean);
    if (!slots.length) return toast("Offer at least one time.");
    send(b.dataset.prepSend, { action: "request", slots, note: f.querySelector(".pf-note").value.trim() });
  }));
  document.querySelectorAll("[data-prep-confirm]").forEach((b) => (b.onclick = () => send(b.dataset.prepConfirm, { action: "confirm", time: b.dataset.time })));
}

async function viewMine() {
  if (!state.user) { $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>My requests</h1>${signInGate("your requests")}`; return; }
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>My requests</h1><p class="sub">Contact details unlock only after an athlete accepts.</p><div id="list" class="grid"><div class="thinking"><span class="spinner"></span>Loading…</div></div>`;
  const list = await api(`/api/requests/booker/${state.bookerId}`);
  $("#list").innerHTML = list.length ? list.map((r) => `<div class="req">
    <div class="req-top"><div><b>${esc(r.athlete_name)}</b> · <span class="meta">${esc(CAT[r.event_type] || r.event_type)} · ${esc(r.event_date || "date TBD")} · ${money(r.budget)}</span></div><span>${r.screening.demo ? `<span class="status demo" title="Sample request so every inbox has something to try">demo</span> ` : ""}<span class="status ${r.status}">${r.status}</span></span></div>
    <p class="msg">${esc(r.message)}</p>
    ${prepPanel(r, "booker")}
    ${r.payout ? commitPanel(r, "booker") : ""}
    ${r.contact ? `<div class="contact">🔓 <b>Contact unlocked:</b> ${esc(r.contact.email)}${r.contact.phone ? " · " + esc(r.contact.phone) : ""}</div>`
      : r.status === "blocked" ? `<div class="alert bad">🛡️ Blocked by Gatekeeper: ${esc(r.screening.summary)}</div>`
      : `<div class="locked">🔒 Contact details stay private until ${esc(r.athlete_name.split(" ")[0])} accepts.</div>`}
  </div>`).join("") : `<div class="empty">No requests yet. Use <b>Find talent</b> to send one.</div>`;
  wirePrep("booker", viewMine);
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
    <div class="req-top"><div><b>${esc(r.org)}</b> ${r.org_type ? `<span class="pill orgtype">${esc(ORG_LABEL[r.org_type] || r.org_type)}</span>` : ""} <span class="meta">· ${esc(r.booker_name)} · ${esc(r.city || "")} · ${esc(r.event_date || "date TBD")}</span></div><span>${r.screening.demo ? `<span class="status demo" title="Sample request so every inbox has something to try">demo</span> ` : ""}<span class="status ${r.status}">${r.status}</span></span></div>
    <div class="gate"><div class="label">${bot("gatekeeper", r.status === "blocked" ? "classic" : "happy", 72)}<span>Gatekeeper summary</span></div>${(r.screening.rider_conflicts || []).length ? `<div class="conflict">⚠️ Conflicts with your Event Rider: ${esc(r.screening.rider_conflicts.join("; "))}</div>` : ""}${esc(r.screening.summary)}<br><span class="meta">${esc(r.screening.fee_note)}</span>
      ${(r.screening.risk_flags || []).length || (r.screening.rule_flags || []).length ? `<br><span class="meta">⚠️ ${esc([...(r.screening.risk_flags || []), ...(r.screening.rule_flags || [])].join(", "))}</span>` : ""}</div>
    <details><summary>Read full message</summary><p class="msg">${esc(r.message)}</p></details>
    ${prepPanel(r, "athlete")}
    ${r.payout ? commitPanel(r, "athlete") : ""}
    ${["pending", "flagged"].includes(r.status) ? `<div class="row" style="justify-content:flex-start"><button class="btn good small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="1">Accept & share my contact</button><button class="btn ghost small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="0">Decline</button></div>` : ""}
  </div>`;
  $("#inbox").innerHTML = (open.map(reqHtml).join("") || `<div class="empty">No requests yet. Switch to <b>Booking talent for an event or appearance</b> and send this athlete one.</div>`)
    + (blocked.length ? `<details><summary>🛡️ ${blocked.length} request(s) blocked by Gatekeeper</summary><div class="grid">${blocked.map(reqHtml).join("")}</div></details>` : "");
  document.querySelectorAll("[data-checkin]").forEach((b) => (b.onclick = async () => {
    try { await api(`/api/requests/${b.dataset.checkin}/checkin`, { method: "POST", body: { athlete_id: state.athleteId } });
      toast("Checked in. Thanks for being early!"); drawInbox(); } catch (err) { toast(err.message); }
  }));
  wirePrep("athlete", drawInbox);
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
    <div><label>Your story, in your own words</label><textarea id="s-notes" rows="6" placeholder="Where you played, the hardest moment, what you do now, what you'd love to talk about or do at events…"></textarea></div>
    <details class="more-q" open><summary><b>Tell us more</b> <span class="meta">(optional, but it makes your profile much stronger)</span></summary>
      <div class="row"><div><label>Active years</label><input id="q-active" placeholder="e.g. 2004–2015, or 2022–now"></div>
        <div><label>Public speaking?</label><select id="q-speak"><option value="">Choose…</option><option>Yes, I love it</option><option>Yes, small groups</option><option>Not yet, open to it</option><option>No, appearances only</option></select></div></div>
      <div><label>Awards, victories, and favorite accomplishments</label><textarea id="q-awards" rows="2" placeholder="Titles, records, all-star picks, the win you're proudest of…"></textarea></div>
      <div><label>What you overcame as an athlete</label><textarea id="q-overcame" rows="2" placeholder="Injuries, setbacks, being overlooked, life outside sports…"></textarea></div>
      <div><label>Stories you like to tell about your career</label><textarea id="q-stories" rows="2" placeholder="The locker-room moment, the coach who changed everything…"></textarea></div>
      <div><label>Current passions and interests</label><input id="q-passions" placeholder="Coaching, business, family, faith, the outdoors…"></div>
      <div><label>Charities and organizations you've supported</label><textarea id="q-charity" rows="2" placeholder="Causes you care about and events you've done for them"></textarea></div>
      <div><label>Off the table</label><textarea id="q-off" rows="2" placeholder="Topics or experiences you don't want to discuss. We'll keep them out of your profile."></textarea></div>
    </details>
    <p class="meta" style="margin:0">${uiIcon("pen", 14)} After you publish, you'll add up to three photos and set your rider.</p>
    <button class="btn" id="s-go">Write my profile</button>
  </div><div id="s-out" class="panel"><div class="empty">Your draft will appear here.</div></div></div>`;
  $("#s-city").value = "Denver";
  $("#s-go").onclick = async () => {
    const QS = [["q-active", "Active years"], ["q-speak", "Public speaking"], ["q-awards", "Awards, victories, and favorite accomplishments"],
      ["q-overcame", "What I overcame as an athlete"], ["q-stories", "Stories I like to tell about my career"], ["q-passions", "Current passions and interests"],
      ["q-charity", "Charities and organizations I've supported"]];
    const extra = QS.map(([id, label]) => [label, $("#" + id).value.trim()]).filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join("\n");
    const story = $("#s-notes").value.trim();
    const body = { name: $("#s-name").value.trim(), sport: $("#s-sport").value.trim(), level: $("#s-level").value, city: $("#s-city").value,
      notes: [story, extra].filter(Boolean).join("\n\n"), off_limits: $("#q-off").value.trim() };
    if (!body.name || !body.sport || body.notes.length < 30) return toast("Add your name, sport, and a few sentences about your story (or answer a few questions below).");
    const btn = $("#s-go"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Writing…`;
    $("#s-out").innerHTML = thinking("story_builder", ["Story Builder is reading your story", "Writing your headline and bio", "Picking topics bookers search for", "Flagging anything to double-check"]);
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
    try { const a = await api("/api/athletes", { method: "POST", body }); await loadRoster(); state.athleteId = a.id; localSet("np_athlete", a.id); localSet("np_published", "1");
      state.tab = "rider"; render();
      celebrate({ kind: "athlete", name: a.name,
        title: "Profile published!",
        sub: `You're live on NextPlay Pros, ${esc(a.name.split(" ")[0])}. Bookers can find you starting now.`,
        steps: ["Add up to three photos (your current photo shows first).", "Set your rider and availability so only the right requests reach you.",
                "Explore gigs on the Opportunity board, and answer requests in your inbox."],
        primary: ["rider", "Add my photos"], secondary: ["board", "Explore gigs"] });
    } catch (err) { toast(err.message); }
  };
}

// ---------------------------------------------------------------- opportunity board
const BOARD_FILTERS = [  // activity types on the Opportunity board
  ["all", "All", "grid", () => true],
  ["charity", "Charitable", "heart", (o) => o.charitable],
  ["story", "Story & speaking", "mic", (o) => ["speaking", "mentoring"].includes(o.type)],
  ["appear", "Appearances & autographs", "pen", (o) => ["appearance", "endorsement"].includes(o.type)],
  ["clinic", "Clinics & camps", "ball", (o) => o.type === "clinic"],
  ["fun", "Entertainment", "star", (o) => o.type === "comedy_entertainment"],
];
async function viewBoard() {
  const list = await api("/api/opportunities");
  state.boardFilter = state.boardFilter || "all";
  $("#view").innerHTML = `<div class="band slim" aria-hidden="true"></div><h1>Opportunity board</h1><p class="sub">Open gigs posted by local businesses, schools, and nonprofits.</p>
    <div class="board-filters" role="toolbar" aria-label="Filter by type of activity"></div><div id="board" class="grid two"></div>`;
  const draw = () => {
    const f = BOARD_FILTERS.find((x) => x[0] === state.boardFilter) || BOARD_FILTERS[0];
    $(".board-filters").innerHTML = BOARD_FILTERS.map(([k, label, icon, test]) =>
      `<button class="chip-f ${k === f[0] ? "on" : ""}" data-bf="${k}" aria-pressed="${k === f[0]}">${icon ? uiIcon(icon, 16) : ""}${label} <span>${list.filter(test).length}</span></button>`).join("");
    const shown = list.filter(f[3]);
    $("#board").innerHTML = shown.map((o) => `<div class="card"><div class="req-top"><b>${esc(o.title)}</b><span>${o.charitable ? `<span class="pill charity">${uiIcon("heart", 13)} Charitable</span> ` : ""}<span class="pill cat">${CAT[o.type]}</span></span></div>
      <div class="meta">${esc(o.org)} · ${esc(o.city)} · ${esc(o.date)}</div><p class="story">${esc(o.details)}</p>
      <div class="card-foot"><span class="fee">${o.budget_max ? `Up to ${money(o.budget_max)}` : "Volunteer"}</span>
      ${state.role === "booker" ? `<button class="btn small ghost" data-scout-opp="${o.id}">Find matches with Scout</button>` : ""}</div></div>`).join("")
      || `<div class="empty">No open gigs of this type right now.</div>`;
    document.querySelectorAll("[data-bf]").forEach((b) => (b.onclick = () => { state.boardFilter = b.dataset.bf; draw(); }));
    document.querySelectorAll("[data-scout-opp]").forEach((b) => (b.onclick = () => {
      const o = list.find((x) => x.id === b.dataset.scoutOpp);
      state.lastQuery = `${o.title} for ${o.org} in ${o.city} on ${o.date}. ${o.details}`; state.lastBudget = o.budget_max || null; state.lastScout = null;
      state.tab = "find"; render(); runScout();
    }));
  };
  draw();
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
  { name: "Lafayette “Fat” Lever", alt: "Fat Lever", role: "Former Denver Nuggets guard · 2x NBA All-Star · Denver", photo: "/static/img/lever.jpg", initials: "FL", hue: 210,
    credit: 'Photo: Portland Trail Blazers, 1983, <a href="https://commons.wikimedia.org/wiki/File:Fat_Lever.jpg" target="_blank" rel="noopener">public domain</a> via Wikimedia Commons',
    facts: [
      "Played six seasons for the Denver Nuggets, 1984–1990 [5]",
      "Two-time NBA All-Star (1988, 1990) and All-NBA Second Team (1987) [5]",
      "The Nuggets retired his No. 12, and he is still the franchise's all-time leader in steals [5]",
      "43 career triple-doubles, 13th in NBA history: of the top 13, the only eligible player not in the Hall of Fame [5]",
    ],
    why: "A Denver legend with a retired number, still a name to Nuggets fans of a certain age, but younger fans and most local organizers would never know how to reach him. NextPlay Pros would put him in front of schools, youth basketball clinics, and community events across the Front Range." },
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
  { name: "Emma Coburn", alt: "Emma Coburn", role: "Steeplechase world champion · Olympic medalist · Crested Butte, CO", photo: "/static/img/coburn.jpg", initials: "EC", hue: 350,
    credit: 'Photo: jenaragon94 (Flickr), <a href="https://commons.wikimedia.org/wiki/File:2018_USA_Indoor_Track_and_Field_Championships_(26466189318).jpg" target="_blank" rel="noopener">CC BY 2.0</a>',
    facts: [
      "Grew up in Crested Butte and ran for the University of Colorado Boulder [12]",
      "Three-time Olympian and Olympic bronze medalist in the 3000 m steeplechase [12]",
      "World champion, world silver medalist, and 10-time U.S. champion in the steeplechase [12]",
    ],
    why: "A small-mountain-town kid who became a world champion. Every Colorado high school track team, running club, and girls-in-sports program would love an hour with her. That's exactly the local pull NextPlay Pros is built for." },
];
const FACES = [  // About hero: face shots that scroll right to left
  ["mg.jpg", "MG Vellinga", "center 20%"], ["lever.jpg", "Fat Lever", "center 15%"], ["bloom.jpg", "Jeremy Bloom", "center 20%"], ["clark.jpg", "Wyndham Clark", "center 20%"],
  ["mg2.jpg", "MG Vellinga", "center 20%"], ["dauwalter.jpg", "Courtney Dauwalter", "center 20%"], ["coburn.jpg", "Emma Coburn", "center 20%"],
  ["bloom2.jpg", "Jeremy Bloom", "center 20%"], ["clark2.jpg", "Wyndham Clark", "center 20%"],
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
  <section class="hero about-hero">${XO(220, "xo-watermark")}
    <div class="faces" aria-label="Athletes featured on NextPlay Pros"><div class="faces-track">${[0, 1].map((copy) => FACES.map(([img, name, pos]) =>
      `<figure ${copy ? 'aria-hidden="true"' : ""}><img src="/static/img/${img}" alt="${copy ? "" : esc(name)}" style="object-position:${pos}"><figcaption>${esc(name)}</figcaption></figure>`).join("")).join("")}</div></div>
    <h1>Every athlete's story deserves an audience</h1>
    <button class="story-btn" data-story>▶ Watch our story</button>
    <p>NextPlay Pros connects former, current, and rising athletes with the schools, companies, nonprofits, and local businesses that want them for talks, appearances, clinics, and events. We do the matching, the writing, and the scam screening. The athlete decides who gets their contact details.</p>
  </section>
  <h2 class="about-h">Meet your team</h2>
  <p class="sub">Every pro has a team: a scout, a promoter, security. Most athletes never get one. NextPlay Pros gives every athlete a team of three.</p>
  <div class="grid three team">
    <div class="card team-card">${bot("scout", "happy", 140)}<div><h3>Scout</h3><div class="role">Your talent scout</div><p>Reads what a booker is planning, searches the roster, and puts you forward when your story fits: the theme, the city, the budget, and the day you're free.</p></div></div>
    <div class="card team-card">${bot("story_builder", "happy", 140)}<div><h3>Story Builder</h3><div class="role">Your promoter</div><p>She talks you up, loudly and accurately. She turns your rough notes into a profile bookers want to hire, using only your facts, and flags every claim to verify before it goes live.</p></div></div>
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
    <p>As a designer, I worked with the NBA, MLB, and NFL and on more than five Olympic Games. I've seen stars rise and fade, and I've seen how much fans love both the memories and the journeys behind them.</p>
    <p>NextPlay Pros is the platform I've long wanted to build, for two kinds of athletes:</p>
    <ul class="why-two">
      <li><b>Stars past their prime:</b> real business opportunities, a way to reconnect with their fans, and a stage to inspire people who want to hear their stories.</li>
      <li><b>Up-and-coming athletes:</b> their moment to shine, and a way to connect with audiences who want to know who they are.</li>
    </ul>
    <p class="meta">Adrian Vellinga · Yale SOM · MGT 409 final project</p>
  </div>
  <h2 class="about-h">Athletes who show why</h2>
  <p class="sub">Real athletes who show who NextPlay Pros is for. MG is from my own circle; Fat Lever, Jeremy, Wyndham, Courtney, and Emma are Colorado stories everyone here knows. They are shown to illustrate the idea, not as members: they are not in the demo roster, and no fees or contact details are listed.</p>
  <div class="grid">${FEATURED.map(card).join("")}</div>
  <div class="panel sources"><b>Sources</b><ol>
    <li><a href="https://www.sltrib.com/sports/2017/12/04/park-citys-maryguenn-vellinga-is-utahs-best-hope-for-glory-as-salt-palace-hosts-usa-boxing-national-championships-this-week" target="_blank" rel="noopener">Salt Lake Tribune, Dec 2017</a></li>
    <li><a href="https://www.sltrib.com/sports/2018/05/13/for-the-first-time-utah-is-sending-a-full-womens-team-to-the-national-golden-gloves-boxing-tournament" target="_blank" rel="noopener">Salt Lake Tribune, May 2018</a></li>
    <li><a href="https://www.kpcw.org/show/mountain-money/2024-10-28/local-boxing-gym-punches-back-against-parkinsons-disease" target="_blank" rel="noopener">KPCW, Oct 2024</a></li>
    <li><a href="https://townlift.com/2026/08/mountain-mettle-returns-aug-22-with-focus-on-youth-scholarships/" target="_blank" rel="noopener">TownLift, Aug 2026</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Fat_Lever" target="_blank" rel="noopener">Wikipedia: Fat Lever</a></li>
    <li><a href="https://commons.wikimedia.org/wiki/File:Fat_Lever.jpg" target="_blank" rel="noopener">Wikimedia Commons: Fat Lever photo (public domain)</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Jeremy_Bloom" target="_blank" rel="noopener">Wikipedia: Jeremy Bloom</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Wyndham_Clark" target="_blank" rel="noopener">Wikipedia: Wyndham Clark</a></li>
    <li><a href="https://www.cbsnews.com/news/wyndham-clark-u-s-open-2026-golf/" target="_blank" rel="noopener">CBS News, Jun 2026</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Courtney_Dauwalter" target="_blank" rel="noopener">Wikipedia: Courtney Dauwalter</a></li>
    <li><a href="https://ultrarunning.com/featured/2023-ultrarunner-of-the-year-courtney-dauwalter/" target="_blank" rel="noopener">UltraRunning Magazine, 2023 Ultrarunner of the Year</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Emma_Coburn" target="_blank" rel="noopener">Wikipedia: Emma Coburn</a></li>
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
  if (isCollege(a)) chips.unshift("🎓 Name, Image & Likeness (NIL) rules apply");
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
    <div class="panel profile-panel"><h2>📷 Your photos</h2>
      <p class="meta">Your <b>current photo</b> is the one bookers see first; add up to two more (action shots, career moments). JPG or PNG, up to 6 MB.</p>
      <div class="photo-slots">${[0, 1, 2].map((i) => {
        const url = i === 0 ? a.photo : (a.photos_extra || [])[i - 1];
        return `<div class="photo-slot"><div class="slot-label">${i === 0 ? "Current photo" : "Optional photo " + i}</div>
          ${url ? `<img src="${esc(url)}" alt="">` : i === 0 ? photoBox(a, "pro-photo small") : `<div class="slot-empty">+</div>`}
          <label class="btn small ghost slot-btn">${url ? "Replace" : "Upload"}<input type="file" hidden data-slot="${i}" accept="image/jpeg,image/png,image/webp"></label>
          ${i > 0 && url ? `<button class="btn small ghost slot-btn" data-remove-slot="${i}">Remove</button>` : ""}</div>`; }).join("")}</div>
      <div id="photo-msg" class="meta"></div>
      <p class="photo-note">A quick note: photos should be appropriate for all ages and show you at your best, whether that's a professional headshot or a highlight from your athletic career. Thank you for helping keep NextPlay Pros welcoming for every school, family, and organization.</p>
      <p class="photo-safe">${uiIcon("shield", 14)} Every photo is screened automatically before anyone sees it. Nudity, sexual, or graphic images are blocked.</p></div>
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
  document.querySelectorAll("[data-slot]").forEach((inp) => (inp.onchange = async () => {
    const f = inp.files[0], slot = Number(inp.dataset.slot); if (!f) return;
    if (f.size > 6e6) return ($("#photo-msg").textContent = "That photo is over 6 MB.");
    $("#photo-msg").textContent = "Checking and uploading…";
    const data_url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    try { await api(`/api/athletes/${a.id}/photo`, { method: "POST", body: { athlete_id: a.id, data_url, slot } }); await loadRoster(); toast("Photo passed the safety check and was saved."); drawRiderForm(); }
    catch (err) { $("#photo-msg").innerHTML = `<span class="photo-err">${esc(err.message)}</span>`; }
  }));
  document.querySelectorAll("[data-remove-slot]").forEach((b) => (b.onclick = async () => {
    try { await api(`/api/athletes/${a.id}/photo/remove`, { method: "POST", body: { athlete_id: a.id, slot: Number(b.dataset.removeSlot) } }); await loadRoster(); toast("Photo removed."); drawRiderForm(); }
    catch (err) { toast(err.message); }
  }));
  $("#rider-save").onclick = async () => {
    const pick = (n) => [...document.querySelectorAll(`input[name="${n}"]:checked`)].map((i) => i.value);
    const rider = { security: pick("security"), accommodations: pick("accommodations"), wont_do: pick("wont_do"),
      transport: (document.querySelector('input[name="transport"]:checked') || {}).value || "self",
      wont_do_other: $("#wont-other").value.trim(), max_hours: Number($("#max-hours").value) || 3 };
    const availability = { days: pick("days"), times: pick("times"), notice_days: Number($("#notice-days").value) || 0 };
    try {
      await api(`/api/athletes/${a.id}/rider`, { method: "PUT", body: { athlete_id: a.id, rider } });
      await api(`/api/athletes/${a.id}/availability`, { method: "PUT", body: { athlete_id: a.id, availability } });
      await loadRoster(); localSet("np_rider_saved", "1"); toast("Saved. Bookers will see your availability and rider before they can send a request."); }
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
  <div class="panel deposit" style="margin-top:16px"><h2>${uiIcon("lock", 20)} How deposits are held <span class="pill">Proposed for launch</span></h2>
    <p class="sub">Both sides should feel safe: athletes know the money is real before they travel, and bookers know they don't pay for a no-show.</p><ul class="terms">
    <li><b>A licensed processor holds the money, not us.</b> Fees sit in a separate escrow account at a licensed payment processor (for example, Stripe Connect). NextPlay Pros can't spend it; it can only be released to the athlete or refunded to the booker under these rules.</li>
    <li><b>Talk first, then pay.</b> Nothing is charged for a request or a prep call. The booker's full fee is collected only when the athlete accepts.</li>
    <li><b>Both sides see it's secured.</b> The booking shows "Funds secured" to the booker and "Your fee is secured" to the athlete before anyone travels.</li>
    <li><b>If the booker cancels:</b> 14+ days before the event, a full refund. 3 to 13 days before, 50% goes to the athlete for holding the date. Under 72 hours, 100% goes to the athlete.</li>
    <li><b>If the athlete cancels:</b> the booker gets 100% back right away, plus help finding a replacement. Cancelling under 72 hours counts as a strike, the same as a no-show.</li>
    <li><b>Weather or emergencies:</b> the event can be rescheduled within 90 days or fully refunded, with no strike for either side.</li>
    <li><b>Release:</b> after the athlete checks in and the event happens, a 48-hour window lets the booker raise a problem; then the payout goes out automatically (5% or 10% platform fee, per the rules above).</li>
    <li><b>Disputes:</b> the money stays frozen while both sides share the check-in record and any photos or messages. We decide within five business days.</li>
  </ul><p class="meta">Today the app runs this math as a demo; no real money moves. The payment processor is the next build.</p></div>
  <div class="panel" style="margin-top:16px"><h2>🎓 Name, Image &amp; Likeness (NIL) rules for college athletes</h2><p class="sub">NIL means college athletes can be paid for the use of their name, image, and likeness: appearances, talks, autographs, and promotions. These rules keep those deals legal and keep athletes eligible.</p><ul class="terms">
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

const VIEWS = { home: viewHome, rider: viewRider, terms: viewTerms, about: viewAbout, find: viewFind, browse: viewBrowse, mine: viewMine, board: viewBoard, behind: viewBehind, inbox: viewInbox, build: viewBuild };

async function loadRoster() { state.athletes = await api("/api/athletes"); }
(async () => { const soft = (pr) => pr.catch(() => null);
  [state.cities, state.riderOpts, state.regions] = await Promise.all([soft(api("/api/cities")), soft(api("/api/rider-options")), soft(api("/api/regions")), soft(loadRoster())]);
  state.cities = state.cities || []; if (!state.regions) state.loc = { st: "", rg: "" };
  if (state.loc.st && !state.regions[state.loc.st]) state.loc = { st: "CO", rg: "" };
  render(); })();
