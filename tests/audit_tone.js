#!/usr/bin/env node
// Tone-panel audit (THEORY.md §7) — NOT part of the gate. Runs the shipped block-0 DSP on
// the real takes in samples/ (Les_Paul, SG, Majesty: the same riff, ending with the six
// open strings in E♭ standard) and on controlled variants, and prints every number quoted
// in docs/THEORY.md §7.4–7.5. Sections A–H: the ten shipped descriptors and what moves
// them. Sections I–J: the comb-checked f₀, inharmonicity B, per-partial decay, two-stage
// knee and the pickup-resonance hump that the reworked panel proposes.
// Usage: node tests/audit_tone.js
"use strict";
const fs=require("fs"), path=require("path"), os=require("os");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const dspSrc=blocks[0];
const modFile=path.join(os.tmpdir(),"rameau_audit_tone_dsp.js");
fs.writeFileSync(modFile,dspSrc+`
module.exports={welch,detectPeaks,noteInfo,powerToDb,smoothOct,bandPower,spectralCentroid,spectralTilt,stftBands,detectOnsets,amplitudeEnvelope,attackTimes,bandDecays,autocorrF0,harmonicProfile,
 dynamicsMetrics,shortTermRms,percentile,noteInfo,midiToFreq,decimateEnvelope};`);
const D=require(modFile);

// ---- WAV reader (PCM 16/24/32-int, float32; mono or first channel) ----
function readWav(file){
  const b=fs.readFileSync(file);
  let p=12, fmt=null, data=null;
  while(p+8<=b.length){
    const id=b.toString("ascii",p,p+4), sz=b.readUInt32LE(p+4);
    if(id==="fmt "){ fmt={tag:b.readUInt16LE(p+8),ch:b.readUInt16LE(p+10),rate:b.readUInt32LE(p+12),bits:b.readUInt16LE(p+22)}; }
    if(id==="data"){ data=b.subarray(p+8,p+8+sz); break; }
    p+=8+sz+(sz&1);
  }
  const {ch,rate,bits,tag}=fmt, bps=bits/8, frames=Math.floor(data.length/(bps*ch));
  const x=new Float32Array(frames);
  for(let i=0;i<frames;i++){
    const o=i*bps*ch;
    let v;
    if(tag===3) v=data.readFloatLE(o);
    else if(bits===16) v=data.readInt16LE(o)/32768;
    else if(bits===24) v=((data[o]|(data[o+1]<<8)|(data[o+2]<<16))<<8>>8)/8388608;
    else v=data.readInt32LE(o)/2147483648;
    x[i]=v;
  }
  return {x,rate};
}

