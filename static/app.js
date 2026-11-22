// Next Play front end: plain JS, no build step.
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
    return `<details class="glass" ${open ? "open" : ""}><summary>${bot(g.agent, "classic", 26)}<b>Glass box</b> · blocked before the AI · 0 tokens · $0</summary><div class="glass-body">${trace}</div></details>`;
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
function athleteCard(a, extra = "") {
  return `<div class="card">
    <div class="card-head">${avatar(a)}<div><div class="name">${esc(a.name)} ${SPORT_ICON[a.sport] || ""}</div>
      <div class="meta">${esc(a.level)} · ${esc(a.sport)} · ${esc(a.city)}, ${esc(a.state)}</div></div>${extra.score || ""}</div>
    ${extra.why || ""}
    ${a.headline ? `<div><b>${esc(a.headline)}</b></div>` : ""}
    <p class="story">${esc(a.story)}</p>
    <div>${a.categories.map((c) => `<span class="pill cat">${CAT[c] || c}</span>`).join("")}${a.topics.map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
    <div class="card-foot"><span class="fee">${money(a.fee_min)}–${money(a.fee_max)}</span>
      <span class="meta">${a.virtual_ok ? "Virtual OK · " : ""}travels ${a.travel_miles} mi</span></div>
    <button class="btn small" data-request="${a.id}">Request booking</button>
  </div>`;
}

// ---------------------------------------------------------------- tabs
const TABS = {
  booker: [["find", "Find talent (AI Scout)"], ["browse", "Browse roster"], ["mine", "My requests"], ["board", "Opportunity board"], ["behind", "Behind the scenes"], ["about", "About"]],
  athlete: [["inbox", "My inbox"], ["build", "Build my profile (AI)"], ["board", "Opportunity board"], ["behind", "Behind the scenes"], ["about", "About"]],
};
function renderTabs() {
  $("#tabs").innerHTML = TABS[state.role].map(([k, l]) => `<button data-tab="${k}" class="${state.tab === k ? "active" : ""}">${l}</button>`).join("");
  document.querySelectorAll(".role-switch button").forEach((b) => b.classList.toggle("active", b.dataset.role === state.role));
}
document.querySelectorAll(".role-switch button").forEach((b) => (b.onclick = () => { state.role = b.dataset.role; state.tab = TABS[state.role][0][0]; render(); }));
$("#tabs").onclick = (e) => { const t = e.target.closest("[data-tab]"); if (t) { state.tab = t.dataset.tab; render(); } };
document.addEventListener("click", (e) => { const r = e.target.closest("[data-request]"); if (r) requestModal(r.dataset.request); });

function render() { renderTabs(); (VIEWS[state.tab] || VIEWS.find)(); }

