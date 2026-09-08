---
tags: [music, theory, physics, learning]
date: 2026-08-22
---

# Harmony & Physics — a running learning doc

Zahid's exploration of how guitar notes map to the physics of sound. Started 2026-08-22 from the realization that a major triad's 3rd and 5th are harmonics of the root. Related: [[music/profile|profile]].

## 1 · The raw material: the harmonic series

Pluck a string tuned to frequency f and it vibrates at f AND at 2f, 3f, 4f, 5f… simultaneously (the string subdivides into halves, thirds, quarters…). Every note you've ever played is a chord of these partials; their relative strengths are the *timbre*.

Using C as the root (octaves folded back into one octave — the ear treats ×2 as "the same note"):

| Harmonic | Ratio to root | Folded note | Interval | In tune w/ 12-TET? |
|---|---|---|---|---|
| 1 | 1/1 | C | unison | ✓ |
| 2 | 2/1 | C | octave | ✓ exact |
| 3 | 3/2 | G | perfect 5th | ✓ (+2¢) |
| 4 | 4/2 | C | octave | ✓ |
| 5 | 5/4 | E | major 3rd | ~ (−14¢, noticeably flat of fret) |
| 6 | 3/2 | G | 5th | ✓ |
| 7 | 7/4 | ≈Bb | "blues 7th" | ✗ (−31¢, between frets!) |
| 8 | 2/1 | C | octave | ✓ |
| 9 | 9/8 | D | major 2nd | ~ (+4¢) |
| 10 | 5/4 | E | major 3rd | ~ |
| 11 | 11/8 | ≈F# | ~tritone | ✗ (way off) |
| 12 | 3/2 | G | 5th | ✓ |
| 13 | 13/8 | ≈A-ish | ~minor 6th+ | ✗ (−59¢) |
| 15 | 15/8 | B | major 7th | ~ (−12¢) |

**The major triad is the harmonic series.** Harmonics 4:5:6 = C:E:G. When you play a major chord you're reconstructing, with separate strings, what a single string already does quietly by itself. The ear recognizes the pattern and fuses it — it even infers the shared fundamental (this is called *virtual pitch*). That's why major sounds "complete."

## 2 · Why simple ratios sound good (the physics of consonance)

Two notes played together are consonant when their *harmonic series line up*:

