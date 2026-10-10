// ═══════════════════════════════════════════════════════════════
// ui.js — Keybindings, LocalStorage, Screens, Shop, Reset
// ═══════════════════════════════════════════════════════════════
// ── KEYBINDING SYSTEM ────────────────────────────────────────
let rebindTarget=null,rebindBtn=null;

const keyDisplayNames={
  'KeyA':'A','KeyB':'B','KeyC':'C','KeyD':'D','KeyE':'E','KeyF':'F',
  'KeyG':'G','KeyH':'H','KeyI':'I','KeyJ':'J','KeyK':'K','KeyL':'L',
  'KeyM':'M','KeyN':'N','KeyO':'O','KeyP':'P','KeyQ':'Q','KeyR':'R',
  'KeyS':'S','KeyT':'T','KeyU':'U','KeyV':'V','KeyW':'W','KeyX':'X',
  'KeyY':'Y','KeyZ':'Z','KeyC':'C',
  'ArrowLeft':'←','ArrowRight':'→','ArrowUp':'↑','ArrowDown':'↓',
  'ShiftLeft':'SHIFT L','ShiftRight':'SHIFT R',
  'ControlLeft':'CTRL L','ControlRight':'CTRL R',
  'AltLeft':'ALT L','Space':'LEERTASTE',
  'KeyF':'F','Digit1':'1','Digit2':'2','Digit3':'3',
};
function keyName(code){return keyDisplayNames[code]||code;}

function startRebind(action,btn){
  if(rebindTarget){rebindBtn.textContent=keyName(customBindings[rebindTarget]);rebindBtn.classList.remove('listening');}
  rebindTarget=action;rebindBtn=btn;
  btn.textContent='TASTE...';btn.classList.add('listening');
  sndBtnClick();
}

function finishRebind(code){
  if(!rebindTarget)return;
  // Escape = Rebind abbrechen (statt Escape als Taste zu binden)
  if(code==='Escape'){
    rebindBtn.textContent=keyName(customBindings[rebindTarget]);
    rebindBtn.classList.remove('listening');
    rebindTarget=null;rebindBtn=null;
    return;
  }
  // Duplikate: wenn Taste schon belegt ist → Belegungen tauschen
  for(const a in customBindings){
    if(a!==rebindTarget&&customBindings[a]===code){
      customBindings[a]=customBindings[rebindTarget];
      const el=document.getElementById('kb-'+a);
      if(el)el.textContent=keyName(customBindings[a]);
    }
  }
  customBindings[rebindTarget]=code;
  rebindBtn.textContent=keyName(code);
  rebindBtn.classList.remove('listening');
  rebindTarget=null;rebindBtn=null;
  saveSave();
}

function resetBindings(){
  customBindings={left:'KeyA',right:'KeyD',jump:'Space',jump2:'ArrowUp',dash:'KeyC'};
  ['left','right','jump','dash'].forEach(a=>{
    const el=document.getElementById('kb-'+a);
    const v=customBindings[a]||customBindings[a+'2']||'?';
    if(el)el.textContent=keyName(v);
  });
  saveSave();
}

// Key-Event für Rebind abfangen
window.addEventListener('keydown',e=>{
  if(rebindTarget){
    e.preventDefault();
    e.stopImmediatePropagation(); // verhindert, dass der Game-Handler (data.js) mitfeuert
    finishRebind(e.code);
    return;
  }
},true); // capture phase = vor dem normalen Handler

// ── LOCALSTORAGE ─────────────────────────────────────────────
let highscore=0;
function loadSave(){
  try{
    highscore=parseInt(localStorage.getItem('mr_highscore')||'0')||0;
    sfxVol=parseFloat(localStorage.getItem('mr_sfx')||'0.8');
    musicVol=parseFloat(localStorage.getItem('mr_music')||'0.6');
    const kb=JSON.parse(localStorage.getItem('mr_bindings')||'{}');
    Object.assign(customBindings,kb);
  }catch(e){}
  document.getElementById('hs-display').textContent=highscore;
  // Keybinding-Buttons aktualisieren
  ['left','right','jump','dash'].forEach(a=>{
    const el=document.getElementById('kb-'+a);
    const v=customBindings[a]||customBindings[a+'2']||'?';
    if(el)el.textContent=keyName(v);
  });
  const sfxPct=Math.round(sfxVol*100),musPct=Math.round(musicVol*100);
  document.getElementById('slider-sfx').value=sfxPct;
  document.getElementById('val-sfx').textContent=sfxPct;
  document.getElementById('slider-music').value=musPct;
  document.getElementById('val-music').textContent=musPct;
  document.getElementById('slider-sfx-p').value=sfxPct;
  document.getElementById('val-sfx-p').textContent=sfxPct;
  document.getElementById('slider-music-p').value=musPct;
  document.getElementById('val-music-p').textContent=musPct;
}
function saveSave(){
  try{
    localStorage.setItem('mr_highscore',String(highscore));
    localStorage.setItem('mr_sfx',String(sfxVol));
    localStorage.setItem('mr_music',String(musicVol));
    localStorage.setItem('mr_bindings',JSON.stringify(customBindings));
  }catch(e){}
}
function updateHighscore(){
  if(kills>highscore){highscore=kills;saveSave();document.getElementById('hs-display').textContent=highscore;}
}