// ---------------------------------------------------------------- booker: Scout
const EXAMPLES = [
  "Keynote for 250 credit-union employees in Denver in January about bouncing back from setbacks. Budget $5,000.",
  "Saturday basketball clinic for 60 kids ages 10-14 in Englewood. Nonprofit, can pay about $800.",
  "Funny emcee for a children's hospital charity gala in Dallas, clean material, up to $4,000.",
  "Virtual fireside chat on women in leadership for a business school club, budget $3,000.",
];
function viewFind() {
  $("#view").innerHTML = `
  <section class="hero">
    <h1>Who do you want at your event?</h1>
    <p>Describe it like you'd tell a friend. Scout searches the roster, keeps you under budget, and explains every match.</p>
    <div class="form">
      <div><label for="q">Your event</label><textarea id="q" placeholder="e.g. Motivational speaker for our 200-person sales kickoff in Denver, someone who came back from an injury">${esc(state.lastQuery || "")}</textarea></div>
      <div class="row"><div style="flex:0 1 200px"><label for="budget">Max budget (optional, enforced)</label><input id="budget" type="number" min="0" step="100" placeholder="5000" value="${esc(state.lastBudget || "")}"></div>
        <div style="flex:0 0 auto"><button class="btn" id="go">Find matches</button></div></div>
    </div>
    <div class="chips">${EXAMPLES.map((x, i) => `<button class="chip" data-ex="${i}">${esc(x.slice(0, 48))}…</button>`).join("")}</div>
  </section>
  <section id="results">${state.lastScout ? scoutResults(state.lastScout) : ""}</section>`;
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
  $("#view").innerHTML = `<h1>The roster</h1><p class="sub">${state.athletes.length} athletes. All demo profiles are fictional.</p>
    <div class="panel" style="margin-bottom:16px"><div class="row">
      <div><label>Sport</label><select id="f-sport"><option value="">Any</option>${sports.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      <div><label>Type</label><select id="f-cat"><option value="">Any</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>State</label><select id="f-state"><option value="">Any</option>${[...new Set(state.athletes.map((a) => a.state))].sort().map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div><label>Max fee</label><input id="f-fee" type="number" step="100" placeholder="any"></div>
    </div></div><div class="grid three" id="roster"></div>`;
  const draw = () => {
    const s = $("#f-sport").value, c = $("#f-cat").value, st = $("#f-state").value, f = Number($("#f-fee").value) || Infinity;
    const list = state.athletes.filter((a) => (!s || a.sport === s) && (!c || a.categories.includes(c)) && (!st || a.state === st) && a.fee_min <= f);
    $("#roster").innerHTML = list.map((a) => athleteCard(a)).join("") || `<div class="empty">No one matches those filters.</div>`;
  };
  ["#f-sport", "#f-cat", "#f-state", "#f-fee"].forEach((id) => ($(id).oninput = draw));
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
        <div><label>Date</label><input id="r-date" type="date"></div></div>
      <div class="row"><div><label>City</label><input id="r-city" value="${esc(b.city || "")}"></div><div><label>Budget offered ($)</label><input id="r-budget" type="number" step="100" value="${esc(b.budget_max ?? state.lastBudget ?? "")}"></div></div>
      <div><label>Message</label><textarea id="r-msg" rows="4" placeholder="Tell ${esc(a.name.split(" ")[0])} about the event, audience, and what you'd like them to do."></textarea></div>
      <div class="meta">Fee range: ${money(a.fee_min)}–${money(a.fee_max)}</div>
      <button class="btn" id="r-send">Send request</button><div id="r-out"></div>
    </div>`);
  $("#r-send").onclick = async () => {
    const body = { athlete_id: a.id, booker_id: state.bookerId, booker_name: $("#r-name").value.trim(), org: $("#r-org").value.trim(),
      event_type: $("#r-type").value, event_date: $("#r-date").value, city: $("#r-city").value.trim(),
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
  $("#view").innerHTML = `<h1>My requests</h1><p class="sub">Contact details unlock only after an athlete accepts.</p><div id="list" class="grid"><div class="thinking"><span class="spinner"></span>Loading…</div></div>`;
  const list = await api(`/api/requests/booker/${state.bookerId}`);
  $("#list").innerHTML = list.length ? list.map((r) => `<div class="req">
    <div class="req-top"><div><b>${esc(r.athlete_name)}</b> · <span class="meta">${esc(CAT[r.event_type] || r.event_type)} · ${esc(r.event_date || "date TBD")} · ${money(r.budget)}</span></div><span class="status ${r.status}">${r.status}</span></div>
    <p class="msg">${esc(r.message)}</p>
    ${r.contact ? `<div class="contact">🔓 <b>Contact unlocked:</b> ${esc(r.contact.email)}${r.contact.phone ? " · " + esc(r.contact.phone) : ""}</div>`
      : r.status === "blocked" ? `<div class="alert bad">🛡️ Blocked by Gatekeeper: ${esc(r.screening.summary)}</div>`
      : `<div class="locked">🔒 Contact details stay private until ${esc(r.athlete_name.split(" ")[0])} accepts.</div>`}
  </div>`).join("") : `<div class="empty">No requests yet. Use <b>Find talent</b> to send one.</div>`;
}

// ---------------------------------------------------------------- athlete: inbox
async function viewInbox() {
  const opts = state.athletes.map((a) => `<option value="${a.id}" ${a.id === state.athleteId ? "selected" : ""}>${esc(a.name)} (${esc(a.sport)})</option>`).join("");
  $("#view").innerHTML = `<div class="row" style="margin-bottom:16px"><div><h1>My inbox</h1><p class="sub" style="margin:0">Every request is screened by Gatekeeper first. You decide who gets your contact info.</p></div>
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
    <div class="gate"><div class="label">${bot("gatekeeper", r.status === "blocked" ? "classic" : "happy", 22)} Gatekeeper summary</div>${esc(r.screening.summary)}<br><span class="meta">${esc(r.screening.fee_note)}</span>
      ${(r.screening.risk_flags || []).length || (r.screening.rule_flags || []).length ? `<br><span class="meta">⚠️ ${esc([...(r.screening.risk_flags || []), ...(r.screening.rule_flags || [])].join(", "))}</span>` : ""}</div>
    <details><summary>Read full message</summary><p class="msg">${esc(r.message)}</p></details>
    ${["pending", "flagged"].includes(r.status) ? `<div class="row" style="justify-content:flex-start"><button class="btn good small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="1">Accept & share my contact</button><button class="btn ghost small" style="flex:0 0 auto" data-decide="${r.id}" data-accept="0">Decline</button></div>` : ""}
  </div>`;
  $("#inbox").innerHTML = (open.map(reqHtml).join("") || `<div class="empty">No requests yet. Switch to <b>I'm booking talent</b> and send this athlete one.</div>`)
    + (blocked.length ? `<details><summary>🛡️ ${blocked.length} request(s) blocked by Gatekeeper</summary><div class="grid">${blocked.map(reqHtml).join("")}</div></details>` : "");
  document.querySelectorAll("[data-decide]").forEach((b) => (b.onclick = async () => {
    try { await api(`/api/requests/${b.dataset.decide}/decide`, { method: "POST", body: { athlete_id: state.athleteId, accept: b.dataset.accept === "1" } });
      toast(b.dataset.accept === "1" ? "Accepted. The booker can now see your contact details." : "Declined."); drawInbox();
    } catch (err) { toast(err.message); }
  }));
}

