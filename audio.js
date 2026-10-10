// ═══════════════════════════════════════════════════════════════
// audio.js — Web Audio Engine, Sounds, Musik
// ═══════════════════════════════════════════════════════════════
// ── AUDIO ENGINE ─────────────────────────────────────────────
let audioCtx=null,musicPlaying=false,musicInterval=null,musicStep=0,musicTempo=1.0;
let lastSndShoot=0,lastSndImpact=0;
let masterSfxGain=null,masterMusicGain=null;
let sfxVol=0.8,musicVol=0.6; // 0..1

function getAudio(){
  if(!audioCtx){
    try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
    masterSfxGain=audioCtx.createGain();masterSfxGain.gain.value=sfxVol;masterSfxGain.connect(audioCtx.destination);
    masterMusicGain=audioCtx.createGain();masterMusicGain.gain.value=musicVol;masterMusicGain.connect(audioCtx.destination);
  }
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function playTone(freq,type,vol,atk,decay,pitch2,dur,isMusic=false){
  const a=getAudio();if(!a)return;
  const g=a.createGain(),o=a.createOscillator();
  o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);
  if(pitch2!==undefined)o.frequency.exponentialRampToValueAtTime(pitch2,a.currentTime+dur*0.8);
  g.gain.setValueAtTime(0,a.currentTime);
  g.gain.linearRampToValueAtTime(vol,a.currentTime+atk);
  g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+atk+decay);
  const dest=isMusic&&masterMusicGain?masterMusicGain:masterSfxGain||a.destination;
  o.connect(g);g.connect(dest);
  o.start(a.currentTime);o.stop(a.currentTime+atk+decay+0.05);
}
function playNoise(vol,atk,decay,loFreq,hiFreq,isMusic=false){
  const a=getAudio();if(!a)return;
  const bufLen=Math.min(Math.floor(a.sampleRate*decay),a.sampleRate*0.3);
  const buf=a.createBuffer(1,bufLen,a.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  const src2=a.createBufferSource(),filt=a.createBiquadFilter(),g=a.createGain();
  src2.buffer=buf;filt.type='bandpass';filt.frequency.value=(loFreq+hiFreq)/2;filt.Q.value=0.8;
  g.gain.setValueAtTime(vol,a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+decay);
  const dest=isMusic&&masterMusicGain?masterMusicGain:masterSfxGain||a.destination;
  src2.connect(filt);filt.connect(g);g.connect(dest);
  src2.start();src2.stop(a.currentTime+decay);
}
function sndShoot(isShotgun,isPlasma){
  const now=Date.now();if(now-lastSndShoot<50)return;lastSndShoot=now;
  if(isShotgun){playNoise(0.38,0.001,0.13,150,1000);playTone(110,'sawtooth',0.22,0.001,0.09,55,0.10);}
  else if(isPlasma){playTone(240,'sawtooth',0.28,0.001,0.20,70,0.20);playTone(480,'sine',0.14,0.001,0.15,100,0.15);}
  else{playTone(920,'square',0.22,0.001,0.07,200,0.07);playNoise(0.10,0.001,0.04,1500,4000);}
}
function sndImpact(isAoe){
  const now=Date.now();if(!isAoe&&now-lastSndImpact<40)return;lastSndImpact=now;
  if(isAoe){
    playNoise(0.55,0.001,0.30,60,350);playTone(45,'sawtooth',0.35,0.001,0.25,22,0.25);
    playNoise(0.20,0.001,0.10,800,2500);
  } else {
    playNoise(0.32,0.001,0.06,400,2000);
    playTone(600,'square',0.14,0.001,0.04,150,0.04);
  }
}
function sndHurt(){playTone(120,'sawtooth',0.16,0.001,0.13,60,0.13);playNoise(0.12,0.001,0.1,100,500);}
function sndKill(isElite){
  playNoise(isElite?0.55:0.30,0.001,isElite?0.35:0.22,isElite?50:100,isElite?250:700);
  if(isElite){playTone(35,'sawtooth',0.35,0.001,0.32,18,0.32);playNoise(0.25,0.001,0.18,1000,4000);}
  else{playTone(180,'square',0.15,0.001,0.10,80,0.10);}
}
function sndOverheat(){playTone(400,'sawtooth',0.1,0.001,0.35,200,0.35);}
function sndThunder(intensity){
  // Donner: Noise durch tiefen Bandpass gefiltert + Sub-Rumble
  const a=getAudio();if(!a)return;
  // Rumble-Noise (0.6–1.2s)
  const dur=0.6+Math.random()*0.6;
  const bufLen=Math.min(Math.floor(a.sampleRate*dur),a.sampleRate);
  const buf=a.createBuffer(1,bufLen,a.sampleRate);
  const d=buf.getChannelData(0);
  // Pinker Noise approximation
  let b0=0,b1=0,b2=0;
  for(let i=0;i<d.length;i++){
    const white=Math.random()*2-1;
    b0=0.99886*b0+white*0.0555179;b1=0.99332*b1+white*0.0750759;b2=0.96900*b2+white*0.1538520;
    d[i]=(b0+b1+b2+white*0.5362)*0.11;
  }
  const src2=a.createBufferSource();src2.buffer=buf;
  // Tiefer Lowpass für Donner-Charakter
  const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=280+Math.random()*120;lp.Q.value=0.7;
  // Envelope: kurzer Attack, langer Decay mit Rumble
  const g=a.createGain();
  const vol=0.45*intensity*(masterSfxGain?1:1);
  g.gain.setValueAtTime(0,a.currentTime);
  g.gain.linearRampToValueAtTime(vol,a.currentTime+0.04);
  g.gain.exponentialRampToValueAtTime(vol*0.4,a.currentTime+0.2);
  g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur);
  const dest=masterSfxGain||a.destination;
  src2.connect(lp);lp.connect(g);g.connect(dest);
  src2.start();src2.stop(a.currentTime+dur+0.05);
  // Sub-Rumble: sehr tiefer Sine-Oscillator
  const osc=a.createOscillator();osc.type='sine';
  osc.frequency.setValueAtTime(38+Math.random()*18,a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(22,a.currentTime+dur*0.8);
  const g2=a.createGain();
  g2.gain.setValueAtTime(0,a.currentTime);
  g2.gain.linearRampToValueAtTime(0.18*intensity,a.currentTime+0.06);
  g2.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur*0.9);
  osc.connect(g2);g2.connect(dest);
  osc.start(a.currentTime);osc.stop(a.currentTime+dur);
}
function sndPickup(){playTone(880,'sine',0.04,0.001,0.05,1100,0.05);}
function sndBtnClick(){playTone(1200,'sine',0.06,0.001,0.04,1400,0.04);playNoise(0.04,0.001,0.02,2000,5000);}
function sndBuySuccess(){
  // Mechanisch-digitaler Kauf-Sound: aufsteigend
  playTone(440,'square',0.08,0.001,0.05,660,0.05);
  setTimeout(()=>playTone(660,'square',0.08,0.001,0.05,880,0.05),60);
  setTimeout(()=>playTone(880,'sine',0.10,0.001,0.12,1200,0.12),120);
}
function sndBuyFail(){
  // Buzzer: absteigende Dissonanz
  playTone(220,'sawtooth',0.12,0.001,0.15,110,0.15);
  playNoise(0.08,0.001,0.10,100,400);
}

const BASS_NOTES=[55,55,49,55,58,55,52,55];
function startMusic(){
  if(musicPlaying)return;musicPlaying=true;
  const stepMs=()=>60000/(128*musicTempo)/2;
  const scheduleNext=()=>{
    musicInterval=setTimeout(()=>{
      const a=getAudio();if(!a||!musicPlaying)return;
    const freq=BASS_NOTES[musicStep%BASS_NOTES.length];
    playTone(freq,'sawtooth',0.035,0.01,0.16,freq*0.95,0.18,true);
    if(musicStep%4===0||musicStep%4===2)playNoise(0.018,0.001,0.035,3000,8000,true);
    if(musicStep%8===0)playTone(freq*2,'sine',0.012,0.05,0.3,freq*2,0.35,true);
      musicStep++;
      scheduleNext();
    },stepMs());
  };
  scheduleNext();
}
function stopMusic(){
  musicPlaying=false;
  if(musicInterval){clearTimeout(musicInterval);musicInterval=null;}
}

