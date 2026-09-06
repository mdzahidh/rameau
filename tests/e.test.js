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
module.exports = { TONE_EVIDENCE, RING_MIN_SEC, toneEvidenceOf, evidenceFor, toneRowState, bandVerdict, TONE_BANDS_DEFAULT, tuningMidi, toneBandsFromTakes,
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
  ok(/def\.plain\?"same strings and scale":"not distinguishable"/.test(tr) && /def\.plain\?"different strings or scale"/.test(tr),
    "String stiffness gets the two plain words and nothing else");
  const defs = body("toneRowDefs");
  for (const k of ["warmth", "low-end", "tightness", '"sustain"', 'term:"attack"']) ok(!defs.includes(k === '"sustain"' ? 'term:"sustain"' : k), "row gone from the panel: " + k.replace(/"/g, ""));
  ok(/term:"f0-decay"/.test(defs) && /term:"dynamic-range"/.test(defs) && /g:"take", term:"dynamic-range"/.test(defs), "Fundamental decay is a row; Dynamic range is a Take row");
  ok(/term:"inharmonicity", name:"String stiffness", plain:true/.test(defs) && /val:s=>slotStiffnessEA\(s\.metrics\)/.test(defs), "String stiffness reads open E and A only");
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
  ok(/r\.def\.glance&&r\.state===1/.test(rv) && /r\.def\.glance&&r\.state===1/.test(rp) && /r\.def\.glance&&!r\.def\.text&&!r\.def\.plain/.test(cu),
    "…and 'not distinguishable' is said only when a banded glance row exists to say it (glance is a row flag since 2026-09-06, not a group)");
}

section("2026-09-06 — the Tone character card re-audited under the core use case: groups by what a player asks, per-row sensitivity, ear-first popover, synthesized pairs");
{
  const defs = body("toneRowDefs"), b4 = blocks[4];
  const tg = b4.slice(b4.indexOf("const TONE_GROUPS=["), b4.indexOf("];", b4.indexOf("const TONE_GROUPS=[")));
  ok(/id:"sound"/.test(tg) && /id:"ring"/.test(tg) && /id:"take"/.test(tg) && !/id:"inst"|id:"voice"/.test(tg), "three groups: How it sounds / How it rings / The take — Instrument and Voicing are gone");
  ok(!/g:"inst"|g:"voice"/.test(defs), "no row points at a dead group");
  const rows = [...defs.matchAll(/\{g:"(\w+)", term:"([\w-]+)", name:"([^"]+)"/g)].map(m => ({ g: m[1], term: m[2], name: m[3] }));
  const byTerm = Object.fromEntries(rows.map(r => [r.term, r]));
  ok(rows.length === 17, "seventeen rows", rows.length);
  ok(byTerm["f0-decay"].name === "Sustain" && byTerm["neck-sustain"].name === "Dead spots" && byTerm["attack-spectrum"].name === "Pick attack", "player-speak names: Sustain, Dead spots, Pick attack");
  ok(["pickup-resonance", "body-resonance", "inharmonicity", "brightness", "even-odd", "harmonic-richness", "attack-spectrum"].every(t => byTerm[t].g === "sound") &&
     ["overtone-sustain", "bloom", "neck-sustain", "f0-decay"].every(t => byTerm[t].g === "ring") &&
     ["pitch-check", "noise-floor", "dynamic-range", "residual", "comparability", "recording-path"].every(t => byTerm[t].g === "take"), "each row sits in the group its question belongs to");
  const glance = [...defs.matchAll(/term:"([\w-]+)"[^\n]*glance:true/g)].map(m => m[1]).sort();
  ok(glance.join() === ["bloom", "body-resonance", "f0-decay", "neck-sustain", "overtone-sustain", "pickup-resonance"].join(), "glance:true on exactly the rows that fed At a glance before (String stiffness stays out via plain)", glance.join());
  // Every non-text row states what is measured (unit line + `how`), what it sounds like (`ear`) and how much the playing moves it (`sens`).
  const numeric = rows.filter(r => !["pitch-check", "noise-floor", "comparability", "recording-path"].includes(r.term));
  const rowSrc = t => { const i = defs.indexOf('term:"' + t + '"'); const j = defs.indexOf("\n    {g:", i + 1); return defs.slice(i, j < 0 ? undefined : j); };
  ok(numeric.every(r => /\n\s+how:"/.test(rowSrc(r.term))), "every numeric row carries `how` — the measurement in one breath");
  ok(numeric.every(r => /\n\s+sens:\{k:"(low|mid|high|take)", note:"[^"]*"\}/.test(rowSrc(r.term))), "every numeric row carries `sens` with a level and a note");
  ok(numeric.filter(r => r.g !== "take").every(r => /\n\s+ear:\{hi:"[^"]+", lo:"[^"]+"\}/.test(rowSrc(r.term))), "every guitar row carries `ear` — higher and lower in a player's words");
  ok(["brightness", "even-odd", "harmonic-richness", "attack-spectrum", "bloom"].every(t => /sens:\{k:"high"/.test(rowSrc(t))) && ["pickup-resonance", "f0-decay", "inharmonicity", "overtone-sustain"].every(t => /sens:\{k:"low"/.test(rowSrc(t))),
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
  ok(earKeys.length === 11 && earKeys.every(k => byTerm[k] && byTerm[k].g !== "take"), "eleven pairs, one per guitar row, none for a Take row", earKeys.join());
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
  const tb = body("toneBandFor"), lv = body("liveToneBands"), rr = body("renderToneRows"), sv = body("saveToneBands"), tr = body("toneRecords");
  ok(/const lv=liveToneBands\(\); const lb=lv\.ready&&lv\.bands\[key\];/.test(tb) && tb.indexOf("lv.ready") < tb.indexOf("state.toneBands&&state.toneBands[key]") && tb.indexOf("state.toneBands[key]") < tb.indexOf("provisional:true"),
    "precedence: live from the takes, then saved, then provisional");
  ok(/measured:true, live:true/.test(tb), "a live band is a measured band — it opens the verdict door");
  ok(/if\(per\[0\]&&per\[1\]\)/.test(lv) && /v:Math\.max\(a\.v,b\.v\)/.test(lv) && /toneBandsFromTakes\(vals, TONE_BANDS_DEFAULT\)/.test(lv), "live bands need two or more takes in BOTH slots, and take the larger spread");
  ok(/takes\.map\(t=>\{ try\{ const v=def\.val\(t\);/.test(lv), "…and every take's value comes from the same def.val the panel prints");
  ok(/state\.toneRepeat=lv\.ready;/.test(rr) && /toneBandsStatus\.textContent=\(lv\.ready\?"Reliability: measured from the takes on the cards"/.test(rr) && /toneSaveBandsBtn\.disabled=!lv\.ready;/.test(rr) && !/toneRepeatToggle/.test(html),
    "the switch is gone (2026-09-06); a status line says where the bands come from, and Save follows it");
  ok(!/kind:"repeat"/.test(tr), "the old repeat-mode verdict is gone — live bands flow through the one door");
  ok(/for\(const k in lv\.bands\)/.test(sv) && /state\.toneBands\[k\]=\{v:lv\.bands\[k\]\.v\};/.test(sv), "Save persists the live spreads");
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
  ok(/ROOM_ROWS\.has\(def\.term\)&&s\.metrics\.room&&s\.metrics\.room\.outlasts/.test(tr) && /const ROOM_ROWS=new Set\(\["overtone-sustain","bloom","f0-decay","neck-sustain"\]\);/.test(b4), "the four decay rows drop to partial when the room outlasts the note, with the room named");
  ok(/s\.metrics\.path=pathFor\(i\);/.test(tr), "the resolved path rides on the metrics, so comparability and the glossary read one value");
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
  ok(per==="attack-spectrum,bloom,body-resonance,dynamic-range,even-odd,f0-decay,harmonic-richness,inharmonicity,neck-sustain,overtone-sustain,residual", "perTake on the eleven note-based rows — Pickup voice and Brightness read the mean spectrum", per);
  ok(/const tv=def\.text\?viewRec\(i\):s;/.test(tr) && /perVals=takes\.map\(t=>\{ let x=null; try\{ x=def\.val\(ownView\(t\),i\); \}/.test(tr) && /v=def\.log\?Math\.exp\(ok\.reduce\(\(a,x\)=>a\+Math\.log\(x\),0\)\/ok\.length\):ok\.reduce\(\(a,x\)=>a\+x,0\)\/ok\.length;/.test(tr),
    "Take rows read the selected take; perTake rows average each take's own value, geometric on a log axis");
  ok(/d="mean over "\+nT\+" takes \("\+perVals\.map\(fm\)\.join\(" · "\)\+"\)"/.test(tr) && /d="from the mean spectrum of "\+slotMeanOf\(i\)\+" takes"/.test(tr), "the readout says which kind of mean it prints and lists the per-take values");
  ok(/Values: means over each guitar's takes; the Take rows read the selected take/.test(body("renderToneRows")), "the panel's status line says so once");
  // The time views carry their own take picker (user, 2026-09-06): same selection as the card, never a second state.
  ok(/<div class="ctlgroup takesel" id="sgramTakeSel" hidden/.test(html) && /<div class="ctlgroup takesel" id="envTakeSel" hidden/.test(html) && (html.match(/<select data-takesel="[01]"/g)||[]).length===4, "a Take group with one select per guitar on the spectrogram and envelope cards, hidden until a stack exists");
  ok(html.indexOf('id="sgramTakeSel"')>html.indexOf('id="sgramCtlMove"') && html.indexOf('id="sgramTakeSel"')<html.indexOf('id="sgramCtlHome"'), "the spectrogram's picker sits inside the wrapper that travels to the expanded view");
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
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