// ---- replicate block-4 computeTimeMetrics + computeSpectralExtras ----
async function metrics(x,rate){
  const m={};
  const {power,df}=await D.welch(x,rate,8192,4096,null);
  m.centroid=D.spectralCentroid(power,df,60,20000);
  m.tilt=D.spectralTilt(power,df);
  const tot=Math.max(D.bandPower(power,df,60,20000),1e-30);
  m.warmth=D.bandPower(power,df,200,500)/tot;
  m.fullness=D.bandPower(power,df,60,200)/tot;
  const dyn=D.dynamicsMetrics(x,rate);
  m.dr=dyn.dr; m.noiseFloor=dyn.noiseFloor; m.snr=dyn.snr; m.clipCount=dyn.clipCount;
  const sb=D.stftBands(x,rate,[[60,200],[200,1200],[2000,6000]]);
  const onsets=D.detectOnsets(sb.flux,sb.frameRate);
  m.onsets=onsets.length;
  const {env,envRate}=D.amplitudeEnvelope(x,rate);
  const times=onsets.map(fi=>fi/sb.frameRate);
  m.attack=D.attackTimes(env,envRate,times);
  const dec=D.bandDecays(sb.bandP,sb.frameRate,onsets);
  m.tight=dec[0]; m.sustain=dec[1]; m.hiDecay=dec[2];
  let bestGap=0,bestT=-1;
  for(let k=0;k<times.length;k++){ const end=(k+1<times.length)?times[k+1]:x.length/rate; const gap=end-times[k]; if(gap>bestGap){bestGap=gap;bestT=times[k];} }
  let segStart=-1,segLen=0;
  if(bestGap>=0.35&&bestT>=0){ segStart=Math.round((bestT+0.05)*rate); segLen=Math.min(Math.round((bestGap-0.05)*rate),x.length-segStart); }
  else { const rms=D.shortTermRms(x,rate); let bi=0; for(let k=1;k<rms.length;k++) if(rms[k]>rms[bi]) bi=k; segStart=Math.round(bi*0.025*rate); segLen=Math.min(Math.round(1.0*rate),x.length-segStart); }
  m.segStart=segStart/rate; m.segLen=segLen/rate;
  m.f0=null;m.f0Conf=null;m.richness=null;m.evenOdd=null;
  if(segLen>2048&&segStart>=0){
    const f0win=Math.min(8192,segLen), f0start=segStart+Math.max(0,Math.round((segLen-f0win)/2));
    const f0r=D.autocorrF0(x,rate,f0start,f0win);
    if(f0r){ m.f0=f0r.f0; m.f0Conf=f0r.conf;
      const hp=await D.harmonicProfile(x,rate,segStart,segLen,f0r.f0);
      if(hp){ m.richness=hp.richness; m.evenOdd=hp.evenOdd; m.hp=hp.harmonics; }
      // octave-guard probes: harmonic profile under f0/2 and 2*f0 hypotheses
      m.alt={};
      for(const [k,f] of [["half",f0r.f0/2],["dbl",f0r.f0*2]]){
        const h=await D.harmonicProfile(x,rate,segStart,segLen,f);
        if(h) m.alt[k]={richness:h.richness,evenOdd:h.evenOdd,hp:h.harmonics};
      }
    }
  }
  m.power=power; m.df=df;
  return m;
}
const KEYS=["centroid","warmth","fullness","tilt","richness","evenOdd","attack","tight","sustain","dr"];
const fmt=(k,v)=>{ if(v==null||!isFinite(v)) return "   —  ";
  if(k==="centroid") return v.toFixed(0).padStart(6);
  if(k==="warmth"||k==="fullness") return (v*100).toFixed(1).padStart(5)+"%";
  if(k==="attack"||k==="tight"||k==="sustain") return (v*1000).toFixed(0).padStart(5)+"ms";
  return v.toFixed(1).padStart(6); };
function row(name,m){ return name.padEnd(22)+KEYS.map(k=>fmt(k,m[k])).join(" ")+"  f0="+(m.f0?m.f0.toFixed(1)+"("+m.f0Conf.toFixed(2)+")":"—")+" on="+m.onsets; }
function header(){ return "".padEnd(22)+KEYS.map(k=>k.slice(0,6).padStart(6)).join(" "); }

// ---- variants ----
function scale(x,g){ const y=new Float32Array(x.length); for(let i=0;i<x.length;i++) y[i]=x[i]*g; return y; }
function resample(x,ratio){ // ratio>1 => pitch up (shorter). cubic Hermite.
  const n=Math.floor(x.length/ratio), y=new Float32Array(n);
  for(let i=0;i<n;i++){ const t=i*ratio, k=Math.floor(t), f=t-k;
    const p0=x[Math.max(0,k-1)],p1=x[k],p2=x[Math.min(x.length-1,k+1)],p3=x[Math.min(x.length-1,k+2)];
    y[i]=p1+0.5*f*(p2-p0+f*(2*p0-5*p1+4*p2-p3+f*(3*(p1-p2)+p3-p0))); }
  return y;
}
function slice(x,rate,t0,t1){ return x.subarray(Math.round(t0*rate),Math.round(t1*rate)); }
function addNoise(x,dbfs,seed){ let s=seed>>>0; const a=Math.pow(10,dbfs/20)*Math.SQRT2; const y=new Float32Array(x.length);
  for(let i=0;i<x.length;i++){ s=(Math.imul(s,1664525)+1013904223)>>>0; y[i]=x[i]+a*(s/2147483648-1); } return y; }