// ---------------------------------------------------------------- athlete: Story Builder
function viewBuild() {
  const levels = ["Former Pro", "Former College", "Olympian", "Paralympian", "Current Pro", "Rising (College)", "Rising (Minor League)", "Rising (Pro-Am)"];
  $("#view").innerHTML = `<h1>Build my profile</h1><p class="sub">No agent? No problem. Tell your story in your own words and Story Builder turns it into a profile bookers want to hire.</p>
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
      <div class="meta">🔒 Email and phone go into the private vault. No AI ever reads them; bookers see them only after you accept.</div>
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
  $("#view").innerHTML = `<h1>Opportunity board</h1><p class="sub">Open gigs posted by local businesses, schools, and nonprofits.</p>
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
// Two real athletes from the founder's own circle, shown to illustrate who Next Play is for.
// Facts come from the public sources listed on the page. They are NOT in the demo roster (no fees, no contacts).
const FEATURED = [
  { name: "MG Vellinga", alt: "Maryguenn Vellinga", role: "Professional boxer · Park City, Utah", photo: "/static/img/mg.jpg", initials: "MG", hue: 330,
    facts: [
      "Started boxing at 28 and climbed to No. 2 nationally in the Elite Female 112-lb division at the 2017 USA Boxing National Championships [1]",
      "Competed for Utah at the 2018 National Golden Gloves, part of the first full Utah women's team sent to the tournament [2]",
      "Co-founded RISE Boxing in Park City, including therapeutic boxing classes for people living with Parkinson's disease [3]",
      "Runs Mountain Mettle, a charity boxing night that funds youth scholarships through the RISE Strong Foundation [4]",
    ],
    why: "A late starter who became a national contender, then built a business and a charity around the sport. That story fits keynotes on grit and second acts, women-in-sport panels, and hands-on clinics, and she is exactly the kind of athlete bookers don't know how to find." },
  { name: "Mehmet “Memo” Okur", alt: "Mehmet Okur", role: "Former NBA center · Utah Jazz 2004–2011", photo: "/static/img/okur.jpg", initials: "MO", hue: 210,
    credit: 'Photo: Stephanie Young Merzel, <a href="https://commons.wikimedia.org/wiki/File:Mehmet_Okur_(cropped).jpg" target="_blank" rel="noopener">CC BY 2.0</a>',
    facts: [
      "NBA champion with the 2004 Detroit Pistons, then signed with the Utah Jazz in July 2004 and played seven seasons in Salt Lake City [5]",
      "2007 NBA All-Star [5]",
      "Named a Utah Jazz team ambassador after his playing career [6]",
    ],
    why: "A champion and All-Star whose name still means something in Utah and in Turkey, now well past his playing days. Next Play would put him in front of community events, youth clinics, and Turkish-American groups that would love to book him but have no idea how to reach him." },
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
      <div class="why"><b>Why Next Play:</b> ${esc(a.why)}</div>
      ${a.credit ? `<div class="credit">${a.credit}</div>` : ""}
    </div></article>`;
  $("#view").innerHTML = `
  <section class="hero about-hero">
    <div class="about-crew">${bot("scout", "happy", 70)}${bot("story_builder", "classic", 70)}${bot("gatekeeper", "classic", 70)}</div>
    <h1>Every athlete's story deserves an audience</h1>
    <p>Next Play connects former, current, and rising athletes with the schools, companies, nonprofits, and local businesses that want them for talks, appearances, clinics, and events. AI does the matching, the writing, and the scam screening. The athlete decides who gets their contact details.</p>
  </section>
  <div class="panel founder">
    <h2>Why I'm building this</h2>
    <p>I spent years doing design work alongside sports and event teams in Utah. Over and over I met athletes with incredible stories who were past their playing days, not household names, or still on the rise, and the businesses and events that would have loved to book them had no idea how to reach them. Next Play is the bridge I kept wishing existed.</p>
    <p class="meta">Adrian Pucci · Yale SOM · MGT 409 final project</p>
  </div>
  <h2 class="about-h">The athletes who inspired it</h2>
  <p class="sub">Two people from my own circle, and exactly who Next Play is for. They are shown here to illustrate the idea; they are not part of the demo roster, and no fees or contact details are listed.</p>
  <div class="grid">${FEATURED.map(card).join("")}</div>
  <div class="panel sources"><b>Sources</b><ol>
    <li><a href="https://www.sltrib.com/sports/2017/12/04/park-citys-maryguenn-vellinga-is-utahs-best-hope-for-glory-as-salt-palace-hosts-usa-boxing-national-championships-this-week" target="_blank" rel="noopener">Salt Lake Tribune, Dec 2017</a></li>
    <li><a href="https://www.sltrib.com/sports/2018/05/13/for-the-first-time-utah-is-sending-a-full-womens-team-to-the-national-golden-gloves-boxing-tournament" target="_blank" rel="noopener">Salt Lake Tribune, May 2018</a></li>
    <li><a href="https://www.kpcw.org/show/mountain-money/2024-10-28/local-boxing-gym-punches-back-against-parkinsons-disease" target="_blank" rel="noopener">KPCW, Oct 2024</a></li>
    <li><a href="https://townlift.com/2026/08/mountain-mettle-returns-aug-22-with-focus-on-youth-scholarships/" target="_blank" rel="noopener">TownLift, Aug 2026</a></li>
    <li><a href="https://en.wikipedia.org/wiki/Mehmet_Okur" target="_blank" rel="noopener">Wikipedia: Mehmet Okur</a></li>
    <li><a href="https://www.deseret.com/2014/9/28/20549451/mehmet-okur-named-team-ambassador-for-utah-jazz" target="_blank" rel="noopener">Deseret News, Sep 2014</a></li>
  </ol></div>`;
}

const VIEWS = { about: viewAbout, find: viewFind, browse: viewBrowse, mine: viewMine, board: viewBoard, behind: viewBehind, inbox: viewInbox, build: viewBuild };

async function loadRoster() { state.athletes = await api("/api/athletes"); }
(async () => { [state.cities] = await Promise.all([api("/api/cities"), loadRoster()]); render(); })();
