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
module.exports = { TONE_EVIDENCE, RING_MIN_SEC, toneEvidenceOf, evidenceFor, toneRowState, bandVerdict, TONE_BANDS_DEFAULT, tuningMidi, toneBandsFromTakes };
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
  ok(/if\(!append\)\{ state\.slotNames\[i\]=""; state\.slotTypes\[i\]="solid"; \}/.test(b4), "the name stays on the slot when a take is added, and drops when the slot is replaced");
  const lr = body("landRecording");
  ok(/const append=!!state\.slots\[i\];/.test(lr) && /processing:proc\|\|null \},seq,append\)/.test(lr), "a recorded take into a loaded slot is another take of that guitar");
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
  ok(/state\.toneRepeat=lv\.ready;/.test(rr) && /toneRepeatToggle\.disabled=true;/.test(rr) && /toneSaveBandsBtn\.disabled=!lv\.ready;/.test(rr), "the switch is set by the app and disabled; Save follows it");
  ok(!/kind:"repeat"/.test(tr), "the old repeat-mode verdict is gone — live bands flow through the one door");
  ok(/for\(const k in lv\.bands\)/.test(sv) && /state\.toneBands\[k\]=\{v:lv\.bands\[k\]\.v\};/.test(sv), "Save persists the live spreads");
}

section("E2.4–E2.6 — the card: name headline, take list, readiness, one Play/Pause, the waveform");
{
  const rc = body("renderCard"), th = body("transportHtml"), tr = body("takeReadiness"), b4 = blocks[4];
  ok(/<div class="filesub"><span class="filename"/.test(rc) && /class="slotname/.test(rc), "the name is the headline and the file sits under it");
  ok(/<div class="takelist">'\+takeRows\+adding\+addRow\+'<\/div>/.test(rc) && /data-act="addfile"/.test(rc), "a take list with + Add take (open or record)");
  ok(/<label class="typelbl">Type <select class="slottype"/.test(rc), "the type select is labelled Type");
  ok(/data-act="record" title="Record a take into this slot">● Record<\/button>':""\)\+\s*'<button class="iconbtn" data-act="clear"/.test(rc) && !/data-act="record"/.test(th), "● Record sits beside ⟳ Replace and ✕ Clear, not in the transport");
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
  ok(/snr<REC_GUIDE_SNR_MIN/.test(ga) && /stopCapture\(false\);/.test(ga) && /const REC_GUIDE_SNR_MIN=40;/.test(b4), "a first played step under 40 dB above the measured floor stops the take with one sentence");
  ok(/landRecording\(i,buf,cap\.proc,guideProtocol\(cap\)\);/.test(b4) && /protocol:protocol\|\|null \},seq,append\)/.test(b4) && /protocol:meta\.protocol\|\|null \}/.test(b4),
    "the landed take carries protocol {version, stepsDone, skipped} in its facts — and so in the snapshot");
  ok(/recGuided:!!state\.recGuided,/.test(body("_settingsPayload")) && /if\(typeof j\.recGuided==="boolean"\) state\.recGuided=j\.recGuided;/.test(b4), "the Guided switch is remembered additively; absent → on");
  ok(/data-recguided/.test(body("renderCard")) && /data-act="recskip"/.test(body("guideHtml")), "the arming panel has the switch and a running step can be skipped");
  ok(/skippedFor\(r\.def\.term\)/.test(body("openReadinessPop")), "the readiness tap names the skipped step beside the row it would have fed");
  ok(/<h4>The guided take<\/h4>/.test(html) && /<h4>What to play — three parts, in this order<\/h4>/.test(html), "the recording guide gained one paragraph and lost nothing");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
