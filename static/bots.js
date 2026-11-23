// The three NextPlay Pros agents as little robots (same family as Lex and Max from HW 6).
// bot(name, mood, size): name = scout | story_builder | gatekeeper; mood = classic | happy | thinking.
(function () {
  const INK = "#1b2440";
  function eyes(mood, lx, rx, y, glasses) {
    if (mood === "happy") {
      return `<path d="M${lx - 7} ${y + 2} Q${lx} ${y - 6} ${lx + 7} ${y + 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M${rx - 7} ${y + 2} Q${rx} ${y - 6} ${rx + 7} ${y + 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
    const dy = mood === "thinking" ? -4 : 1, dx = mood === "thinking" ? 3 : 1;
    const fill = glasses ? "#9fdcec" : INK;
    return `<circle cx="${lx + dx}" cy="${y + dy}" r="4.5" fill="${fill}"/><circle cx="${rx + dx}" cy="${y + dy}" r="4.5" fill="${fill}"/>
            <circle cx="${lx + dx + 1.5}" cy="${y + dy - 1.5}" r="1.4" fill="#fff"/><circle cx="${rx + dx + 1.5}" cy="${y + dy - 1.5}" r="1.4" fill="#fff"/>`;
  }
  function mouth(mood, y) {
    if (mood === "thinking") return `<circle cx="104" cy="${y}" r="4" fill="none" stroke="${INK}" stroke-width="3"/>`;
    if (mood === "happy") return `<path d="M86 ${y - 3} Q100 ${y + 11} 114 ${y - 3}" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    return `<path d="M88 ${y - 2} Q100 ${y + 6} 112 ${y - 2}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  }
  const legs = (c, shoe) => `<ellipse cx="100" cy="222" rx="56" ry="6" fill="#000" opacity=".18"/>
    <rect x="72" y="190" width="18" height="28" rx="6" fill="${c}"/><rect x="110" y="190" width="18" height="28" rx="6" fill="${c}"/>
    <rect x="66" y="212" width="28" height="9" rx="4" fill="${shoe}"/><rect x="106" y="212" width="28" height="9" rx="4" fill="${shoe}"/>`;

  const BOTS = {
    // Scout: talent scout. Orange ball cap, binoculars, clipboard with a star.
    scout: (m) => `${legs("#8a96ad", "#3b4763")}
      <rect x="54" y="126" width="92" height="68" rx="16" fill="#0f1b2d"/>
      <text x="100" y="178" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="22" fill="#ff5a1f">NP</text>
      <rect x="88" y="116" width="24" height="12" rx="3" fill="#b7c2d6"/>
      <rect x="58" y="62" width="84" height="58" rx="18" fill="#dfe5ee" stroke="#b7c2d6" stroke-width="2"/>
      <path d="M62 84 Q100 76 138 84 L136 94 Q124 100 108 94 L100 90 L92 94 Q76 100 64 94 Z" fill="#0b1630"/>
      <path d="M68 86 Q80 83 92 86 L90 91 Q78 95 70 91 Z" fill="#ff7a45" opacity=".85"/><path d="M108 86 Q120 83 132 86 L130 91 Q122 95 110 91 Z" fill="#ff7a45" opacity=".85"/>
      <path d="M72 86 L80 85" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
      ${m === "thinking" ? `<path d="M92 108 L110 106" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
        : `<path d="M88 106 Q102 112 114 102" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`}
      <path d="M56 66 Q58 30 100 30 Q142 30 144 66 Z" fill="#ff5a1f"/>
      <path d="M100 66 L172 66 Q176 72 168 76 L100 74 Z" fill="#d9440f"/>
      <circle cx="100" cy="31" r="5" fill="#d9440f"/>
      <path d="M78 44 Q100 36 122 44" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
      <path d="M58 150 Q44 160 52 178" fill="none" stroke="#b7c2d6" stroke-width="10" stroke-linecap="round"/>
      <rect x="30" y="160" width="30" height="38" rx="3" fill="#f4f1ea" stroke="#8a6d3b" stroke-width="2"/>
      <rect x="38" y="156" width="14" height="7" rx="2" fill="#8a6d3b"/>
      <path d="M45 170 L48 177 L55 177 L49 181 L51 188 L45 184 L39 188 L41 181 L35 177 L42 177 Z" fill="#e6c27a"/>
      <path d="M142 150 Q156 156 152 170" fill="none" stroke="#b7c2d6" stroke-width="10" stroke-linecap="round"/>
      <rect x="140" y="164" width="14" height="22" rx="5" fill="${INK}"/><rect x="156" y="164" width="14" height="22" rx="5" fill="${INK}"/>
      <rect x="152" y="170" width="6" height="8" fill="${INK}"/>
      <circle cx="147" cy="186" r="5" fill="#9fdcec"/><circle cx="163" cy="186" r="5" fill="#9fdcec"/>`,
    // Story Builder: promoter (she/her), African American, with attitude. Afro puff, sunglasses, arched brow, smirk,
    // gold hoops, headset mic, sharp orange blazer, hand on hip, megaphone up.
    story_builder: (m) => `${legs("#8a96ad", "#3b4763")}
      <rect x="54" y="126" width="92" height="68" rx="12" fill="#ff5a1f"/>
      <path d="M100 126 L84 126 L100 154 L116 126 Z" fill="#0f1b2d"/>
      <path d="M84 126 L92 142 L80 150 Z M116 126 L108 142 L120 150 Z" fill="#d9440f"/>
      <circle cx="100" cy="174" r="3" fill="#0f1b2d"/>
      <rect x="88" y="116" width="24" height="12" rx="3" fill="#53301c"/>
      <circle cx="100" cy="34" r="27" fill="#1a110c"/><circle cx="86" cy="26" r="10" fill="#2a1b12" opacity=".6"/>
      <rect x="84" y="54" width="32" height="7" rx="3.5" fill="#ff5a1f"/>
      <rect x="58" y="62" width="84" height="58" rx="22" fill="#6b4026" stroke="#53301c" stroke-width="2"/>
      <path d="M58 84 Q56 56 100 56 Q144 56 142 84 Q130 66 100 66 Q70 66 58 84 Z" fill="#1a110c"/>
      <circle cx="59" cy="104" r="5" fill="none" stroke="#e6c27a" stroke-width="2.5"/><circle cx="141" cy="104" r="5" fill="none" stroke="#e6c27a" stroke-width="2.5"/>
      <path d="M64 80 Q80 76 96 80 L94 90 Q82 98 70 92 Q64 88 64 80 Z" fill="#0b1630"/><path d="M104 80 Q120 76 136 80 Q136 88 130 92 Q118 98 106 90 Z" fill="#0b1630"/>
      <path d="M64 80 L58 74 M136 80 L142 74" stroke="#0b1630" stroke-width="4" stroke-linecap="round"/>
      <rect x="94" y="81" width="12" height="3" fill="#0b1630"/>
      <path d="M70 83 Q80 81 90 83 L89 88 Q80 93 72 89 Z" fill="#c2185b" opacity=".55"/><path d="M110 83 Q120 81 130 83 Q129 88 126 89 Q118 93 111 88 Z" fill="#c2185b" opacity=".55"/>
      <path d="M72 75 Q82 72 92 75" fill="none" stroke="#120c09" stroke-width="3" stroke-linecap="round"/>
      <path d="M108 74 Q117 65 127 71" fill="none" stroke="#120c09" stroke-width="3" stroke-linecap="round"/>
      ${m === "thinking" ? `<path d="M92 107 L110 105" stroke="#120c09" stroke-width="3" stroke-linecap="round"/>`
        : `<path d="M88 104 Q102 109 115 98" fill="none" stroke="#c2185b" stroke-width="4.5" stroke-linecap="round"/>`}
      <path d="M61 88 Q58 66 74 58" fill="none" stroke="#3b4763" stroke-width="4" stroke-linecap="round"/>
      <rect x="54" y="86" width="10" height="14" rx="4" fill="#3b4763"/>
      <path d="M60 100 Q64 112 80 112" fill="none" stroke="#3b4763" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="112" r="3.5" fill="#3b4763"/>
      <path d="M56 140 Q30 156 50 176 L58 172" fill="none" stroke="#6b4026" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M144 140 Q162 132 166 118" fill="none" stroke="#6b4026" stroke-width="10" stroke-linecap="round"/>
      <path d="M160 120 L186 94 L200 128 L172 128 Z" fill="#f4f1ea" stroke="#9aa7bf" stroke-width="2" stroke-linejoin="round"/>
      <rect x="158" y="116" width="13" height="13" rx="3" fill="#0f1b2d"/>
      <path d="M202 92 L208 84 M204 110 L212 110 M196 78 L198 70" stroke="#ff5a1f" stroke-width="3" stroke-linecap="round"/>`,
    // Gatekeeper: bouncer. Square, shades, earpiece, shield badge, velvet rope post.
    gatekeeper: (m) => `${legs("#6f7d99", "#232836")}
      <rect x="50" y="128" width="100" height="66" rx="6" fill="#232836"/>
      <path d="M100 128 L88 128 L100 150 L112 128 Z" fill="#f4f1ea"/><path d="M100 136 L96 150 L100 160 L104 150 Z" fill="#c62828"/>
      <path d="M124 142 L136 146 L136 155 Q136 163 124 168 Q112 163 112 155 L112 146 Z" fill="#e6c27a" stroke="#0b1630" stroke-width="2"/>
      <path d="M118 155 L123 160 L131 150" fill="none" stroke="#0b1630" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="88" y="118" width="24" height="12" rx="2" fill="#9aa7bf"/>
      <rect x="52" y="56" width="96" height="66" rx="6" fill="#c9d3e3" stroke="#9aa7bf" stroke-width="2"/>
      <rect x="52" y="52" width="96" height="12" rx="3" fill="#232836"/>
      ${`<rect x="62" y="78" width="34" height="18" rx="6" fill="#0b1630"/><rect x="104" y="78" width="34" height="18" rx="6" fill="#0b1630"/>
      <line x1="96" y1="85" x2="104" y2="85" stroke="#0b1630" stroke-width="4"/>
      <rect x="${m === "thinking" ? 70 : 66}" y="82" width="10" height="4" rx="2" fill="#9fdcec" opacity=".8"/><rect x="${m === "thinking" ? 112 : 108}" y="82" width="10" height="4" rx="2" fill="#9fdcec" opacity=".8"/>`}
      ${m === "happy" ? `<path d="M88 106 Q100 112 112 106" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>` : `<line x1="88" y1="108" x2="112" y2="108" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`}
      <path d="M150 74 Q160 80 156 96 Q154 106 146 112" fill="none" stroke="#232836" stroke-width="2.5"/>
      <circle cx="150" cy="76" r="5" fill="#232836"/>
      <path d="M50 146 Q36 156 44 176" fill="none" stroke="#9aa7bf" stroke-width="11" stroke-linecap="round"/>
      <path d="M150 150 Q164 160 158 178" fill="none" stroke="#9aa7bf" stroke-width="11" stroke-linecap="round"/>
      <rect x="168" y="150" width="8" height="66" rx="3" fill="#e6c27a"/><circle cx="172" cy="148" r="7" fill="#e6c27a"/>
      <path d="M172 160 Q190 176 200 168" fill="none" stroke="#c62828" stroke-width="6" stroke-linecap="round"/>`,
  };
  const LABEL = { scout: "Scout, a talent-scout robot in an orange ball cap and sport shades, with binoculars and a clipboard",
    story_builder: "Story Builder, a confident African American promoter robot with an afro puff, sunglasses, gold hoops, a headset, an orange blazer, and a megaphone",
    gatekeeper: "Gatekeeper, a square bouncer robot in black sunglasses with an earpiece, a shield badge and a velvet rope" };
  // Finish: brushed-metal heads, shaded bodies, soft drop shadow, so the robots read as polished at any size.
  let uid = 0;
  const FINISH = [
    ['fill="#dfe5ee"', "head"], ['fill="#c9d3e3"', "head"], ['fill="#0f1b2d"', "navy"], ['fill="#232836"', "suit"],
    ['fill="#f4f1ea"', "cream"], ['fill="#ff5a1f"', "orange"], ['fill="#c62828"', "red"], ['fill="#e6c27a"', "gold"],
  ];
  const grad = (id, top, bottom) => `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
  window.bot = function (name, mood = "classic", size = 48, cls = "") {
    const draw = BOTS[name] || BOTS.scout;
    const u = `b${++uid}`;
    let body = draw(mood);
    FINISH.forEach(([find, key]) => { body = body.split(find).join(`fill="url(#${key}-${u})"`); });
    const defs = `<defs>
      ${grad(`head-${u}`, "#f7f9fc", "#b9c4d6")}${grad(`navy-${u}`, "#24395a", "#0b1424")}${grad(`suit-${u}`, "#3a4256", "#161a24")}
      ${grad(`cream-${u}`, "#ffffff", "#ddd6c8")}${grad(`orange-${u}`, "#ff7a45", "#d9440f")}${grad(`red-${u}`, "#e04545", "#9e1c1c")}
      ${grad(`gold-${u}`, "#f3d89c", "#c49a45")}
      <filter id="sh-${u}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#0b1424" flood-opacity=".35"/></filter>
      <radialGradient id="gl-${u}" cx=".35" cy=".25" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>`;
    // a soft highlight over the head gives the "glossy" finish
    const gloss = `<ellipse cx="92" cy="78" rx="30" ry="14" fill="url(#gl-${u})" pointer-events="none"/>`;
    return `<svg viewBox="0 0 210 230" width="${size}" height="${Math.round(size * 230 / 210)}" class="bot ${cls}" role="img" aria-label="${LABEL[name] || name}">${defs}<g filter="url(#sh-${u})">${body}${gloss}</g></svg>`;
  };
  window.BOT_NAMES = { scout: "Scout", story_builder: "Story Builder", gatekeeper: "Gatekeeper" };
})();
