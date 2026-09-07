#!/usr/bin/env node
// The E-phase suite (evidence-driven readouts, 2026-09-05 →). Block-0 math for the
// evidence manifests, then source-read contracts on the wiring, milestone by milestone.
// Usage: node tests/e.test.js
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const dspSrc = blocks[0];
const modFile = path.join(os.tmpdir(), "rameau_e_under_test.js");
fs.writeFileSync(modFile, dspSrc + `
module.exports = { TONE_EVIDENCE, RING_MIN_SEC, toneEvidenceOf, evidenceFor, toneRowState, bandVerdict, TONE_BANDS_DEFAULT, tuningMidi, toneBandsFromTakes, rangeToSe, combineBands, comparabilityAll, poolMetrics, poolDeadSpots, COMPAT_CHECKS,
  tapResonance, roomTail, roomOutlastsNote, recordingPath, comparability, meanPowerSpectra, welch, smoothOct, powerToDb, shortTermRms, stftBands, detectOnsets, dynamicsMetrics, autocorrF0, goertzelTrack, trackT20, TAP_WELCH_N, tapQCeiling, ROOM_TAIL_RATIO, wavWrite, wavReadInfo, wavFileSlug, sniffAudioInfo };
`);
const D = require(modFile);

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail != null ? "  → " + detail : "")); }
}
function section(t) { console.log("\n" + t); }
// Brace-matched body of a top-level function in index.html (the naive slice trap: the
// next `function` keyword can be thousands of characters away — Q1's lesson).
function body(name) {
  const i = html.indexOf("function " + name + "(");
  if (i < 0) return "";
  let d = 0, k = html.indexOf("{", i);
  for (; k < html.length; k++) { const c = html[k]; if (c === "{") d++; else if (c === "}" && --d === 0) { k++; break; } }
  return html.slice(i, k);
}

// ---- synthetic takes ----
const midi = D.tuningMidi("standard", 0);          // E standard
const f = m => 440 * Math.pow(2, (m - 69) / 12);
function note(f0, o) { return Object.assign({ t: 0, gap: 0.6, pass: true, f0, nB: 14, t20: 2.0 }, o || {}); }
function take(notes, o) { return Object.assign({ notes, snr: 40, tap: null, air: null }, o || {}); }
const fullTake = take([
  ...midi.map((m, i) => note(f(m), { gap: 4, partials: [3, 2.5, 2, 1.8, 1.5, 1.2, 1, 0.9], stage: { twoStage: true }, attackOct: 0.1 })),
  ...[43, 46, 48, 51, 53, 56, 58, 61, 63, 66, 68, 71, 73].map(m => note(f(m), { attackOct: 0.2 })),
]);

section("E1.2 — toneEvidenceOf counts once what a take supplies");
{
  const ev = D.toneEvidenceOf(fullTake, midi, 440);
  ok(ev.analysed && ev.notes === 19 && Math.abs(ev.span - 33) < 1e-9, "19 comb-checked notes spanning 33 semitones", JSON.stringify(ev));
  ok(ev.openE === 14 && ev.openA === 14, "open E and A read their best partial count");
  ok(ev.ring === 6 && ev.partials === 6 && ev.stage === 6 && ev.attacks === 19 && ev.decays === 19, "six ringing notes, six two-stage fits, every note's decay and attack");
  const other = take([note(f(40)), note(f(45)), note(f(50))]);
  ok(D.toneEvidenceOf(fullTake, midi, 440, other).matchedDecays === 3, "decays matched by pitch against the other take");
  ok(!D.toneEvidenceOf({ f0: 110 }, midi, 440).analysed, "a take analysed before the per-note pass reports nothing");
}

section("E1.2 — evidenceFor: every state reachable, missing exact");
{
  const e2 = D.evidenceFor("pickup-resonance", D.toneEvidenceOf(fullTake, midi, 440));
  ok(e2.state === 2 && e2.missing.length === 0, "a full take measures Pickup voice");
  const thin = take([note(f(40)), note(f(45)), note(f(50)), note(f(55)), note(f(59))], { snr: 30 });
  const e3 = D.evidenceFor("pickup-resonance", D.toneEvidenceOf(thin, midi, 440));
  ok(e3.state === 3, "five notes at 30 dB is partial");
  ok(JSON.stringify(e3.missing) === JSON.stringify([{ what: "notes", have: 5, need: 10 }, { what: "snr", have: 30, need: 35 }]),
    "missing names exactly the notes and the SNR, structured, in manifest order", JSON.stringify(e3.missing));
  const e4 = D.evidenceFor("pickup-resonance", D.toneEvidenceOf(take([note(f(40)), note(f(45))]), midi, 440));
  ok(e4.state === 4 && e4.missing.some(x => x.what === "notes") && e4.missing.some(x => x.what === "span"), "two notes a fourth apart is not measurable");
  ok(D.evidenceFor("pickup-resonance", null).state === 4 && D.evidenceFor("pickup-resonance", { analysed: false }).missing[0].what === "analysis",
    "no analysis → not measurable, with `analysis` as the missing item");
  // body voice: tap → 2, LTAS peak → 3, nothing → 4
  ok(D.evidenceFor("body-resonance", D.toneEvidenceOf(take([], { tap: { f: 100 } }), midi, 440)).state === 2, "a tap measures Body voice");
  const bv3 = D.evidenceFor("body-resonance", D.toneEvidenceOf(take([], { air: { f: 100 } }), midi, 440));
  ok(bv3.state === 3 && bv3.missing.length === 1 && bv3.missing[0].what === "tap", "an LTAS peak alone is partial and asks for a tap");
  ok(D.evidenceFor("body-resonance", D.toneEvidenceOf(take([]), midi, 440)).state === 4, "no peak at all is not measurable");
  // string stiffness needs both open wound strings
  const eOnly = take([note(f(40), { nB: 14 }), note(f(45), { nB: 8 })]);
  const st = D.evidenceFor("inharmonicity", D.toneEvidenceOf(eOnly, midi, 440));
  ok(st.state === 3 && st.missing.length === 1 && st.missing[0].what === "openA" && st.missing[0].have === 8, "open A with 8 partials is short of 12: partial");
  ok(D.evidenceFor("inharmonicity", D.toneEvidenceOf(take([note(f(40), { nB: 14 })]), midi, 440)).state === 4, "no open A at all: not measurable");
  // overtone ring: partial fits on short notes are partial, six long rings are measured
  const shortRing = take(midi.map(m => note(f(m), { gap: 0.5, partials: [1, 1, 1, 1, 1, 1, 1, 1] })));
  const or = D.evidenceFor("overtone-sustain", D.toneEvidenceOf(shortRing, midi, 440));
  ok(or.state === 3 && or.missing[0].what === "ring" && or.missing[0].have === 0 && or.missing[0].need === 6, "six 0.5 s notes with partial fits are partial: none rings 1.5 s");
  // bloom: adjusted threshold 4
  ok(D.TONE_EVIDENCE.bloom.need.stage === 4 && D.TONE_EVIDENCE["pickup-resonance"].need.notes === 10 && D.TONE_EVIDENCE["pickup-resonance"].need.snr === 35,
    "the two measured adjustments are the constants (THEORY §7.7)");
  // fundamental decay reads the matched count when there is another take
  const evM = D.toneEvidenceOf(fullTake, midi, 440, take([note(f(40)), note(f(45)), note(f(50))]));
  const fd = D.evidenceFor("f0-decay", evM);
  ok(fd.state === 3 && fd.missing[0].what === "decays" && fd.missing[0].have === 3, "three matched decays out of nineteen: partial, and the count is the matched one");
  ok(D.evidenceFor("f0-decay", D.toneEvidenceOf(fullTake, midi, 440)).state === 2, "alone, the same take measures it");
  ok(D.evidenceFor("dynamic-range", null).state === 2 && D.evidenceFor("noise-floor", { analysed: false }).state === 2, "take facts have no manifest and are measured when present");
}

section("E1.4 — toneRowState: a verdict only from a measured band");
{
  const big = D.bandVerdict(3000, 1200, D.TONE_BANDS_DEFAULT["pickup-resonance"]);   // 1.3 oct, far outside 0.138
  const small = D.bandVerdict(3000, 2900, D.TONE_BANDS_DEFAULT["pickup-resonance"]);
  ok(big.distinguishable && !small.distinguishable, "fixture: one gap clears the provisional band, one does not");
  const prov = Object.assign({ provisional: true }, D.TONE_BANDS_DEFAULT["pickup-resonance"]);
  const r2 = D.toneRowState([2, 2], prov, big);
  ok(r2.state === 2 && r2.verdict === false, "INVERTED: a gap that clears a provisional band is state 2 and yields no verdict");
  const r3 = D.toneRowState([2, 2], prov, small);
  ok(r3.state === 3 && r3.verdict === false && r3.missing.length === 1 && r3.missing[0].what === "band" && r3.missing[0].need === 0.138,
    "a gap inside the provisional band is partial, and says the band is what was thin", JSON.stringify(r3));
  const meas = { oct: 0.138, measured: true };
  ok(D.toneRowState([2, 2], meas, big).state === 1 && D.toneRowState([2, 2], meas, big).verdict === true, "the same gap against a measured band is banded, with a verdict");
  ok(D.toneRowState([2, 2], meas, small).state === 1, "…and inside a measured band it is still banded (the verdict is 'not distinguishable')");
  ok(D.toneRowState([2, 3], meas, big).state === 3 && !D.toneRowState([2, 3], meas, big).verdict, "one partial take makes the row partial even with a measured band");
  ok(D.toneRowState([2, 4], meas, big).state === 3, "one measured take beside one unmeasurable is partial — one dot, one missing line");
  ok(D.toneRowState([4, 4], meas, big).state === 4 && D.toneRowState([null, null], meas, big).state === 4, "nothing measurable collapses");
  ok(D.toneRowState([2, null], prov, null).state === 2 && D.toneRowState([3], null, null).state === 3, "a single take is its own state, no band involved");
}

