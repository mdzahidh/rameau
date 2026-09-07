#!/usr/bin/env node
// Generates the samples/ WAV pair — the same Karplus–Strong phrases the
// in-app demo synthesizes, rendered to 16-bit PCM WAV so drag-and-drop of
// real files can be exercised. Deterministic: same seeds as the app.
// Usage: node tests/make_samples.js
"use strict";
const fs = require("fs"), path = require("path");

// ---- the app's demo synth, copied verbatim from index.html (tests/e.test.js compares the two) ----
// ---------- demo pair: two solidbodies, one phrase (2026-09-06) ----------
// Two solidbodies, one phrase. An extended Karplus–Strong string: a shaped pluck (the two-level
// velocity pulse an ideal string carries after a pluck at fraction `pos` of its length, softened
// by a one-pole `lp` for the pick, with a little noise for life), a second circular difference for
// the pickup's position (`pu`, THEORY §7.6.5), per-period loop loss `damp` set from the note's T20,
// a high-frequency loss `S`, one first-order allpass for inharmonicity (`disp` is the coefficient at
// A2; it is scaled per note so B reads about the same on every string, as it does on a real set), a second
// slower polarisation `slow=[amp, lossExponent]` for the two-stage decay, and a pick click. Each
// take runs through one resonant low-pass for the pickup and lands on the same −78 dBFS hiss.
// Every note is muted just before the next pluck (one string at a time, as the guide asks);
// the last one rings out.
function lcg(seed){ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/2147483648-1; }; }
function demoString(rate,f0,dur,o,rand){
  const d=Math.max(0,o.disp||0), a=-d, apDelay=(1+d)/(1-d), nAp=d?1:0;
  const N=Math.max(2,Math.round(rate/f0-0.5-apDelay*nAp));
  const D=Math.max(1,Math.min(N-1,Math.round(o.pos*N)));
  const ex=new Float64Array(N);
  for(let i=0;i<N;i++) ex[i]=(i<D?1:-D/(N-D))+(o.noise||0)*rand();
  if(o.lp){ let y=0; for(let r=0;r<2;r++) for(let i=0;i<N;i++){ y+=o.lp*(ex[i]-y); if(r) ex[i]=y; } }
  if(o.pu){ const P=Math.max(1,Math.round(o.pu*N)), e0=Float64Array.from(ex); for(let i=0;i<N;i++) ex[i]=e0[i]-e0[(i-P+N)%N]; }
  const n=Math.round(dur*rate), out=new Float64Array(n);
  const loop=(damp,S,amp)=>{ const dl=Float64Array.from(ex); let k=0; const x1=new Float64Array(nAp), y1=new Float64Array(nAp);
    for(let i=0;i<n;i++){ const v=dl[k]; out[i]+=amp*v; let w=damp*(S*v+(1-S)*dl[(k+1)%N]);
      for(let s=0;s<nAp;s++){ const yy=a*w+x1[s]-a*y1[s]; x1[s]=w; y1[s]=yy; w=yy; }
      dl[k]=w; k=(k+1)%N; } };
  loop(o.damp,o.S,1);
  if(o.slow) loop(Math.pow(o.damp,o.slow[1]),o.S,o.slow[0]);
  if(o.click){ const nc=Math.round(o.click*rate/1000); let pv=0; for(let i=0;i<nc&&i<n;i++){ const v=rand(); out[i]+=o.clickAmp*(v-pv)*(1-i/nc); pv=v; } }
  const nf=Math.min(n,Math.round(0.06*rate)); for(let i=0;i<nf;i++) out[n-nf+i]*=0.5*(1+Math.cos(Math.PI*i/nf));
  return out;
}
// [midi, seconds to the next event]: a riff up the A string ending on a blue note, a rest, then the
// six open strings rung out. D♯4 on the single-coil guitar is its dead spot.
const DEMO_PHRASE=[[45,0.5],[48,0.5],[50,0.5],[52,0.5],[55,0.5],[57,1.2],[63,0.7],[64,1.5],[null,1.0],[40,1.8],[45,1.8],[50,1.8],[55,1.8],[59,1.8],[64,1.8]];
const DEMO_GUITARS={
  S:{name:"Single-coil 25.5″", rate:44100, seed:42424243, pos:0.14, pu:0.065, lp:0.85, noise:0.06, S:0.50, t20:0.60, slow:[0.25,0.25], disp:0.85, pickup:[3600,2.4], click:2,   clickAmp:0.5,  dead:{midi:63, t20:0.09}},
  H:{name:"Humbucker 24.75″",   rate:48000, seed:20260820, pos:0.14, pu:0.24,  lp:0.45, noise:0.06, S:0.62, t20:1.00, slow:[0.30,0.25], disp:0.89, pickup:[2400,1.5], click:0.8, clickAmp:0.25}
};
function demoTake(g,take){
  const rate=g.rate, rand=lcg(g.seed+take*7919), jit=()=>take>1?rand():0;
  let t=1.5; const events=[];
  for(const [midi,gap] of DEMO_PHRASE){ if(midi!=null) events.push({midi, t:t+0.02*jit(), gap}); t+=gap; }
  const total=Math.round((t+1.0)*rate), out=new Float64Array(total);
  for(const e of events){
    const f0=440*Math.pow(2,(e.midi-69)/12);
    const T=(g.dead&&g.dead.midi===e.midi)?g.dead.t20:g.t20*Math.pow(f0/110,-0.35);
    const damp=Math.pow(10,-1/(f0*T));
    const dur=e.gap+(e===events[events.length-1]?0.5:0.02), disp=1-(1-g.disp)*(f0/110); // muted before the next pluck; the last note rings out
    const nt=demoString(rate,f0,dur,{pos:g.pos*(1+0.1*jit()), pu:g.pu, lp:g.lp, noise:g.noise, S:g.S, damp, slow:g.slow, disp, click:g.click, clickAmp:g.clickAmp},rand);
    const off=Math.round(e.t*rate), amp=Math.pow(10,0.8*jit()/20)/Math.pow(f0/110,0.15);
    for(let j=0;j<nt.length&&off+j<total;j++) out[off+j]+=amp*nt[j];
  }
  const [fc,Q]=g.pickup, w=2*Math.PI*fc/rate, al=Math.sin(w)/(2*Q), c=Math.cos(w), b0=(1-c)/2, b1=1-c, b2=(1-c)/2, a0=1+al, a1=-2*c, a2=1-al;
  let x1=0,x2=0,y1=0,y2=0; for(let i=0;i<total;i++){ const v=out[i], yy=(b0*v+b1*x1+b2*x2-a1*y1-a2*y2)/a0; x2=x1; x1=v; y2=y1; y1=yy; out[i]=yy; }
  let peak=0; for(let i=0;i<total;i++){ const a=Math.abs(out[i]); if(a>peak) peak=a; }
  const gn=peak>0?0.7/peak:1, nz=Math.pow(10,-78/20)*Math.sqrt(3);
  for(let i=0;i<total;i++) out[i]=out[i]*gn+nz*rand();
  return out;
}
// ---------- end demo pair ----------