// Slider-Events
document.getElementById('slider-music').addEventListener('input',function(){
  musicVol=this.value/100;
  document.getElementById('val-music').textContent=this.value;
  if(masterMusicGain)masterMusicGain.gain.value=musicVol;
  saveSave();
});
document.getElementById('slider-sfx').addEventListener('input',function(){
  sfxVol=this.value/100;
  document.getElementById('val-sfx').textContent=this.value;
  if(masterSfxGain)masterSfxGain.gain.value=sfxVol;
  saveSave();
});

// ── SCREENS ──────────────────────────────────────────────────
function showScreen(id){
  ['screen-start','screen-pause','screen-wave','screen-gameover']
    .forEach(s=>document.getElementById(s).classList.remove('show'));
  if(id)document.getElementById(id).classList.add('show');
}
function switchTab(n){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  const tabEl=document.getElementById('tab-'+n);
  if(tabEl)tabEl.classList.add('active');
  const panelEl=document.getElementById('panel-'+n);
  if(panelEl)panelEl.classList.add('active');
  sndBtnClick();
}
function quitGame(){if(confirm('Spiel wirklich beenden?'))window.close();}
function handleEsc(){
  if(phase==='playing'||phase==='countdown'){
    if(phase==='countdown'&&countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
    phase='paused';keys={};mouseDown=false;showScreen('screen-pause');
  } else if(phase==='paused'){
    // Wenn Countdown unterbrochen: wieder aufnehmen
    // BUGFIX: >=0 statt >0 — Pause exakt bei "KAMPF!" (Val 0) führte sonst
    // zu phase='playing' OHNE startWave() → Softlock (keine Gegner, kein Wellenende)
    if(countdownVal>=0&&countdownVal<=3&&countdownTimer===null){
      resumeCountdown();
    } else {
      phase='playing';showScreen(null);
    }
  }
}
function goToMainMenu(){
  if(shopTimer){clearInterval(shopTimer);shopTimer=null;}
  stopMusic();phase='start';keys={};mouseDown=false;showScreen('screen-start');
}

document.getElementById('btn-start').addEventListener('click',()=>{sndBtnClick();getAudio();resetGame();});
document.getElementById('btn-resume').addEventListener('click',()=>{
  sndBtnClick();
  document.getElementById('pause-main').style.display='block';
  document.getElementById('pause-settings').style.display='none';
  if(countdownVal>=0&&countdownVal<=3&&countdownTimer===null){resumeCountdown();}else{phase='playing';}
  showScreen(null);
});
document.getElementById('btn-quit-pause').addEventListener('click',()=>{
  sndBtnClick();
  document.getElementById('pause-main').style.display='block';
  document.getElementById('pause-settings').style.display='none';
  goToMainMenu();
});
document.getElementById('btn-restart').addEventListener('click',()=>{sndBtnClick();resetGame();});
document.getElementById('btn-quit-go').addEventListener('click',()=>{sndBtnClick();goToMainMenu();});
document.getElementById('btn-pause-settings').addEventListener('click',()=>{
  sndBtnClick();
  document.getElementById('pause-main').style.display='none';
  document.getElementById('pause-settings').style.display='block';
  // Pause-Slider mit aktuellen Werten synchronisieren
  document.getElementById('slider-music-p').value=Math.round(musicVol*100);
  document.getElementById('val-music-p').textContent=Math.round(musicVol*100);
  document.getElementById('slider-sfx-p').value=Math.round(sfxVol*100);
  document.getElementById('val-sfx-p').textContent=Math.round(sfxVol*100);
});
document.getElementById('btn-pause-settings-back').addEventListener('click',()=>{
  sndBtnClick();
  document.getElementById('pause-main').style.display='block';
  document.getElementById('pause-settings').style.display='none';
});
// Pause-Slider Events
document.getElementById('slider-music-p').addEventListener('input',function(){
  musicVol=this.value/100;
  document.getElementById('val-music-p').textContent=this.value;
  document.getElementById('slider-music').value=this.value;
  document.getElementById('val-music').textContent=this.value;
  if(masterMusicGain)masterMusicGain.gain.value=musicVol;
  saveSave();
});
document.getElementById('slider-sfx-p').addEventListener('input',function(){
  sfxVol=this.value/100;
  document.getElementById('val-sfx-p').textContent=this.value;
  document.getElementById('slider-sfx').value=this.value;
  document.getElementById('val-sfx').textContent=this.value;
  if(masterSfxGain)masterSfxGain.gain.value=sfxVol;
  saveSave();
});
document.getElementById('btn-shop-open').addEventListener('click',openShop);
document.getElementById('btn-fight-on').addEventListener('click',fightOn);
document.getElementById('btn-levelup').addEventListener('click',()=>{
  const luBtn=document.getElementById('btn-levelup');
  luBtn.style.display='none'; // sofort verstecken — kein Doppelklick
  sndBtnClick();
  showLevelUpMenu();
});
document.getElementById('btn-go').addEventListener('click',closeShopAndStart);

// ── RESET ────────────────────────────────────────────────────
function resetGame(){
  kills=0;scrap=0;wave=1;noBreakStreak=0;noDmgStreak=0;
  playerHP=100;hurtFlash=0;heat=0;overheated=false;parallaxOffset=0;
  lastEnemyHit={};bgPhase=0;bgParticles=[];bgStyle='city';musicTempo=1.0;musicStep=0;
  // Boss komplett zurücksetzen
  boss=null;bossHP=0;bossMaxHP=0;
  document.getElementById('boss-bar').style.display='none';
  // Lightning zurücksetzen
  lightning={phase:'idle',alpha:0,timer:180,nextIn:0,flashX:0,intensity:1.0};
  // Alle Partikel-Arrays komplett leeren
  dustParticles=[];sparks=[];muzzleFlashes=[];particles=[];
  debris=[];bloodDecals=[];floatTexts=[];scraps=[];
  stats=defaultStats();
  upgrades.left.forEach(u=>u.level=0);
  upgrades.right.forEach(u=>u.level=0);
  upgrades.back.forEach(u=>u.level=0);
  upgrades.special.forEach(u=>u.level=0);
  bullets=[];enemies=[];waveState={total:0,spawned:0,spawnTimer:0,spawnInterval:0,active:false};
  player.x=GAME_W/2-20;player.y=GROUND-52;
  player.dashVx=0;player.facing=1;player.moving=false;
  player.knockVx=0;player.tilt=0;player.tiltVel=0;player.velX=0;player.aimTilt=0;
  // BUGFIX: fehlende Resets — nach Tod in der Luft blieben Restwerte erhalten
  player.velY=0;player.onGround=true;player.jumpCount=0;player.jumpCooldown=0;
  player.airJumpUsed=false;player.dashInvince=0;player.dashFlash=0;
  player.stamina=100;player.staminaRegen=0;player.staminaRegenMax=130;
  playerMaxHP=100; // Panzerung+-Perks zurücksetzen (playerHP=100 oben gesetzt)
  freezeFrames=0;parallaxOffset=player.x;
  mouseX=GAME_W/2;mouseY=GAME_H/2;keys={};mouseDown=false;
  if(shopTimer){clearInterval(shopTimer);shopTimer=null;}
  ['hkills','hscrap','hwave'].forEach((id,i)=>document.getElementById(id).textContent=[0,0,1][i]);
  document.getElementById('hwep').textContent='Standard';
  document.getElementById('shopbox').classList.remove('show');
  document.getElementById('btn-shop-open').style.display='block';
  document.getElementById('btn-fight-on').style.display='block';
  // Level-Up und Perk-Reset
  killsForLevelUp=10;levelUpPending=false;playerLevel=0;
  if(typeof perkBonuses!=='undefined'){
    perkBonuses.dmg=0;perkBonuses.rateDiv=1.0;perkBonuses.heatMult=1.0;
    perkBonuses.stompMult=1.0;perkBonuses.dashCD=0;perkBonuses.dashDmg=0;
    perkBonuses.bulletScale=1.0;
  }
  document.getElementById('levelup-menu').style.display='none';
  document.getElementById('btn-levelup').style.display='none';
  updateHPBar();updateHeatBar();
  generateStars(); // Sterne neu setzen
  showScreen(null);
  startCountdown();
}

// ── COUNTDOWN ────────────────────────────────────────────────
function resumeCountdown(){
  phase='countdown';
  const el=document.getElementById('countdown');
  el.style.opacity='1';el.textContent=countdownVal>0?countdownVal:'KAMPF!';
  countdownTimer=setInterval(()=>{
    countdownVal--;
    if(countdownVal>0){el.textContent=countdownVal;}
    else if(countdownVal===0){el.textContent='KAMPF!';}
    else{
      clearInterval(countdownTimer);countdownTimer=null;
      el.style.opacity='0';phase='playing';startWave();startMusic();getAudio();
    }
  },900);
}

function startCountdown(){
  phase='countdown';countdownVal=3;
  const el=document.getElementById('countdown');
  el.style.opacity='1';el.textContent=countdownVal;
  if(countdownTimer)clearInterval(countdownTimer);
  countdownTimer=setInterval(()=>{
    countdownVal--;
    if(countdownVal>0){el.textContent=countdownVal;}
    else if(countdownVal===0){el.textContent='KAMPF!';}
    else{
      clearInterval(countdownTimer);countdownTimer=null;
      el.style.opacity='0';
      phase='playing';startWave();startMusic();getAudio();
    }
  },900);
}

// ── WELLEN ───────────────────────────────────────────────────
function calcWaveEnemies(w){return 8+(w-1)*3+noBreakStreak*2;}
function calcSpawnInterval(w){return Math.max(32,100-(w-1)*5);}

function startWave(){
  waveState.total=calcWaveEnemies(wave);
  waveState.spawned=0;waveState.spawnTimer=60;
  waveState.spawnInterval=calcSpawnInterval(wave);
  waveState.active=true;lastEnemyHit={};
  document.getElementById('wavefill').style.width='0%';
  const bossIn=BOSS_WAVE-(wave%BOSS_WAVE);
  const nbEl=document.getElementById('hnextboss');
  if(nbEl)nbEl.textContent=bossIn===BOSS_WAVE?'⚠ BOSS DIESE WELLE!':bossIn<=3?'⚠ BOSS in '+bossIn+' Wellen':'';
  document.getElementById('hwave').textContent=wave;
  // Akt-Phasen: alle 10 Wellen eskaliert die Atmosphäre
  const act=Math.floor((wave-1)/10);
  // Hintergrund-Stil pro Akt zufällig aber konsistent (Hash)
  const bgStyles=['city','industrial','ruins'];
  bgStyle=bgStyles[act%3];
  bgPhase=wave<=3?0:wave<=6?1:wave<=9?2:Math.min(4,3+(act-1));
  // Musik-Tempo steigt mit Akt
  musicTempo=1.0+act*0.15; // bis zu 1.6x schneller
}

function endWave(){
  waveState.active=false;noBreakStreak++;
  // Alle 10 Kills: Level-Up anbieten
  // Hier nur Wave-Ende: Level-Up wird durch Kill-Counter getriggert
  phase='decision';
  keys={};mouseDown=false;
  const nextTotal=calcWaveEnemies(wave+1); // BUGFIX: Streak wurde doppelt addiert (steckt schon in calcWaveEnemies)
  const eliteRisk=(wave+1)>=stats.eliteEarlyWave;
  const bonus=Math.round(scrap*0.12); // reduziert von 18% auf 12%
  document.getElementById('wtitle').textContent='WELLE '+wave+' ABGESCHLOSSEN!';
  document.getElementById('wsub').innerHTML=
    'Kills: '+kills+' &nbsp;·&nbsp; <span style="color:#ffd700">⬡ '+scrap+'</span>';
  const hpPct=Math.round(playerHP/playerMaxHP*100);
  const hpCol=hpPct>60?'#00ff88':hpPct>30?'#ffaa00':'#ff3333';
  const hpEl=document.getElementById('shop-hp-display');
  if(hpEl){
    hpEl.style.color=hpCol;
    hpEl.innerHTML='<span style="color:'+hpCol+'">❤ '+playerHP+'/'+playerMaxHP+'</span>'
      +'<span style="color:#333;font-size:10px;margin-left:8px;">('+hpPct+'%)</span>';
  }
  const nextWave=wave+1;
  const showFast=nextWave>=2;
  const showTank=nextWave>=2;
  const showFlying=nextWave>=3;
  document.getElementById('wnext').innerHTML=
    '<span style="color:#555">Nächste Welle:</span> <span style="color:#ff6600">'+nextTotal+' Gegner</span>'
    +'<br><span style="color:#555;font-size:10px;">Typen: </span>'
    +'<span style="color:#6611aa">Normal</span>'
    +(showFast?' <span style="color:#cc8800">· Schnell</span>':'')
    +(showTank?' <span style="color:#334400">· Panzer</span>':'')
    +(eliteRisk?' <span style="color:#ff2222">· ⚠ Elite</span>':'')
    +(showFlying?' <span style="color:#8844ff">· Flieger</span>':'')
    +'<br><span style="color:#555">Serie: </span><span style="color:#ffd700">×'+noBreakStreak+'</span>';
  document.getElementById('fight-warn-sub').textContent='⚠ +'+bonus+' Schrott (+12%) · Mehr Gegner · Elites früher · Kein HP-Recover';
  document.getElementById('shopbox').classList.remove('show');
  document.getElementById('btn-shop-open').style.display='block';
  document.getElementById('btn-fight-on').style.display='block';
  // Level-Up Button anzeigen wenn pending
  const luBtn=document.getElementById('btn-levelup');
  if(luBtn) luBtn.style.display=levelUpPending?'block':'none';
  showScreen('screen-wave');renderMechPanel();
}

function openShop(){
  document.getElementById('shopbox').classList.add('show');
  document.getElementById('btn-shop-open').style.display='none';
  document.getElementById('btn-fight-on').style.display='none';
  document.getElementById('btn-levelup').style.display='none';
  noBreakStreak=0;
  healPlayer(30); // HP erhöhen
  // HP-Anzeige im Shop sofort aktualisieren (nach Heal)
  const hpPct2=Math.round(playerHP/playerMaxHP*100);
  const hpCol2=hpPct2>60?'#00ff88':hpPct2>30?'#ffaa00':'#ff3333';
  const hpEl2=document.getElementById('shop-hp-display');
  if(hpEl2){
    hpEl2.style.color=hpCol2;
    hpEl2.innerHTML='<span style="color:'+hpCol2+'">❤ '+playerHP+'/'+playerMaxHP+'</span>'
      +'<span style="color:#333;font-size:10px;margin-left:8px;">('+hpPct2+'%)</span>';
  }
  renderShop();drawMechSilhouette();
  let t=35;
  const tb=document.getElementById('timebar');
  tb.style.transition='none';tb.style.width='100%';
  setTimeout(()=>{tb.style.transition='width 35s linear';tb.style.width='0%';},50);
  shopTimer=setInterval(()=>{t--;if(t<=0){clearInterval(shopTimer);shopTimer=null;closeShopAndStart();}},1000);
}
function closeShopAndStart(){
  if(shopTimer){clearInterval(shopTimer);shopTimer=null;}
  wave++;startWave();phase='playing';showScreen(null);
}
function fightOn(){
  const bonus=Math.round(scrap*0.12); // reduziert von 18% auf 12%
  scrap+=bonus; // BUGFIX: war zuvor im Kommentar verschluckt — Bonus wurde nie gutgeschrieben
  document.getElementById('hscrap').textContent=scrap;
  floatText(player.x+player.w/2,player.y-20,'+'+bonus+' BONUS!','#ffd700');
  stats.eliteEarlyWave=Math.max(stats.eliteEarlyWave-1,wave+1);
  stats.spawnMult=Math.min(stats.spawnMult+0.15,2.0);
  wave++;phase='playing';showScreen(null);startWave();
  showMsg('WEITER KÄMPFEN! ×'+noBreakStreak);
}

// ── SHOP / MECH-PANEL ─────────────────────────────────────────
function renderMechPanel(){renderShop();}
function drawMechSilhouette(){
  const mc=document.getElementById('mechCanvas'),mctx=mc.getContext('2d');
  mctx.clearRect(0,0,90,140);mctx.fillStyle='#050508';mctx.fillRect(0,0,90,140);
  const lU=upgrades.left.find(u=>u.level>0),rU=upgrades.right.find(u=>u.level>0),bU=upgrades.back.find(u=>u.level>0);
  mctx.fillStyle='#1a1a2e';mctx.fillRect(28,90,12,28);mctx.fillRect(50,90,12,28);
  mctx.fillStyle='#0055aa';mctx.fillRect(25,116,16,5);mctx.fillRect(49,116,16,5);
  mctx.fillStyle=lU||rU?'#6b0000':'#1e1e3e';mctx.fillRect(22,46,46,46);
  if(bU){mctx.fillStyle=bU.color;mctx.fillRect(30,52,10,18);mctx.fillRect(50,52,10,18);}
  mctx.fillStyle='#0d0d1e';mctx.fillRect(26,22,38,26);
  mctx.fillStyle=lU||rU?'#ff0055':'#00ffcc';mctx.fillRect(29,28,32,10);
  mctx.fillStyle='#151528';mctx.fillRect(12,48,12,18);mctx.fillRect(66,48,12,18);
  if(lU){mctx.fillStyle=lU.color;mctx.fillRect(2,52,12,8);}
  else{mctx.fillStyle='#00ffcc';mctx.fillRect(4,52,10,7);}
  if(rU){mctx.fillStyle=rU.color;mctx.fillRect(76,52,12,8);}
  else{mctx.fillStyle='#00ffcc';mctx.fillRect(76,52,10,7);}
  mctx.strokeStyle='#1a1a2e';mctx.lineWidth=1;mctx.strokeRect(0,0,90,140);
}
function renderShop(){
  ['left','right','back'].forEach(slot=>{
    const el=document.getElementById('slot-'+slot);el.innerHTML='';
    upgrades[slot].forEach(u=>{
      const lv=u.level,maxed=lv>=u.max;
      const costsArr=u.costs||[u.cost||10];
      const nextCost=maxed?null:costsArr[Math.min(lv,costsArr.length-1)];
      const afford=!maxed&&scrap>=nextCost;
      const descsArr=u.descs||[u.desc||''];
      const desc=descsArr[Math.min(lv,descsArr.length-1)];
      const btn=document.createElement('button');
      btn.className='upg'+(maxed?' owned':'');
      if(lv>0)btn.style.borderColor=u.color;
      const lvTxt=u.max>1?' LV'+lv+'/'+u.max:'';
      const statusTxt=maxed?'✓ MAX':afford?'⚙ '+nextCost+' ⬡':'✗ '+nextCost+' ⬡';
      btn.innerHTML='<b>'+u.name+'</b>'+lvTxt+'<br><span style="font-size:10px;color:#888">'+desc+'</span><span class="ucost">'+statusTxt+'</span>';
      if(!maxed&&afford){
        btn.addEventListener('click',()=>{
          scrap-=nextCost;u.level++;
          if(u.effect)u.effect(u.level);
          document.getElementById('hscrap').textContent=scrap;
          sndBuySuccess();flashMechSilhouette();
          renderShop();applyUpgradeVisuals();drawMechSilhouette();
        });
      } else if(!maxed&&!afford){btn.addEventListener('click',()=>sndBuyFail());}
      el.appendChild(btn);
    });
  });
  // Special-Slot (HP-Kauf + Schild-Recharge)
  let specEl=document.getElementById('slot-special');
  if(!specEl){
    specEl=document.createElement('div');specEl.id='slot-special';
    const row=document.createElement('div');row.className='slot-row';
    const lbl=document.createElement('span');lbl.className='slot-label';lbl.textContent='VERBRAUCH';
    row.appendChild(lbl);row.appendChild(specEl);
    document.getElementById('upgrade-slots').appendChild(row);
  }
  specEl.innerHTML='';
  specEl.style.cssText='display:flex;gap:5px;flex:1;flex-wrap:wrap;';
  upgrades.special.forEach(u=>{
    if(u.id==='shield_r'&&!stats.hasShield)return;
    if(u.id==='shield_r'&&stats.shieldUp)return;
    if(u.id==='cooling'&&u.level>=u.max)return; // maxed
    // BUGFIX: Kosten skalieren mit Level (vorher immer costs[0])
    const cost=u.costs[Math.min(u.level,u.costs.length-1)],afford=scrap>=cost;
    const btn=document.createElement('button');
    btn.className='upg';btn.style.borderColor=u.color;
    btn.innerHTML='<b>'+u.name+'</b><span class="ucost">'+(afford?'⚙ '+cost+' ⬡':'✗ '+cost+' ⬡')+'</span>';
    if(afford){
      btn.addEventListener('click',()=>{
        scrap-=cost;if(u.id!=='shield_r')u.level++;if(u.effect)u.effect();
        document.getElementById('hscrap').textContent=scrap;
        sndBuySuccess();renderShop();
      });
    } else btn.addEventListener('click',()=>sndBuyFail());
    specEl.appendChild(btn);
  });
  drawMechSilhouette();
}
function applyUpgradeVisuals(){
  const n=[];
  upgrades.left.forEach(u=>{if(u.level>0)n.push(u.max>1?u.name+' L'+u.level:u.name);});
  upgrades.right.forEach(u=>{if(u.level>0)n.push(u.max>1?u.name+' L'+u.level:u.name);});
  if(n.length)document.getElementById('hwep').textContent=n.join('+');
}
function flashMechSilhouette(){
  // Weißer Flash für 4 Frames (~67ms)
  const fl=document.getElementById('silhouette-flash');
  fl.style.opacity='0.85';
  setTimeout(()=>fl.style.opacity='0',70);
  // Shop-Funken auf dem Spielfeld (als Canvas-Partikel)
  const cx2=player.x+player.w/2,cy2=player.y;
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2,s=Math.random()*5+2;
    sparks.push({x:cx2+(Math.random()-.5)*40,y:cy2+(Math.random()-.5)*30,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,
      life:20,maxLife:20,color:Math.random()<0.5?'#ffd700':'#00ffcc',size:2.5,muzzle:true});
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function shake(mag,fr){shakeMag=Math.max(shakeMag,mag);shakeFrames=Math.max(shakeFrames,fr);}
function healPlayer(amt){
  playerHP=Math.min(playerMaxHP,playerHP+amt);
  updateHPBar();
  if(phase!=='playing'&&phase!=='countdown'){
    floatText(player.x+player.w/2,player.y-15,'+'+amt+' HP','#00ff88');
  }
  // Shop-HP-Anzeige mitaktualisieren wenn sichtbar
  const hpElH=document.getElementById('shop-hp-display');
  if(hpElH&&hpElH.offsetParent!==null){
    const p=Math.round(playerHP/playerMaxHP*100);
    const c=p>60?'#00ff88':p>30?'#ffaa00':'#ff3333';
    hpElH.innerHTML='<span style="color:'+c+'">❤ '+playerHP+'/'+playerMaxHP+'</span>'
      +'<span style="color:#333;font-size:10px;margin-left:8px;">('+p+'%)</span>';
  }
}
function updateHPBar(){
  const pct=Math.max(0,playerHP/playerMaxHP*100),col=pct>50?'#00ff88':pct>25?'#ffaa00':'#ff3333';
  document.getElementById('hpfill').style.width=pct+'%';
  document.getElementById('hpfill').style.background=col;
  document.getElementById('hpbar').style.borderColor=col;
  document.getElementById('hpbar-wrap').style.color=col;
  document.getElementById('hhp').textContent=playerHP;
}
function updateHeatBar(){
  const pct=heat/OVERHEAT_MAX*100,col=pct<40?'#00cc44':pct<75?'#ffaa00':'#ff3333';
  document.getElementById('heatfill').style.width=pct+'%';
  document.getElementById('heatfill').style.background=col;
  const lbl=document.getElementById('heatlabel');
  if(overheated){lbl.textContent='⚠ ÜBERHITZT!';lbl.style.color='#ff3333';}
  else if(pct>65){lbl.textContent='HEISS!';lbl.style.color='#ffaa00';}
  else lbl.textContent='';
}
function hurtPlayer(dmg,knockDir){
  if(player.dashInvince>0)return; // Dash-Unverwundbarkeit
  if(stats.shieldUp){stats.shieldUp=false;floatText(player.x+player.w/2,player.y-10,'SCHILD!','#00ccff');shake(6,8);return;}
  playerHP=Math.max(0,playerHP-dmg);hurtFlash=16;shake(12,14);noDmgStreak=0;
  if(knockDir!==undefined)player.knockVx=knockDir*5;
  updateHPBar();sndHurt();floatText(player.x+player.w/2,player.y-10,'-'+dmg,'#ff3333');
  if(playerHP<=0){
    stopMusic();phase='dead';keys={};mouseDown=false;
    updateHighscore();
    document.getElementById('go-stats').innerHTML='Welle <span>'+wave+'</span> · <span>'+kills+'</span> Kills · <span>'+scrap+'</span> Schrott';
    showScreen('screen-gameover');
  }
}
function gore(x,y,count,big){
  const n=Math.min(big?count*2:count,50);
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,s=Math.random()*(big?8:4.5)+1;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-Math.random()*3.5,
      size:Math.random()*4+2,color:Math.random()<0.6?'#00ff44':Math.random()<0.5?'#00cc33':'#aaff00',
      life:Math.random()*40+20,onGround:false});
  }
}
function dropScrap(x,y,amount){
  const real=Math.ceil(amount*stats.scrapBonus);
  // Lebenszeit: Basiswert 8s, pro Welle -0.4s, Minimum 3s
  const lifetime=Math.max(3000, 8000-wave*400);
  const expiry=Date.now()+lifetime;
  for(let i=0;i<real;i++)
    scraps.push({x:x+(Math.random()-.5)*30,y,vy:-Math.random()*3-1,vx:(Math.random()-.5)*3,settled:false,attracted:false,val:1,expiry,lifetime});
}
function floatText(x,y,txt,col){floatTexts.push({x,y,txt,col,life:55,vy:-1.0,size:13,bold:true});}
function dmgNum(x,y,dmg,isCrit){
  // Damage Number: kleiner, schnell, kurz
  floatTexts.push({
    x:x+(Math.random()-.5)*14,
    y:y-8,
    txt:String(dmg),
    col:isCrit?'#ff4400':'#ffffff',
    life:28,
    vy:-1.6,
    size:isCrit?16:12,
    bold:true,
    isDmg:true
  });
}
let fmsgTO=null;
function showMsg(txt){
  const m=document.getElementById('fmsg');m.textContent=txt;m.style.opacity='1';
  if(fmsgTO)clearTimeout(fmsgTO);fmsgTO=setTimeout(()=>{m.style.opacity='0';},1800);
}