// pluck/pickup comb: ideal string plucked at fraction p → partial n weighted sin(nπp)/n² ; pickup at q senses sin(nπq).
function pluckTone(rate,f0,dur,p,q,B){
  const n=Math.round(dur*rate), y=new Float32Array(n);
  for(let h=1;h<=40;h++){
    const fh=h*f0*Math.sqrt(1+(B||0)*h*h); if(fh>=rate/2) break;
    const a=Math.abs(Math.sin(h*Math.PI*p))/(h*h)*(q!=null?Math.abs(Math.sin(h*Math.PI*q)):1);
    const tau=1.2/Math.pow(h,0.7); // higher partials die faster
    for(let i=0;i<n;i++){ const t=i/rate; y[i]+=a*Math.exp(-t/tau)*Math.sin(2*Math.PI*fh*t); }
  }
  let pk=0; for(let i=0;i<n;i++) pk=Math.max(pk,Math.abs(y[i])); for(let i=0;i<n;i++) y[i]*=0.5/pk;
  return y;
}
function phrase(rate,notes,p,q,B){ // 0.12 s lead, notes 0.6 s apart, last rings 2.3 s
  const lead=0.12, gap=0.6, total=Math.round((lead+gap*notes.length+2.3)*rate), out=new Float32Array(total);
  notes.forEach((f,i)=>{ const t=pluckTone(rate,f,i===notes.length-1?2.3:gap+0.3,p,q,B); const off=Math.round((lead+i*gap)*rate);
    for(let j=0;j<t.length&&off+j<total;j++) out[off+j]+=t[j]; });
  return out;
}

function teeth(power,df,f,H){ const out=[];
  for(let h=1;h<=H;h++){ const fc=h*f; if(fc>=power.length*df) break;
    const lo=Math.max(1,Math.floor(fc*0.965/df)),hi=Math.min(power.length-1,Math.ceil(fc*1.035/df));
    let pk=0; for(let k=lo;k<=hi;k++) if(power[k]>pk) pk=power[k];
    const fhi=Math.min(power.length-1,Math.floor((h+1)*f*0.965/df)); let fl=Infinity; for(let k=hi;k<=fhi;k++) if(power[k]<fl) fl=power[k];
    out.push({h,db:D.powerToDb(pk),floorDb:isFinite(fl)?D.powerToDb(fl):null}); }
  return out; }
function guard(power,df,f0){ // never below the autocorrelation pick; lowest passing of ×1,×2,×3
  for(const k of [1,2,3]){ const t=teeth(power,df,f0*k,8); const top=Math.max(...t.slice(0,6).map(o=>o.db));
    const pres=t.map(o=>o.floorDb!=null&&o.db-o.floorDb>=10&&o.db>=top-30); if(pres.slice(0,6).every(Boolean)) return {k,f:f0*k,frac:pres.filter(Boolean).length/t.length}; }
  return null; }
function fitB(power,df,f,H){ let B=0,f0=f; const used=[];
  for(let h=1;h<=H;h++){ const fc=h*f0*Math.sqrt(1+B*h*h); if(fc>=power.length*df) break;
    const lo=Math.max(2,Math.floor(fc*0.988/df)),hi=Math.min(power.length-2,Math.ceil(fc*1.012/df)); let pk=0,pi=lo; for(let k=lo;k<=hi;k++) if(power[k]>pk){pk=power[k];pi=k;}
    if(pi<=lo||pi>=hi) continue; const fhi=Math.min(power.length-1,Math.floor((h+1)*f0*0.965/df)); let fl=Infinity; for(let k=hi;k<=fhi;k++) if(power[k]<fl) fl=power[k];
    if(isFinite(fl)&&D.powerToDb(pk)-D.powerToDb(fl)<8) continue;
    const y0=D.powerToDb(power[pi-1]),y1=D.powerToDb(power[pi]),y2=D.powerToDb(power[pi+1]); const den=y0-2*y1+y2; const d=den!==0?Math.max(-.5,Math.min(.5,0.5*(y0-y2)/den)):0;
    used.push({h,fh:(pi+d)*df});
    if(used.length>=3){ let sx=0,sy=0,sxx=0,sxy=0,n=used.length; for(const u of used){ const X=u.h*u.h,Y=Math.pow(u.fh/u.h,2); sx+=X;sy+=Y;sxx+=X*X;sxy+=X*Y; }
      const sl=(n*sxy-sx*sy)/(n*sxx-sx*sx), ic=(sy-sl*sx)/n; if(ic>0){ f0=Math.sqrt(ic); B=Math.max(0,sl/ic); } } }
  const res=used.map(u=>1200*Math.log2(u.fh/(u.h*f0*Math.sqrt(1+B*u.h*u.h)))); const rms=Math.sqrt(res.reduce((s,r)=>s+r*r,0)/Math.max(1,res.length));
  return {B,f0,n:used.length,rmsCents:rms,hmax:used.length?used[used.length-1].h:0}; }