- C (f) and G (3/2 f): every 3rd harmonic of C lands exactly on every 2nd harmonic of G. Massive overlap → the mismatched partials are few → smoothness.
- Two notes a semitone apart: almost no partials align, and many pairs sit *close but not equal* → they beat against each other at rates the ear reads as roughness (Helmholtz's critical-band theory).

So "harmonizing" is literal: consonance = shared/aligned harmonics, dissonance = beating between near-miss harmonics. Simple ratio ⇒ more alignment ⇒ smoother.

## 2.5 · Roughness, precisely (added 2026-08-22)

**Definition.** Two pure tones f₁, f₂ superpose as cos(2πf₁t)+cos(2πf₂t) = 2·cos(πΔf·t)·cos(π(f₁+f₂)t): a carrier at the mean frequency, amplitude-modulated at Δf. Perception by Δf:
- Δf ≲ 15 Hz → audible slow **beating** (wah-wah loudness).
- Δf ≈ 15–~½ critical band, peak ~30–40 Hz → too fast to track: **roughness**, a gritty buzz. This is the sensation.
- Δf > critical band → the cochlea's mechanical filter bank (basilar membrane; bandwidth ≈ ERB, roughly 11–15% of center frequency) resolves the tones into separate channels → smooth again.
Roughness = amplitude modulation *inside one cochlear filter*. Physiological and computable (Plomp–Levelt 1965; Sethares' model sums over all partial pairs, weighted by amplitude product).

**Parameterized roughness curve (Sethares' model, added 2026-08-22 for Claude Rameau's consonance explainer).** For one pair of partials at frequencies f₁ ≤ f₂ with amplitudes a₁, a₂:

```
d(f₁, f₂, a₁, a₂) = min(a₁, a₂) · [ e^(−b₁·s·Δf) − e^(−b₂·s·Δf) ]
where  Δf = f₂ − f₁
       s  = d* / (s₁·f₁ + s₂)
       b₁ = 3.5,  b₂ = 5.75,  d* = 0.24,  s₁ = 0.021,  s₂ = 19
```

Total roughness of two complex tones = Σ d over **all** cross-pairs of their partials (self-pairs of one tone contribute a timbre's intrinsic roughness and are usually included too). Properties worth asserting in tests: d = 0 at Δf = 0 (unison); d peaks near Δf ≈ ¼ of the critical bandwidth at f₁ (~30–40 Hz in the guitar's mid-register) — the peak of the bracketed term sits at s·Δf = ln(b₂/b₁)/(b₂−b₁) ≈ 0.221; d → 0 as Δf exceeds the critical band. The `s` scaling encodes the frequency-dependent critical bandwidth (wider in Hz at higher f₁), which is what makes the same musical interval rougher in low register than high — the physics behind "power chords low, triads high." Amplitude convention: `min(a₁,a₂)` per Sethares (*Tuning, Timbre, Spectrum, Scale*, 1998 — the softer partner limits audible beating); the a₁·a₂ product is a common variant, fine if stated. Output is a relative (dimensionless) roughness — normalize the plotted curve to its own maximum and say so on the axis; do not present absolute units.

**The 15th-harmonic paradox (Zahid's question).** B is harmonic 15 of C — so why is B-against-C rough? Because for *complex* tones you compare the full harmonic combs, and alignment must be weighted by energy:
- C's comb: f, 2f, 3f… · B's comb: (15/8)f·{1,2,3…}. First coincidence: C's 15th = B's 8th. But string-harmonic amplitudes fall ~1/n — by harmonic 15 there's almost no power. The alignment exists *mathematically* and is *energetically irrelevant*.
- Meanwhile the strong low partials near-miss: at C4 (261.6 Hz), B4 = 490.5 Hz vs C's 2nd harmonic 523.2 Hz → Δ = 32.7 Hz — **exactly peak roughness**. B's 2nd partial (981) vs C's 4th (1046): Δ = 65 Hz, still inside the critical band at that register. The comb's high-energy region is full of near-misses parked in the maximum-grit zone.
- General law: for ratio p/q the first strong coincidence sits at harmonic p (of the lower note) — so **p·q (Tenney height) ranks dissonance**: octave 2, fifth 6, fourth 12, maj6 15, maj3 20, min3 30, maj2 72, maj7 120. The maj7 is the scale's roughest interval against the root *because* its first real overlap is pushed to the powerless tail while every strong tooth lands a semitone-ish from a strong neighbor.
- Semitone-class intervals are worst-case: a constant ~6% ratio offset keeps *every* partial pair within the ~11–15% critical band — the whole comb grinds at once.

**Register changes everything (Zahid's ×8 observation).** Fold B up three octaves and play literal 15f against f: now B's entire comb {15f, 30f, 45f…} is a *subset* of C's comb — exact coincidences everywhere, zero near-misses → it fuses, faint and consonant. The major 7th's grind is *created by octave-folding it down* into the register where its partials interleave with C's strong ones. Deep point: **sensory roughness is register-dependent; ratio-class ("interval") is an octave-equivalent abstraction that discards exactly what roughness depends on (absolute Δf between partials).** Tonal function (the leading-tone pull) lives at the abstract level; grit lives at the sensory level. Arrangers exploit this constantly — spread voicings put "dissonant" notes far apart to keep function without grit.

**Timbre corollary (Sethares).** Roughness depends on the partials, not the notation: pure sine waves are nearly roughness-free at any interval; heavily distorted guitar (dense partials + intermodulation) makes even a major 3rd grind — why power chords rule under gain, and why gamelan music, with inharmonic metallophone partials, evolved different "consonant" scales. Consonance is a property of *spectra*, and only by proxy of notes.

## 2.6 · "Consonant" and "simple ratio," defined properly (added 2026-08-22)

**Simple ratio** = p/q in lowest terms with small p·q. Graded, not binary — 2/1 (p·q=2) simplest, 3/2 (6), 4/3 (12), 5/4 (20)… 15/8 (120). Three equivalent pictures of why small p·q matters:
1. **Time domain — joint periodicity.** Two tones at f and (p/q)f have a combined waveform that repeats every q cycles of the lower tone (= p of the upper). 3/2 → composite repeats every 2 low-cycles: short, strongly periodic pattern. 15/8 → repeats only every 8 low-cycles: quasi-aperiodic churn. The auditory nerve phase-locks to waveform periodicity; short joint period → clean, unified neural code.
2. **Frequency domain — comb alignment.** Partials coincide exactly at multiples of the lcm: a fraction ~1/(p·q) of teeth align. Small p·q → many high-energy coincidences, few near-misses → low roughness (§2.5). Large p·q → alignment exiled to the amplitude tail, strong partials near-missing.
3. **Inference — common fundamental.** Both notes are harmonics (q-th and p-th) of an implied fundamental at f/q. Small q → that ancestor is close below and the brain's harmonicity template locks on (virtual pitch, fusion). Large q → implied root too remote; no fusion.

**Consonance** = the perceptual state those three produce. Operationally, three separable components:
- *Smoothness*: absence of roughness (no strong AM inside cochlear filters) — sensory, register- and timbre-dependent.
- *Fusion/harmonicity*: the combined spectrum resembles ONE harmonic series, so the ear binds it into a single object with a clear virtual pitch — why 4:5:6 sounds "resolved."
- *Familiarity/stability*: learned expectation that this sonority doesn't demand motion — cultural layer (medieval theorists classed the major 3rd as dissonant; jazz treats the maj7 chord as home).
Sensory consonance (first two) is physics; *musical* consonance (third) is trained. They usually agree because the training data was made by ears obeying the physics.

**Tolerance bands.** The ear accepts a few cents of mismatch — consonance minima are basins with width, not points. That width is why 12-TET's 2¢-off fifths pass perfectly, its 14¢-off thirds sit noticeably up the wall of the basin, and vibrato (deliberate oscillation around the minimum) sounds alive rather than out of tune.

## 3 · The major scale, note by note (Zahid's core question)

Just-intonation ratios for C major:

| Degree | Note | Ratio | Harmonic pedigree                                                 | Verdict on "harmonizes with root"                             |
| ------ | ---- | ----- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| 1      | C    | 1/1   | the root                                                          | —                                                             |
| 2      | D    | 9/8   | harmonic 9 = 3×3 (a 5th above the 5th)                            | YES — Zahid's intuition ✓ (but "grandchild": consonant via G) |
| 3      | E    | 5/4   | harmonic 5                                                        | YES — direct overtone                                         |
| 4      | F    | 4/3   | **NOT an overtone of C** — instead **C is the 3rd harmonic of F** | Inverse relation — Zahid's doubt ✓                            |
| 5      | G    | 3/2   | harmonic 3                                                        | YES — strongest non-octave                                    |
| 6      | A    | 5/3   | **not an overtone of C** — A is the major 3rd (5th harmonic) of F | Inverse-family — doubt ✓                                      |
| 7      | B    | 15/8  | harmonic 15 = 3×5 (major 3rd of the 5th)                          | YES-ish — distant direct overtone                             |

**The pattern:** every ratio is built only from primes 2, 3, 5 (octave, fifth, major third). The scale splits into two families:

- **Overtone family (2, 3, 5, 7):** derived *upward* from C — powers of 3 and 5. These rest on the root.
- **Undertone family (4, 6):** derived *downward* — F is the note that *contains C in its own harmonic series*, and A is F's major third. These notes don't rest on C; C rests on them.

This is not a technicality — it's audible and it IS functional harmony:
- G (overtone) sounds *supported by* C → dominant feels like tension that belongs to home.
- F (undertone) sounds like it *wants to be its own root* → subdominant's "pulling away" feel. Play C then F: F doesn't sit inside C; it tugs the tonal center toward itself.
- The amen cadence (F→C) and the V→I cadence are the two directions of the same physics.

**The tidiest derivation of the whole scale:** take the strongest relation (the 5th) once in each direction from C — giving F ← C → G — and build the harmonic-series triad (4:5:6) on each:
- F–A–C, C–E–G, G–B–D
Union = C D E F G A B. **The major scale is three interlocking major triads.** Nothing else needed. Every note is the 1, 3, or 5 of the tonic, dominant, or subdominant. (This also explains why I, IV, V harmonize "everything" in folk/blues/country: together they literally contain the scale.)

### The 2nd and 7th, honestly

Zahid guessed they harmonize — true with nuance:
- D (9/8) is two perfect 5ths up (C→G→D). Alone against C it's mildly dissonant (whole tone = adjacent-ish harmonics 8:9) but it *belongs* — the ear hears the lineage through G. Sus2 chords work because of this: clearly consonant-adjacent, but unresolved.
- B (15/8) is a 5th + a major 3rd (C→G→B). As harmonic 15 it's a real overtone but a weak/high one; against C alone it's the sharpest dissonance in the scale (semitone from the octave!). Its consonance is *contextual*: inside G's triad it's smooth; its adjacency to C is exactly the "leading tone" pull that makes V→I resolve.

Rule of thumb: **low harmonic number = consonant in isolation; higher composite numbers (9, 15) = consonant by inheritance, tense in isolation, and that tension is what makes music move.**

## 3.4 · Zahid's denominator rule (added 2026-08-22)

Zahid's own formulation, verified: for a scale note at ratio p/q (lowest terms) to the root —

- **q a power of 2** (1, 2, 4, 8…) ⇔ the note is an octave-folded harmonic of the root: it's harmonic p, dropped log₂(q) octaves. Scale check: 9/8, 5/4, 3/2, 15/8 ✓ — the overtone family.
- **q containing an odd factor** (the 3 in 4/3 and 5/3) ⇔ the note is NOT in the root's series. Both notes are instead harmonics of a **common fundamental at f/q**: the root is its q-th harmonic, the note its p-th. For the 4th: f/3 *is* low F — C is the 3rd harmonic of F. For the 6th: same ancestor F, with A as its 5th harmonic (F's major third).
- Refinement: the test is "power of two," not merely "even" (a denominator of 6 is even but hides a 3 — e.g. septimal 7/6). In the major scale the two happen to coincide.
- Numerator layer: if p is a power of 2 (4/3), the upper note IS the common fundamental octave-shifted — the 4th literally is the foreign root (why a bare 4th sounds like a suspension wanting to resolve to IV). If p has odd factors (5/3), the note is a member of the foreign family, not its root.
- Prime factors = family tree: every 3 = a fifth-step, every 5 = a major-third-step, 2s = octaves. **Denominator = ancestry test; numerator = which descendant.**

## 3.5 · The 6th, a closer look (added 2026-08-22)

The 6th (A in C) is the scale's most interesting citizen:

- **Consonant without being an overtone.** 5/3 is a very simple ratio — consonance only needs *aligned partials*, not membership in the root's series (every 3rd harmonic of A meets every 5th of C). Direction doesn't matter for smoothness; it matters for *gravity*. So A sounds sweet over C, yet doesn't rest on it.
- **Two rival derivations, 22 cents apart.** By stacked fifths C→G→D→A: 27/16 (906¢, "Pythagorean 6th"). As F's major third: 5/3 (884¢). The gap is the syntonic comma (81/80) — the 6th is the scale's most tuning-ambiguous note. ET splits the difference at 900¢. (String players intonate it differently depending on harmonic context; a fretted guitar can't.)
- **Home chord: IV only.** In the three-triad construction, each note lives in specific triads: C→I,IV · D→V · E→I · F→IV · G→I,V · A→**IV only** · B→V. So in I-IV-V accompaniment, the moment a melody lands on the 6th, the harmony *must* be on IV (or treat A as a color tone). The 6th is the subdominant family's calling card — hearing A over a C context is what "IV-ness" sounds like.
- **The shadow tonic.** A is the root of vi (A minor), the relative minor — the same seven notes reorganized around the 6th degree. The deceptive cadence V→vi works because vi shares two notes with I (C, E) but re-roots them on A: home's furniture, different house. Sad reprises of happy songs = pivot the same material to the 6th.

## 3.6 · The narrative layer (added 2026-08-22)

Zahid's goal: musical intuition as *story*. Validated framing — the scale's seven notes form three castes, matching the three generating triads:

- 🏠 **Tonic family (1, 3, 5)** — at rest. Home's furniture; phrases can end here.
- 🧭 **Dominant family (7, 2, +5)** = members of the V chord — tension pointing **homeward** (centripetal). 7 is the doorknob (leading tone, rises to 1); 2 falls to 1 or rises to 3.
- 🌄 **Subdominant family (4, 6, +1)** = members of the IV chord — tension pointing **away** (centrifugal). 4 leans down to 3 or asserts F; 6 falls wistfully to 5.

Correction to first draft of the intuition: 2 and 7 are home-*blooded* but not at rest — allegiance ≠ stability. Both castes are tension; direction differs.

**Stepwise resolution table (most of melody-writing):** 2→1 or 3 · 4→3 · 6→5 · 7→8.

**The archetype:** I → IV → V → I = home → departure → crisis-pointing-home → homecoming. The hero's journey in ratios; why it carries thousands of songs.

**Pivot stones:** C lives in I and IV; G lives in I and V — dual citizens a storyteller stands on while choosing the tale's direction.

One-line version: *4 and 6 pull away toward the parent; 2 and 7 pull back toward home; only 1, 3, 5 rest — music is the art of scheduling those pulls.*

![[major-scale-narrative.svg]]
*The narrative in one picture: dynasty of fifths (top) + gravity map of the three triad-families (bottom). Source: `assets/major-scale-narrative.svg`.*

## 3.7 · The lineage of fifths and the Tonnetz (added 2026-08-22)

Zahid's tree intuition (away-world F = parent, home C = child, return-engine G = child-of-home via V) — verified and extended:

- **The parent relation chains.** "X's 3rd harmonic = Y" generates a dynasty: F → C → G → D → A → E → B. Those seven nodes ARE the C major scale (Pythagorean derivation). Home sits second from the top: one ancestor (F), five descendants.
- Generation distance tracks tension against home: D grandchild, A great-grandchild, B most remote (the restless leading tone).
- Flat-ward modulation = toward ancestors (relaxing/darkening); sharp-ward = toward descendants (brightening/energizing). Octave equivalence closes the chain into the **circle of fifths** — now derived, not memorized.
- **Caveat → next structure:** the pure chain yields Pythagorean E (81/64); the ear prefers the direct 5th harmonic E (5/4); gap = syntonic comma (22¢). There are really TWO parent-relations (×3 fifths, ×5 major thirds). Two axes → the **Tonnetz** lattice (Euler 1739): fifths horizontal, thirds diagonal; every triad = a triangle; progressions = paths; smooth progressions share triangle edges (C→Am), jarring ones teleport. The fifths-tree is the Tonnetz's spine.
- [ ] TODO: render a proper Tonnetz + dynasty-tree SVG wall chart.

## 4 · Minor

Natural minor (A minor = C major's notes, from A): ratios from A: 1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5.

- **Minor 3rd = 6/5** — the gap between harmonics 5 and 6. Still a simple ratio (consonant), but crucially the minor triad is **10:12:15** as a stack — it is NOT a segment of one harmonic series. A major triad (4:5:6) points at a single virtual fundamental; a minor triad's implied fundamental is distant and ambiguous. Same smoothness, less "pointing home" → the darker, unresolved color isn't cultural, it's arithmetic.
- Elegant symmetry: the minor triad is the major triad *mirrored* (major = 5th split as M3+m3 from the bottom; minor = the same two thirds in reverse order). Riemann's "undertone" theory formalizes this: minor is major seen in a mirror, which rhymes with the overtone/undertone split inside the major scale itself (§3).
- Harmonic/melodic minor are patches: natural minor's 7th (9/5, a whole tone below the octave) doesn't lead; raising it back to a leading tone (harmonic minor) reinstates the V→I physics at the cost of the exotic aug-2nd gap.

## 5 · The guitar's compromise: equal temperament

Frets are spaced by 2^(1/12) ≈ 1.0595 per semitone — every ratio above is *approximated* so that all 12 keys work identically:

| Interval | Just ratio | 12-TET error |
|---|---|---|
| Octave | 2/1 | 0¢ exact |
| 5th | 3/2 | −2¢ (inaudible) |
| 4th | 4/3 | +2¢ |
| Major 3rd | 5/4 | **+14¢ sharp** (very audible) |
| Minor 3rd | 6/5 | **−16¢ flat** |
| Major 6th | 5/3 | +16¢ |

Consequences Zahid already lives with:
- **Natural harmonics vs fretted notes:** the fret-5/7/12 harmonics are the *true* series (they're the physics; frets are the compromise). The 7th-fret harmonic (3rd harmonic) is 2¢ off its fretted twin — fine. But the 4th-fret harmonic (5th harmonic, pure major 3rd) is 14¢ flat of the fretted major 3rd. Tuning by 5th/7th-fret harmonics chains pure 5ths and drifts — why tuner > harmonic-tuning for a tempered instrument.
- **Distorted power chords omit the 3rd** because distortion generates intermodulation between all partials — the 14¢-off tempered 3rd turns to mud under gain; the near-pure 5th stays solid. Root+5th = the two notes ET renders almost justly.
- Harmonic 7 (the 7/4 "blues seventh") lives *between* frets — bends and slides toward it are the blues reaching for a note the fret system doesn't own.

## 6 · Fretboard ↔ harmonics map

```
Node position:   12th fret   7th & 19th   5th & 24th   ~3.9th (4th) & 9th & 16th
Harmonic:        2nd (oct)   3rd (5th)    4th (2 oct)  5th (maj 3rd, pure −14¢)
String divides:  1/2         1/3          1/4          1/5
```

### 6.1 · Nodes above the 5th harmonic (added 2026-08-26)

A node of the *n*th harmonic sits at every fraction *k/n* of the string (0 < k < n). Touching
one there kills every partial that does **not** have a node at that point, leaving harmonic *n*
and its multiples. The *fret* nearest that touch point follows from fret spacing itself:

> **fret(k, n) = 12 · log₂( 1 / (1 − k/n) )**

which is just the geometric series below, read backwards. Every node whose *k/n* reduces
(2/6 = 1/3, 4/8 = 1/2, …) is a node the lower harmonic already owns, so only the *unreduced*
fractions are new. Continuing the map:

```
Harmonic:        6th (5th, 2 oct up)   7th ("blues 7th")        8th (3 oct)
String divides:  1/6                   1/7                      1/8
New nodes:       ~3.2nd fret,          ~2.7th, ~5.8th,          ~2.3rd, ~8.1st,
                 ~31st (1/6, 5/6)      ~9.7th fret              ~17th fret
Shares nodes w/: 3rd (7th), 2nd (12th) — none —                 4th (5th), 2nd (12th)
In tune w/ 12-TET? ✓ (+2¢, the 3rd    ✗ (−31¢, between       ✓ (exact octave of
                   harmonic an oct up)    frets — see §1)          the fundamental)
```

Practical reading: the 6th and 8th harmonics are easy — they are the 3rd and 4th an octave
higher, so they still answer where those do — the 6th at frets 7 and 12, the 8th at frets
5 and 12 — as well as at their own new nodes. The 7th is the odd one out: 7 is prime, so **none** of its six nodes coincides
with a lower harmonic's, the three lowest all sit between frets, and the pitch it sounds is
31¢ flat of anything the fretboard owns — the same fact §1 records as "between frets!", seen from the string's side.

Fret spacing itself is the geometric series L·2^(−n/12) — the physical picture of "every semitone = same *ratio*, not same distance," which is also why capos and Eb tuning change nothing about any of the above: harmony is ratios, and ratios ride along.

## 7 · Timbre descriptors: what moves them (audit, added 2026-09-05)

The Tone character panel (M1.5) reports ten descriptors as if each were a property of the
guitar. This section records what an audit of the shipped math on real takes found: for
each descriptor, how much of its variation comes from the instrument versus from the player,
the pick, the room and what was played. Method and numbers first; the physics of the
confounders (§7.2–7.4) is the ground truth for the panel's regrouping.

### 7.1 · Method

Material: three takes of the same riff on three guitars (`samples/Les_Paul.wav`,
`samples/SG.wav`, `samples/Majesty.wav`, 43–59 s, E♭ standard), each ending with the six
open strings plucked one at a time (E♭2 A♭2 D♭3 G♭3 B♭3 E♭4). The Les Paul and the SG carry
the same pickups and the same strings at the same 24.75" scale; the Majesty is a 25.5" guitar
with different pickups and strings. Every number below comes from the app's own block-0
functions run under node (`tests/audit_tone.js`, sections A–H). Five manipulations:

1. **Between-guitar spread** — SD of each descriptor across the three full takes (same riff).
2. **Within-guitar spread** — SD across the four quarters of one take (same guitar, different
   material), pooled over the three guitars. A descriptor whose within-guitar spread exceeds
   its between-guitar spread is measuring the phrase, not the guitar.
3. **Level** — the take at −12 dB, and at −12 dB with white noise added at −60 dBFS.
4. **Transposition** — the take resampled +7 and −5 semitones (pitch and tempo move together;
   the register test is what matters here).
5. **Pluck and pickup position** — an ideal-string model (§7.2) with the same partial decays,
   plucked at L/12.5 … L/2, and sensed at L/14 (bridge), L/7 and L/4 (neck).

### 7.2 · The plucked string: where the pick and the pickup sit

An ideal string of length L plucked at a fraction *p* of its length has partial amplitudes

> a_n ∝ sin(nπp) / n²

(Fletcher & Rossing, *The Physics of Musical Instruments*, §2.8; the displacement is a
triangle with its corner at *p*, and this is that triangle's Fourier series). Two consequences:

- **Nulls.** Partial *n* vanishes whenever *np* is an integer: plucking at L/2 kills every even
  partial, at L/3 every multiple of 3, and so on. The even/odd balance of a note is therefore
  set by **where the pick lands**, before the guitar has a say.
- **Pickup comb.** A magnetic pickup at fraction *q* from the bridge senses each partial
  weighted by |sin(nπq)|: it is blind to partial *n* when *nq* is an integer. A bridge pickup
  at L/14 first nulls partial 14; a neck pickup at L/4 nulls partials 4, 8, 12 … — most of
  the bridge-versus-neck difference is this comb, not "tone".

Measured on the model (same "guitar", same phrase, only *p* or *q* moved):

| Moved | Centroid | Richness | Even/odd |
|---|---|---|---|
| pluck L/12.5 → L/2 | 252 → 195 Hz (0.37 oct) | −9.4 → −24.9 dB | +5.5 → −90 dB (null) |
| pluck at L/3 | — | — | **+21.2 dB** (partials 3, 6, 9 nulled) |
| pickup L/14 → L/4 | 334 → 242 Hz (0.46 oct) | −3.8 → −8.1 dB | +4.0 → +9.8 dB |

For scale: the three real guitars, same riff, differ in centroid by 0.33 oct (SD). The pick
alone moves it further than that.

### 7.3 · A sub-harmonic is not a fundamental

The shipped f₀ estimate is a normalized autocorrelation (lag 60–1200 Hz) with a guard that
prefers the smallest lag within 90 % of the best. On the Majesty's longest note (E♭4, 11.7 s)
it returned **103.4 Hz at confidence 0.84** and the harmonic profile then read

```
h:   1     2      3      4      5      6      7     8      9     10
dB:  0  −15.6  +15.1  −12.5  −27.9  +20.4  −3.4  −35.6  +22.0  −43.5
```

— every third "harmonic" strong, the rest 15–40 dB down. That is a comb at **3 × 103.4 =
310 Hz (E♭4)** read through a period three times too long (the autocorrelation locked on the
common period of the note and its ringing lower fifth). Reported as "odd-leaning −2.3 dB" it
is nonsense: the note's own fundamental was being counted as an odd harmonic. Across all
pitched notes in the three takes the same test moved the pitch on 17 % (LP), 9 % (SG) and
57 % (Majesty) of notes, always upward, by ×2 or ×3. A confidence number from the
autocorrelation cannot catch this — the correlation at the sub-period is *genuinely* high.
The check that does catch it is the comb itself: at the true f₀, teeth 1…6 are all present
(each ≥ 10 dB above the floor between it and the next); at f₀/3, two of every three are
missing. The rule the panel will use: *try ×1, ×2, ×3; keep the lowest hypothesis whose first
six teeth are present; never go below the autocorrelation's own pick (its errors are
sub-harmonic); if none passes, print no harmonic-indexed number and say why.*

**Amended 2026-09-06 — tooth 1 is excused the floor test, not the level test.** On the user's
SG and Majesty takes the rule as written raised 1 of 11 and **7 of 14** pitched notes, and the
two registers came out an octave apart (G♯2 against G♯3) though the same riff was played on
both. A per-note probe of the teeth showed two different things under the raises. **Real low
notes with a faint fundamental:** the Majesty's opening D♯2 had tooth 1 at 6 dB over the floor
and 11 dB under the strongest tooth — present by any ear, but failing the ≥ 10 dB floor test,
because at 78 Hz with Δf ≈ 12 Hz the floor between tooth 1 and tooth 2 is a few bins wide and
never dips. **True sub-harmonic picks:** the autocorrelation's 69 Hz picks (C♯2, below the
lowest string in E♭) had *nothing* at tooth 1 — 40 to 66 dB under the top — and were rightly
raised to C♯3. A first fix that made tooth 1 optional cured the first kind and let the second
kind through an octave low. The discriminator in the data is the **level under the strongest
tooth**, so the rule is now: *tooth 1 must sit within 30 dB of the strongest tooth but need
not clear the between-teeth floor; teeth 2…6 keep both tests* (`weakF0` marks a tooth 1 that
passed only the level test). Verified on a synthetic 78 Hz comb with tooth 1 at −20 dB
(`tests/dsp.test.js`), and `tests/audit_tone.js` now calls the shipped `combCheckF0` rather
than its own copy of the rule. Re-run on the three takes: the Majesty's D♯2 is kept at ×1 (tooth 1 at 6 dB over the floor, 11 dB under the top), and every pick with nothing at tooth 1 — one on the Les Paul, one on the SG, six on the Majesty, all 39–73 dB under the top — is still raised.

### 7.4 · Confounder table

Spread is one SD; "oct" is log₂ units. *Level*: pure gain leaves every descriptor unchanged
(all are ratios); the noise-floor row shows what a −60 dBFS floor does at −12 dB. *Register*:
the +7 st resampling. *Between/within*: three guitars same riff ÷ four quarters of one take.
Verdict codes: **I** instrument (invariant to level, reasonably invariant to technique),
**V** voicing/technique (real, but the player, the pick, or the material), **T** take/recording.

| Descriptor | Between / within | Pluck position | Pickup position | Register (+7 st) | Noise floor −60 dBFS | Other | Verdict |
|---|---|---|---|---|---|---|---|
| Brightness (centroid) | 0.33 / 0.55 oct = **0.6** | 0.37 oct | 0.46 oct | tracks pitch 1:1 (423 → 634 Hz) | +0.05 oct | r = 0.80 with tilt (n = 15) | **V** — content + pick + pickup; instrument-level counterpart is the pickup resonance (§7.5) |
| Warmth (200–500 Hz share) | 5.6 / 17.6 pts = **0.3** | ~3 pts | ~3 pts | ±2 pts here; band fixed while notes move | none | identical to the Band Energy row | **V** — content-dependent, fixed band |
| Fullness (60–200 Hz share) | 9.0 / 9.8 pts = **0.9** | 10 pts | 14 pts | 25.7 → 4.5 % | none | | **V** — content-dependent, fixed band |
| Spectral tilt | 0.74 / 2.30 dB/oct = **0.3** | 1.2 dB/oct | 1.6 dB/oct | −10.1 → −7.5 | **+2.0 dB/oct** | r = 0.80 with centroid | **V**, folded under Brightness — one fact, not two |
| Harmonic richness | 10 / 5.2 dB = 1.9 (but see →) | **15 dB** | 4 dB | ±1 dB | blanks (f₀ lost) | single-note statistic: same LP file cut at 30 s reads 12.9 dB, whole file 5.0 dB | **V** — pluck position, and which note happened to be longest |
| Even/odd balance | 2.4 / 1.6 dB = 1.5 (but see →) | **+5 → +21 → −90 dB** | +4 → +10 dB | ±1 dB | blanks | inverts under a sub-harmonic f₀ (§7.3) | **V** — pluck position; needs the comb-checked f₀ |
| Attack (10→90 % rise) | 0.11 / 2.1 oct = **0.05** | model: 3–5 ms | — | 26 → 18 ms | +4 ms | quarter with 3 onsets reads 1 ms | **V** — the pick and the hand |
| Tightness (60–200 Hz T20) | 0.26 / 0.31 oct = 0.85 | — | — | 1350 → 754 ms | +160 ms | band fixed while notes move; median over onsets | **V** — phrase median; per-string decay replaces it (§7.6) |
| Sustain (200–1200 Hz T20) | 0.36 / 0.32 oct = 1.1 | — | — | 1524 → 1193 ms | none | same | **V** — same; per-string decay replaces it |
| Dynamic range (P95−P10) | 0.93 / 7.3 dB = **0.13** | — | — | none | **−4.7 dB** | | **V** — performance; and a take-quality flag |
| f₀ confidence, onsets, noise floor, SNR, clipping | — | — | — | — | — | already computed, never shown together | **T** — make quality visible |

Reading the table: **no shipped descriptor passes the instrument test.** Richness and even/odd
have a between/within ratio above 1 only because one guitar's value was a sub-harmonic error
(§7.3) and because each is a single-note statistic — the same Les Paul file reads 5.0 dB or
12.9 dB depending on where it is cut. Everything else moves more with the phrase than with
the guitar.

### 7.5 · What did separate the three guitars (feasibility, same takes)

Probed on the six open-string plucks with the comb-checked f₀ (`tests/audit_tone.js` §I–J):

- **Inharmonicity B** (f_n = n·f₀·√(1 + B·n²), fitted with f₀ free over 12–14 partials,
  residual 0.2–2.6 ¢): per string, ×10⁻⁴ —
  E♭2 1.96 / 1.87 / 1.66 · A♭2 0.89 / 1.06 / 0.70 · D♭3 0.92 / — / 0.61 · G♭3 1.77 / 1.59 / 1.39 ·
  B♭3 0.53 / 0.78 / 0.48 · E♭4 0.28 / 0.41 / 0.19 (LP / SG / Majesty). The two guitars with
  the same strings and scale agree within ~15 % on every string; the longer-scale guitar
  reads lower on every string, as B ∝ 1/L² predicts. The plain G is the stiffest plain string
  — the well-known reason it is the hardest to intonate.
- **Per-partial decay** (T20 of partials 1–8 tracked by Goertzel, 4096/512): e.g. G♭3 —
  LP 2.9 / 5.4 / 5.5 / 4.6 / 3.4 / 2.5 / 2.2 / 2.3 s, SG 2.0 / 3.6 / 4.2 / 3.5 / 2.3 / 1.3 /
  1.0 / 0.8 s, Majesty 4.9 / 3.2 / 6.1 / 3.7 / 2.6 / 2.7 / 1.7 / 1.9 s. Which partials die first
  differs by guitar on the same note.
- **Pickup resonance** (LTAS hump over the local 800 Hz–8 kHz trend): LP 3.02 kHz, +4.8 dB,
  Q ≈ 2.2; SG 2.77 kHz, +6.8 dB, Q ≈ 2.0; Majesty 2.08 kHz, +6.7 dB, Q ≈ 3.9. The two guitars
  sharing pickups land within 9 % of each other at the same Q; the third is a different pickup.
- **Two-stage decay** (piecewise-linear dB fit with a knee): present on most notes, but the
  knee time varies 0.1–3.2 s across notes of one guitar and the fit's gain over one line
  ranges 0.07–0.87 — it needs a fit-quality gate and the repeatability mode before it can
  carry a verdict.
- **Attack-transient spectrum** (centroid of the first 10 ms vs 300–500 ms later): varies as
  much between strings of one guitar (LP 259–454 Hz) as between guitars on one string
  (G♭3: 259 / 182 / 433 Hz). On this evidence it is a pick descriptor, not a guitar one.

One take per guitar cannot say how much any of these moves between two takes of the *same*
guitar. That number — the reliability band — is what the repeatability mode exists to measure.

### 7.6 · Derivations for the new descriptors (added 2026-09-05, before the UI)

Every row the reworked panel prints traces to one of these. Where a sentence would need a
fact this section does not state, the UI stops at the measurement.

**7.6.1 · Inharmonicity B.** A real string has bending stiffness as well as tension, so its
partials are not exact multiples of f₀:

> f_n = n · f₀ · √(1 + B·n²) ,  B = π³·E·d⁴ / (64·T·L²)  (plain cylindrical string)

(Fletcher & Rossing §2.18; E Young's modulus, d diameter, T tension, L speaking length.)
B rises with the fourth power of diameter and falls with the square of scale length —
a plain G string is the stiffest plain string on the set, and a 25.5" scale reads lower
than a 24.75" one on every string, which is what §7.5 measured. A wound string's winding
adds mass but almost no stiffness, so its B is set by the core, not the outer diameter —
why wound low strings read *lower* B than the plain G. Typical guitar values 10⁻⁵–10⁻³;
at B = 1.6×10⁻⁴ the 12th partial sits 600·log₂(1 + 144B) ≈ 20 ¢ sharp of harmonic. Fit:
(f_n / n)² = f₀²·(1 + B·n²) is linear in n² — intercept f₀², slope f₀²·B — so f₀ is fitted
free and never assumed from the autocorrelation. Teeth are accepted one at a time inside
±1.2 % of the running prediction (interior peak, ≥ 8 dB above the floor that follows);
the residual in cents is reported with the value. B is a property of the string set and
the scale, i.e. of the guitar as strung — it also states the string's state (a dead,
corroded string reads higher).

**7.6.2 · Per-partial decay.** Each partial loses energy at its own rate — to the air
(viscous, ∝ f^½), inside the string (internal friction, rising with f) and through the
bridge into the body (whatever the body accepts at that frequency) — so a note's timbre
*changes* as it rings: A_n(t) = a_n·e^(−t/τ_n). In dB that is a straight line of slope
−8.686/τ_n dB/s, and the time to shed 20 dB is T20_n = 2.303·τ_n. Which partials die first
is set by the body's admittance at those frequencies, which is the guitar. Measured by a
Goertzel filter at f_n (7.6.1) per 4096-pt Hann frame, hop 512, regression from the
post-onset peak until −25 dB or the next onset; accepted with ≥ 6 frames, ≥ 6 dB of observed
decay and a slope steeper than −1 dB/s. The panel's *Overtone sustain* is the geometric mean
of T20₃…₈ on the matched open strings; the popover prints every partial.

**7.6.3 · Two-stage decay (bloom).** A string vibrates in two polarizations. Motion
perpendicular to the top drives the bridge strongly and loses energy fast; motion parallel
to it couples weakly and rings on. The sum

> A(t) = a₁·e^(−t/τ₁) + a₂·e^(−t/τ₂) ,  τ₁ < τ₂

has two asymptotic slopes in dB and a knee near t_k = ln(a₁/a₂)·τ₁τ₂/(τ₂ − τ₁), where the
terms are equal (Weinreich 1977, *Coupled piano strings*, for the mechanism; Woodhouse 2004
for the guitar). Players hear the slow tail as *bloom* or natural compression. Measured as
a piecewise-linear regression of the broadband RMS envelope in dB (10 ms frames, from the
onset peak to −30 dB) with one breakpoint chosen to minimise the residual; reported are the
early slope, the late slope, the knee and the fraction of the single-line residual the knee
removes. Accepted as two-stage only when that fraction is ≥ 0.40 and the early slope is at
least 1.5× the late; otherwise the row says *one slope fits*.

**7.6.4 · Pickup resonance.** A magnetic pickup is a coil: inductance L (single coils
≈ 2–3 H, humbuckers ≈ 4–8 H) in series with its DC resistance, loaded by the cable
capacitance (≈ 100 pF per metre), its own winding capacitance (≈ 100 pF) and the pots. That
is an RLC low-pass with a resonant peak at

> f_r = 1 / (2π·√(L·C))

— L = 8 H, C = 600 pF gives 2.3 kHz; L = 2.5 H, C = 500 pF gives 4.5 kHz. The height and
width of the peak (Q) are set by the load: a 250 kΩ pot damps more than a 500 kΩ one, a
longer cable lowers f_r, and a volume pot below maximum lowers both f_r and Q. It is the
dominant spectral shaper of a solidbody and it characterises the rig (cable, pots) as much
as the guitar — the UI says so. Estimated from the LTAS as the hump over the local trend:
1/3-octave-smoothed curve sampled 800 Hz–8 kHz, an OLS line in log-f fitted inside that
window, the maximum of the residual, and Q = f / (−3 dB width of the residual). The residual
is still shaped by the material, so the number is comparable only on matched material.

**7.6.5 · Pickup-position comb.** From §7.2: a pickup at fraction q of the string senses
partial n weighted |sin(nπq)| and is blind where n·q is an integer. Given the scale length
and the pickup's distance from the bridge (both user-supplied), the first nulls are at
n = 1/q, 2/q, … for each string's f₀. Reported as predicted null frequencies, not measured.

**7.6.6 · Body-air (Helmholtz) resonance and top mode.** f = (c/2π)·√(A/(V·L′)) — the
soundhole area A, body volume V and the effective neck length L′ of the air plug; on
steel-strings 90–120 Hz, pulled down by the flexible top. The first top-plate mode follows
at 140–260 Hz. Q = f / (−3 dB bandwidth) of the peak. A tap on the bridge excites both with
no string pitch in the way, so the tap test is preferred: an onset that fails the comb check
and decays within 0.35 s, its 0.25 s spectrum searched 70–130 Hz for the air peak. The LTAS
peak is the fallback and is labelled as such. **Measured only on hollow/acoustic slots**: on
a solidbody the same window holds the riff's notes (§7.4 — the Les Paul's "air resonance"
was A♭2).

*The tap, read (added 2026-09-05, E6.2).* `tapResonance()` reads both modes from one tap
spectrum — the first 0.25 s after an unpitched onset that fell faster than 57 dB/s (a knock
with the strings muted), 4096-pt Welch, 1/12-octave smoothing, in dB. The air mode is the most
prominent peak in **70–130 Hz**, the first top mode the most prominent in **140–260 Hz** — the
two ranges stated above, kept apart so one wide air peak cannot be read twice — each accepted
with ≥ 3 dB of prominence over its neighbours. **Q = f / Δf₋₃dB**, the width walked down each
side of the peak on the same smoothed curve to the first sample 3 dB below it. Two things set
the resolution floor: the 8192-point Hann window over the 0.25 s knock (−3 dB main lobe
≈ 1.44 bins ≈ 8 Hz at 48 kHz) and the 1/12-octave smoothing (5.8 % of f), added in
quadrature — so an air mode near 100 Hz reads a Q of at most ≈ 10 and a top mode near 200 Hz
at most ≈ 14 (`tapQCeiling(f, rate)`); a Q at its ceiling means *at least this*, and the
popover prints the ceiling beside it. Three knocks are asked for because the loudest *clean* knock is the one
reported (a knock that caught a string fails the tap test's decay gate and is simply not a
tap). A tap on a solidbody also yields a spectrum — of the neck and body bending modes (§7.6.7),
not of an air cavity — which is why the row is hidden there rather than mislabelled.

**7.6.7 · Dead spots.** The neck and body of a solidbody have bending modes (the first near
60–120 Hz, higher ones at a few hundred Hz — Fleischer & Zwicker 1998, *Mechanical
vibrations of electric guitars*, Acustica 84). The string's end is not a rigid support:
where the neck's admittance is high at a played note's frequency, the string drives the neck
and its energy leaves fast — that note, on that string, dies early. Non-uniform sustain
across the neck is therefore the solidbody's structural signature. Measured as the T20 of
the fundamental (7.6.2) for every pitched note of the take; a note under one third of the
median of the notes within an octave of it (at least three) is flagged — a low string's
fundamental outlasts a plain G's for reasons that are the string, not the neck, so a note
is only judged against its neighbours (provisional threshold). A flag is a candidate — play
it again.

**7.6.8 · Attack-transient spectrum.** The spectral centroid (§7.4) of the first 10 ms after
an onset (512-pt Welch) against the centroid 300–500 ms later, as a ratio in octaves. On
the audit takes it varied as much between strings of one guitar as between guitars on one
string (§7.5), so it is filed under voicing/technique: it is the pick meeting the string.

**7.6.9 · Between-note residual.** For every gap of ≥ 0.3 s between onsets, the minimum
short-term RMS in the gap minus the peak RMS of the note before it, in dB; the median over
gaps. On a direct take this is the string's own ring plus the noise floor; with a
microphone it rises with room and distance. THEORY does not give a distance from it, so it
is named as what it is.

**7.6.11 · The room in a decay (added 2026-09-05, E6.3).** A microphone hears the string
through the air of the room. After a sound stops, the room's field decays exponentially in
energy; the time to fall 60 dB is the reverberation time, RT60 (Sabine: T ≈ 0.161·V/A, V the
volume in m³, A the total absorption in m²), typically 0.3–0.6 s in a furnished room and
longer in a hard one, and its share of what the microphone hears grows with distance from
the instrument (past the critical distance the reverberant field dominates the direct
sound). The decay a microphone records is therefore the **slower** of two processes — the
string's own loss (§7.6.2) and the room's — and a decay row cannot read faster than the room
lets it. In an ordinary room the string outlasts the room by a wide margin (a T20 of seconds
against a room T20 of a fifth of a second), so the room shows up **between** notes (§7.6.9)
and not in the decays. The test is therefore relational, not a constant: after the **last**
onset the broadband RMS envelope is followed from 10 dB below its peak to the noise floor
+ 6 dB and a straight line in dB gives the tail's T20 (`roomTail()`); when that exceeds the
note's own decay — the slower of its fundamental T20 and, when a two-stage fit exists, its
late slope, so that bloom (§7.6.3) is never mistaken for a room — by more than **1.5×**
(provisional), the tail is not the string. The decay rows (Overtone ring, Bloom, Fundamental
decay, Sustain across the neck) then read *partial* with the room named, and a pair in which
only one take carries a room is flagged as not directly comparable. A DI take has no room:
its tail follows the string and the test stays silent. THEORY gives no way to subtract a
room from a decay; the rows say what they measured.

**7.6.12 · What the recording path leaves in the audio (added 2026-09-05, E6.4).** Three
paths reach the app: a direct line from a magnetic pickup (DI), a microphone in front of the
instrument, and an under-saddle piezo (an acoustic's DI). The audio tells some apart and not
others. A room tail (§7.6.11) exists **only** through a microphone — a pickup or a piezo
hears the string and the top, never the room's air — so a tail slower than the string is
evidence of a mic. Two channels that differ are two microphones or a stereo pair; a DI is one
signal even when it is saved as two identical channels (the app sums to mono either way and
says so). Beyond that the audio is silent: a piezo's characteristic brightness is a tendency,
not a test, and THEORY does not fix one — so between DI and piezo the app reads the guitar's
declared type (an acoustic with no room in it was plugged in) and prints the path as
*detected*, with an override in its popover that is stored with the take and never written
back into the type. `unknown` only when nothing has been analysed.

**7.6.10 · Comparability and the reliability band.** Two takes are compared row by row only
when the things level-matching does not fix are close: register (median pitched f₀ within
5 semitones), onset density and count (ratio ≤ 1.5), noise floor (within 10 dB), duration
(ratio ≤ 2), level (|offset| ≤ 12 dB even with level-match on). A failed check greys the rows
it affects and says why. A row's **band** is how far its number is expected to move between
two takes of the same guitar; |Δ| inside the band prints *not distinguishable*, never a
delta. Bands come from the repeatability mode (two takes of one guitar → |A − B| stored per
row); until measured, provisional bands from §7.4 apply and are labelled so: centroid
±0.55 oct, B ±20 %, pickup f ±10 %, even/odd ±4 dB, richness ±4 dB, band shares ±5 pts,
attack ±1 oct, attack colour ±0.5 oct (already a log quantity, so an absolute band),
band decays ±0.3 oct, overtone sustain ±0.3 oct, neck sustain ±0.3 oct, dynamic range ±5 dB.

**Amended 2026-09-06 — every take counts.** The user's principle: *wherever it makes sense,
all the takes are taken into account.* Three consequences, each written here before the code.

*(a) The band shrinks with the number of takes.* A guitar's takes give a range R over n
values; for a normal sample the range estimates the spread as σ ≈ R / d₂(n) with
d₂ = 1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078 for n = 2…10 (the
control-chart constant; n > 10 keeps d₂(10) under a √n that goes on shrinking). What a
verdict compares is the difference of two **means**, whose standard error is
√(σ_A²/n_A + σ_B²/n_B). The band is therefore

  band = 1.128 · √( (R_A / (d₂(n_A)·√n_A))² + (R_B / (d₂(n_B)·√n_B))² ),

the factor 1.128 chosen so that two takes of each guitar with equal ranges R give **band = R** —
exactly the band the rule above produced (the larger of two equal spreads). With three takes
each it is 0.54 R; with two of one guitar and three of the other, 0.80 R. A saved band (the
repeatability mode's stored spread) is used as it was saved.

*(b) Comparability runs over every pair of takes.* A check passes only if it passes for every
take of A against every take of B; a failing check reports its worst pair by name. Two takes of
one guitar cannot repair a third that was recorded in another register or through a mic. The
recording path is detected per take, and a guitar whose takes mix DI and microphone is said
so before anything is compared.

*(c) Note-based rows use every take.* A row's value is the mean of its per-take values
(geometric on a log axis). Its evidence is pooled — the notes of all the takes together — since
that is what the mean was made from. **Sustain** matches notes between each take of A and each
take of B (±50 ¢), takes the median per pair, and averages the pairs; at most three takes per
guitar enter (the three with the most pitched notes), so the pair count stays at nine or fewer.
**Bloom** (§7.6.3) has no provisional band — the audit's knee times were too spread to guess one
— but it takes a *measured* band from the takes like every other row (amended 2026-09-08); on
three takes a side of the user's Les Paul and Majesty the combined band was 0.75 oct against a
2.03 oct gap, so the row reached a verdict. When one guitar's takes swing more than the gap, the
row says *not distinguishable*, which is the honest reading of a pick-sensitive knee.
A **dead spot** (§7.6.7) is reported only when the note dies early in a strict majority of the
takes that contain it **and** the note was readable (passed the comb check, with a measured
decay) in a majority of all the guitar's takes — one weak pluck in one take is a pluck, the same
note dying in two takes of three is the neck. A note read in one take of three cannot be a
majority of anything: it is a *weak candidate*, listed in the row's detail with the takes it was
missing from, rejected in, or had no decay in, and never headlined (amended 2026-09-08, after a
"1 of 1 takes" dead spot headlined At a glance with three takes loaded).

### 7.7 · Evidence requirements (added 2026-09-05, E1.1 — measured before frozen)

Per tone-panel row: what a take must supply before the row renders as **measured** (state 2),
the floor under which it is **not measurable** (state 4), and — between the two — **partial**
(state 3). The starting values came from the user's brief (SPEC.md 2026-09-05, E phase); each
was run against the three audit takes (§7.1) and the synthetic demo pair through the shipped
per-note pass (`computeTimeMetrics`, scratch driver over block 0 + block 4) before it was
written into `TONE_EVIDENCE` in block 0. Counts are what each take actually supplied.

**What the takes supply** (E♭ standard for the audit takes, E standard for the demo; the demo rows are the 2026-09-06 pair — two construction-modelled solidbodies, two takes each, fourteen notes with every note muted before the next pluck — measured with the scratch probe that mirrors the per-note pass, SPEC.md 2026-09-06):

| Take | comb-checked notes / span | SNR | open strings | open E · A best partial count | notes ringing ≥ 1.5 s with partial decays | two-stage fits | fundamental decays (T20) | attack spectra |
|---|---|---|---|---|---|---|---|---|
| Les Paul | 12 / 24.0 st | 38 dB | 6 of 6 | 14 · 14 | 6 | 3 | 4 | 9 |
| SG | 11 / 26.4 st | 39 dB | 6 of 6 | 14 · 14 | 6 | 3 | 6 | 10 |
| Majesty | 14 / 23.9 st | 44 dB | 6 of 6 | 14 · 14 | 6 | 4 | 5 | 7 |
| demo single-coil, take 1 · 2 | 14 / 24.1 st | 59 · 58 dB | 6 of 6 | 12 · 13 | 7 | 9 | 13 | 12 |
| demo humbucker, take 1 · 2 | 14 / 24.0 st | 63 · 63 dB | 6 of 6 | 10 · 13 | 7 | 6 | 14 | 12 |

Only onsets followed by ≥ 0.45 s become notes at all (`NOTE_MIN_GAP`), so a riff with 85
onsets yields 17 candidates; and only the `NOTE_MAX_HEAVY` = 12 longest get the partial,
two-stage and attack fits. Both caps bound what any take can supply and are the reason for
two of the adjustments below.

**The manifests** (`TONE_EVIDENCE`; *need* = state 2, *min* = state 3 floor):

| Row | need | min | Provenance / adjustment |
|---|---|---|---|
| Pickup voice | ≥ 10 comb-checked notes, span ≥ 12 st, SNR ≥ 35 dB | 4 notes, 5 st, 25 dB | **Adjusted from 20 notes / 40 dB.** The audit takes supply 11–14 notes at 38–44 dB and are the material on which the two guitars sharing pickups landed within 9 % at the same Q (§7.5) — the starting values would have called all three *partial* while the measurement demonstrably worked on them. The threshold sits just under the weakest take that did. Demo pair: 6 notes → partial. |
| Body voice | a tap (§7.6.6) | an LTAS peak 70–130 Hz | As briefed: tap → measured; LTAS peak → partial. Hidden for solidbody slots. No audit take has a tap. |
| String stiffness | open E **and** open A, each with ≥ 12 accepted partials | each ≥ 6 | As briefed. All five takes reach it (14 partials on both). |
| Overtone ring | ≥ 6 notes ringing ≥ 1.5 s with partial decays | ≥ 2 notes with partial decays (any length) | As briefed; the six open-string plucks are exactly the six. The demo's 0.5 s notes carry partial fits but only one rings 1.5 s → partial, which is right. |
| Bloom | ≥ 4 two-stage fits | ≥ 1 | **Adjusted from 10.** `NOTE_MAX_HEAVY` = 12 caps the candidates and the audit takes accepted 3–4 of them (§7.5: the fit's gain over one line ranges 0.07–0.87), so 10 is unreachable on any riff; 4 is what the Majesty supplied and the point where a median is more than one outlier plus one. LP/SG → partial. |
| Sustain across the neck | ≥ 18 notes with a fundamental T20, span ≥ 12 st | ≥ 6 (a median exists, `DEAD_SPOT_MIN_NOTES`) | **"Over ≥ 4 strings" cannot be verified from audio** — string identity is not in the pitch. The span is what the dead-spot judgement needs (neighbours within 6 st); the guided neck walk (E3) is what guarantees the strings, recorded in `protocol.stepsDone`. Audit takes: 4–6 decays → partial or collapsed, which is correct: a riff is not a neck walk. |
| Fundamental decay | ≥ 6 notes with a T20 (matched by pitch across the two takes when both are loaded) | ≥ 2 | As briefed. SG 6 → measured; LP 4, Majesty 5 → partial. |
| Brightness | ≥ 6 comb-checked notes | ≥ 1 | As briefed. **Not** recomputed inside note bodies — see below. |
| Even/odd, Harmonic richness | ≥ 6 comb-checked notes | ≥ 2 | As briefed. |
| Attack colour | ≥ 6 attack spectra | ≥ 2 | As briefed; the count is of notes with an attack spectrum (heavy notes only). Demo 5 → partial. |
| Take rows (Pitch check, Level and floor, Between notes, Material, Dynamic range) | — | — | Facts about the take; measured whenever present. |

**Brightness inside note bodies — measured and rejected.** The brief proposed computing the
centroid inside comb-checked note bodies above the floor, expecting the floor sensitivity to
drop. It rises. With a −60 dBFS floor added to each take at −12 dB (the §7.4 manipulation):

| Take | whole-take centroid / tilt shift | note-body median (full body) | note-body median (cut at floor + 20 dB) |
|---|---|---|---|
| Les Paul | +0.026 oct / +1.6 dB/oct | +0.033 oct / +4.3 dB/oct | +0.033 / +3.9 |
| SG | +0.039 / +1.3 | **+0.303 / +4.0** | +0.234 / +3.7 |
| Majesty | +0.004 / +0.7 | +0.008 / +4.0 | +0.008 / +3.8 |

A single note's Welch has a short segment and a decaying tail that sits closer to the floor
than the take's loud passages, so the floor weighs more, not less. The whole-take centroid
stays, `computeTimeMetrics` is unchanged, and the "not comparable · noise floor" flag on the
Brightness row stays with it.

**Not from audio at all:** the provisional band (§7.6.10) no longer decides a verdict. In a
one-take-each comparison it decides only whether the gap between two measured values is
thinner than the audit's own spread — *partial* — or not; a verdict exists only from a band
measured on the user's own takes.

---

## Appendix A · Rameau, the physicist of harmony (added 2026-08-22)

**Jean-Philippe Rameau (1683–1764)** — French Baroque composer (operas: *Hippolyte et Aricie*, *Les Indes galantes*; brilliant harpsichord music) who, at 39, published the *Traité de l'harmonie* (1722) and effectively founded music theory as a science. Why he matters to this document:

- **He derived harmony from physics.** Building on Joseph Sauveur's brand-new acoustics (Sauveur had just measured overtones and coined "harmonics"), Rameau grounded chords in the *corps sonore* — the resonating body: a vibrating string sounds its 12th (3rd harmonic) and 17th (5th harmonic), therefore the major triad is *given by nature*, not by convention. Exactly the argument this doc rebuilt from harmonic combs.
- **The fundamental bass (basse fondamentale):** his revolutionary claim that a progression is governed by the succession of chord *roots* — an implied bass line of fundamentals, moving preferentially by fifths. That's our dynasty-of-fifths lineage, stated in 1722.
- **Inversions:** he recognized C-E-G, E-G-C, G-C-E as *the same chord* — obvious now, radical then. Identity lives in the root and its harmonic pedigree, not in voicing. (Same abstraction as our octave-folding.)
- **Tonic / dominant / subdominant:** he named the three functions and their gravity — the home/engine/away-world triangle of §3.6 is Rameau's *tonique–dominante–sous-dominante* with modern physics under it.
- **His famous struggle:** minor. The overtone series gives major for free; Rameau spent decades on shaky derivations of the minor triad (co-vibration, undertone speculations later formalized-ish by Riemann). Our §4 (10:12:15, no single-series home) is the modern resolution of the exact problem that tormented him.
- **The scientific culture:** d'Alembert popularized his system (*Élémens de musique*, 1752); he feuded publicly with Rousseau over harmony-vs-melody. Rameau insisted "music is a physico-mathematical science" — and was mocked for it by the literary set. This document is, in spirit, Team Rameau.

One-line take: Rameau is what happens when a working musician demands *why* — he found the overtone series under the triad 300 years before FFTs, and every "functional harmony" chart since is his footnote.

## Learnings log

- **2026-08-22 (night)** — Roughness defined precisely (§2.5): AM inside one cochlear filter, peak ~30–40 Hz; resolved the 15th-harmonic paradox (alignment must be energy-weighted — first coincidence at harmonic 15 is powerless while strong partials near-miss at Δ=32.7 Hz for B4/C5); Tenney height p·q ranks dissonance; register-dependence (B three octaves up = pure subset of C's comb = consonant — the maj7's grind is created by octave-folding); Sethares timbre-dependence.
- **2026-08-22 (evening)** — Narrative layer established (§3.6): three castes (tonic rest / dominant homeward-pull / subdominant away-pull), resolution table, I-IV-V as hero's journey. Refined Zahid's "everyone else stays home": 2 & 7 are home-family but restless — allegiance ≠ stability.
- **2026-08-22 (later still)** — Zahid derived the denominator rule himself from rational frequency forms: q = power of 2 ⇔ overtone of root; odd factor in q ⇔ shared ancestor at f/q (the undertone family). Refined "even" → "power of two"; added the numerator layer (p = 2^k ⇒ the note IS the foreign root). §3.4.
- **2026-08-22 (later)** — Deep-dive on the 6th: consonant (5/3) without being an overtone — alignment ≠ ancestry; the syntonic-comma ambiguity (27/16 vs 5/3); lives ONLY in the IV triad among I-IV-V, making it the "sound of IV"; and it's the relative-minor root (vi = shadow tonic, deceptive cadence).
- **2026-08-22** — Started the doc. Confirmed: major triad = harmonics 4:5:6; 2nd = harmonic 9 (3×3), major 7th = harmonic 15 (3×5) — "harmonize by inheritance." The 4th and 6th are the inverse family: C is a harmonic *of F*; A is F's third — the physical root of subdominant "pull." Major scale = union of the 4:5:6 triads on F, C, G. Minor 3rd = 6/5 (consonant) but minor triad 10:12:15 has no single-series home → darker. ET fudges 3rds by ±14–16¢ (why power chords under gain, why harmonic-tuning drifts).

## Open questions / next threads

- [ ] Hear it: A/B a just-intonation major 3rd vs the fretted one (Claude Rameau could measure the beating!)
- [ ] Pentatonic minor/major through this lens (spoiler: it deletes both "problem" semitones)
- [ ] Why does the tritone resolve outward? (7th-chord physics)
- [ ] South Asian classical: ragas use just-ish intervals and 22 shrutis — connect to the harmonic families
