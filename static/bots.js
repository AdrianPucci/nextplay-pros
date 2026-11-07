// The three Next Play agents as little robots (same family as Lex and Max from HW 6).
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
      ${eyes(m, 84, 116, 88)}${mouth(m, 106)}
      <circle cx="68" cy="102" r="4" fill="#f2a6a0" opacity=".7"/><circle cx="132" cy="102" r="4" fill="#f2a6a0" opacity=".7"/>
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
    // Story Builder: writer. Red beret, pencil behind the ear, open notebook.
    story_builder: (m) => `${legs("#8a96ad", "#3b4763")}
      <rect x="54" y="126" width="92" height="68" rx="16" fill="#f4f1ea"/>
      <rect x="54" y="134" width="92" height="8" fill="#e6c27a"/><rect x="54" y="152" width="92" height="8" fill="#e6c27a"/><rect x="54" y="170" width="92" height="8" fill="#e6c27a"/>
      <rect x="88" y="116" width="24" height="12" rx="3" fill="#b7c2d6"/>
      <rect x="58" y="62" width="84" height="58" rx="22" fill="#dfe5ee" stroke="#b7c2d6" stroke-width="2"/>
      <circle cx="84" cy="88" r="12" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="116" cy="88" r="12" fill="#fff" stroke="${INK}" stroke-width="3"/>
      <line x1="96" y1="88" x2="104" y2="88" stroke="${INK}" stroke-width="3"/>
      ${eyes(m, 84, 116, 88)}${mouth(m, 108)}
      <ellipse cx="96" cy="60" rx="46" ry="14" fill="#c62828"/><circle cx="96" cy="46" r="5" fill="#c62828"/>
      <rect x="140" y="66" width="8" height="38" rx="2" fill="#e6c27a" transform="rotate(20 144 85)"/>
      <path d="M148 101 L152 112 L156 100 Z" fill="#f4d9b0" transform="rotate(20 144 85)"/>
      <path d="M60 158 Q50 168 66 176" fill="none" stroke="#b7c2d6" stroke-width="10" stroke-linecap="round"/>
      <path d="M140 158 Q150 168 134 176" fill="none" stroke="#b7c2d6" stroke-width="10" stroke-linecap="round"/>
      <path d="M64 162 L100 170 L100 196 L64 188 Z" fill="#fff" stroke="#9aa7bf" stroke-width="2"/><path d="M136 162 L100 170 L100 196 L136 188 Z" fill="#fff" stroke="#9aa7bf" stroke-width="2"/>
      <line x1="70" y1="172" x2="94" y2="177" stroke="#9fdcec" stroke-width="2"/><line x1="70" y1="179" x2="94" y2="184" stroke="#9fdcec" stroke-width="2"/>
      <line x1="106" y1="177" x2="130" y2="172" stroke="#9fdcec" stroke-width="2"/><line x1="106" y1="184" x2="124" y2="180" stroke="#9fdcec" stroke-width="2"/>`,
    // Gatekeeper: bouncer. Square, shades, earpiece, shield badge, velvet rope post.
    gatekeeper: (m) => `${legs("#6f7d99", "#232836")}
      <rect x="50" y="128" width="100" height="66" rx="6" fill="#232836"/>
      <path d="M100 128 L88 128 L100 150 L112 128 Z" fill="#f4f1ea"/><path d="M100 136 L96 150 L100 160 L104 150 Z" fill="#c62828"/>
      <path d="M124 142 L136 146 L136 155 Q136 163 124 168 Q112 163 112 155 L112 146 Z" fill="#e6c27a" stroke="#0b1630" stroke-width="2"/>
      <path d="M118 155 L123 160 L131 150" fill="none" stroke="#0b1630" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="88" y="118" width="24" height="12" rx="2" fill="#9aa7bf"/>
      <rect x="52" y="56" width="96" height="66" rx="6" fill="#c9d3e3" stroke="#9aa7bf" stroke-width="2"/>
      <rect x="52" y="52" width="96" height="12" rx="3" fill="#232836"/>
      ${m === "happy" ? eyes(m, 82, 118, 86) : `<rect x="62" y="78" width="34" height="18" rx="6" fill="#0b1630"/><rect x="104" y="78" width="34" height="18" rx="6" fill="#0b1630"/>
      <line x1="96" y1="85" x2="104" y2="85" stroke="#0b1630" stroke-width="4"/>
      <rect x="${m === "thinking" ? 70 : 66}" y="82" width="10" height="4" rx="2" fill="#9fdcec" opacity=".8"/><rect x="${m === "thinking" ? 112 : 108}" y="82" width="10" height="4" rx="2" fill="#9fdcec" opacity=".8"/>`}
      ${m === "happy" ? `<path d="M86 104 Q100 116 114 104" fill="${INK}"/>` : `<line x1="88" y1="108" x2="112" y2="108" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`}
      <path d="M150 74 Q160 80 156 96 Q154 106 146 112" fill="none" stroke="#232836" stroke-width="2.5"/>
      <circle cx="150" cy="76" r="5" fill="#232836"/>
      <path d="M50 146 Q36 156 44 176" fill="none" stroke="#9aa7bf" stroke-width="11" stroke-linecap="round"/>
      <path d="M150 150 Q164 160 158 178" fill="none" stroke="#9aa7bf" stroke-width="11" stroke-linecap="round"/>
      <rect x="168" y="150" width="8" height="66" rx="3" fill="#e6c27a"/><circle cx="172" cy="148" r="7" fill="#e6c27a"/>
      <path d="M172 160 Q190 176 200 168" fill="none" stroke="#c62828" stroke-width="6" stroke-linecap="round"/>`,
  };
  const LABEL = { scout: "Scout, a talent-scout robot in an orange ball cap with binoculars and a clipboard",
    story_builder: "Story Builder, a writer robot in a red beret with a pencil and an open notebook",
    gatekeeper: "Gatekeeper, a square bouncer robot in sunglasses with an earpiece, a shield badge and a velvet rope" };
  window.bot = function (name, mood = "classic", size = 48, cls = "") {
    const draw = BOTS[name] || BOTS.scout;
    return `<svg viewBox="0 0 210 230" width="${size}" height="${Math.round(size * 230 / 210)}" class="bot ${cls}" role="img" aria-label="${LABEL[name] || name}">${draw(mood)}</svg>`;
  };
  window.BOT_NAMES = { scout: "Scout", story_builder: "Story Builder", gatekeeper: "Gatekeeper" };
})();