function track(x,rate,start,frames,N,hop,fc){ const win=new Float64Array(N); for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N); const df=rate/N, tr=new Float64Array(frames);
  for(let fr=0;fr<frames;fr++){ const off=start+fr*hop; if(off+N>x.length) break; let best=0; for(const fb of [fc-df,fc,fc+df]){ const w=2*Math.PI*fb/rate,c=2*Math.cos(w); let s0=0,s1=0,s2=0;
      for(let i=0;i<N;i++){ s0=x[off+i]*win[i]+c*s1-s2; s2=s1; s1=s0; } const p=s1*s1+s2*s2-c*s1*s2; if(p>best) best=p; } tr[fr]=best; } return tr; }
function t20(tr,hop,rate){ let ip=0; for(let i=1;i<Math.min(tr.length,8);i++) if(tr[i]>tr[ip]) ip=i; const pv=tr[ip]; if(pv<=0) return null;
  let sx=0,sy=0,sxx=0,sxy=0,n=0,last=0; for(let i=ip;i<tr.length;i++){ const rel=10*Math.log10(Math.max(tr[i]/pv,1e-9)); if(rel<-25) break; const t=(i-ip)*hop/rate; sx+=t;sy+=rel;sxx+=t*t;sxy+=t*rel;n++; last=rel; }
  if(n<6||last>-6) return null; const sl=(n*sxy-sx*sy)/(n*sxx-sx*sx); return sl<-1?20/(-sl):null; }
function twoStage(x,rate,st,span){ const w=Math.round(0.01*rate), n=Math.min(Math.floor((x.length-st)/w),Math.round(span/0.01)); if(n<20) return null;
  const e=new Float64Array(n); for(let i=0;i<n;i++){ let s=0; for(let j=0;j<w;j++){ const v=x[st+i*w+j]; s+=v*v; } e[i]=10*Math.log10(Math.max(s/w,1e-12)); }
  let ip=0; for(let i=1;i<Math.min(n,10);i++) if(e[i]>e[ip]) ip=i; const pts=[]; for(let i=ip;i<n;i++){ if(e[i]<e[ip]-30) break; pts.push([(i-ip)*0.01,e[i]-e[ip]]); } if(pts.length<12) return null;
  const fit=(a,b)=>{ let sx=0,sy=0,sxx=0,sxy=0,m=0; for(let i=a;i<b;i++){ const [t,y]=pts[i]; sx+=t;sy+=y;sxx+=t*t;sxy+=t*y;m++; } const sl=(m*sxy-sx*sy)/(m*sxx-sx*sx), ic=(sy-sl*sx)/m; let ss=0; for(let i=a;i<b;i++){ const r=pts[i][1]-(sl*pts[i][0]+ic); ss+=r*r; } return {sl,ic,ss}; };
  const one=fit(0,pts.length); let best=null; for(let k=4;k<pts.length-4;k++){ const a=fit(0,k),b=fit(k,pts.length); const ss=a.ss+b.ss; if(!best||ss<best.ss) best={ss,early:a.sl,late:b.sl,knee:pts[k][0]}; }
  return {early:best.early,late:best.late,knee:best.knee,expl:1-best.ss/one.ss}; }