function spawnEnemy(){
  const fromLeft=Math.random()<0.5;
  const baseSpd=(0.7+wave*0.11+Math.random()*0.6)*stats.spawnMult;
  const isElite=wave>=stats.eliteEarlyWave&&Math.random()<0.35;
  const isFlying=wave>=3&&Math.random()<Math.min(0.3,wave*0.04);

  // 3 Boden-Typen (nur wenn nicht Elite/Flieger)
  // 'normal' = aktueller Standard
  // 'fast'   = schnell aber schwach (60% HP, 150% Speed, wenig Schaden)
  // 'tank'   = langsam aber gepanzert (300% HP, 55% Speed, mehr Schaden)
  let subtype='normal';
  if(!isElite&&!isFlying&&wave>=2){
    const r=Math.random();
    if(r<0.25) subtype='fast';
    else if(r<0.42) subtype='tank';
  }

  const spdMult=subtype==='fast'?1.7:subtype==='tank'?0.55:1.0;
  const spd=baseSpd*spdMult;
  const hpBase=isElite?4+Math.floor(wave/2):1+Math.floor(wave/3);
  const hpMult=subtype==='fast'?0.6:subtype==='tank'?3.0:1.0;
  const hp=Math.max(1,Math.round(hpBase*hpMult));
  const dmgBase=isElite?20:isFlying?6:9;
  const dmgMult=subtype==='tank'?1.6:subtype==='fast'?0.7:1.0;

  const w=isElite?44:isFlying?28:subtype==='tank'?42:subtype==='fast'?26:32;
  const h=isElite?54:isFlying?28:subtype==='tank'?48:subtype==='fast'?36:44;

  enemies.push({
    id:'e'+(enemyIdCounter++), // eindeutige ID (BUGFIX: vorher Index-basierte Cooldown-Keys)
    x:fromLeft?-50:GAME_W+10,
    y:isFlying?GROUND-160-Math.random()*120:GROUND-h,
    w,h,vx:fromLeft?spd:-spd,baseSpd:spd,hp,maxHp:hp,hitFlash:0,
    legAnim:Math.random()*Math.PI*2,elite:isElite,flying:isFlying,
    subtype, // 'normal'|'fast'|'tank'
    dmg:Math.round(dmgBase*dmgMult),state:'walk',attackTimer:0,knockVx:0,
    floatOffset:Math.random()*Math.PI*2,floatSpeed:0.02+Math.random()*0.01,
    shootTimer:0,shootCooldown:0,hoverTimer:0,
    stomped:false, // für Sprung-Stomp
    // BUGFIX: diese Fähigkeiten wurden in game.js/render.js geprüft,
    // aber nie gesetzt — Elite-Regen, Panzer-Schild und Dodge waren tot
    regen:isElite,
    absorb:subtype==='tank',
    absorbCooldown:0,
    dodge:subtype==='fast',
    deathTimer:0
  });
}