// ---- 16-bit PCM mono WAV writer ----
function writeWav(file, samples, rate) {
  const n = samples.length, dataBytes = n * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(1, 22);          // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);   // byte rate
  buf.writeUInt16LE(2, 32);          // block align
  buf.writeUInt16LE(16, 34);         // bits
  buf.write("data", 36); buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return buf;
}

const outDir = path.join(__dirname, "..", "samples");
fs.mkdirSync(outDir, { recursive: true });
const specs=[
  { file:"demo-singlecoil-44k_take1.wav", g:DEMO_GUITARS.S, take:1 },
  { file:"demo-singlecoil-44k_take2.wav", g:DEMO_GUITARS.S, take:2 },
  { file:"demo-humbucker-48k_take1.wav",  g:DEMO_GUITARS.H, take:1 },
  { file:"demo-humbucker-48k_take2.wav",  g:DEMO_GUITARS.H, take:2 },
];
for(const sp of specs){
  const s=demoTake(sp.g,sp.take);
  const buf=writeWav(path.join(outDir,sp.file),s,sp.g.rate);
  console.log(sp.file+": "+s.length+" samples @ "+sp.g.rate+" Hz, "+(s.length/sp.g.rate).toFixed(2)+" s, "+buf.length+" bytes");
}

// sanity: the app's own sniffer must read these files' rates back
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const dsp = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const modFile = path.join(require("os").tmpdir(), "guitarscope_dsp_sniff_check.js");
fs.writeFileSync(modFile, dsp + "\nmodule.exports={sniffAudioInfo};\n");
const { sniffAudioInfo } = require(modFile);
for (const sp of specs) {
  const b = fs.readFileSync(path.join(outDir, sp.file));
  const info = sniffAudioInfo(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const okRate = info && info.sampleRate === sp.g.rate && info.container === "WAV";
  console.log(`  sniff ${sp.file}: ${okRate ? "ok" : "FAIL"} → ${JSON.stringify(info)}`);
  if (!okRate) process.exit(1);
}
console.log("samples ready");
