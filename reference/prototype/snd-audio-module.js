/* ================= AUDIO (Web Audio, tanpa berkas) =================
   Acuan kenyamanan:
   - Telinga paling peka di 2-5 kHz, jadi energi SFX dijaga di bawah ~2,5 kHz dan ada penekan lembut di 3,2 kHz.
   - Serangan nada >= 4 ms supaya tidak ada klik. Semua suara lewat low-pass 9 kHz.
   - Sasaran loudness: musik sekitar -26 LUFS, campuran saat bermain sekitar -20 LUFS, puncak di bawah -1 dBFS (limiter).
   - Musik pakai laras slendro ideal (5 langkah sama, 240 sen) agar tidak meniru laras satu gamelan tertentu. */
export const Snd=(function(){
  const AC=typeof window!=="undefined"&&(window.AudioContext||window.webkitAudioContext);
  const LS="ng_audio_v1",st={music:.6,sfx:.8,amb:.6,mute:false};
  try{Object.assign(st,JSON.parse(localStorage.getItem(LS)||"{}"))}catch(e){}
  const save=()=>{try{localStorage.setItem(LS,JSON.stringify(st))}catch(e){}};
  let ctx=null,bus=null,rev=null,noise=null,tmr=0,nextT=0,beat=0,wx="cerah",duckT=0,mus=null,amb=null,last={};
  const R=Math.random,pick=a=>a[Math.floor(R()*a.length)],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const curve=v=>v*v;
  const F0=146.83,sl=k=>F0*Math.pow(2,k/5);   // slendro ideal: 5 langkah sama

  function mkNoise(c){const n=c.sampleRate*3,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<n;i++){const w=R()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}
    // sambungkan ujung agar loop mulus
    const f=2000;for(let i=0;i<f;i++){const a=i/f;d[n-f+i]=d[n-f+i]*(1-a)+d[i]*a}
    return b}
  function mkIR(c,sec){const n=Math.floor(c.sampleRate*sec),b=c.createBuffer(2,n,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const t=i/n;lp+=(( R()*2-1)-lp)*.35;d[i]=lp*Math.pow(1-t,3.2)*(t<.01?t/.01:1)}}
    return b}
  function build(c){
    ctx=c;bus={};amb=null;mus=null;
    const hp=c.createBiquadFilter();hp.type="highpass";hp.frequency.value=32;hp.Q.value=.6;
    const ear=c.createBiquadFilter();ear.type="peaking";ear.frequency.value=3200;ear.Q.value=.8;ear.gain.value=-3.5;
    const lp=c.createBiquadFilter();lp.type="lowpass";lp.frequency.value=9000;lp.Q.value=.5;
    const lim=c.createDynamicsCompressor();lim.threshold.value=-14;lim.knee.value=10;lim.ratio.value=12;lim.attack.value=.004;lim.release.value=.25;
    const trim=c.createGain();trim.gain.value=1.3;
    const master=c.createGain();master.gain.value=st.mute?0:1;
    master.connect(hp);hp.connect(ear);ear.connect(lp);lp.connect(lim);lim.connect(trim);trim.connect(c.destination);
    bus.master=master;
    ["music","sfx","amb"].forEach(k=>{const g=c.createGain();g.gain.value=curve(st[k]);g.connect(master);bus[k]=g});
    bus.mlp=c.createBiquadFilter();bus.mlp.type="lowpass";bus.mlp.frequency.value=6000;bus.mlp.Q.value=.4;
    bus.mduck=c.createGain();bus.mduck.gain.value=1;bus.mlp.connect(bus.mduck);bus.mduck.connect(bus.music);
    rev=c.createConvolver();rev.buffer=mkIR(c,2.6);const rg=c.createGain();rg.gain.value=.55;rev.connect(rg);rg.connect(bus.music);
    bus.revM=c.createGain();bus.revM.gain.value=.5;bus.revM.connect(rev);
    const rs=c.createGain();rs.gain.value=.28;rs.connect(rev);bus.revS=rs;
    noise=mkNoise(c);
  }
  const pan=(t,p,dest)=>{if(!ctx.createStereoPanner||!p)return dest;const s=ctx.createStereoPanner();s.pan.value=p;s.connect(dest);return s};
  /* nada logam lembut (metalofon): parsial tak harmonis, serangan lunak, parsial tinggi cepat hilang */
  function bell(f,t,o){o=o||{};const g0=o.g==null?.3:o.g,dec=o.dec||1.4,dest=pan(t,o.pan,o.dest||bus.sfx),rv=o.rev==null?.5:o.rev;
    const out=ctx.createGain();out.connect(dest);if(rv>0){const s=ctx.createGain();s.gain.value=rv;out.connect(s);s.connect(rev)}
    [[1,1,1],[2.76,.32,.55],[5.4,.1,.28]].forEach(([r,gv,dv])=>{const fq=f*r;if(fq>6500)return;
      const os=ctx.createOscillator(),g=ctx.createGain();os.type="sine";os.frequency.value=fq;
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(g0*gv,t+(o.att||.006));g.gain.exponentialRampToValueAtTime(.0001,t+dec*dv+.02);
      os.connect(g);g.connect(out);os.start(t);os.stop(t+dec*dv+.05)});
  }
  function tone(f,t,dur,o){o=o||{};const os=ctx.createOscillator(),g=ctx.createGain(),att=o.att||.012;os.type=o.type||"sine";os.frequency.setValueAtTime(f,t);if(o.f2)os.frequency.exponentialRampToValueAtTime(o.f2,t+dur);
    let n=os;if(o.lp){const l=ctx.createBiquadFilter();l.type="lowpass";l.frequency.value=o.lp;os.connect(l);n=l}
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.g||.2,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    n.connect(g);g.connect(pan(t,o.pan,o.dest||bus.sfx));os.start(t);os.stop(t+dur+.05)}
  function puff(t,dur,o){o=o||{};const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;s.playbackRate.value=o.rate||1;
    const f=ctx.createBiquadFilter();f.type=o.type||"bandpass";f.frequency.setValueAtTime(o.f||800,t);if(o.f2)f.frequency.exponentialRampToValueAtTime(o.f2,t+dur);f.Q.value=o.q||.8;
    const g=ctx.createGain(),att=o.att||.01;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.g||.2,t+att);if(o.hold)g.gain.setValueAtTime(o.g||.2,t+o.hold);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(pan(t,o.pan,o.dest||bus.sfx));s.start(t,R()*2);s.stop(t+dur+.05)}
  const P=(k)=>sl(k);

  /* ---------- efek suara ---------- */
  const SF={
    click:t=>{tone(520,t,.05,{g:.14,att:.004,type:"sine"})},
    dice:t=>{for(let i=0;i<8;i++){const tt=t+i*.07+R()*.02,gv=.24*(1-i/12);puff(tt,.045,{f:900+R()*700,q:2,g:gv,att:.003,pan:(R()-.5)*.4});tone(260+R()*80,tt,.05,{g:.05,att:.003})}
      puff(t+.62,.09,{f:700,q:1.6,g:.22,att:.003});tone(180,t+.62,.12,{g:.1,att:.004,f2:120})},
    step:t=>{tone(340+R()*40,t,.07,{g:.12,att:.004,f2:240});puff(t,.04,{f:800,q:1.4,g:.1,att:.003})},
    coin:t=>{bell(784,t,{g:.12,dec:.5,rev:.3});bell(1175,t+.07,{g:.09,dec:.45,rev:.3})},
    pay:t=>{for(let i=0;i<6;i++)bell(pick([660,784,880,988]),t+i*.095,{g:.08,dec:.4,rev:.3,pan:-.3+R()*.6})},
    gain:t=>{bell(784,t,{g:.11,dec:.55});bell(988,t+.09,{g:.09,dec:.55})},
    spend:t=>{tone(280,t,.18,{g:.2,att:.006,f2:200,lp:900})},
    buy:t=>{[523,659,784].forEach((f,i)=>bell(f,t+i*.08,{g:.12,dec:.7}))},
    build:t=>{for(let i=0;i<3;i++){puff(t+i*.17,.06,{f:520,q:1.6,g:.1,att:.004});tone(180,t+i*.17,.08,{g:.08,att:.004,f2:120})}bell(880,t+.56,{g:.12,dec:.9})},
    salary:t=>{[0,2,4,6,7].forEach((k,i)=>bell(sl(k+10),t+i*.1,{g:.1,dec:.9}))},
    good:t=>{[0,2,4,7].forEach((k,i)=>bell(sl(k+8),t+i*.11,{g:.12,dec:1.1}))},
    bad:t=>{tone(330,t,.55,{g:.22,att:.02,f2:240,lp:800,type:"triangle"});tone(311,t+.05,.55,{g:.18,att:.02,f2:220,lp:800,type:"triangle"})},
    jail:t=>{tone(110,t,.5,{g:.12,att:.005,f2:70});puff(t,.2,{f:420,q:1.2,g:.1,att:.004});bell(220,t+.02,{g:.1,dec:1.2,rev:.2});bell(330,t+.02,{g:.07,dec:1.0,rev:.2})},
    turn:t=>{bell(sl(9),t,{g:.1,dec:.9});bell(sl(12),t+.14,{g:.08,dec:1.1})},
    bankrupt:t=>{[0,-2,-4,-7].forEach((k,i)=>bell(sl(k+7),t+i*.28,{g:.12,dec:1.3}))},
    win:t=>{[0,2,4,6,7,9,11,14].forEach((k,i)=>bell(sl(k+4),t+i*.12,{g:.12,dec:1.4}));bell(sl(5),t+1.1,{g:.1,dec:2})},
    thunderFar:t=>{puff(t,2.8,{type:"lowpass",f:260,f2:70,q:.6,g:.28,att:.12});puff(t+.25,1.8,{type:"lowpass",f:180,q:.5,g:.18,att:.2})}
  };
  /* efek bencana, kunci sama dengan FX di tampilan */
  const FXS={
    banjir:t=>{puff(t,3.5,{type:"lowpass",f:500,f2:900,q:.5,g:.22,att:.6});for(let i=0;i<10;i++)tone(300+R()*400,t+.4+i*.28,.12,{g:.04,att:.01,f2:500+R()*300,lp:1200})},
    tsunami:t=>{puff(t,4.5,{type:"lowpass",f:260,f2:1100,q:.5,g:.3,att:1.6,hold:2.4});puff(t+2.2,2.4,{type:"lowpass",f:420,q:.5,g:.2,att:.3})},
    merapi:t=>{tone(58,t,3.2,{g:.2,att:.08,f2:40});puff(t,3.4,{type:"lowpass",f:200,q:.5,g:.2,att:.05});puff(t+.3,2.5,{type:"lowpass",f:700,f2:200,q:.5,g:.12,att:.1});for(let i=0;i<7;i++)tone(160+R()*90,t+.2+i*.28,.4,{g:.06,att:.01,f2:90,lp:600})},
    krakatau:t=>{FXS.merapi(t);tone(50,t+.2,3.5,{g:.14,att:.05,f2:34});puff(t+.1,3.6,{type:"lowpass",f:170,q:.5,g:.12,att:.04})},
    gempa:t=>{for(let i=0;i<22;i++){const tt=t+i*.17;tone(88+R()*30,tt,.2,{g:.14*(1-i/30),att:.02,f2:66});puff(tt,.18,{type:"lowpass",f:300,q:.5,g:.15*(1-i/30),att:.02})}},
    lombok:t=>{FXS.gempa(t);puff(t+1.4,2.2,{type:"lowpass",f:320,f2:90,q:.5,g:.2,att:.2})},
    kebakaran:t=>{puff(t,4,{type:"lowpass",f:900,q:.5,g:.16,att:.5,hold:2.2});for(let i=0;i<46;i++)puff(t+R()*4,.03,{f:1300+R()*900,q:1.2,g:.05+R()*.04,att:.002})},
    longsor:t=>{puff(t,3.2,{type:"lowpass",f:420,f2:120,q:.5,g:.3,att:.3});for(let i=0;i<24;i++){const tt=t+.2+i*.12+R()*.05;tone(140+R()*160,tt,.09,{g:.07,att:.004,f2:80,lp:900});puff(tt,.07,{f:500+R()*300,q:1,g:.07,att:.003})}},
    kering:t=>{puff(t,4,{f:420,q:.7,g:.08,att:1.4,hold:2.4});tone(196,t+.2,3.6,{g:.04,att:1.2,type:"triangle",lp:500})},
    puting:t=>{puff(t,4,{f:500,f2:1400,q:1.2,g:.2,att:1.4,hold:2.2});puff(t+.4,3.6,{f:350,f2:900,q:1.6,g:.14,att:1.0,hold:2})},
    meteor:t=>{puff(t,1.2,{f:1900,f2:240,q:.8,g:.14,att:.08});tone(70,t+1.0,1.8,{g:.15,att:.01,f2:40});puff(t+1.0,1.6,{type:"lowpass",f:480,f2:130,q:.5,g:.14,att:.01})},
    meteorstorm:t=>{for(let i=0;i<6;i++)FXS.meteor(t+i*.8)},
    petir:t=>{puff(t,.5,{f:2300,q:.7,g:.15,att:.002});puff(t+.05,1.2,{f:900,f2:300,q:.6,g:.2,att:.003});puff(t+.18,3.2,{type:"lowpass",f:240,f2:70,q:.5,g:.3,att:.15})},
    gaji:t=>SF.salary(t),diskon:t=>SF.good(t),thr:t=>SF.salary(t)
  };

  /* ---------- suasana (laut, hujan, angin, burung) ---------- */
  const WXA={cerah:{rain:0,wind:.02,bird:.5,lp:6500,mg:1},berawan:{rain:0,wind:.04,bird:.18,lp:5200,mg:1},hujan:{rain:.6,wind:.05,bird:0,lp:3800,mg:.9},badai:{rain:1,wind:.16,bird:0,lp:3000,mg:.75},panas:{rain:0,wind:0,bird:0,lp:6800,mg:.95},kabut:{rain:0,wind:.07,bird:0,lp:2800,mg:.85},asap:{rain:0,wind:.09,bird:0,lp:2400,mg:.8}};
  function layer(type,f,q,lfoHz,lfoDepth){const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=ctx.createGain();g.gain.value=0;
    s.connect(fl);fl.connect(g);g.connect(bus.amb);s.start();
    if(lfoHz){const o=ctx.createOscillator(),d=ctx.createGain();o.frequency.value=lfoHz;d.gain.value=lfoDepth;o.connect(d);d.connect(g.gain);o.start()}
    return {g,fl}}
  function startAmb(){
    if(amb)return;
    const sea=layer("lowpass",420,.5,.09,.025),rain=layer("lowpass",5200,.4),rainHi=layer("highpass",650,.4),wind=layer("bandpass",300,.7,.07,.02);
    sea.g.gain.value=.07;amb={sea,rain,rainHi,wind};setWeatherLevels(true);
  }
  function setWeatherLevels(now){
    if(!amb)return;const w=WXA[wx]||WXA.cerah,t=ctx.currentTime,k=now?.01:2.2;
    amb.rain.g.gain.setTargetAtTime(w.rain*.1,t,k);amb.rainHi.g.gain.setTargetAtTime(w.rain*.03,t,k);
    amb.wind.g.gain.setTargetAtTime(.02+w.wind*.35,t,k);
    if(bus.mlp)bus.mlp.frequency.setTargetAtTime(w.lp,t,k);
  }
  function bird(t){const f=2100+R()*700,n=2+Math.floor(R()*3);for(let i=0;i<n;i++)tone(f*(1+R()*.12),t+i*.13,.09,{g:.012,att:.012,f2:f*(1.1+R()*.2),dest:bus.amb,pan:R()-.5})}

  /* ---------- musik generatif bergaya gamelan ---------- */
  const BEAT=1.15;
  function startMusic(t0){
    if(mus)return;
    const mk=(f)=>{const o=ctx.createOscillator(),g=ctx.createGain(),l=ctx.createBiquadFilter();o.type="sine";o.frequency.value=f;g.gain.value=.03;l.type="lowpass";l.frequency.value=700;o.connect(g);g.connect(l);l.connect(bus.mlp);o.start();return o};
    mus={drone:[mk(F0),mk(F0*1.5*1.002)],k:0,lastK:9};
    nextT=Math.max(ctx.currentTime,t0||0)+.2;beat=0;
  }
  function musicStep(t){
    const b=beat++;const d=bus.mlp;
    const out=bus.mlp;
    if(b%16===0){bell(F0,t,{g:.2,dec:4,rev:.6,dest:out});bell(F0*2,t,{g:.1,dec:3,rev:.6,dest:out});
      const dk=pick([0,3,2,4]);mus.drone[0].frequency.setTargetAtTime(sl(dk),t,1.6);mus.drone[1].frequency.setTargetAtTime(sl(dk+3),t,1.6)}
    if(b%4===0)bell(sl(pick([5,8,10])),t,{g:.2,dec:3,rev:.7,dest:out,pan:-.2});
    if(R()<.74){let k=mus.lastK+pick([-2,-1,-1,0,1,1,2]);k=clamp(k,5,12);mus.lastK=k;bell(sl(k),t,{g:.18,dec:1.6,rev:.55,dest:out,pan:(R()-.5)*.5})}
    if(R()<.5)bell(sl(clamp(mus.lastK+5,10,17)),t+BEAT/2,{g:.07,dec:.9,rev:.5,dest:out,pan:(R()-.5)*.7});
    if(b%8===4&&R()<.4){const f=sl(pick([8,10,11,12]));const o=ctx.createOscillator(),g=ctx.createGain(),v=ctx.createOscillator(),vg=ctx.createGain();o.type="sine";o.frequency.value=f;v.frequency.value=4.8;vg.gain.value=f*.004;v.connect(vg);vg.connect(o.frequency);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.09,t+.5);g.gain.linearRampToValueAtTime(.06,t+1.6);g.gain.exponentialRampToValueAtTime(.0001,t+2.6);o.connect(g);g.connect(out);const s=ctx.createGain();s.gain.value=.6;g.connect(s);s.connect(rev);o.start(t);v.start(t);o.stop(t+2.7);v.stop(t+2.7)}
  }
  function pump(){
    if(!ctx||!mus)return;
    const lim=ctx.currentTime+.6;while(nextT<lim){musicStep(nextT);nextT+=BEAT}
    if(wx==="cerah"||wx==="berawan"){const p=(WXA[wx].bird)*.012;if(R()<p)bird(ctx.currentTime+.05)}
    if(wx==="badai"&&R()<.012){last.th=ctx.currentTime;SF.thunderFar(ctx.currentTime+.1)}
  }
  function ensure(){
    if(!AC)return false;
    if(!ctx){try{build(new AC())}catch(e){ctx=null;return false}}
    if(ctx.state==="suspended")ctx.resume();
    return true;
  }
  const api={
    st,
    get on(){return !!ctx},
    ensure,
    start(){
      if(!ensure())return;
      startAmb();startMusic();if(!tmr)tmr=setInterval(pump,150);
      if(!api._vis){api._vis=1;document.addEventListener("visibilitychange",()=>{if(!ctx)return;if(document.hidden)ctx.suspend();else ctx.resume()})}
    },
    play(name,o){
      if(!ctx||st.mute)return;if(ctx.state!=="running")return;
      const f=SF[name];if(!f)return;const now=ctx.currentTime;
      const gap={step:.11,click:.04,coin:.06}[name];if(gap){if(last[name]&&now-last[name]<gap)return;last[name]=now}
      f(now+(o&&o.delay||0)+.01);
    },
    fx(key){
      if(!ctx||st.mute||ctx.state!=="running")return;const f=FXS[key];if(!f)return;f(ctx.currentTime+.02);
      api.duck(4200);
    },
    duck(ms){
      if(!ctx||!bus)return;const t=ctx.currentTime;bus.mduck.gain.cancelScheduledValues(t);bus.mduck.gain.setTargetAtTime(.35,t,.15);bus.mduck.gain.setTargetAtTime(1,t+ms/1000,.8);
    },
    setWeather(k){wx=k;if(ctx)setWeatherLevels(false)},
    vol(k,v){st[k]=clamp(v,0,1);if(bus&&bus[k])bus[k].gain.setTargetAtTime(curve(st[k]),ctx.currentTime,.05);save()},
    mute(m){st.mute=!!m;if(bus)bus.master.gain.setTargetAtTime(st.mute?0:1,ctx.currentTime,.05);save()},
    /* untuk pengukuran: pasang ke konteks apa pun (mis. OfflineAudioContext) */
    _build:build,_SF:SF,_FXS:FXS,_startAmb:startAmb,_startMusic:startMusic,_musicStep:musicStep,_bus:()=>bus,_wx:k=>{wx=k;setWeatherLevels(true)},_beat:BEAT,_setNext:t=>{nextT=t},_renderMusic:(t0,t1)=>{nextT=t0;while(nextT<t1){musicStep(nextT);nextT+=BEAT}}
  };
  return api;
})();