// attack-transient spectrum: centroid of the first 10 ms after the onset vs. 300–500 ms later (steady)
async function attackSpectrum(x,rate,st){ const N=Math.round(0.01*rate); const a=x.subarray(st,st+N), s=x.subarray(st+Math.round(0.3*rate),st+Math.round(0.5*rate));
  const wa=await D.welch(a,rate,512,256,null), ws=await D.welch(s,rate,2048,1024,null);
  return {atk:D.spectralCentroid(wa.power,wa.df,60,20000), steady:D.spectralCentroid(ws.power,ws.df,60,20000)}; }

const ONSETS={Les_Paul:[22.8,28.4,32.5,37.4,42.5,47.5],SG:[17.8,21.2,25.1,29.4,33.8,38.5],Majesty:[19.0,24.0,31.0,35.9,41.1,47.0]};
(async()=>{
  const takes={};
  for(const n of ["Les_Paul","SG","Majesty"]){ takes[n]=readWav(path.join(ROOT,"samples",n+".wav")); }
  const R={};
  console.log("\n=== A. Full takes ===\n"+header());
  for(const n in takes){ R[n]=await metrics(takes[n].x,takes[n].rate); console.log(row(n,R[n])); }
  for(const n in takes){ const m=R[n]; console.log(n,"seg",m.segStart.toFixed(2)+"s len",m.segLen.toFixed(2)+"s f0",m.f0&&m.f0.toFixed(2),"conf",m.f0Conf&&m.f0Conf.toFixed(3),
    "\n   harmonics(dB rel h1):",m.hp&&m.hp.map(h=>h.h+":"+(10*Math.log10(h.p/m.hp[0].p)).toFixed(1)).join(" "),
    "\n   alt half:",m.alt&&m.alt.half&&("rich "+m.alt.half.richness.toFixed(1)+" eo "+(m.alt.half.evenOdd==null?"—":m.alt.half.evenOdd.toFixed(1))),
    " alt dbl:",m.alt&&m.alt.dbl&&("rich "+m.alt.dbl.richness.toFixed(1)+" eo "+(m.alt.dbl.evenOdd==null?"—":m.alt.dbl.evenOdd.toFixed(1)))); }

  console.log("\n=== B. Within-take quarters (same guitar, different phrase material) ===\n"+header());
  const Q={};
  for(const n in takes){ const {x,rate}=takes[n]; const T=x.length/rate; Q[n]=[];
    for(let q=0;q<4;q++){ const m=await metrics(slice(x,rate,q*T/4,(q+1)*T/4),rate); Q[n].push(m); console.log(row(n+" q"+(q+1),m)); } }
  // within vs between spread
  console.log("\n--- spread: within-guitar SD (pooled over quarters) vs between-guitar SD (of full-take values); log-domain for ratio-like keys ---");
  const logKeys={centroid:1,attack:1,tight:1,sustain:1};
  const sd=a=>{ const v=a.filter(x=>x!=null&&isFinite(x)); if(v.length<2) return null; const mu=v.reduce((s,x)=>s+x,0)/v.length; return Math.sqrt(v.reduce((s,x)=>s+(x-mu)**2,0)/(v.length-1)); };
  for(const k of KEYS){ const tr=v=>v==null?null:(logKeys[k]?Math.log2(v):v);
    const within=[]; for(const n in Q){ const s=sd(Q[n].map(m=>tr(m[k]))); if(s!=null) within.push(s*s); }
    const w=within.length?Math.sqrt(within.reduce((a,b)=>a+b,0)/within.length):null;
    const b=sd(Object.values(R).map(m=>tr(m[k])));
    console.log(k.padEnd(10),"within",w==null?"—":w.toFixed(3).padStart(7),"between",b==null?"—":b.toFixed(3).padStart(7),"ratio between/within",(w&&b)?(b/w).toFixed(2):"—",logKeys[k]?"(octaves / log2 units)":"");
  }

  console.log("\n=== C. Level: −12 dB gain, and −12 dB with added noise at −60 dBFS ===\n"+header());
  for(const n of ["Les_Paul","SG"]){ const {x,rate}=takes[n];
    console.log(row(n+" 0dB",R[n]));
    console.log(row(n+" -12dB",await metrics(scale(x,0.25),rate)));
    console.log(row(n+" -12dB+noise",await metrics(addNoise(scale(x,0.25),-60,7),rate)));
  }

  console.log("\n=== D. Transposition by resampling (a fifth up ×1.498, a fourth down ×0.749 — tempo moves too, stated) ===\n"+header());
  for(const n of ["Les_Paul","SG"]){ const {x,rate}=takes[n];
    console.log(row(n+" as is",R[n]));
    console.log(row(n+" +7 st",await metrics(resample(x,Math.pow(2,7/12)),rate)));
    console.log(row(n+" -5 st",await metrics(resample(x,Math.pow(2,-5/12)),rate)));
  }

  console.log("\n=== E. Pluck position (ideal string model, same 'guitar' — E2 A2 D3 G3 B3 E4 phrase) ===\n"+header());
  const notes=[82.41,110,146.83,196,246.94,329.63];
  for(const p of [0.08,0.15,0.25,0.333,0.5]){ const m=await metrics(phrase(48000,notes,p,null,0),48000); console.log(row("pluck at L×"+p,m)); }
  console.log("--- pickup position (pluck fixed at 0.15): bridge ~L/14 vs neck ~L/4 ---");
  for(const q of [1/14,1/7,0.25]){ const m=await metrics(phrase(48000,notes,0.15,q,0),48000); console.log(row("pickup at L×"+q.toFixed(3),m)); }
  console.log("--- inharmonicity B on the same model (pluck 0.15, no pickup): does harmonicProfile's ±3.5 % window hold? ---");
  for(const B of [0,1e-4,5e-4,2e-3]){ const m=await metrics(phrase(48000,notes,0.15,null,B),48000); console.log(row("B="+B,m)); }

  console.log("\n=== F. Note density: same LP take, every other onset region removed vs. as is (sparser) — and the demo pair ===");
  console.log(header());
  { const {x,rate}=takes.Les_Paul; // sparse: keep first 22 s only (fewer onsets) vs. full
    console.log(row("LP first 15 s",await metrics(slice(x,rate,0,15),rate)));
    console.log(row("LP first 30 s",await metrics(slice(x,rate,0,30),rate)));
    console.log(row("LP full",R.Les_Paul)); }

  console.log("\n=== G. Tilt vs centroid correlation across every segment measured above ===");
  const pts=[]; for(const n in Q) for(const m of Q[n]) pts.push([Math.log2(m.centroid),m.tilt]); for(const n in R) pts.push([Math.log2(R[n].centroid),R[n].tilt]);
  { const n=pts.length, mx=pts.reduce((s,p)=>s+p[0],0)/n, my=pts.reduce((s,p)=>s+p[1],0)/n;
    let sxy=0,sxx=0,syy=0; for(const [a,b] of pts){ sxy+=(a-mx)*(b-my); sxx+=(a-mx)**2; syy+=(b-my)**2; }
    console.log("n="+n+"  Pearson r(log2 centroid, tilt) = "+(sxy/Math.sqrt(sxx*syy)).toFixed(3)); }

  console.log("\n=== H. LTAS peaks 1.5–8 kHz (pickup-resonance candidates) and 70–260 Hz ===");
  for(const n in R){ const m=R[n]; const p6=D.smoothOct(m.power,m.df,6); const db=new Float64Array(p6.length); for(let k=0;k<db.length;k++) db[k]=D.powerToDb(p6[k]);
    const hi=D.detectPeaks(db,m.df,{fmin:1500,fmax:8000,minProm:3,maxCount:4,minDistOct:1/6});
    const lo=D.detectPeaks(db,m.df,{fmin:70,fmax:260,minProm:3,maxCount:4,minDistOct:1/12});
    console.log(n.padEnd(10),"hi:",hi.map(p=>p.f.toFixed(0)+"Hz("+p.prom.toFixed(1)+"dB)").join(" "),"  lo:",lo.map(p=>p.f.toFixed(0)+"Hz("+p.prom.toFixed(1)+"dB)").join(" ")); }

  console.log("\n=== I. Per-note map (every onset followed by ≥0.45 s): comb-checked f0, B, T20 of the fundamental; pickup hump ===");
  for(const name in takes){ const {x,rate}=takes[name];
    const sb=D.stftBands(x,rate,[[60,200],[200,1200],[2000,6000]]); const times=D.detectOnsets(sb.flux,sb.frameRate).map(fi=>fi/sb.frameRate);
    console.log("\n##",name,"onsets",times.length); const notes=[];
    for(let k=0;k<times.length;k++){ const end=(k+1<times.length?times[k+1]:x.length/rate), gap=end-times[k]; if(gap<0.45) continue;
      const s0=Math.round((times[k]+0.05)*rate), sl=Math.min(Math.round((gap-0.05)*rate),x.length-s0); const N=sl>=8192?4096:2048; if(sl<N*2) continue;
      const r=D.autocorrF0(x,rate,s0+Math.max(0,(sl-8192)>>1),Math.min(8192,sl)); if(!r) continue;
      const w=await D.welch(x.subarray(s0,s0+sl),rate,N,N>>1,null); const g=guard(w.power,w.df,r.f0); if(!g) continue;
      const bf=fitB(w.power,w.df,g.f,12); const st=Math.max(0,Math.round((times[k]-0.01)*rate)); const frames=Math.floor(Math.min(gap,6)*rate/512);
      const T=t20(track(x,rate,st,frames,4096,512,bf.f0),512,rate);
      notes.push({t:times[k],gap,raw:r.f0,conf:r.conf,f0:bf.f0,fix:g.k,note:D.noteInfo(bf.f0,440).name,B:bf.B,nB:bf.n,T20:T}); }
    console.log("  t(s)   gap   raw f0   fix  f0     note   conf  B        T20(h1)");
    for(const n of notes) console.log("  "+n.t.toFixed(1).padStart(5),n.gap.toFixed(2).padStart(5),n.raw.toFixed(1).padStart(7),("×"+n.fix).padStart(4),n.f0.toFixed(1).padStart(7),n.note.padEnd(5),n.conf.toFixed(2),n.B.toExponential(1).padStart(8),n.T20==null?"   —":n.T20.toFixed(2).padStart(5)+"s");
    const fixed=notes.filter(n=>n.fix!==1).length; console.log("  → "+notes.length+" notes; the comb check raised the pitch on "+fixed+" ("+(notes.length?(100*fixed/notes.length).toFixed(0):0)+" %)");
    // ---- pickup resonance hump: LTAS (1/3-oct smoothed) minus the tilt line, 800 Hz–8 kHz ----
    const power=R[name].power, df=R[name].df; const tilt=R[name].tilt;
    const sm=D.smoothOct(power,df,3); const pts=[]; for(let f=800;f<=8000;f*=Math.pow(2,1/24)){ const k=Math.round(f/df); pts.push([f,D.powerToDb(sm[k])]); }
    // reference line: OLS over the window itself (so the hump is relative to the local trend)
    let sx=0,sy=0,sxx=0,sxy=0,n=pts.length; for(const [f,y] of pts){ const X=Math.log2(f); sx+=X;sy+=y;sxx+=X*X;sxy+=X*y; } const sl=(n*sxy-sx*sy)/(n*sxx-sx*sx), ic=(sy-sl*sx)/n;
    const res=pts.map(([f,y])=>[f,y-(sl*Math.log2(f)+ic)]); let bi=0; for(let i=1;i<res.length;i++) if(res[i][1]>res[bi][1]) bi=i;
    let lo=bi,hi=bi; while(lo>0&&res[lo][1]>res[bi][1]-3) lo--; while(hi<res.length-1&&res[hi][1]>res[bi][1]-3) hi++;
    console.log("  LTAS hump over local trend ("+sl.toFixed(1)+" dB/oct in window; global tilt "+tilt.toFixed(1)+"): peak "+res[bi][0].toFixed(0)+" Hz, +"+res[bi][1].toFixed(1)+" dB, −3 dB width "+res[lo][0].toFixed(0)+"–"+res[hi][0].toFixed(0)+" Hz → Q≈"+(res[bi][0]/(res[hi][0]-res[lo][0])).toFixed(1));
  }

  console.log("\n=== J. The six open-string plucks, per guitar: B (residual), per-partial T20, two-stage knee, attack-transient centroid ===");
  const all={};
  for(const name of Object.keys(ONSETS)){ const {x,rate}=takes[name];
    const sb=D.stftBands(x,rate,[[60,200],[200,1200],[2000,6000]]); const times=D.detectOnsets(sb.flux,sb.frameRate).map(fi=>fi/sb.frameRate);
    console.log("\n##",name); all[name]=[];
    for(const t0 of ONSETS[name]){ const t=times.reduce((b,v)=>Math.abs(v-t0)<Math.abs(b-t0)?v:b,times[0]); const k=times.indexOf(t); const gap=(k+1<times.length?times[k+1]:x.length/rate)-t;
      const s0=Math.round((t+0.05)*rate), sl=Math.min(Math.round((gap-0.05)*rate),x.length-s0); const w=await D.welch(x.subarray(s0,s0+sl),rate,8192,4096,null);
      const r=D.autocorrF0(x,rate,s0+Math.max(0,(sl-8192)>>1),Math.min(8192,sl)); const g=r?guard(w.power,w.df,r.f0):null; if(!g){ console.log("  @"+t.toFixed(1)+" no pitch"); continue; }
      const bf=fitB(w.power,w.df,g.f,14); const st=Math.max(0,Math.round((t-0.01)*rate)); const frames=Math.floor(Math.min(gap,6)*rate/512);
      const T=[]; for(let h=1;h<=8;h++){ const fc=h*bf.f0*Math.sqrt(1+bf.B*h*h); if(fc>rate/2) break; T.push(t20(track(x,rate,st,frames,4096,512,fc),512,rate)); }
      const ts=twoStage(x,rate,st,Math.min(gap,6)); const as=await attackSpectrum(x,rate,st);
      const rec={note:D.noteInfo(bf.f0,440).name,f0:bf.f0,fix:g.k,conf:r.conf,B:bf.B,rms:bf.rmsCents,nB:bf.n,hmax:bf.hmax,T,ts,as,gap};
      all[name].push(rec);
      console.log("  "+rec.note.padEnd(4)+bf.f0.toFixed(1).padStart(6)+" ×"+g.k+" conf "+r.conf.toFixed(2)+" gap "+gap.toFixed(1)+"s  B="+bf.B.toExponential(2)+" (n="+bf.n+", hmax "+bf.hmax+", rms "+bf.rmsCents.toFixed(1)+"¢)  T20 h1-8: "+T.map(v=>v==null?"—":v.toFixed(1)).join(" ")+
        "  knee "+(ts?ts.knee.toFixed(2)+"s early "+ts.early.toFixed(1)+" late "+ts.late.toFixed(1)+" dB/s (R² gain "+ts.expl.toFixed(2)+")":"—")+"  atk-centroid "+as.atk.toFixed(0)+" vs steady "+as.steady.toFixed(0)); }
  }
  console.log("\n=== per-string side by side (B ×1e-4 | T20 h1 / h2 / h3 s | knee s) ===");
  const names=Object.keys(all); const strings=["D♯2","G♯2","C♯3","F♯3","A♯3","D♯4"];
  for(const s of strings){ let line=s.padEnd(6); for(const n of names){ const r=all[n].find(q=>q.note===s); line+=(n.slice(0,7)+": "+(r?(r.B*1e4).toFixed(2)+" | "+[0,1,2].map(i=>r.T[i]==null?"—":r.T[i].toFixed(1)).join("/")+" | "+(r.ts?r.ts.knee.toFixed(2):"—"):"—")).padEnd(34); } console.log(line); }
})();
