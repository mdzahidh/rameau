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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
