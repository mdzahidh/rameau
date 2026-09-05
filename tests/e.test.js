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
module.exports = { TONE_EVIDENCE, RING_MIN_SEC, toneEvidenceOf, evidenceFor, toneRowState, bandVerdict, TONE_BANDS_DEFAULT, tuningMidi };
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
  ok(/def\.type&&!loadedTypes\.includes\(def\.type\)\) continue;/.test(tr), "a type-bound row is hidden, not a pointer, when no loaded slot is that kind");
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
  ok(/closest\(".vlab\[data-pop\]"\)/.test(b4) && /openTonePop\(k,\+i,vl\.getBoundingClientRect\(\)\)/.test(b4), "clicking a value opens it through the same document click door as a term");
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
  ok(/r\.group==="inst"&&r\.state===1/.test(rv) && /r\.group==="inst"&&r\.state===1/.test(rp), "…and 'not distinguishable' is said only when a banded row exists to say it");
}

section("E1.7 — exports: schema tone-3, additive");
{
  const csv = body("exportToneCSV"), js = body("exportToneJSON");
  ok(/# schema: tone-3/.test(csv) && /"descriptor,a_value,b_value,group,band,verdict,state,missing"/.test(csv), "CSV: tone-3, the six tone-2 columns first and unchanged, state and missing appended");
  ok(/schema:"tone-3"/.test(js) && /state:r\.state, evidence:\{a:r\.evidence\[0\], b:r\.evidence\[1\], row:r\.missing\}/.test(js), "JSON: tone-3, rowsV2 gains state and evidence per row");
  ok(/rows, rowsV2, comparability:compat, instrumentTypes/.test(js), "…and keeps every tone-2 field");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