section("E1.4 — toneRecords: evidence and state on every record, one door to a verdict");
{
  const tr = body("toneRecords");
  ok(tr.length > 200, "toneRecords found");
  ok(/evidence:\[null,null\], state:4, missing:\[\]/.test(tr), "every record starts with evidence, a four-valued state and missing");
  ok(/const rs=toneRowState\(rec\.evidence\.map\(e=>e\?e\.state:null\), rec\.band, d\);/.test(tr) && /rec\.state=rs\.state;/.test(tr),
    "the row's state comes from block 0's toneRowState, never decided in the renderer");
  // The door: `kind:"diff"` and `kind:"same"` are assigned only inside the measured guard.
  const guardAt = tr.indexOf("else if(rs.verdict&&rec.band&&rec.band.measured){");
  ok(guardAt > 0, "the measured-band guard exists");
  const guardBody = (() => { let d = 0, k = tr.indexOf("{", guardAt); const st = k; for (; k < tr.length; k++) { if (tr[k] === "{") d++; else if (tr[k] === "}" && --d === 0) { k++; break; } } return tr.slice(st, k); })();
  const diffs = (tr.match(/kind:"diff"/g) || []).length, sames = (tr.match(/kind:"same"/g) || []).length;
  ok(diffs === 1 && sames === 1 && /kind:"diff"/.test(guardBody) && /kind:"same"/.test(guardBody),
    "INVERTED: diff and same are each assigned once, and only inside the measured guard — no verdict from a provisional band");
  ok(!/provisional/.test(guardBody), "the guard body never mentions a provisional band");
  // E6.1 (2026-09-05): the type became three-valued and a row lists the types it applies to.
  ok(/if\(def\.types&&!\[0,1\]\.some\(i=>state\.slots\[i\]&&\(applies\(def,i\)\|\|types\[i\]==null\)\)\) continue;/.test(tr), "a type-bound row is hidden, not a pointer, when no loaded slot is a kind it applies to — but stays, collapsed, for a slot whose kind is not set (2026-09-06)");
  ok(/if\(types\[i\]==null\) rec\.evidence\[i\]=\{state:4, have:\{\}, need:\{\}, missing:\[\{what:"type-unset"\}\]\};/.test(tr) && /case "type-unset": return "needs the guitar’s kind — set it on the card/.test(blocks[4]),
    "…an unset side is not measurable with 'set the guitar’s kind' as the item");
  ok(/typesDiffer=both&&!!types\[0\]&&!!types\[1\]&&types\[0\]!==types\[1\];/.test(tr) && /if\(!slotType\(0\)\|\|!slotType\(1\)\) parts\.push\("Set each guitar’s kind on its card/.test(body("renderVerdict")),
    "…the cross-type comparison waits until both kinds are set, and At a glance says what to do");
  ok(!/def\.plain/.test(tr) && !/plain:true/.test(body("toneRowDefs")), "no plain-words row is left: String stiffness is a highlight line, not a row (2026-09-06)");
  const defs = body("toneRowDefs");
  for (const k of ["warmth", "low-end", "tightness", '"sustain"', 'term:"attack"']) ok(!defs.includes(k === '"sustain"' ? 'term:"sustain"' : k), "row gone from the panel: " + k.replace(/"/g, ""));
  ok(/term:"f0-decay"/.test(defs) && !/term:"dynamic-range"|term:"residual"/.test(defs), "Fundamental decay is a row; Dynamic range and Between notes are readouts, not rows (2026-09-06)");
  ok(!/term:"inharmonicity"/.test(defs) && /slotStiffnessEA\(ownView\(t\)\.metrics\)/.test(body("stiffnessLineHtml")) && /let verdict=stiffnessLineHtml\(\);/.test(body("preCompareHtml")), "String stiffness is out of the rows and into Before you compare, read from every take's open E and A");
  const cc = html.slice(html.indexOf("const COMPAT_CHECKS=["), html.indexOf("function comparability("));
  ok(!/"warmth"|"low-end"|"tightness"|"sustain"|"attack"/.test(cc) && /"f0-decay"/.test(cc), "comparability rows name no dead row and gate Fundamental decay on register");
}

section("E1.5 — the renderer: four visual states, one phrasing place, the readout popover");
{
  const rh = body("toneRowHtml");
  ok(/if\(rec\.state===4&&!d\.text\)\{/.test(rh) && /class="tonerow tone-s4"/.test(rh) && /class="tone-missing"/.test(rh), "state 4 collapses to the title and one line");
  ok(/const hollow=\(rec\.evidence\[i\]&&rec\.evidence\[i\]\.state>=3\)\|\|bandThin;/.test(rh) && /\(hollow\?" hollow":""\)/.test(rh), "a partial take's dot is hollow — per dot, from that take's own evidence");
  ok(/const bandThin=rec\.state===3&&rec\.missing\.some\(x=>x\.what==="band"\);/.test(rh), "…and both dots are hollow when the row is partial because the gap sits inside the provisional band");
  ok(/if\(rec\.state===1&&rec\.band&&vals\[0\]!=null\)\{/.test(rh) && /class="tone-band"/.test(rh), "state 1 alone draws the shaded band");
  ok(/class="tonerow tone-s'\+rec\.state\+blockedCls/.test(rh) && /data-state="'\+rec\.state\+'"/.test(rh), "every row carries its state as a class and a data attribute");
  ok(!/provisional/.test(rh), "the surface never says 'provisional' — the shape says it");
  ok(/data-pop="'\+d\.term\+':'\+i\+'"/.test(rh), "each value label is a door to the readout popover");
  // one phrasing place
  const phr = (html.match(/function missingPhrase\(/g) || []).length;
  const callers = (html.match(/missingPhrase\(/g) || []).length;
  ok(phr === 1 && callers >= 3, "missingPhrase is defined once and is the only place a missing item becomes words", phr + " defs, " + callers + " mentions");
  const b4 = blocks[4];
  const needsElsewhere = b4.replace(body("missingPhrase"), "").replace(body("_needPhrase"), "").match(/"needs "\+/g) || [];
  ok(needsElsewhere.length === 0, "no other code composes a 'needs …' sentence", needsElsewhere.length);
  const tp = body("openTonePop");
  ok(/rec\.detail\[i\]/.test(tp) && /TONE_STATE_WORD\[rec\.state\]/.test(tp) && /termHtml\(d\.term,/.test(tp), "the popover prints the rung-3 detail, the state word and a door to the full method");
  ok(/closest\("\[data-pop\]"\)/.test(b4) && /openTonePop\(k,\+i,vl\.getBoundingClientRect\(\)\)/.test(b4), "clicking a value opens it through the same document click door as a term");
  const css = html.slice(0, html.indexOf("<script>"));
  ok(/\.track \.pt\.a\.hollow\{ box-shadow:inset 0 0 0 2\.5px var\(--slot-a\); \}/.test(css) && /\.tonerow\.tone-s4 \.tone-missing\{ grid-column:2 \/ -1;/.test(css) && /\.track \.tone-band\{/.test(css),
    "the .tone-* classes exist and hollow dots keep the slot's own color");
  ok(!/grid-template-columns:210px 64px 1fr 64px 168px/.test(css) === false, "the tone row grid is unchanged (no layout constant moved)");
}

section("E1.6 — At a glance: state-1 Instrument rows only; the empty case names the cheapest upgrade");
{
  const pc = body("proseCandidates"), rv = body("renderVerdict"), rp = body("renderProse"), cu = body("cheapestUpgrade");
  ok(!/clear\("inharmonicity"\)/.test(pc), "String stiffness never reaches At a glance");
  ok(/clear\("f0-decay"\)/.test(pc) && /fam:"time"/.test(pc.slice(pc.indexOf('clear("f0-decay")'))), "Fundamental decay is a time-family candidate");
  ok(/const clear=k=>\{ const r=rec\(k\); return \(r&&r\.verdict&&r\.verdict\.kind==="diff"\)\?r:null; \};/.test(pc),
    "candidates still come from verdict kind diff — which since E1.4 exists only in state 1 (Q5's line is untouched)");
  ok(cu.length > 100 && /r\.state===2/.test(cu) && /Record a second take of either guitar/.test(cu) && /missingPhrase\(ev\.missing\[0\],r\.def\)/.test(cu),
    "cheapestUpgrade: a second take when a row is measured, else the first missing item in the one phrasing");
  ok(/cheapestUpgrade\(\)/.test(rv) && /cheapestUpgrade\(\)/.test(rp), "both the strip and the prose print it in the empty case");
  ok(/r\.def\.glance&&r\.state===1/.test(rv) && /r\.def\.glance&&r\.state===1/.test(rp) && /r\.def\.glance&&!r\.def\.text\)/.test(cu),
    "…and 'not distinguishable' is said only when a banded glance row exists to say it (glance is a row flag since 2026-09-06, not a group)");
}

section("2026-09-06 — the Tone character card re-audited under the core use case: groups by what a player asks, per-row sensitivity, ear-first popover, synthesized pairs");
{
  const defs = body("toneRowDefs"), b4 = blocks[4];
  const tg = b4.slice(b4.indexOf("const TONE_GROUPS=["), b4.indexOf("];", b4.indexOf("const TONE_GROUPS=[")));
  ok(/id:"sound"/.test(tg) && /id:"ring"/.test(tg) && !/id:"take"|id:"inst"|id:"voice"/.test(tg) && /const TONE_PRE_GROUP="take";/.test(b4), "two row groups, How it sounds / How it rings; the take facts are the Before-you-compare block, not a group");
  ok(!/g:"inst"|g:"voice"/.test(defs), "no row points at a dead group");
  const rows = [...defs.matchAll(/\{g:"(\w+)", term:"([\w-]+)", name:"([^"]+)"/g)].map(m => ({ g: m[1], term: m[2], name: m[3] }));
  const byTerm = Object.fromEntries(rows.map(r => [r.term, r]));
  ok(rows.length === 13, "thirteen rows (String stiffness left for Before you compare, 2026-09-06)", rows.length);
  ok(byTerm["f0-decay"].name === "Sustain" && !byTerm["neck-sustain"] && byTerm["attack-spectrum"].name === "Pick attack", "player-speak names: Sustain (Dead spots merged into it), Pick attack");
  ok(["pickup-resonance", "body-resonance", "brightness", "even-odd", "harmonic-richness", "attack-spectrum"].every(t => byTerm[t].g === "sound") &&
     ["overtone-sustain", "bloom", "f0-decay"].every(t => byTerm[t].g === "ring") &&
     ["pitch-check", "noise-floor", "comparability", "recording-path"].every(t => byTerm[t].g === "take"), "each row sits in the group its question belongs to");
  const glance = [...defs.matchAll(/term:"([\w-]+)"[^\n]*glance:true/g)].map(m => m[1]).sort();
  ok(glance.join() === ["bloom", "body-resonance", "f0-decay", "overtone-sustain", "pickup-resonance"].join(), "glance:true on the five rows that speak for the guitar (String stiffness stays out via plain)", glance.join());
  // Every non-text row states what is measured (unit line + `how`), what it sounds like (`ear`) and how much the playing moves it (`sens`).
  const numeric = rows.filter(r => !["pitch-check", "noise-floor", "comparability", "recording-path"].includes(r.term));
  const rowSrc = t => { const i = defs.indexOf('term:"' + t + '"'); const j = defs.indexOf("\n    {g:", i + 1); return defs.slice(i, j < 0 ? undefined : j); };
  ok(numeric.every(r => /\n\s+how:"/.test(rowSrc(r.term))), "every numeric row carries `how` — the measurement in one breath");
  ok(numeric.every(r => /\n\s+sens:\{k:"(low|mid|high|take)", note:"[^"]*"\}/.test(rowSrc(r.term))), "every numeric row carries `sens` with a level and a note");
  ok(numeric.filter(r => r.g !== "take").every(r => /\n\s+ear:\{hi:"[^"]+", lo:"[^"]+"\}/.test(rowSrc(r.term))), "every guitar row carries `ear` — higher and lower in a player's words");
  ok(["brightness", "even-odd", "harmonic-richness", "attack-spectrum", "bloom"].every(t => /sens:\{k:"high"/.test(rowSrc(t))) && ["pickup-resonance", "f0-decay", "overtone-sustain"].every(t => /sens:\{k:"low"/.test(rowSrc(t))),
    "the disclosure follows THEORY §7.4/§7.5: the pick-moved rows say high, the decay rates and the pickup say low");
  ok(numeric.every(r => { const u = rowSrc(r.term).match(/unit:"([^"]+)"/)[1]; return /(Hz|dB|seconds|inharmonicity B|centroid|percentile|frequency|when a note|energy in|brightness of)/.test(u) && /(median|mean|whole take|average|open E|each gap|tap|first 12|two takes|every pitched|comb-checked|above the floor)/.test(u); }),
    "every unit line names the quantity and the material it is combined over");
  for (const k of ["warmth", "low-end", "tightness", 'term:"sustain"', 'term:"attack"']) ok(!defs.includes(k), "still no dead row: " + k.replace(/"/g, ""));
  // Row: the tag beside the name.
  const rh = body("toneRowHtml");
  ok(/TONE_SENS_WORD\[d\.sens\.k\]/.test(rh) && /class="sens '\+d\.sens\.k\+'"/.test(rh) && /'<small>'\+esc\(d\.unit\)\+'<\/small>/.test(rh), "the row prints the sensitivity tag beside the name and the unit line under it");
  ok(/\.tonename \.sens\{/.test(b4 + blocks[0]) || /\.tonename \.sens\{/.test(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")), "…and the tag has a rule");
  // Popover: ear first, then the measurement, then the number, then the disclosure.
  const op = body("openTonePop");
  const at = t => op.indexOf(t);
  ok(at('sec("By ear"') > 0 && at('sec("What is measured"') > at('sec("By ear"') && at('d.text?"This take":"This number"') > at('sec("What is measured"') && at('sec("How much the playing moves it"') > at('d.text?"This take":"This number"') && at('sec("What it rests on"') > at('sec("How much the playing moves it"'),
    "the readout is layered: By ear → What is measured → This number → How much the playing moves it → What it rests on");
  ok(/<b>Higher<\/b> — "\+esc\(d\.ear\.hi\)/.test(op) && /<b>Lower<\/b> — "\+esc\(d\.ear\.lo\)/.test(op), "By ear prints higher and lower");
  ok(/data-ear="'\+d\.term\+':lo"/.test(op) && /data-ear="'\+d\.term\+':hi"/.test(op) && /Synthesized string, not a recording — what changed: '\+esc\(ex\.changed\)/.test(op), "the pair of play buttons says it is synthesized and what changed");
  ok(/Same player, same pick, same phrase on both guitars — then what differs here is the guitar\./.test(op) && /d\.sens\.k==="high"\?/.test(op), "a high-sensitivity row says the use case back: same player, same pick, same phrase");
  // The synthesized pairs.
  const te = b4.slice(b4.indexOf("const TONE_EAR={"), b4.indexOf("const _earCache={};"));
  const earKeys = [...te.matchAll(/^  "([\w-]+)":\{lo:"/gm)].map(m => m[1]);
  ok(earKeys.length === 9 && earKeys.every(k => byTerm[k] && byTerm[k].g !== "take"), "nine pairs, one per guitar row (String stiffness left with its row, 2026-09-06), none for a Take row", earKeys.join());
  ok(earKeys.every(k => new RegExp('"' + k + '":\\{lo:"[^"]+", hi:"[^"]+", changed:"[^"]+",\\s*make:w=>').test(te)), "each pair has two labels, a `changed` sentence and a maker");
  ok(/THEORY §7\.2/.test(te) && /§7\.6\.2/.test(b4.slice(b4.indexOf("// ---------- ear examples"), b4.indexOf("const TONE_EAR={"))), "the pairs cite the THEORY sections they enact");
  ok(/e0\[\(i-D\+N\)%N\]/.test(body("earKs")), "the pluck-position comb is circular (a linear one left the first D samples uncombed and the even partials alive)");
  ok(/startPlayback\(0,null,null,\(\)=>setEarPlayUI\(null\),0,rec\)/.test(b4) && /toneEarRec\(term,w\)/.test(b4), "the ear buttons play through the one playback path, handing it a synthesized rec");
  ok(/samples, info:\{sampleRate:EAR_RATE\}/.test(body("toneEarRec")) && /0\.5\/pk/.test(body("toneEarRec")), "the rec has the shape canPlay() reads, normalised to −6 dBFS");
  // Copy that named the old groups.
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ok(!/Nothing in the Instrument group|Instrument rows read the open strings|It lives in the Voicing group|filed under voicing/.test(html), "no copy names the Instrument or Voicing group any more");
  const bl = html.slice(html.indexOf('key:"bloom"'), html.indexOf('key:"bloom"') + 1200);
  ok(!/swell|gets warmer or louder|build-up of body-mode/.test(bl) && /two polarizations/.test(bl) && /7\.6\.3/.test(bl), "Bloom's glossary now describes the two-stage decay THEORY §7.6.3 measures, not a swell");
}

section("E1.7 — exports: schema tone-3, additive");
{
  const csv = body("exportToneCSV"), js = body("exportToneJSON");
  ok(/# schema: tone-3/.test(csv) && /"descriptor,a_value,b_value,group,band,verdict,state,missing"/.test(csv), "CSV: tone-3, the six tone-2 columns first and unchanged, state and missing appended");
  ok(/schema:"tone-3"/.test(js) && /state:r\.state, evidence:\{a:r\.evidence\[0\], b:r\.evidence\[1\], row:r\.missing\}/.test(js), "JSON: tone-3, rowsV2 gains state and evidence per row");
  ok(/rows, rowsV2, comparability:compat, instrumentTypes/.test(js), "…and keeps every tone-2 field");
}

// ---- E2: block-4 functions that are pure apart from block 0 — extract and run them ----
const b4src = blocks[4];
function fnSrc(src, name) { const i = src.indexOf(name); if (i < 0) throw new Error("no " + name); let d = 0, k = src.indexOf("{", i); for (; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) { k++; break; } } return src.slice(i, k); }
const e2File = path.join(os.tmpdir(), "rameau_e2_under_test.js");
fs.writeFileSync(e2File, dspSrc + "\n" + fnSrc(b4src, "function computeSpectralExtras(") + "\n" + fnSrc(b4src, "function snapshotTakeRecords(") + "\nmodule.exports={snapshotTakeRecords};");
const E2 = require(e2File);

section("E2.2 — the snapshot reader: v1 loads as one take, takes[] restores the rest");
{
  const N = 4097, df = 48000 / 8192;
  const curve = () => { const a = new Array(N); for (let k = 0; k < N; k++) a[k] = -40 - 20 * Math.log10(1 + k / 200); return a; };
  const v1 = { slot: 0, name: "lp.wav", welch: { df, frames: 12, powerDb: curve() }, metrics: { centroid: 1 }, duration: 10 };
  const r1 = E2.snapshotTakeRecords(v1);
  ok(r1.length === 1 && r1[0].name === "lp.wav" && r1[0].kind === "snapshot" && r1[0].welch.power.length === N, "a v1 entry (no takes[]) yields exactly one record");
  ok(Math.abs(10 * Math.log10(r1[0].welch.power[0]) + 40) < 1e-6, "…with the stored dB curve back as power");
  const v2 = Object.assign({}, v1, { takes: [{ name: "lp-2.wav", welch: { df, frames: 9, powerDb: curve() }, metrics: {}, duration: 9 }, { name: "broken" }] });
  const r2 = E2.snapshotTakeRecords(v2);
  ok(r2.length === 2 && r2[0].name === "lp.wav" && r2[1].name === "lp-2.wav" && r2[1].welch.frames === 9, "takes[] entries follow take 0; a malformed entry is skipped, not fatal", r2.map(r => r.name).join(","));
  ok(E2.snapshotTakeRecords({ name: "x" }).length === 0 && E2.snapshotTakeRecords(null).length === 0, "an entry with no spectrum yields nothing");
  const ex = body("exportJSON"), ap = body("applySnapshot");
  ok(/slotTakes\(i\)\.slice\(1\)/.test(ex) && /\.\.\.\(takes\.length\?\{takes\}:\{\}\)/.test(ex), "the writer adds takes[] only when there are further takes — a one-take snapshot is byte-shaped like v1");
  ok(/const recs=snapshotTakeRecords\(f\);/.test(ap) && /_bindTakes\(recs\);/.test(ap) && /state\.slots\[i\]=recs\[0\];/.test(ap), "the reader goes through the same builder and binds the takes");
}

section("E2.1 — a slot holds takes: one door, one array, no cycle in the serializer");
{
  const b4 = blocks[4];
  ok(/function slotTakes\(i\)\{ const s=state\.slots\[i\]; return s\?\(s\.takes\|\|\[s\]\):\[\]; \}/.test(b4), "slotTakes() is the door");
  ok(/Object\.defineProperty\(r,"takes",\{value:recs, enumerable:false/.test(b4), "takes is non-enumerable — JSON.stringify never meets the cycle");
  ok(/async function analyzeSlot\(i,slot,seq,append\)/.test(b4) && /if\(append&&state\.slots\[i\]\) attachTake\(i,slot\);/.test(b4), "analyzeSlot has an append path that attaches instead of replacing");
  ok(/if\(!slot\.takes\) _bindTakes\(\[slot\]\);/.test(b4), "…and a re-analysis of the primary keeps its sibling takes");
  ok(/loadFileIntoSlot\(i,audio\[0\],\{append:!!state\.slots\[i\]\}\)/.test(b4), "a file dropped on a loaded slot adds a take");
  ok(/if\(!append&&!\(opts&&opts\.keep\)\)\{ state\.slotNames\[i\]=""; state\.slotTypes\[i\]=null; state\.slotPaths\[i\]=null; \}/.test(b4), "the name, the type and the path override stay on the slot when a take is added or replaced from the stack (opts.keep), and drop when a new guitar replaces the slot");
  const lr = body("landRecording");
  ok(/const append=!!state\.slots\[i\]&&!keep;/.test(lr) && /if\(pr&&pr\.replace!=null&&slotTakes\(i\)\.length>1\) removeTake\(i,pr\.replace\);/.test(lr) && /processing:proc\|\|null, protocol:protocol\|\|null \},seq,append\)/.test(lr),
    "a recorded take into a loaded slot is another take of that guitar; recorded from a row it replaces that row's take (2026-09-06)");
  const rt = body("removeTake");
  ok(/if\(arr\.length===1\)\{ clearSlot\(i\); return; \}/.test(rt) && /state\.slots\[i\]=arr\[0\];/.test(rt), "removing the last take clears the slot; removing take 0 promotes take 1");
}

section("E2.3 — bands from takes: the spread across one guitar's takes, live, with the same semantics as a saved band");
{
  const bands = { "pickup-resonance": { oct: 0.138 }, "even-odd": { abs: 4 }, "overtone-sustain": { oct: 0.3 } };
  const r = D.toneBandsFromTakes({ "pickup-resonance": [3000, 3300], "even-odd": [1.0, -0.5, 2.0], "overtone-sustain": [2.0, null], "unknown": [1, 2] }, bands);
  ok(Math.abs(r["pickup-resonance"].v - Math.log2(1.1)) < 1e-12 && r["pickup-resonance"].n === 2, "an oct band is the log₂ spread of max over min");
  ok(Math.abs(r["even-odd"].v - 2.5) < 1e-12 && r["even-odd"].n === 3, "an abs band is max − min");
  ok(!("overtone-sustain" in r) && !("unknown" in r), "fewer than two usable values, or no domain, yields no band");
  ok(!("pickup-resonance" in D.toneBandsFromTakes({ "pickup-resonance": [3000, -1] }, bands)), "a log band ignores non-positive values");
  const tb = body("toneBandFor"), lv = body("liveToneBands"), rr = body("renderToneRows"), tr = body("toneRecords");
  ok(/const lv=liveToneBands\(\); const lb=lv\.ready&&lv\.bands\[key\];/.test(tb) && tb.indexOf("lv.ready") < tb.indexOf("state.toneBands&&state.toneBands[key]") && tb.indexOf("state.toneBands[key]") < tb.indexOf("provisional:true"),
    "precedence: live from the takes, then saved, then provisional");
  ok(/measured:true, live:true/.test(tb), "a live band is a measured band — it opens the verdict door");
  ok(/if\(per\[0\]&&per\[1\]\)/.test(lv) && /const c=combineBands\(a,b\); if\(c\) out\[k\]=c;/.test(lv) && /toneBandsFromTakes\(vals, TONE_BANDS_DEFAULT\)/.test(lv), "live bands need two or more takes in BOTH slots, and combine the two spreads as a standard error (every take counts, 2026-09-06)");
  ok(/takes\.map\(t=>\{ try\{ const v=def\.val\(ownView\(t\),i\);/.test(lv), "…and every take's value comes from the same def.val the panel prints, on the take as analysed alone (never the mean spectrum take 0 carries)");
  ok(/state\.toneRepeat=lv\.ready;/.test(rr) && /toneBandsStatus\.textContent=\(lv\.ready\?"Reliability: measured from the takes on the cards"/.test(rr) && !/toneSaveBandsBtn|saveToneBands/.test(html) && !/toneRepeatToggle/.test(html),
    "the switch and the Save button are gone (2026-09-06); a status line says where the bands come from");
  ok(!/kind:"repeat"/.test(tr), "the old repeat-mode verdict is gone — live bands flow through the one door");
  ok(/for\(const k in lv\.bands\)/.test(body("snapshotBands")) && /out\[k\]=\{v:lv\.bands\[k\]\.v\};/.test(body("snapshotBands")), "the export carries the live spreads (Save folded into it, 2026-09-06)");
}

section("E2.4–E2.6 — the card: name headline, take list, readiness, one Play/Pause, the waveform");
{
  const rc = body("renderCard"), th = body("transportHtml"), tr = body("takeReadiness"), b4 = blocks[4];
  ok(/class="slotname/.test(rc) && !/class="filesub"/.test(rc) && /const s=playRec\(i\)\|\|state\.slots\[i\], info=s\.info/.test(rc), "the name is the headline; the file lives in its take row and the facts line describes the selected take (2026-09-06)");
  ok(/<div class="takelist">'\+takeRows\+adding\+addRow\+'<\/div>/.test(rc) && /data-act="addfile"/.test(rc) && /<div class="takerow takeadd"><span class="k">\+ Add another take of this guitar<\/span>/.test(rc), "a stack of takes with an add-another-take row (open or record)");
  ok(/data-act="replace" data-take="'\+k\+'" title="Replace this take with a file">Open file/.test(rc) && /data-act="record" data-take="'\+k\+'" title="Replace this take with a new recording">● Record/.test(rc) && /data-act="cleartake" data-take="'\+k\+'"/.test(rc),
    "…every row carries Open file, Record and Remove, and the first two replace that row's take");
  ok(/\(t===sel\?" sel":""\)/.test(rc) && /if\(row&&!e\.target\.closest\("button"\)\)\{ selectTake\(i,\+row\.dataset\.take\); return; \}/.test(b4) && /startPlayback\(i,null,null,\(\)=>cardPlayStopped\(i\),o,playRec\(i\)\)/.test(body("startCardPlay")) && /const s=playRec\(i\); if\(!s\|\|!s\.tvis\) return;/.test(body("drawWave")),
    "…one transport per card: a row click selects the take, and Play, the waveform and the seek address the selected one");
  ok(/<label class="typelbl'\+\(slotType\(i\)\?"":" unset"\)\+'">Type <select class="slottype"/.test(rc) && /<option value=""'\+\(slotType\(i\)\?"":" selected"\)\+'>Not set — choose…<\/option>/.test(rc),
    "the type select is labelled Type and starts at Not set (2026-09-06)");
  ok(!/data-act="record"/.test(th) && !/data-act="replace" data-take="0" title="Replace with another file"/.test(rc) && /data-act="clear" title="Clear this card/.test(rc), "the head keeps only ✕ Clear; Record and Replace live on the take rows, never in the transport");
  ok(/data-act="playpause"/.test(th) && !/cardpause/.test(th) && !/type="range" class="seek"/.test(th), "one Play/Pause toggle, no separate pause button, no bare range");
  ok(/<canvas class="wave" data-seek/.test(th) && /seekCard\(i,\{value:waveSeekValue\(cv,e\)\},false\)/.test(b4) && /seekCard\(i,\{value:waveSeekValue\(d\.cv,e\)\},true\)/.test(b4),
    "the waveform seeks through the same seekCard(): preview while down, commit on release");
  ok(!/const sk=tr\.querySelector\(".seek"\)/.test(body("syncTransport")) && /drawWave\(i\);/.test(body("syncTransport")), "the tick redraws the waveform's playhead instead of moving a slider");
  ok(/const ev=toneEvidenceOf\(m, tuningMidi\(state\.tuning,state\.customOffset\), state\.a4, null\);/.test(tr) && /evidenceFor\(d\.term,ev\)/.test(tr) && /supports "\+supported\+" of "\+total\+" rows/.test(tr),
    "readiness reads evidenceFor over every row and prints how many it supports");
  ok(!/<span class="k">SNR<\/span>/.test(rc) && !/termHtml\("noise-floor","floor"\)/.test(rc), "the floor/SNR pills are gone — the readiness line replaces them");
  ok(/openReadinessPop\(i,\+rb\.dataset\.ready\|\|0,rb\.getBoundingClientRect\(\)\)/.test(b4) && /missingLine\(r\.e\.missing,r\.def\)/.test(body("openReadinessPop")), "the tap opens the numbers and the rows not supported, phrased by the one place");
  ok(/or a snapshot JSON/.test(rc), "snapshot JSON is its own phrase in the drop hint");
  const dw = body("drawWave");
  ok(/s\.tvis\.onsets/.test(dw) && /a>=0\.999/.test(dw) && /const clipCol="#d94a3d";/.test(dw), "the waveform draws the onset ticks and clipping in the meter's red");
}

section("E3 — the guided take: unlocks from TONE_EVIDENCE, the analysis onset detector, protocol on the take");
{
  const b4 = blocks[4];
  const lit = b4.slice(b4.indexOf("const REC_PROTOCOL=["), b4.indexOf("];", b4.indexOf("const REC_PROTOCOL=[")) + 2);
  const proto = new Function(lit + " return REC_PROTOCOL;")();
  ok(proto.length === 6 && proto.map(s => s.id).join(",") === "silence,open,walk,anchors,tap,mic", "six steps in the briefed order", proto.map(s => s.id).join(","));
  const bad = proto.flatMap(s => s.unlocks).filter(k => !D.TONE_EVIDENCE[k]);
  ok(bad.length === 0 && proto.flatMap(s => s.unlocks).length >= 10, "every unlocks key is a TONE_EVIDENCE key — the manifest is the source", bad.join(","));
  ok(/for\(const st of REC_PROTOCOL\) for\(const k of st\.unlocks\) if\(!TONE_EVIDENCE\[k\]\) throw/.test(b4), "…and the page refuses to load a step that unlocks an unknown row");
  ok(proto.find(s => s.id === "tap").when === "hollow" && proto.find(s => s.id === "mic").when === "mic" && proto.find(s => s.id === "silence").advance === "seconds:3", "tap is hollow-only, mic placement is mic-only, silence counts three seconds");
  const gt = body("guidedTick");
  ok(/const sb=stftBands\(x,rate,\[\[60,200\],\[200,1200\],\[2000,6000\]\]\);/.test(gt) && /g\.count=detectOnsets\(sb\.flux,sb\.frameRate\)\.length;/.test(gt),
    "the step advance counts onsets with the analysis's own detector on the analysis's own bands — one detector");
  ok(/if\(cap\.guide\) guidedTick\(cap,cards\[i\]\);/.test(b4), "…driven from the capture's existing tick, no new node and no new pass");
  const ga = body("_guideAdvance");
  ok(/const REC_GUIDE_SNR_MIN=25, REC_GUIDE_WARN_S=25, REC_GUIDE_WAIT_S=45;/.test(b4) && !/snr<REC_GUIDE_SNR_MIN/.test(ga) && !/stopCapture/.test(ga),
    "the advance no longer judges the take; the gate moved into the tick (2026-09-06)");
  const gtk = body("guidedTick");
  ok(/if\(!g\.heard\)\{[\s\S]*?g\.heard=g\.snr==null\|\|g\.snr>=REC_GUIDE_SNR_MIN;/.test(gtk) && /if\(g\.heard\)\{[\s\S]*?detectOnsets\(sb\.flux,sb\.frameRate\)\.length;/.test(gtk),
    "notes are counted only once the guitar is heard REC_GUIDE_SNR_MIN dB above the measured floor — room noise cannot advance a step");
  ok(/else if\(g\.elapsed>=REC_GUIDE_WAIT_S\)\{\s*_guideFail\(cap,"Stopped and discarded/.test(gtk) && /stopCapture\(false\);\s*cardUI\[i\]=\{mode:"arming",prev:prev,perm:"granted",msg:null,checking:false,fail:text\};/.test(body("_guideFail")),
    "a played step that hears nothing for REC_GUIDE_WAIT_S s discards the take and re-arms the panel with the reason, never lands it");
  ok(/g\.elapsed>=REC_GUIDE_WARN_S\) return "Nothing heard yet — stopping in "\+left\+" s/.test(body("_guideProgressText")) && /class="reccount" title="seconds left"/.test(body("guideHtml")),
    "…the prompt warns before it stops, and a clock step shows a countdown");
  ok(/landRecording\(i,buf,cap\.proc,guideProtocol\(cap\)\);/.test(b4) && /protocol:protocol\|\|null \},seq,append\)/.test(b4) && /protocol:meta\.protocol\|\|null \}/.test(b4),
    "the landed take carries protocol {version, stepsDone, skipped} in its facts — and so in the snapshot");
  ok(/recGuided:!!state\.recGuided,/.test(body("_settingsPayload")) && /if\(typeof j\.recGuided==="boolean"\) state\.recGuided=j\.recGuided;/.test(b4), "the Guided switch is remembered additively; absent → on");
  ok(/data-recguided/.test(body("renderCard")) && /data-act="recskip"/.test(body("guideHtml")), "the arming panel has the switch and a running step can be skipped");
  ok(/skippedFor\(r\.def\.term\)/.test(body("openReadinessPop")), "the readiness tap names the skipped step beside the row it would have fed");
  ok(/<h4>The guided take<\/h4>/.test(html) && /<h4>What to play — three parts, in this order<\/h4>/.test(html), "the recording guide gained one paragraph and lost nothing");
}

section("E4 — the Band Energy fold: one builder, two strips, a step line, the chip, the axis");
{
  const b3 = blocks[3], b4 = blocks[4];
  // E4.5: None is a real vocabulary with an empty region set — evaluate the literal.
  const lit = b3.slice(b3.indexOf("const VOCABS=["), b3.indexOf("];", b3.indexOf("const VOCABS=[")) + 2);
  const V = new Function(lit + " return VOCABS;")();
  const none = V.find(v => v.id === "none");
  ok(none && Array.isArray(none.regions) && none.regions.length === 0 && V.length === 5, "VOCABS carries None as an empty set, beside the four vocabularies", V.map(v => v.id).join(","));
  // E4.1/E4.2/E4.3: every band number comes from bandTable(), which reads Q3's one floor predicate.
  const bt = body("bandRowsFor");
  ok(/nearFloorBands\(\)/.test(bt) && /bandPower\(/.test(bt) && /share/.test(bt) && /onFloor/.test(bt), "bandTable() is the one builder: shares, Δ and the floor from the same predicate the table used");
  // 2026-09-06 (user test): the table came back as its own sub-section, on the same builder; the numbers left the strips.
  ok(/id="freqBands" data-sub="bands"/.test(html) && /id="bandsTable"/.test(html) && /const t=bandTable\(\);/.test(body("renderBandsTable")) && !/bandPower\(/.test(body("renderBandsTable")),
    "the Band energy table is back as a sub-section and renders bandTable()'s rows — never its own integral");
  ok(/if\(key!==_bandsKey\)\{ _bandsKey=key; renderBandsTable\(\); \}/.test(body("drawAll")) && /\[VOCAB_ACTIVE,state\.smooth,state\.lm,state\.lmOffset,state\.tuning,state\.customOffset,sk\(0\),sk\(1\)\]/.test(body("drawAll")) && /bandsTable\.setAttribute\("data-nearfloor-rows", String\(t\.nFloor\)\)/.test(body("renderBandsTable")),
    "…drawn with the plots but only when its inputs change, folded like them, and it reports the floored rows");
  ok(/bands:anyLoaded\(\)\?bandTable\(\):null/.test(body("buildSpecModel")) && /const bands=bandTable\(\);/.test(body("buildDiffModel")), "both plot models carry the builder's rows to block 3");
  ok(/const t=bandTable\(\);/.test(body("biggestRegionDelta")) && /const t=bandTable\(\);/.test(body("exportBandsCSV")) && /const t=bandTable\(\);/.test(body("exportBandsJSON")) && /const t=bandRowsFor\(\[r\]\), row=t\.rows\[0\];/.test(body("regionBandHtml")) && /return Object\.assign\(bandRowsFor\(vocab\.regions\),\{vocab\}\);/.test(body("bandTable")),
    "At a glance, both Bands exports and the region popover read the same builder");
  ok(/termContentHtml\(key, regionBandHtml\(key\)\)/.test(body("openPopover")) && /valsOverride\?valsOverride:vals\.length/.test(body("termSections")), "a region's glossary popover prints the table's row as its Current values — one tap down, nothing printed twice");
  // The strip: shares on the Spectrum, Δ on the Difference, skipped when narrow, never smeared.
  const lane = body("drawEqLane");
  ok(/drawEqLane\(ctx, w, hits\);/.test(body("drawSpectrumScene")) && /drawEqLane\(ctx, w, hits\);/.test(body("drawDiffScene")) && /^function drawEqLane\(ctx, w, hits\)\{/m.test(b3),
    "the strips print no band numbers (2026-09-06) — the lane takes no rows");
  ok(!/fmtPct\(/.test(lane) && !/fmtDb\(/.test(lane), "INVERTED: no share or Δ is printed on either strip");
  // The step line.
  const ds = body("drawDiffScene");
  ok(/model\.bands\.rows\.filter\(r=>r\.d!=null/.test(ds) && /ctx\.setLineDash\(r\.onFloor\?\[4,4\]:\[\]\);/.test(ds) && /r\.onFloor\?0\.28:0\.62/.test(ds), "the band-mean Δ step line draws over the curve, dashed [4,4] and faint where the whole band is under the floor — R5.5's own dressing");
  // E4.4: the fold key is gone; a stored one is ignored by the existing filter.
  ok(/bands:freqBands/.test(b4) && /bands:false/.test(b4) && /if\(k in COLL_CARDS&&typeof j\[k\]==="boolean"\)/.test(b4), "gsCollapse/?open= know 'bands' again (2026-09-06)");
  // E4.5/E4.6: the chip on both plots drives setVocab(); Strings at the axis on both plots through one door; the card header is title and subtitle only.
  ok((html.match(/<select class="lanesel"/g) || []).length === 2 && /for\(const sel of \[vocabSel,vocabSelDiff\]\) sel\.addEventListener\("change",\(\)=>\{\s*setVocab\(sel\.value\);/.test(b4), "a .lanesel chip on each plot, both driving setVocab()");
  ok(/vocabSel\.value=v; vocabSelDiff\.value=v;/.test(body("setVocab")), "…setVocab syncs both chips");
  // 2026-09-06 (user test): "all the controls are on the top" — one Show strings switch in the card header, Clear harmonics beside it.
  const head = html.slice(html.indexOf('id="freqCard"'), html.indexOf('id="freqSpec"'));
  ok((html.match(/class="stringsSw"/g) || []).length === 1 && /<span class="lbl">Show strings<\/span>/.test(head) && /id="clearHarmonicsBtn" hidden/.test(head) && !/class="axisctl"/.test(html),
    "Show strings and Clear harmonics sit in the Frequency card header; nothing sits on the axis row");
  ok(/querySelectorAll\("\.stringsSw"\)\.forEach\(c=>c\.addEventListener\("change",\(\)=>setStrings\(c\.checked,true\)\)\)/.test(b4) && /if\(stg\) setStrings\(stg\[1\]==="1",false\);/.test(b4) && /clearHarmonicsBtn\.hidden = !state\.strings \|\| !_hasAnyHarmonics\(\);/.test(body("syncClearHarmonicsBtn")),
    "…the switch and the ?strings= hook go through setStrings(); Clear harmonics renders only while a harmonic is on");
  ok(/id="bandsCsvBtn"/.test(html.slice(html.indexOf('id="freqBands"'), html.indexOf('id="toneCard"'))), "the Bands CSV/JSON buttons live in the Band energy sub-section");
  ok(/PLOT\.mT=laneTwoRows\(\)\?LANE_TWO:LANE_ONE;/.test(body("syncLaneHeight")) && /const LANE_TOP=18, LANE_ONE=LANE_TOP\+34, LANE_TWO=LANE_TOP\+48;/.test(b3) && /#specCanvas\{ height:474px; \}/.test(html) && /#diffCanvas\{ height:250px; \}/.test(html),
    "the lane is the chip row plus M2.6c's two text lines per region row: 52 px, or 66 for two rows; the canvases keep the chip row");
}

section("E6 — the copy is frozen, the type has three values, the rows and the vocabulary follow it");
{
  const crypto = require("crypto");
  const S = "// ---------- hollow and acoustic copy (E6) ----------", E = "// ---------- end hollow and acoustic copy ----------";
  const i = html.indexOf(S), j = html.indexOf(E);
  ok(i > 0 && j > i, "both E6 copy sentinels are present");
  const block = html.slice(i, j + E.length) + "\n";
  const sha = crypto.createHash("sha256").update(block).digest("hex");
  ok(sha === "ef7e6780cbdc34fdba62252fb3ba7bfba8370efd196524d452bed73e19350f6c", "the E6 copy block is byte-identical to the reviewed text", sha.slice(0, 16));
  const copyText = block.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ok(!/§|\.md\b|THEORY|ROADMAP/.test(copyText), "…and the prose never cites a document at the user");
  const b4 = blocks[4], b3 = blocks[3];
  ok(/const SLOT_TYPES=\["solid","hollow","acoustic"\];/.test(b4) && /function normType\(t\)\{ return SLOT_TYPES\.includes\(t\)\?t:null; \}/.test(b4) && /function slotType\(i\)\{ return normType\(state\.slotTypes\[i\]\); \}/.test(b4) && /slotTypes:\[null,null\], slotPaths:\[null,null\]/.test(b4),
    "the type is three-valued plus not-set (null) through one normaliser, and a fresh slot is not set");
  ok(/state\.slotTypes\[i\]=normType\(st\.slotTypes\[i\]\);/.test(b4) && /state\.slotTypes\[i\]=normType\(f\.instrument\);/.test(b4), "the snapshot reader accepts acoustic on settings.slotTypes and on the file entry");
  ok(/slotPaths:\(state\.slotPaths\|\|\[null,null\]\)\.slice\(\)/.test(b4) && /if\(Array\.isArray\(st\.slotPaths\)\)/.test(b4), "the path override rides in the snapshot, additively, and is read back");
  ok(!/state\.slotTypes\[i\]=.*pathFor|slotTypes\[i\]=.*recordingPath/.test(b4), "INVERTED: nothing writes a detected path into the type");
  ok(/types:\["solid","hollow"\], piezo:true/.test(b4) && /types:\["hollow","acoustic"\]/.test(b4), "Pickup voice belongs to solid + hollow (and an acoustic on a piezo); Body voice to hollow + acoustic");
  const tr = body("toneRecords");
  ok(/rec\.evidence\[i\]=\{state:4, have:\{\}, need:\{\}, missing:\[\{what:"type", other:types\[i\]\}\]\};/.test(tr), "a typed row with no meaning on one side of a pair collapses that side with missing {what:'type'}");
  ok(/const rm=pooled\[i\]&&pooled\[i\]\.room;/.test(tr) && /ROOM_ROWS\.has\(def\.term\)&&rm&&rm\.outlasts/.test(tr) && /const ROOM_ROWS=new Set\(\["overtone-sustain","bloom","f0-decay"\]\);/.test(b4), "the four decay rows drop to partial when the room outlasts the note, with the room named");
  ok(/for\(const t of slotTakes\(i\)\)\{ if\(t\.metrics\)\{ t\.metrics\.path=pathForTake\(i,t\);/.test(tr) && /function pathFor\(i\)\{ return pathForTake\(i,state\.slots\[i\]\); \}/.test(b4), "the resolved path rides on every take's metrics (detected per take), so comparability and the glossary read one value");
  ok(/m\.room=roomTail\(shortTermRms\(x,rate\),0\.025,times,m\.noiseFloor\);/.test(b4) && /m\.room\.outlasts=roomOutlastsNote\(m\.room,ref\);/.test(b4) && /if\(!ref\|\|lt>ref\) ref=lt;/.test(b4), "computeTimeMetrics reads the tail once and judges it against the slower of the fundamental's T20 and the late two-stage slope");
  ok(/const tr=tapResonance\(db,wt\.df\);/.test(b4) && /welch\(tap,rate,TAP_WELCH_N,TAP_WELCH_N>>1,null\)/.test(b4), "the tap branch reads both modes through tapResonance at the block-0 window");
  ok(/VOCAB_BY_ID\.anatomy\.regions=ac\?ANATOMY_ACOUSTIC:ANATOMY_ELECTRIC;/.test(body("syncVocabTuning")) && /key:"an-ac-air"/.test(b3) && /key:"an-ac-body"/.test(b3) && /key:"an-ac-strings"/.test(b3) && /key:"an-ac-sparkle"/.test(b3), "Anatomy swaps to the acoustic set (air / body / strings / sparkle) when an acoustic is loaded");
  ok(/\(st\.when==="mic"&&mic\)/.test(body("guidedStepsFor")), "the mic-placement step lights up for a mic take");
  ok(/"stereo, "\+\(s\.channelMode==="left"\?"left":s\.channelMode==="right"\?"right":"summed"\)/.test(body("renderCard")), "a stereo file says 'stereo, summed' (or which side was picked)");
  ok(/data-pathsel/.test(body("openTonePop")) && /closest\("\[data-pathsel\]"\)/.test(b4) && /term:"recording-path"/.test(b4), "the Recording path row is a Take row with an override select in its popover");
  ok(/Different kinds of guitar — /.test(body("renderVerdict")), "At a glance opens a cross-type pair by saying so");
}

section("E7 — the name in the file: a WAV round trip, the sniffer unmoved, the slug, the wiring");
{
  const RATE = 44100, N = 1234;
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let k = 0; k < N; k++) { L[k] = Math.sin(k * 0.05) * 0.7; R[k] = Math.cos(k * 0.031) * 0.4; }
  const ab = { sampleRate: RATE, numberOfChannels: 2, length: N, getChannelData: c => c ? R : L };
  const name = "Zahid’s Lés Paul (1959)"; // odd byte length, non-ASCII: exercises padding and UTF-8
  const meta = { name, date: "2026-09-05", software: "Claude Rameau", comment: "take 2 · solidbody · guided v1",
    rmau: { app: "Claude Rameau", name, type: "hollow", take: 1, protocol: { version: 1, stepsDone: ["silence", "open"], skipped: ["tap"], floorDb: -61.5 }, path: "mic", onsets: [0.12, 1.5] } };
  const buf = D.wavWrite(ab, meta);
  const wi = D.wavReadInfo(buf);
  ok(wi && wi.sampleRate === RATE && wi.channels === 2 && wi.bitDepth === "32-bit float", "wavReadInfo reads the format back", JSON.stringify(wi && [wi.sampleRate, wi.channels, wi.bitDepth]));
  ok(wi && wi.info.INAM === name && wi.info.ICRD === "2026-09-05" && wi.info.ISFT === "Claude Rameau" && /guided v1/.test(wi.info.ICMT), "…INAM / ICRD / ISFT / ICMT round-trip, UTF-8 and odd lengths included", JSON.stringify(wi && wi.info));
  ok(wi && JSON.stringify(wi.rmau) === JSON.stringify(meta.rmau), "…and the rmau JSON is equal after the trip");
  ok(wi && wi.order.indexOf("LIST") < wi.order.indexOf("data") && wi.order.indexOf("rmau") < wi.order.indexOf("data") && wi.order.indexOf("fmt ") === 0, "chunk order: fmt, LIST, rmau, then data", wi && wi.order.join(","));
  let exact = true; if (wi) { const dv = new DataView(buf); for (let k = 0; k < N && exact; k++) { if (dv.getFloat32(wi.dataOffset + k * 8, true) !== L[k] || dv.getFloat32(wi.dataOffset + k * 8 + 4, true) !== R[k]) exact = false; } }
  ok(wi && exact && wi.dataBytes === N * 8, "the samples are bit-exact, interleaved, 32-bit float");
  ok(buf.byteLength % 2 === 0 && new DataView(buf).getUint32(4, true) === buf.byteLength - 8, "RIFF size and even alignment hold");
  const sn = D.sniffAudioInfo(buf);
  ok(sn && sn.container === "WAV" && sn.sampleRate === RATE && sn.channels === 2 && sn.bitDepth === "32-bit float", "the sniffer reads the same rate from a file carrying LIST and rmau — it stops at fmt", JSON.stringify(sn));
  const sBody = body("sniffAudioInfo");
  ok(!/LIST|rmau|INAM/.test(sBody), "…and its source never mentions either chunk");
  ok(D.wavReadInfo(new Uint8Array(20)) === null && D.wavReadInfo(D.wavWrite({ sampleRate: 8000, numberOfChannels: 1, length: 0, getChannelData: () => new Float32Array(0) }, {})).info.INAM === undefined, "not a WAV → null; no name → no INAM (LIST holds only what was given)");
  ok(D.wavFileSlug("Les Paul (1959)!") === "les-paul-1959" && D.wavFileSlug("  Zahid’s  Lés_Paul ") === "zahids-les-paul" && D.wavFileSlug("") === "" && D.wavFileSlug("日本") === "", "the slug rule: lowercase, spaces to hyphens, [a-z0-9-] only");
  const b4 = blocks[4];
  const tf = body("takeFileName");
  ok(/slug\+"_"\+new Date\(\)\.toISOString\(\)\.slice\(0,10\)\+"_take"\+\(\(k\|\|0\)\+1\)\+suffix\+"\.wav"/.test(tf) && /return "rameau_"\+sanitizeName\(s\.name\)\+"\.wav";/.test(tf) && /other===slug\)\?\(i\?"_b":"_a"\):""/.test(tf),
    "the filename is {slug}_{date}_take{n}.wav, the old rameau_ name when unnamed, _a/_b only on a clash");
  const st = body("saveTake");
  ok(/wavWrite\(t\.audioBuf,meta\)/.test(st) && /software:APP_NAME/.test(st) && /rmau:\{ app:APP_NAME, name:name\|\|"", type, take:\(k\|\|0\), protocol:pr\|\|null/.test(st), "saveTake writes through wavWrite with INFO and rmau");
  ok(/toast\("Saved "\+fn\+" — "/.test(st) && /title="Save as '\+esc\(takeFileName\(i,k\)\)/.test(body("renderCard")), "the save line and the button say the name they will use");
  ok(!/encodeWavFloat32\(/.test(st), "the old header-only writer is not the save path any more");
  const lf = body("loadFileIntoSlot");
  ok(/wavReadInfo\(buf\)/.test(lf) && /if\(inam&&!slotName\(i\)&&state\.slots\[i\]\) setSlotName\(i,inam\);/.test(lf), "on load INAM prefills an unnamed slot through the one name writer, and never overwrites a name");
  ok(/if\(rm&&!append\)\{ if\(rm\.type\) state\.slotTypes\[i\]=normType\(rm\.type\);/.test(lf) && /protocol:rm&&rm\.protocol\?rm\.protocol:null/.test(lf), "…rmau restores type and path on a fresh slot only, and the protocol rides on the take");
}

section("2026-09-06 — a stack of takes is shown as its mean; the time views follow the selected take");
{
  // Block 0: the mean of Welch spectra — equal weight per take, on the first take's grid, frames summed.
  const A={power:Float64Array.from([1,2,3,4]), df:10, frames:5}, B={power:Float64Array.from([3,2,1,0]), df:10, frames:7};
  const m1=D.meanPowerSpectra([A]);
  ok(m1.power===A.power && m1.df===10 && m1.frames===5, "the mean of one take is that take (byte-identical views for a single take)");
  const m2=D.meanPowerSpectra([A,B]);
  ok(Array.from(m2.power).join()==="2,2,2,2" && m2.frames===12 && m2.df===10, "two takes at one Δf: the arithmetic mean of power, frames summed", Array.from(m2.power).join());
  const C={power:Float64Array.from([0,2,4,6,8,10,12,14]), df:5, frames:1}; // the same line sampled twice as finely
  const m3=D.meanPowerSpectra([A,C]);
  ok(Array.from(m3.power).map(x=>+x.toFixed(6)).join()==="0.5,3,5.5,8", "a take at another Δf is interpolated in power onto the first take's grid", Array.from(m3.power).join());
  const Dd={power:Float64Array.from([10,10]), df:10, frames:1};
  ok(Array.from(D.meanPowerSpectra([A,Dd]).power).join()==="5.5,6,6.5,7", "…and held at its last bin above its own Nyquist");
  // Wiring: the stash, the mean in place, the views.
  const b1=blocks[1], b3=blocks[3], b4=blocks[4];
  ok(/if\(!slot\.own\)\{ const spec=\{\}; for\(const k of SPEC_METRIC_KEYS\) spec\[k\]=m\[k\]; slot\.own=\{welch:slot\.welch, fixed6db:slot\.fixed6db, spec\}; \}/.test(body("computeSpectralExtras")), "computeSpectralExtras stashes the take's own analysis once");
  ok(/slot\.own=null;[^\n]*\n\s*computeSpectralExtras\(slot\);/.test(body("analyzeSlot")) && /refreshSlotMean\(i\);\n\s*cardUI\[i\]=\{mode:"loaded"\};/.test(body("analyzeSlot")), "a re-analysis stashes afresh, and every landing refreshes the mean");
  const rm=body("refreshSlotMean");
  ok(/prim\.welch=meanPowerSpectra\(specs\); computeSpectralExtras\(prim\); prim\.meanOf=specs\.length;/.test(rm) && /prim\.welch=prim\.own\.welch; prim\.fixed6db=prim\.own\.fixed6db; Object\.assign\(prim\.metrics,prim\.own\.spec\); prim\.meanOf=0;/.test(rm) && /prim\._dispCache=null; state\._eqFit=null;/.test(rm),
    "take 0 carries the mean spectrum and the metrics measured on it, or its own again when the stack shrinks to one; the display cache and the EQ fit are dropped");
  ok(/refreshSlotMean\(i\);/.test(body("removeTake")) && /state\.slots\[i\]=recs\[0\];\n\s*refreshSlotMean\(i\);/.test(body("applySnapshot")), "removing a take and restoring a snapshot refresh the mean too");
  ok(/const s=ownView\(s0\);/.test(body("exportSnapshot")||b4) , "the snapshot writes take 0 as analysed on its own, never the mean");
  // Time views read the selected take.
  for (const fn of ["bothSgLoaded","sgramScale","sgramView","sgramModelFor","buildEnvModel"]) ok(/viewRec\(/.test(body(fn)) && !/state\.slots\[[ij]\]\.tvis|const s=state\.slots\[i\], tv=/.test(body(fn)), fn+" reads viewRec, never state.slots[i].tvis");
  ok(/const s=viewRec\(i\), tv=s&&s\.tvis;\n\s*if\(!tv\|\|!tv\.sg\)\{ hide\(\); return; \}/.test(b4), "…and so does the spectrogram crosshair");
  ok(/requestDraw\(\);\s*\/\/ the spectrogram and the envelope follow the selection\n\s*renderAnalysis\(\);/.test(body("selectTake")), "selecting a take redraws the time views and re-renders the panel");
  // Chips name their source.
  ok(/return t\+meanNote\(\);/.test(body("statusText")) && /" = mean of "\+slotMeanOf\(i\)\+" takes"/.test(body("meanNote")) && /"take "\+k\+" of "\+n/.test(body("takeNote")), "the spectrum chip says 'mean of N takes'; the time views say 'take k of N'");
  ok(/name:slotFull\(i,80\)\+takeNote\(i," · "\)/.test(body("sgramModelFor")) && /label:slotFull\(i,26\)\+takeNote\(i," · "\)/.test(body("buildEnvModel")), "…on the spectrogram title and the envelope legend");
  // Tone panel: means for note-based rows, the mean spectrum for spectral rows, the selected take for Take rows.
  const tr=body("toneRecords"), defs=body("toneRowDefs");
  const per=[...defs.matchAll(/term:"([\w-]+)", name:"[^"]+",(?: plain:true,)? perTake:true/g)].map(m=>m[1]).sort().join();
  ok(per==="attack-spectrum,bloom,body-resonance,even-odd,f0-decay,harmonic-richness,overtone-sustain", "perTake on the seven note-based rows — Pickup voice and Brightness read the mean spectrum", per);
  ok(/const tv=def\.text\?viewRec\(i\):s;/.test(tr) && /perVals=takes\.map\(t=>\{ let x=null; try\{ x=def\.val\(ownView\(t\),i\); \}/.test(tr) && /v=def\.log\?Math\.exp\(ok\.reduce\(\(a,x\)=>a\+Math\.log\(x\),0\)\/ok\.length\):ok\.reduce\(\(a,x\)=>a\+x,0\)\/ok\.length;/.test(tr),
    "Take rows read the selected take; perTake rows average each take's own value, geometric on a log axis");
  ok(/d="mean over "\+\(pairN>1\?pairN\+" pairs of takes, per take of "\+slotLabel\(i\)\+": ":nT\+" takes \("\)\+perVals\.map\(fm\)\.join\(" · "\)/.test(tr) && /d="from the mean spectrum of "\+slotMeanOf\(i\)\+" takes"/.test(tr), "the readout says which kind of mean it prints — over takes, or over pairs of takes — and lists the per-take values");
  ok(/Values: means over each guitar's takes; Before you compare reads the selected take/.test(body("renderToneRows")), "the panel's status line says so once");
  // Before you compare (user, 2026-09-06): the take facts and the comparability verdict, one block at the top.
  const pre=body("preCompareHtml");
  ok(/preCompare\.innerHTML=preCompareHtml\(records,compat,typesDiffer,types\);/.test(body("renderPreCompare")) && /renderPreCompare\(\);\n\s*renderVerdict\(\);/.test(body("renderAnalysis")) && html.indexOf('id="preCard"')<html.indexOf('id="verdictCard"') && html.indexOf('id="preCard"')>html.indexOf('id="card1"'), "the block has its own card under the guitar cards, above At a glance, rendered before the strip");
  ok(/\.precompare \.ghead\{ display:flex; gap:10px;/.test(html) && /what the two recordings must share before a difference below can be read as the guitar/.test(body("preCompareHtml")), "the head has its gap back and a plain hint");
  ok(/r\.def\.miss\?r\.def\.miss:r\.def\.name\+" — not measured"/.test(body("preCompareHtml")) && /Recording path not known — could not tell DI from microphone; set it in the readout/.test(body("toneRowDefs")) && (body("toneRowDefs").match(/miss:"/g)||[]).length===3, "a missing fact says what it was looking for");
  ok(/records\.filter\(r=>r\.group===TONE_PRE_GROUP\)/.test(pre) && /data-pop="'\+r\.key\+':'\+i\+'"/.test(pre) && /'<span class="light '\+l\+'"><\/span>'/.test(pre), "one line per guitar from the take records: a light and a phrase, the same tap as every readout");
  ok(/mark\("ok"\)\+'<b>Fair to compare<\/b>/.test(pre) && /mark\("bad"\)\+'<b>Not directly comparable<\/b>/.test(pre) && /<b>Reliable<\/b>/.test(pre) && /<b>Not yet reliable<\/b>/.test(pre) && /\.precompare \.light::before\{ content:"✓"; \}/.test(html) && /c\.label\+\(c\.text\?" \("\+c\.text\+\(nPairs>1&&c\.pair\?" — take "/.test(pre) && /Load or record the other guitar to compare/.test(pre), "the last lines always answer — fair or what differs (with a ✓ / ! / ✕ mark), reliable or what is missing, or load the other guitar (2026-09-07)");
  ok(!/toneCompat|compatbar/.test(html), "the separate comparability bar is gone");
  const nf=defs.slice(defs.indexOf('term:"noise-floor"'), defs.indexOf('term:"comparability"')), rp=defs.slice(defs.indexOf('term:"recording-path"'));
  ok(/"dynamic range "\+m\.dr\.toFixed\(1\)\+" dB/.test(nf) && /"between notes "\+Math\.abs\(m\.residual\)\.toFixed\(0\)\+" dB below the note/.test(rp), "Dynamic range lives in the Level and floor readout, Between notes in the Recording path readout");
  ok(![...b4.matchAll(/rows:\[([^\]]*)\]/g)].some(m=>/dynamic-range|residual/.test(m[1])), "no comparability check names a row that no longer exists");
  ok(/q\(\(TONE_GROUPS\.find\(g=>g\.id===r\.group\)\|\|\{name:"Before you compare"\}\)\.name\)/.test(b4), "the CSV names the block for a take record instead of throwing");
  ok(/ear:\{hi:"the upper partials keep singing/.test(defs), "Overtone ring says partials, which is what it tracks");
  // Sustain and Dead spots merged (user, 2026-09-06): one row, the flags in its detail and readout; the flag sentence still reaches At a glance.
  const sus=defs.slice(defs.indexOf('term:"f0-decay"'), defs.indexOf('term:"brightness"'));
  ok(!/term:"neck-sustain"/.test(defs) && /flagged as a dead spot/.test(sus) && /ds=poolDeadSpots\(slotTakes\(i\)\.map\(t=>t\.metrics\)\)/.test(sus) && /" · dead spots over "\+ds\.n\+" notes"/.test(sus) && /pairwise:true/.test(sus) && /val:\(s,i,om\)=>_median\(_f0DecayNotes\(s\.metrics,both\?\(om\|\|_otherMetrics\(i\)\):null\)/.test(sus), "Sustain carries the dead-spot flags in its unit line and its detail");
  const pcm=body("proseCandidates");
  ok(!/clear\("neck-sustain"\)/.test(pcm) && /clear\("f0-decay"\)/.test(pcm) && /const ds=poolDeadSpots\(slotTakes\(i\)\.map\(t=>t\.metrics\)\); if\(ds\.flags\.length\)/.test(pcm) && /termHtml\("neck-sustain","dead spot"\)/.test(pcm), "At a glance keeps one Sustain sentence and the dead-spot flag sentence");
  ok(/def\.term==="f0-decay"&&!both\?" · play frets 0, 3, 5, 7, 9 and 12 on every string"/.test(body("missingPhrase")), "the neck-walk hint moved to Sustain");
  ok(/key:"neck-sustain", name:"Dead spots"/.test(html), "the glossary keeps the dead-spot entry the flag sentence links to, under its player name");
  // The time views carry their own take picker (user, 2026-09-06): same selection as the card, never a second state.
  const wrapA=html.slice(html.indexOf('id="sgramWrapA"'), html.indexOf('id="sgramCanvasA"')), wrapB=html.slice(html.indexOf('id="sgramWrapB"'), html.indexOf('id="sgramCanvasB"'));
  ok(/<div class="takebar takesel" data-pane="0" hidden/.test(wrapA) && /select data-takesel="0"/.test(wrapA) && !/data-takesel="1"/.test(wrapA) && /<div class="takebar takesel" data-pane="1" hidden/.test(wrapB) && /select data-takesel="1"/.test(wrapB), "each spectrogram pane carries its own take picker, inside its plot wrap, hidden until a stack exists");
  const envBar=html.slice(html.lastIndexOf('<div class="takebar takesel" hidden', html.indexOf('id="envWrap"')), html.indexOf('id="envWrap"'));
  ok(/data-takesel="0"/.test(envBar) && /data-takesel="1"/.test(envBar) && (html.match(/<select data-takesel="[01]"/g)||[]).length===4 && !/id="sgramTakeSel"|id="envTakeSel"/.test(html), "the envelope's picker sits right above its plot with both guitars; the head groups are gone");
  // Safari after a screen lock (user report 2026-09-06): a context that saw the page hidden is spent and rebuilt on the next play.
  const sp=body("startPlayback");
  ok(/if\(!playCtx\|\|playCtx\.state==="closed"\|\|playCtxSpent\)\{/.test(sp) && /if\(playCtx\)\{ try\{ playCtx\.close\(\); \}catch\(_e\)\{\} \}/.test(sp) && /playCtx=new AC\(\); playCtxSpent=false;/.test(sp), "a spent playback context is closed and replaced on the next play");
  ok(/document\.addEventListener\("visibilitychange",\(\)=>\{\n\s*if\(document\.visibilityState!=="hidden"\) return;\n\s*stopPlayback\(\);\n\s*if\(playCtx\) playCtxSpent=true;/.test(b4) && /if\(!recCap&&typeof recLive==="object"&&recLive\.ctx\)\{ try\{ stopMonitor\(\); \}catch\(_e\)\{\} try\{ recLive\.ctx\.close\(\); \}catch\(_e\)\{\} recLive\.ctx=null; \}/.test(b4), "going hidden marks the playback context spent and drops an idle capture context; a live capture is left alone");
  ok(/playCtx\.state==="interrupted"\) playCtxSpent=true;/.test(sp), "…and WebKit's 'interrupted' state marks it spent too");
  ok(/for\(const bar of Array\.from\(magCtls\.querySelectorAll\("\.takebar"\)\)\)/.test(body("syncMagCtls")) && /if\(bar\) magCtls\.appendChild\(bar\);/.test(body("syncMagCtls")), "the expanded view takes the pane's own picker along and returns it home");
  const sts=body("syncTakeSels");
  ok(/if\(takes\.length<2\)\{ sel\.hidden=true;/.test(sts) && /grp\.hidden=!any;/.test(sts) && /const v=String\(selTake\[i\]\|\|0\); if\(sel\.value!==v\) sel\.value=v;/.test(sts), "the picker reads selTake and hides itself for a single take");
  ok(/if\(sel\) selectTake\(\+sel\.dataset\.takesel, \+sel\.value\);/.test(b4) && /syncTakeSels\(\);\s*\/\/ the pickers on the time-view cards/.test(body("selectTake")) && /syncTakeSels\(\);\n\}/.test(body("updateVisibility")), "…writes through selectTake, and is rebuilt by selectTake and updateVisibility");
}

section("E6 — block 0: the tap read, the room in a decay, the recording path");
(async () => {
  const RATE = 48000;
  // A tap: two decaying modes, air at 98 Hz (Q ≈ 12) and top at 190 Hz (Q ≈ 9), 0.25 s.
  const tap = new Float64Array(Math.round(0.25 * RATE));
  for (let n = 0; n < tap.length; n++) {
    const t = n / RATE;
    tap[n] = Math.exp(-Math.PI * 98 * t / 12) * Math.sin(2 * Math.PI * 98 * t) + 0.6 * Math.exp(-Math.PI * 190 * t / 9) * Math.sin(2 * Math.PI * 190 * t);
  }
  const wt = await D.welch(tap, RATE, D.TAP_WELCH_N, D.TAP_WELCH_N >> 1, null);
  const p12 = D.smoothOct(wt.power, wt.df, 12), db = new Float64Array(p12.length);
  for (let q = 0; q < db.length; q++) db[q] = D.powerToDb(p12[q]);
  const tr = D.tapResonance(db, wt.df);
  ok(tr && tr.air && Math.abs(tr.air.f - 98) < 4 && tr.top && Math.abs(tr.top.f - 190) < 6, "tapResonance finds the air mode and the first top mode of a synthetic knock", JSON.stringify(tr));
  const qc = D.tapQCeiling(98, RATE);
  ok(tr && tr.air.q > 5 && tr.air.q <= qc * 1.25 && tr.top.q > 5 && qc > 8 && qc < 13, "…each with a Q up to the ceiling the window and smoothing allow (≈ 10 at 98 Hz), and the ceiling is a stated function", tr && (tr.air.q.toFixed(1) + " / " + tr.top.q.toFixed(1) + " · ceiling " + qc.toFixed(1)));
  ok(D.tapResonance(new Float64Array(db.length).fill(-80), wt.df) === null, "a flat spectrum is no tap");

  // A note (broadband decay τ = 0.35 s → T20 ≈ 0.8 s) alone, then with a room tail (τ = 2 s).
  const hop = 0.025, mk = (roomTau) => {
    const x = new Float64Array(Math.round(6 * RATE));
    for (let n = 0; n < x.length; n++) {
      const t = n / RATE, floorV = 1e-4 * Math.sin(12345.6 * n) * 0.5; // a real file has a floor everywhere
      if (t < 1) { x[n] = floorV; continue; }
      const u = t - 1;
      let v = Math.exp(-u / 0.35) * Math.sin(2 * Math.PI * 110 * u) * 0.5;
      if (roomTau) v += 0.15 * Math.exp(-u / roomTau) * (Math.sin(2 * Math.PI * 137 * u + 1) + Math.sin(2 * Math.PI * 411 * u + 2)) / 2;
      x[n] = v + floorV;
    }
    return x;
  };
  const dry = mk(0), wet = mk(2.0);
  const tailOf = x => { const r = D.shortTermRms(x, RATE); const f = D.dynamicsMetrics(x, RATE).noiseFloor; return D.roomTail(r, hop, [1.0], f); };
  const td = tailOf(dry), tw = tailOf(wet);
  const noteT20 = 20 / (8.686 / 0.35);
  ok(td && Math.abs(td.t20 - noteT20) / noteT20 < 0.35, "a dry note's tail is the note's own decay", td && td.t20.toFixed(2) + " s vs " + noteT20.toFixed(2));
  ok(tw && tw.t20 > 1.5 * noteT20, "…and a room tail reads slower than the note", tw && tw.t20.toFixed(2) + " s");
  ok(!D.roomOutlastsNote(td, noteT20) && D.roomOutlastsNote(tw, noteT20), "roomOutlastsNote separates the two at ROOM_TAIL_RATIO " + D.ROOM_TAIL_RATIO);
  ok(D.roomTail(D.shortTermRms(dry, RATE), hop, [], -60) === null, "no onset, no tail");

  // The path.
  ok(D.recordingPath({ room: tw, noteT20, channels: 1, type: "solid" }) === "mic", "a room tail is a microphone, whatever the type says");
  ok(D.recordingPath({ room: td, noteT20, channels: 2, stereoDiffDb: -6, type: "solid" }) === "mic", "two channels that differ are a mic pair");
  ok(D.recordingPath({ room: td, noteT20, channels: 2, stereoDiffDb: -80, type: "solid" }) === "di", "two identical channels are one DI signal");
  ok(D.recordingPath({ room: td, noteT20, channels: 1, type: "acoustic" }) === "piezo" && D.recordingPath({ room: null, channels: 1, type: "hollow" }) === "di", "no room: an acoustic was plugged in (piezo), an electric is DI");
  ok(D.recordingPath(null) === "unknown" && D.recordingPath({ channels: 1 }) === "unknown", "nothing analysed → unknown");
  const cmp = D.comparability({ path: "mic", registerMidi: 50 }, { path: "di", registerMidi: 50 });
  ok(cmp.some(c => c.key === "path" && !c.ok && c.rows.includes("f0-decay")) && cmp.find(c => c.key === "register").ok, "comparability flags mic-vs-DI and names the decay rows; strings pass through the numeric guard");
  ok(D.comparability({ path: "mic" }, { path: "unknown" }).find(c => c.key === "path").ok, "…and an unknown path never blocks");

  // The audit takes: DI recordings, all three — the room test must stay silent on them.
  function readWav(file) {
    const b = fs.readFileSync(file); let p = 12, fmt = null, data = null;
    while (p + 8 <= b.length) { const id = b.toString("ascii", p, p + 4), sz = b.readUInt32LE(p + 4);
      if (id === "fmt ") fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
      if (id === "data") { data = b.subarray(p + 8, p + 8 + sz); break; } p += 8 + sz + (sz & 1); }
    const { ch, rate, bits, tag } = fmt, bps = bits / 8, frames = Math.floor(data.length / (bps * ch)), x = new Float64Array(frames);
    for (let i = 0; i < frames; i++) { const o = i * bps * ch; x[i] = tag === 3 ? data.readFloatLE(o) : bits === 16 ? data.readInt16LE(o) / 32768 : bits === 24 ? ((data[o] | (data[o + 1] << 8) | (data[o + 2] << 16)) << 8 >> 8) / 8388608 : data.readInt32LE(o) / 2147483648; }
    return { x, rate, ch };
  }
  const paths = [];
  for (const nm of ["Les_Paul", "SG", "Majesty"]) {
    const fp = path.join(__dirname, "..", "samples", nm + ".wav");
    if (!fs.existsSync(fp)) continue;
    const { x, rate, ch } = readWav(fp);
    const sb = D.stftBands(x, rate, [[60, 200], [200, 1200], [2000, 6000]]);
    const times = D.detectOnsets(sb.flux, sb.frameRate).map(fi => fi / sb.frameRate);
    const floor = D.dynamicsMetrics(x, rate).noiseFloor;
    const room = D.roomTail(D.shortTermRms(x, rate), 0.025, times, floor);
    // the last note's own fundamental decay (Goertzel at its f0, THEORY §7.6.2)
    const t = times[times.length - 1], start = Math.round((t + 0.05) * rate), len = Math.min(Math.round(1.0 * rate), x.length - start);
    const f0 = D.autocorrF0(x, rate, start, Math.min(8192, len));
    const t20 = f0 ? D.trackT20(D.goertzelTrack(x, rate, Math.round(t * rate), Math.floor((x.length / rate - t) * rate / 512), 4096, 512, f0.f0), 512, rate) : null;
    paths.push({ nm, ch, room: room && room.t20.toFixed(2), t20: t20 && t20.toFixed(2), path: D.recordingPath({ room, noteT20: t20, channels: ch, type: "solid" }) });
  }
  ok(paths.length === 3 && paths.every(p => p.path === "di"), "the three audit takes read as DI — no room outlasts their last note", JSON.stringify(paths));
  section("2026-09-06 — every take counts (THEORY §7.6.10 amended)");
  {
    // (a) the band shrinks with the number of takes
    const R = 0.2;
    const two = D.combineBands({ v: R, n: 2 }, { v: R, n: 2 });
    ok(Math.abs(two.v - R) < 1e-9 && two.n === 4, "two takes each with equal ranges reproduce the old band exactly (the larger spread)", JSON.stringify(two));
    const three = D.combineBands({ v: R, n: 3 }, { v: R, n: 3 }), mixed = D.combineBands({ v: R, n: 2 }, { v: R, n: 3 });
    ok(Math.abs(three.v / R - 0.5441) < 2e-3 && Math.abs(mixed.v / R - 0.8047) < 2e-3, "three each → 0.54 R; two and three → 0.80 R (the numbers THEORY quotes)", (three.v / R).toFixed(4) + " " + (mixed.v / R).toFixed(4));
    let prev = Infinity, mono = true; for (let n = 2; n <= 14; n++) { const v = D.rangeToSe(R, n); if (!(v < prev)) mono = false; prev = v; }
    ok(mono && D.rangeToSe(R, 1) == null && D.combineBands({ v: R, n: 1 }, { v: R, n: 2 }) == null, "the per-side error falls monotonically with n (past the d₂ table too) and one take yields no band");
    const tb2 = body("toneBandFor");
    ok(/const lv=liveToneBands\(\); const lb=lv\.ready&&lv\.bands\[key\];/.test(tb2) && /oct:lb\.v, measured:true, live:true/.test(tb2), "toneBandFor reads the combined value as the band it was reading before");
    // (b) comparability over every pair
    const a1 = { registerMidi: 50, levelRms: -20 }, a2 = { registerMidi: 51, levelRms: -21 }, b1 = { registerMidi: 52, levelRms: -22 }, b2 = { registerMidi: 58, levelRms: -40 };
    const all = D.comparabilityAll([a1, a2], [b1, b2]);
    const reg = all.find(c => c.key === "register"), lvl = all.find(c => c.key === "level");
    ok(reg && !reg.ok && reg.pairs === 4 && reg.failing === 2 && reg.pair[1] === 1 && reg.pair[0] === 0 && /8\.0 semitones/.test(reg.text), "a check fails when any pair fails and reports the worst pair by index", JSON.stringify(reg));
    ok(lvl && !lvl.ok && lvl.pair[0] === 0 && lvl.pair[1] === 1, "…level too (take 1 of A against take 2 of B, 20 dB apart)", JSON.stringify(lvl));
    const fine = D.comparabilityAll([a1, a2], [b1]);
    ok(fine.every(c => c.ok) && fine.find(c => c.key === "register").pairs === 2 && fine.find(c => c.key === "register").bad === 2, "when every pair passes the check passes and reports the widest passing pair");
    ok(D.comparabilityAll([], [b1]).length === 0 && JSON.stringify(D.comparabilityAll([a1], [b1]).map(c => [c.key, c.ok])) === JSON.stringify(D.comparability(a1, b1).map(c => [c.key, c.ok])), "one take each is byte-for-byte the single comparability; an empty side compares nothing");
    // (c) pooled evidence and dead spots
    const nA = [{ pass: true, f0: 110, t20: 2 }, { pass: true, f0: 220, t20: 1 }], nB = [{ pass: true, f0: 330, t20: 1.5 }];
    const pm = D.poolMetrics([{ notes: nA, snr: 30, tap: null }, { notes: nB, snr: 40, tap: { f: 100 } }, { notes: undefined, snr: 50 }]);
    ok(pm.pooled === 3 && pm.notes.length === 3 && pm.snr === 40 && pm.tap && pm.tap.f === 100, "poolMetrics concatenates the takes' notes, takes the median SNR and any tap", JSON.stringify(pm));
    ok(D.poolMetrics([{ notes: nA }]).notes === nA && D.poolMetrics([]) == null, "one take pools to itself");
    const note = (f0, t20) => ({ pass: true, f0, t20 });
    const t1 = { notes: [note(196, 0.4), note(220, 2), note(247, 2.1), note(262, 1.9)], neckFlags: [{ f0: 196, t20: 0.4, ref: 2 }], neckMedian: 1.95, neckN: 4 };
    const t2 = { notes: [note(196, 1.8), note(220, 2), note(247, 2.1), note(262, 1.9)], neckFlags: [], neckMedian: 1.95, neckN: 4 };
    const t3 = { notes: [note(196, 0.5), note(220, 2), note(247, 2.1), note(262, 1.9)], neckFlags: [{ f0: 196.5, t20: 0.5, ref: 2 }], neckMedian: 1.95, neckN: 4 };
    const p12 = D.poolDeadSpots([t1, t2]), p123 = D.poolDeadSpots([t1, t2, t3]), p1 = D.poolDeadSpots([t1]);
    ok(p12.flags.length === 0 && p12.takes === 2, "flagged in one take of two is a pluck, not a dead spot");
    ok(p123.flags.length === 1 && p123.flags[0].inTakes === 2 && p123.flags[0].ofTakes === 3 && Math.abs(p123.flags[0].t20 - 0.5) < 1e-9 && p123.n === 12, "flagged in two takes of three is a dead spot, with the count said and the median of the flagged decays", JSON.stringify(p123.flags));
    ok(p1.flags.length === 1 && p1.flags[0].inTakes === 1 && p1.flags[0].ofTakes === 1 && p1.median === 1.95, "one take flags as before");
    // wiring
    const tr2 = body("toneRecords"), b4x = blocks[4];
    ok(/const compat=both\?comparabilityAll\(takeMs\[0\],takeMs\[1\]\):\[\];/.test(tr2) && /const takeMs=\[0,1\]\.map\(i=>slotTakes\(i\)\.map\(t=>ownView\(t\)\.metrics\)\.filter\(Boolean\)\);/.test(tr2), "comparability runs over every pair of takes, each take as analysed alone");
    ok(/const pooled=\[0,1\]\.map\(i=>poolMetrics\(takeMs\[i\]\)\);/.test(tr2) && /return toneEvidenceOf\(pooled\[i\], openMidis, state\.a4, pooled\[1-i\]\);/.test(tr2), "a row's evidence is pooled over the guitar's takes, and matched against the other guitar's pooled notes");
    ok(/else if\(def\.pairwise&&both\)\{/.test(tr2) && /const mine=topTakes\(i,PAIR_TAKES\), theirs=topTakes\(1-i,PAIR_TAKES\); pairN=mine\.length\*theirs\.length;/.test(tr2) && /def\.val\(ownView\(t\),i,ownView\(u\)\.metrics\)/.test(tr2) && /const PAIR_TAKES=3;/.test(b4x), "a pairwise row is measured take against take, at most three takes a side");
    ok(/function _otherMetrics\(i\)\{ const o=state\.slots\[i===1\?0:1\]; return o\?o\.metrics:null; \}/.test(b4x) && !/_otherMetrics\(s\)/.test(b4x), "the other guitar's metrics are found by slot index, never by searching for the take object (an own view is not in state.slots)");
    const pre2 = body("preCompareHtml");
    ok(/const mx=mixedPaths\(i\); if\(mx\.length\)/.test(pre2) && /function mixedPaths\(i\)/.test(b4x) && /for every one of the "\+nPairs\+" pairs of takes/.test(pre2), "Before you compare warns when a guitar's takes mix paths and says the pass held for every pair");
    const rv2 = body("renderVerdict"), pc2 = body("proseCandidates");
    ok(/warn:true, html:"<b>Not comparable<\/b>/.test(rv2) && /warn:true, html:"<b>Comparable, but not yet reliable<\/b>/.test(rv2) && !/<b>Comparable<\/b>/.test(rv2) && /Before you compare, above/.test(rv2), "At a glance opens with a warning only when comparability or reliability is not right (2026-09-07); when both are, it goes straight to the findings");
    ok(!/level-match/.test(rv2) && !/lmOffset/.test(rv2), "INVERTED: the strip no longer rehashes the level gap");
    ok(/parts\.push\(\{h:"Sound", items:byWho\(cands\.filter\(c=>c\.fam==="tone"\)\)\}\);/.test(rv2) && /parts\.push\(\{h:"Ring", items:byWho\(cands\.filter\(c=>c\.fam==="time"\)\)\}\);/.test(rv2) && /h:"For the player"/.test(rv2) && (pc2.match(/short:/g)||[]).length===(pc2.match(/cands\.push\(\{/g)||[]).length && /is notably louder in the "/.test(rv2) && /else if\(fails\.length\|\|typesDiffer\)\{ \/\* said above/.test(rv2) && /The takes are not comparable as they stand — /.test(body("renderProse")) && /Math\.abs\(bd\.d\)>=3/.test(rv2), "then sections — Sound / Ring / Loudest gap / For the player — every candidate with a short clause, a notable region gap with its dB, and what it adds up to for the player");
    ok(/renderAnalysis\(\);\n\s*runLandingHooks\(\);\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n\s*drawAll\(\);\n\}/.test(body("afterDataChange")), "a landing draws synchronously after renderAnalysis — the first frame never waits on the compositor");
    ok(/clear\("brightness"\)/.test(pc2) && /provided the same pick, pickup and phrase went into both/.test(pc2) && /score:sc\(r\)\*0\.5/.test(pc2), "brightness reaches the strip with its caveat in the sentence and ranked under the instrument rows");
    ok(/"× longer \("\+\s*fmtMs\(x\.vh\)\+" vs "\+fmtMs\(x\.vl\)\+"\), note for note\."/.test(pc2.replace(/\n/g, "")) && /who:x\.hi, tag:/.test(pc2), "Sustain prints the ratio and the two values a player would quote, and tags who for the closing line");
  }
  section("2026-09-06 — stiffness highlight, bands in the export, Feedback route");
  {
    const b4 = blocks[4];
    const sl = body("stiffnessLineHtml");
    ok(/Strings and scale differ/.test(sl) && /Strings and scale read alike/.test(sl) && /TONE_BANDS_DEFAULT\.inharmonicity\.oct/.test(sl) && /some of the brightness and ring difference below is the strings/.test(sl), "the highlight says differ or read alike against the provisional band, and what a difference means for the rows below");
    ok(!/blocked|rows:/.test(sl) && !/inharmonicity/.test(html.slice(html.indexOf("const COMPAT_CHECKS=["), html.indexOf("function comparability("))), "INVERTED: stiffness never blocks or greys a row — it is a highlight, not a check");
    const ex = body("exportJSON"), sb = body("snapshotBands"), ap = body("applySnapshot");
    ok(/\.\.\.snapshotBands\(\) \}/.test(ex) && /if\(lv\.ready\)/.test(sb) && /toneBandsAt:new Date\(\)\.toISOString\(\)/.test(sb), "a JSON snapshot carries the live bands when both guitars have two or more takes, else the remembered ones");
    ok(/if\(st\.toneBands&&typeof st\.toneBands==="object"&&typeof st\.toneBandsAt==="string"\)/.test(ap) && /state\.toneBandsAt=st\.toneBandsAt; saveSettings\(\);/.test(ap), "loading a snapshot restores its bands and keeps them for later sessions — what the Save button did");
    ok(/state\.recGuided=true;/.test(b4) && /if\(gd\)\{ state\.recGuided=!!gd\.checked; saveSettings\(\);/.test(b4), "Guided is on at start and remembered once flipped (user, 2026-09-06)");
    const fy = fs.readFileSync(path.join(__dirname, "..", ".github", "ISSUE_TEMPLATE", "feedback.yml"), "utf8");
    ok(/^\s+id: what$/m.test(fy) && /^\s+id: pro$/m.test(fy) && /^\s+id: setup$/m.test(fy) && /Do you play professionally\?/.test(fy) && /required: true/.test(fy.slice(fy.indexOf("id: what"), fy.indexOf("id: pro"))) && !/email/i.test(fy), "the GitHub issue form has a free-text description (required), the professional-musician question (optional) and the prefilled setup — and asks for no email");
    const fb = body("feedbackSetup"), fu = body("feedbackUrl"), of = body("openFeedback");
    ok(/const FEEDBACK_REPO=APP_REPO;/.test(b4) && /const APP_URL="https:\/\/mdzahidh\.github\.io\/rameau\/", APP_REPO="https:\/\/github\.com\/mdzahidh\/rameau"/.test(b4) && /issues\/new\?template=feedback\.yml&setup="\+encodeURIComponent\(feedbackSetup\(\)\)/.test(fu), "the Feedback button opens the repository's issue form with the setup field prefilled by id");
    ok(!/\.name\b|slotName|slotDesc|slotLabel|audioBuf|samples/.test(fb) && /navigator\.userAgent/.test(fb) && /takes\.length/.test(fb) && /pathFor\(i\)/.test(fb), "INVERTED: the setup text carries browser and take facts, never audio, file names or guitar names");
    ok(/<button class="btn cta" id="feedbackBtn"/.test(html) && /id="feedbackFootBtn"/.test(html) && /\.btn\.cta\{ color:var\(--switch-knob\); background:var\(--switch-on\);/.test(html), "one highlighted call-to-action button in the header (checked-switch fill, never a guitar accent), and a footer link");
    const fm = html.slice(html.indexOf('id="feedbackModal"'), html.indexOf("<!-- recording guide -->"));
    ok(/id="feedbackOpen" href="#" target="_blank" rel="noopener"/.test(fm) && !/fetch\(|XMLHttpRequest/.test(fb + fu + of), "INVERTED: the form opens in a new tab and the page sends nothing itself");
    ok(/if\(feedbackModal\.classList\.contains\("open"\)\) return feedbackModal\.classList\.remove\("open"\);/.test(body("escCascade")) && /\[\?&\]feedback\(\?:&\|\$\)/.test(b4), "Esc closes it and ?feedback opens it for the gate");
  }
  section("2026-09-06 — visibility: the address on everything that leaves the page");
  {
    const b4 = blocks[4], head = html.slice(0, html.indexOf("</head>"));
    ok(/<meta property="og:image" content="https:\/\/mdzahidh\.github\.io\/rameau\/docs\/img\/og\.png">/.test(head) && /<meta name="twitter:card" content="summary_large_image">/.test(head) && /<link rel="canonical" href="https:\/\/mdzahidh\.github\.io\/rameau\/">/.test(head) && /<meta name="description" content="[^"]{60,}">/.test(head), "a pasted link unfurls: description, canonical, Open Graph image and Twitter card");
    ok(fs.existsSync(path.join(__dirname, "..", "docs", "img", "og.png")) && fs.existsSync(path.join(__dirname, "..", "docs", "img", "hero.png")), "the social image and the README hero screenshot are in the repository");
    ok((b4.match(/"made with "\+APP_NAME\+" · "\+APP_HOST/g) || []).length >= 4, "every PNG footer and the share image name the app and its address", (b4.match(/"made with "\+APP_NAME\+" · "\+APP_HOST/g) || []).length);
    ok((b4.match(/"# "\+APP_URL\+" · source "\+APP_REPO,/g) || []).length === 5 && /app:APP_NAME, url:APP_URL, repo:APP_REPO, type:"snapshot"/.test(b4) && /lines\.push\("made with "\+APP_NAME\+" · "\+APP_URL\);/.test(body("eqSettingsText")), "every CSV header, the JSON snapshot and the EQ settings text carry the address");
    const sh = body("exportShareImage");
    ok(/W=1200, H=630/.test(sh) && /drawSpectrumScene\(ctx,plotW,plotH,buildSpecModel\(true\),\[\]\)/.test(sh) && /verdictPara\.textContent/.test(sh) && /_exportPngCanvas\(cv, "rameau-share_"/.test(sh), "the share image is 1200×630, draws the same spectrum scene as the plot, quotes At a glance, and saves through the PNG path");
    ok(/idxs\.forEach\(i=>\{ state\.slotTypes\[i\]="solid"; state\.slotNames\[i\]=DEMO_GUITARS\[i\?"H":"S"\]\.name; \}\);/.test(body("loadDemo")) && /function runLandingHooks\(\)/.test(b4) && /if\(landingHooks\.feedback\) openFeedback\(\);/.test(body("runLandingHooks")) && /scrollIntoView\(\)/.test(body("runLandingHooks")), "the demo declares its kind; ?feedback and ?scrollto wait for the data they describe");
    ok(!/fetch\(|XMLHttpRequest|\.name\b/.test(sh) && /id="shareImgBtn"/.test(html) && /id="shareLinkBtn"/.test(html) && /navigator\.clipboard\.writeText\(APP_URL\)/.test(body("copyAppLink")), "INVERTED: sharing sends nothing and names no file; the buttons sit on the At a glance card and Copy link copies the app's address");
  }
  section("2026-09-06 — the demo pair: two construction-modelled solidbodies, two takes each, one phrase");
  {
    const A = "// ---------- demo pair: two solidbodies, one phrase (2026-09-06) ----------\n", B = "// ---------- end demo pair ----------";
    const b4 = blocks[4], blk = b4.slice(b4.indexOf(A) + A.length, b4.indexOf(B));
    const ms = fs.readFileSync(path.join(__dirname, "make_samples.js"), "utf8"), mblk = ms.slice(ms.indexOf(A) + A.length, ms.indexOf(B));
    ok(blk.length > 2000 && blk === mblk, "the synth block in index.html and tests/make_samples.js are byte-identical", blk.length + " vs " + mblk.length);
    ok(!/fender|strat|gibson|les paul|telecaster|sg\b/i.test(blk), "INVERTED: the demo names no maker and no model");
    const ld = body("loadDemo");
    ok(/for\(let k=1;k<=2;k\+\+\)/.test(ld) && /demoTake\(g,k\)/.test(ld) && /await analyzeSlot\(i,slot,undefined,k>1\)/.test(ld) && /idxs\.forEach\(recAbort\)/.test(ld), "loadDemo lands two takes per guitar through analyzeSlot, appending the second, after aborting any capture");
    const m = new Function(blocks[0] + "\n" + blk + "\nreturn {demoTake, DEMO_GUITARS, DEMO_PHRASE};")();
    ok(m.DEMO_PHRASE.filter(e => e[0] != null).length === 14 && m.DEMO_PHRASE.some(e => e[0] == null) && m.DEMO_GUITARS.S.dead && m.DEMO_GUITARS.S.dead.midi === 63 && !m.DEMO_GUITARS.H.dead, "fourteen notes with one rest; only the single-coil guitar carries a dead spot (D♯4)");
    ok(m.DEMO_GUITARS.S.rate !== m.DEMO_GUITARS.H.rate && m.DEMO_GUITARS.S.pickup[0] > m.DEMO_GUITARS.H.pickup[0] && m.DEMO_GUITARS.S.t20 < m.DEMO_GUITARS.H.t20, "the two guitars differ in sample rate, pickup resonance (single-coil higher) and sustain (humbucker longer)");
    const a1 = m.demoTake(m.DEMO_GUITARS.S, 1), a1b = m.demoTake(m.DEMO_GUITARS.S, 1), a2 = m.demoTake(m.DEMO_GUITARS.S, 2);
    let same = a1.length === a1b.length, diff = false, peak = 0; for (let i = 0; i < a1.length; i++) { if (a1[i] !== a1b[i]) same = false; if (i < a2.length && a1[i] !== a2[i]) diff = true; peak = Math.max(peak, Math.abs(a1[i])); }
    ok(same && diff && Math.abs(peak - 0.7) < 0.01 && a1.length / m.DEMO_GUITARS.S.rate > 18, "a take is deterministic, take 2 differs from take 1 (timing and pick jitter), and every take peaks at 0.7 before the hiss", peak);
    ok(["demo-singlecoil-44k_take1", "demo-singlecoil-44k_take2", "demo-humbucker-48k_take1", "demo-humbucker-48k_take2"].every(n => fs.existsSync(path.join(__dirname, "..", "samples", n + ".wav"))) && !fs.existsSync(path.join(__dirname, "..", "samples", "demo-bright-44k.wav")), "the four demo WAVs are in samples/ and the old pair is gone");
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

