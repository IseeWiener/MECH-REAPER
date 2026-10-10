// ═══════════════════════════════════════════════════════════════
// game.js — Schießen, Boss, Update-Loop, Spieler-Physik
// ═══════════════════════════════════════════════════════════════
// ── SCHIESSEN ────────────────────────────────────────────────
function getShootAngle(){
  // Arm-Pivot (Schulter des Schuss-Arms)
  const armPivX=player.facing===1?player.x+40:player.x;
  const armPivY=player.y+20;
  const dx=(mouseX-armPivX)*player.facing; // facing-korrigiert
  const dy=mouseY-armPivY;
  const angle=Math.atan2(dy,Math.abs(dx)||0.001);
  // Vollständige 360°: kein Clamp
  return{
    vx:Math.cos(angle)*stats.bulletSpd*player.facing,
    vy:Math.sin(angle)*stats.bulletSpd,
    angle
  };
}
function shoot(){
  if(shootCD>0||phase!=='playing'||overheated)return;
  const{vx,vy}=getShootAngle();
  const shootRight=player.facing===1;
  // Schuss-Ursprung: Waffenlauf-Spitze (Arm-Pivot + Arm-Länge in Schussrichtung)
  const shootAngle=Math.atan2(vy,Math.abs(vx));
  const armLen=28; // Arm+Waffenlauf Länge
  const armPivX=shootRight?player.x+40:player.x;
  const armPivY=player.y+20;
  const bOriginX=armPivX+Math.cos(shootAngle)*(shootRight?armLen:-armLen)-stats.bulletW/2;
  const bOriginY=armPivY+Math.sin(shootAngle)*armLen;
  // Waffen-Typ bestimmt Bullet-Aussehen
  // BUGFIX: Optik/Sound folgen jetzt der ZULETZT gekauften Waffe (stats.weaponType),
  // vorher gewann immer MG > Plasma > Shotgun, egal was zuletzt gekauft wurde
  const bType=stats.weaponType||(stats.pierce?'chain':'laser');
  const isShotgun=bType==='shotgun';
  // MG: kleiner+schnell, Plasma: groß+langsam, sonst normal
  const bW=bType==='mg'?5:bType==='plasma'?28:stats.bulletW;
  const bH=bType==='mg'?3:bType==='plasma'?14:stats.bulletH;
  const bSpd=bType==='mg'?1.6:bType==='plasma'?0.55:bType==='shotgun'?0.9:1.0;
  for(let s=0;s<stats.spread;s++){
    const oa=(s-(stats.spread-1)/2)*0.22;
    const effDmg=stats.bulletDmg+(perkBonuses.dmg||0);
    const effW=Math.round(bW*(perkBonuses.bulletScale||1));
    const effH=Math.round(bH*(perkBonuses.bulletScale||1));
    bullets.push({x:bOriginX,
      y:bOriginY+oa*10,vx:vx*bSpd,vy:(vy+Math.sin(oa)*2)*bSpd,
      w:effW,h:effH,dmg:effDmg,pierce:stats.pierce,aoe:false,
      type:bType,trail:bType==='plasma'?[]:null}); // trail nur bei Plasma
  }
  if(stats.hasRocket&&Math.random()<(stats.rocketChance||0.25))
    bullets.push({x:bOriginX,y:bOriginY+6,
      vx:vx*0.4,vy:vy*0.4,w:14,h:8,dmg:stats.rocketDmg||3,aoe:true,pierce:false});

  // Muzzle Flash — Länge je nach Waffe (relativ zum Arm-Pivot)
  const muzzAngle=Math.atan2(vy,Math.abs(vx));
  // Waffenlänge entspricht den Waffen im drawMech (Oberarm+Unterarm+Waffe)
  // Muzzle-Länge: Waffen sind jetzt kürzer (max ~38px)
  const muzzLen=bType==='mg'?38:bType==='shotgun'?37:bType==='rocket'?38:
                bType==='plasma'?33:bType==='chain'?38:bType==='laser'?40:33;
  const muzzX=armPivX+Math.cos(muzzAngle)*(shootRight?muzzLen:-muzzLen);
  const muzzY=armPivY+Math.sin(muzzAngle)*muzzLen;
  const flashR=bType==='shotgun'?18:bType==='plasma'?20:14;
  const flashCol=bType==='shotgun'?'#ffaa00':bType==='plasma'?'#cc44ff':bType==='chain'?'#00ffee':bType==='mg'?'#ffff44':'#ffee44';
  muzzleFlashes.push({x:muzzX,y:muzzY,r:flashR,life:3,maxLife:3,color:flashCol});
  for(let m=0;m<5;m++){
    const sa=muzzAngle+(Math.random()-.5)*0.8;
    sparks.push({x:muzzX,y:muzzY,vx:Math.cos(sa)*(shootRight?1:-1)*flashR*0.9,
      vy:Math.sin(sa)*flashR*0.9,life:5,maxLife:5,color:flashCol,size:2,muzzle:true});
  }

  // Kickback
  const kickback=isShotgun?3.5:stats.hasRocket?2.5:1.2;
  player.knockVx=-player.facing*kickback;

  heat=Math.min(OVERHEAT_MAX,heat+(stats.heatPerShot||HEAT_PER_SHOT));
  if(heat>=OVERHEAT_MAX&&!overheated){overheated=true;showMsg('⚠ ÜBERHITZT!');shake(5,8);sndOverheat();}
  updateHeatBar();
  shake(stats.spread>1?3:1,stats.spread>1?5:3);
  sndShoot(isShotgun,bType==='plasma');
  shootCD=Math.max(3,Math.round(stats.fireRate*(perkBonuses.rateDiv||1.0)));
}


// ── BOSS ─────────────────────────────────────────────────────
function spawnBoss(){
  const hp=200+wave*30;bossMaxHP=hp;bossHP=hp;
  boss={x:Math.random()<0.5?-80:GAME_W+80,y:GROUND-80,w:72,h:80,
    hp,maxHp:hp,hitFlash:0,legAnim:0,eyeAnim:0,
    baseSpd:1.2+wave*0.05,attackTimer:0,knockVx:0,rageActive:false};
  boss.vx=boss.x<0?boss.baseSpd:-boss.baseSpd;
  document.getElementById('boss-bar').style.display='flex';
  document.getElementById('boss-name').textContent='⚠ ALPHA-REAPER — WELLE '+wave;
  updateBossBar();shake(12,20);showMsg('⚠ BOSS ERSCHEINT!');
  setTimeout(()=>sndThunder(1.5),300);
}
function updateBossBar(){
  const pct=Math.max(0,bossHP/bossMaxHP*100);
  document.getElementById('boss-hp-fill').style.width=pct+'%';
  document.getElementById('boss-hp-fill').style.background=pct<30?'#ff6600':pct<60?'#ffaa00':'#ff0055';
  document.getElementById('boss-hp-txt').textContent=bossHP+'/'+bossMaxHP;
}
function updateBoss(dt,pcx,pcy,now){
  if(!boss)return;
  boss.legAnim+=0.12*dt;boss.eyeAnim+=0.05*dt;
  if(boss.hitFlash>0)boss.hitFlash-=dt;
  if(!boss.rageActive&&boss.hp<boss.maxHp*0.3){
    boss.rageActive=true;boss.baseSpd*=1.6;
    showMsg('⚠ RAGE MODUS!');shake(15,20);sndThunder(2.0);
  }
  const touching=boss.x<player.x+player.w&&boss.x+boss.w>player.x&&boss.y<player.y+player.h&&boss.y+boss.h>player.y;
  if(touching){
    boss.attackTimer+=dt;
    const interval=boss.rageActive?10:18;
    if(boss.attackTimer>=interval){
      const k='boss';
      const cd=boss.rageActive?200:350;
      if(!lastEnemyHit[k]||now-lastEnemyHit[k]>cd){
        lastEnemyHit[k]=now;hurtPlayer(boss.rageActive?28:18,pcx>boss.x+boss.w/2?1:-1);boss.attackTimer=0;
      }
    }
  } else {
    const dir=pcx>boss.x+boss.w/2?1:-1;
    boss.x+=dir*boss.baseSpd*(boss.rageActive?1.6:1)*dt;
  }
  if(boss.knockVx!==0){boss.x+=boss.knockVx*dt;boss.knockVx*=Math.pow(0.8,dt);if(Math.abs(boss.knockVx)<0.2)boss.knockVx=0;}
  boss.x=Math.max(-20,Math.min(GAME_W-boss.w+20,boss.x));
  for(let j=bullets.length-1;j>=0;j--){
    const b=bullets[j];if(!b||b.enemy)continue;
    if(b.x<boss.x+boss.w&&b.x+b.w>boss.x&&b.y<boss.y+boss.h&&b.y+b.h>boss.y){
      // BUGFIX: Pierce-Bullets trafen den Boss JEDEN Frame beim Durchflug (~5x Schaden)
      if(b.pierce){
        if(!b.hitIds)b.hitIds={};
        if(b.hitIds['boss'])continue;
        b.hitIds['boss']=1;
      }
      boss.hp-=b.dmg;boss.hitFlash=6;bossHP=boss.hp;
      if(!b.pierce)bullets.splice(j,1);
      boss.knockVx=(b.vx>0?1:-1)*(b.aoe?4:1.5);
      dmgNum(boss.x+boss.w/2,boss.y,b.dmg,b.aoe||b.dmg>=3);
      gore(boss.x+boss.w/2,boss.y+boss.h/2,b.aoe?10:4,!!b.aoe);
      shake(b.aoe?8:2,b.aoe?10:3);updateBossBar();
      if(boss.hp<=0){
        gore(boss.x+boss.w/2,boss.y+boss.h/2,60,true);shake(20,25);
        const bScrap=80+wave*10;dropScrap(boss.x+boss.w/2,boss.y+boss.h/2,bScrap);
        floatText(boss.x+boss.w/2,boss.y,'BOSS BESIEGT! +'+bScrap+' ⬡','#ffd700');
        kills+=5;document.getElementById('hkills').textContent=kills;
        document.getElementById('boss-bar').style.display='none';
        freezeFrames=8;sndKill(true);boss=null;waveState.active=false;endWave();break;
      }
      // kein break mehr: mehrere Bullets dürfen im selben Frame treffen (z.B. Shotgun-Spread)
    }
  }
}
function drawBoss(){
  if(!boss)return;const e=boss,fl=e.hitFlash>0,rage=e.rageActive;
  cx.save();
  const l1=Math.sin(e.legAnim)*7,l2=Math.sin(e.legAnim+Math.PI)*7;
  cx.fillStyle=fl?'#fff':rage?'#882200':'#4a0088';
  cx.fillRect(e.x+8,e.y+62,14,20+l1);cx.fillRect(e.x+28,e.y+62,14,20+l2);
  cx.fillRect(e.x+16,e.y+66,12,16+l2);cx.fillRect(e.x+36,e.y+66,12,16+l1);
  cx.fillStyle=fl?'#fff':rage?'#cc2200':'#6600bb';cx.fillRect(e.x+4,e.y+28,e.w-8,44);
  cx.fillStyle=fl?'#fff':rage?'#ff4400':'#8800dd';
  cx.fillRect(e.x,e.y+24,12,20);cx.fillRect(e.x+e.w-12,e.y+24,12,20);
  cx.fillStyle=fl?'#fff':rage?'#991100':'#4400aa';cx.fillRect(e.x+10,e.y+6,e.w-20,26);
  const ep=0.5+0.5*Math.sin(e.eyeAnim);
  cx.fillStyle=rage?`rgba(255,${Math.floor(60+ep*40)},0,1)`:`rgba(255,0,${Math.floor(100+ep*155)},1)`;
  cx.fillRect(e.x+14,e.y+12,10,8);cx.fillRect(e.x+e.w-24,e.y+12,10,8);
  cx.fillStyle='#fff';cx.fillRect(e.x+16,e.y+14,4,4);cx.fillRect(e.x+e.w-22,e.y+14,4,4);
  cx.fillStyle='#ccc';for(let t=0;t<4;t++)cx.fillRect(e.x+18+t*9,e.y+28,6,8);
  cx.fillStyle='#330000';cx.fillRect(e.x,e.y-12,e.w,6);
  cx.fillStyle=rage?'#ff4400':'#ff0055';cx.fillRect(e.x,e.y-12,e.w*(e.hp/e.maxHp),6);
  if(rage){cx.strokeStyle=`rgba(255,50,0,${0.3+0.3*Math.sin(e.eyeAnim*2)})`;cx.lineWidth=3;cx.beginPath();cx.arc(e.x+e.w/2,e.y+e.h/2,e.w*0.8,0,Math.PI*2);cx.stroke();}
  cx.restore();
}

// ── LEVEL-UP SYSTEM ──────────────────────────────────────────
// Perk-Boni: werden ADDITIV zu den Basis-Stats addiert
// Niemals direkt stats.fireRate etc. überschreiben!
// Beim Schießen: effektiverWert = basisWert + perkBonus
const perkBonuses={
  dmg:0,        // +Schaden pro Schuss
  rateDiv:1.0,  // Multiplikator auf Feuerrate (0.87 pro Stufe = schneller)
  heatMult:1.0, // Multiplikator auf Kühlung (kumulativ)
  stompMult:1.0,// Multiplikator auf Stomp-Schaden
  dashCD:0,     // Reduzierung des Dash-Cooldowns in Frames
  dashDmg:0,    // Zusatz-Schaden beim Dash
  bulletScale:1.0, // Bullet-Größen-Multiplikator
};

const LEVEL_UP_PERKS=[
  {id:'spd',    name:'Schneller Dash',  desc:'Dash-Cooldown -0.7s',  color:'#00ffcc',
    apply:()=>{ perkBonuses.dashCD+=42; }}, // 42 frames ~0.7s weniger Wartezeit
  {id:'hp',     name:'Panzerung+',      desc:'Max HP +25',           color:'#00ff88',
    apply:()=>{ playerMaxHP+=25;playerHP=Math.min(playerMaxHP,playerHP+25);updateHPBar(); }},
  {id:'dmg',    name:'Waffensystem+',   desc:'Schaden +1',           color:'#ff6600',
    apply:()=>{ perkBonuses.dmg++; }},
  {id:'scrap',  name:'Bergungsmodul',   desc:'Schrott +25%',         color:'#ffd700',
    apply:()=>{ stats.scrapBonus=Math.round(stats.scrapBonus*1.25*100)/100; }},
  {id:'heat',   name:'Kühlsystem',      desc:'Kühlung +25%',         color:'#44aaff',
    apply:()=>{ perkBonuses.heatMult*=1.25; }},
  {id:'fire',   name:'Feuerrate+',      desc:'Feuerrate +15%',       color:'#ff4400',
    apply:()=>{ perkBonuses.rateDiv*=0.87; }},
  {id:'stomp',  name:'Stampf-Kraft+',   desc:'Stomp-Schaden ×2',    color:'#ff8800',
    apply:()=>{ perkBonuses.stompMult*=2; }},
  {id:'dash2',  name:'Dash-Schaden+',   desc:'Dash-DMG +2',         color:'#00ccff',
    apply:()=>{ perkBonuses.dashDmg+=2; }},
  {id:'bullet', name:'Kaliber+',        desc:'Bullet-Größe +25%',   color:'#ffaa00',
    apply:()=>{ perkBonuses.bulletScale*=1.25; }},
];

// Flieger sterben nicht sofort, sondern trudeln kurz und explodieren dann (AOE!)
// BUGFIX: dieser State existierte in Update+Render, wurde aber nie ausgelöst
function startFlyerDeath(e){
  if(e.state==='dead')return;
  e.state='dead';e.deathTimer=40;e.hp=0;
  e.laserFired=true;e.hasFired=true; // Warn-Laser sofort aus
  e.knockVx=0;
  floatText(e.x+e.w/2,e.y-8,'⚠ KRITISCH','#ff8800');
  sndImpact(false);
}

function checkLevelUp(){
  if(kills>=killsForLevelUp&&!levelUpPending){
    levelUpPending=true;
    killsForLevelUp+=10+playerLevel*5;
    // Level-Up wird nach Ende der Welle im Wave-Screen angezeigt
  }
}

function showLevelUpMenu(){
  // 3 zufällige Perks auswählen (keine Duplikate)
  const pool=[...LEVEL_UP_PERKS];
  const chosen=[];
  while(chosen.length<3&&pool.length>0){
    const idx=Math.floor(Math.random()*pool.length);
    chosen.push(pool.splice(idx,1)[0]);
  }
  // Spiel pausieren
  phase='levelup';keys={};mouseDown=false;

  // Menü befüllen
  const menu=document.getElementById('levelup-menu');
  const cards=document.getElementById('levelup-cards');
  cards.innerHTML='';
  document.getElementById('levelup-num').textContent=playerLevel+1;
  chosen.forEach(perk=>{
    const card=document.createElement('div');
    card.className='levelup-card';
    card.style.borderColor=perk.color;
    card.innerHTML=`<div class="lu-icon" style="color:${perk.color}">⚡</div>
      <div class="lu-name" style="color:${perk.color}">${perk.name}</div>
      <div class="lu-desc">${perk.desc}</div>`;
    card.addEventListener('click',()=>{
      perk.apply();playerLevel++;levelUpPending=false;
      menu.style.display='none';
      phase='playing';
      sndBuySuccess();
      floatText(player.x+player.w/2,player.y-20,'LEVEL UP!','#ffd700');
    });
    card.addEventListener('mouseenter',()=>sndBtnClick());
    cards.appendChild(card);
  });
  menu.style.display='flex';
}

// ── UPDATE ───────────────────────────────────────────────────
function update(ts){
  if(lastFrameTime===0)lastFrameTime=ts;
  const rawDt=ts-lastFrameTime;lastFrameTime=ts;
  if(rawDt>200){requestAnimationFrame(update);return;} // Tab-Wechsel-Schutz

  // dt normiert auf 60 Hz — Wert 1.0 = ein 60fps-Frame
  const dt=Math.min(rawDt/16.667, 3.0);

  if(phase!=='playing'){draw();requestAnimationFrame(update);return;}
  // Freeze Frame: draw aber keine Logik
  if(freezeFrames>0){freezeFrames--;draw();requestAnimationFrame(update);return;}

  // Shake
  if(shakeFrames>0){shakeX=(Math.random()-.5)*shakeMag*2;shakeY=(Math.random()-.5)*shakeMag*2;shakeFrames-=dt;shakeMag*=Math.pow(0.85,dt);}
  else{shakeX=0;shakeY=0;}
  if(hurtFlash>0)hurtFlash-=dt;

  const movL=isKey('left'),movR=isKey('right');
  player.moving=movL||movR;

  // ── Inertia: velX baut sich auf/ab statt hartem Stop ──
  const targetVelX = movR ? player.spd : movL ? -player.spd : 0;
  // Beschleunigung schneller als Bremsen → Gewichtsgefühl
  const accel = player.moving ? 0.28 : 0.18;
  player.velX += (targetVelX - player.velX) * accel * dt;
  if(Math.abs(player.velX) < 0.05) player.velX = 0;
  const prevX = player.x;
  player.x += player.velX * dt;
  player.facing = mouseX > player.x+player.w/2 ? 1 : -1;

  // Tilt — folgt tatsächlicher Geschwindigkeit
  const moveDir = player.velX > 0.2 ? 1 : player.velX < -0.2 ? -1 : 0;
  player.tiltVel += (moveDir*0.13 - player.tilt)*0.18*dt;
  player.tiltVel *= Math.pow(0.72,dt);
  player.tilt += player.tiltVel*dt;

  // ── Aim-Tilt: Kopf/Arme neigen zur Maus ──
  const armY = player.y+22;
  const rawAim = (mouseY - armY) / (GROUND * 0.4);
  const clampedAim = Math.max(-1.8, Math.min(1.2, rawAim)); // nach unten begrenzt
  player.aimTilt += (clampedAim - player.aimTilt) * 0.14 * dt;

  // Parallax: direkt von player.x ableiten
  parallaxOffset = player.x;
  // Body-Look: folgt Bewegungsrichtung, facing-unabhängig
  // movL/movR sind bereits definiert oben in update()
  const rawBodyLook=movR?1:movL?-1:0;
  player.bodyLookSmooth+=(rawBodyLook-player.bodyLookSmooth)*0.10*dt;

  // ── Staub-Partikel beim Laufen & Schlittern ──
  const isSliding = !player.moving && Math.abs(player.velX) > 0.8;
  const spawnDust = (player.moving || isSliding) && Math.random() < (isSliding ? 0.5 : 0.35) * dt;
  if(spawnDust){
    const foot = player.x + player.w/2 + (Math.random()-.5)*20;
    const col = isSliding
      ? `rgba(${180+Math.floor(Math.random()*40)},${120+Math.floor(Math.random()*40)},60,`
      : `rgba(${140+Math.floor(Math.random()*40)},${130+Math.floor(Math.random()*30)},${110+Math.floor(Math.random()*30)},`;
    dustParticles.push({
      x:foot, y:GROUND-2,
      vx:player.velX*0.35 + (Math.random()-.5)*2.5,
      vy:-(Math.random()*1.8+0.4),
      life:0, maxLife:18+Math.random()*14,
      col, size:Math.random()*3+1.5,
      isSpark: isSliding && Math.random()<0.3
    });
  }
  for(let i=dustParticles.length-1;i>=0;i--){
    const dp=dustParticles[i];
    dp.x+=dp.vx*dt; dp.y+=dp.vy*dt;
    dp.vy+=0.12*dt; dp.vx*=Math.pow(0.92,dt);
    dp.life+=dt;
    if(dp.life>=dp.maxLife||dp.y>GROUND+4) dustParticles.splice(i,1);
  }

  // ── Dash-Kollision: Gegner werden geschoben und nehmen Schaden ──
  if(Math.abs(player.dashVx)>4){
    const dashDmg=2;
    const dashKB=6;
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if(player.x<e.x+e.w&&player.x+player.w>e.x&&
         player.y<e.y+e.h&&player.y+player.h>e.y){
        if(e.state==='dead')continue; // sterbende Flieger nicht erneut treffen
        e.hp-=dashDmg+(perkBonuses.dashDmg||0);e.hitFlash=6; // BUGFIX: Perk "Dash-Schaden+" wurde nie angewendet
        e.knockVx=player.dashVx>0?dashKB:-dashKB; // Gegner wird weggeschoben
        dmgNum(e.x+e.w/2,e.y,dashDmg+(perkBonuses.dashDmg||0),false);
        shake(3,4);
        if(e.hp<=0){
          if(e.flying){startFlyerDeath(e);continue;} // Flieger: Todes-Explosion einleiten
          gore(e.x+e.w/2,e.y+e.h/2,e.elite?30:15,e.elite);
          sndKill(e.elite);
          freezeFrames=e.elite?3:1;
          const scrAmt=e.elite?4:1;
          dropScrap(e.x+e.w/2,e.y+e.h/2,scrAmt);
          kills++;noDmgStreak++;
          document.getElementById('hkills').textContent=kills;
          checkLevelUp(); // BUGFIX: Dash-Kills zählten nicht für Level-Ups
          delete lastEnemyHit[e.id];enemies.splice(i,1);
        }
      }
    }
  }

  if(player.knockVx!==0){player.x+=player.knockVx*dt;player.knockVx*=Math.pow(0.75,dt);if(Math.abs(player.knockVx)<0.3)player.knockVx=0;}
  // ── DASH: nur in Laufrichtung, voller Stamina-Verbrauch, 5s Cooldown ──
  const dashPow=stats.hasDash?(stats.dashPower||22):16;
  const dashDir=movR?1:movL?-1:0; // nur wenn Bewegungstaste gedrückt
  if(isKey('dash')&&!keys['_dashHeld']&&player.staminaRegen<=0&&stats.dashCD<=0&&dashDir!==0){
    player.stamina=0;
    player.staminaRegen=Math.max(60,130-Math.round(perkBonuses.dashCD||0));
    player.staminaRegenMax=player.staminaRegen; // für korrekte Balken-Anzeige mit Dash-Perk
    player.dashVx=dashDir*dashPow*1.8;
    player.dashInvince=9; // ~150ms Unverwundbarkeit
    player.dashFlash=12;
    stats.dashCD=stats.hasDash?40:55;
    shake(6,10);
    // Große Dash-Effekte
    for(let i=0;i<20;i++){
      const ang=Math.random()*Math.PI*2;
      sparks.push({
        x:player.x+player.w/2+(Math.random()-.5)*30,
        y:player.y+player.h/2+(Math.random()-.5)*30,
        vx:-dashDir*(Math.random()*7+3)+Math.cos(ang)*2,
        vy:(Math.random()-.5)*5,
        life:10,maxLife:10,
        color:Math.random()<0.4?'#00ffcc':Math.random()<0.5?'#0088ff':'#ffffff',
        size:Math.random()*3+1.5,muzzle:true
      });
    }
    // Dash-Trail: mehrere Afterimage-Positionen als Partikel
    for(let trail=0;trail<5;trail++){
      const tx=player.x-dashDir*trail*8;
      dustParticles.push({
        x:tx+player.w/2,y:player.y+player.h/2,
        vx:-dashDir*0.5,vy:0,
        life:0,maxLife:8+trail*2,
        col:'rgba(0,200,255,',size:14-trail*2,isSpark:false
      });
    }
    showMsg('DASH!');
  }
  keys['_dashHeld']=isKey('dash');
  if(stats.dashCD>0)stats.dashCD-=dt;
  if(player.dashVx!==0){player.x+=player.dashVx*dt;player.dashVx*=Math.pow(0.7,dt);if(Math.abs(player.dashVx)<0.5)player.dashVx=0;}
  player.x=Math.max(0,Math.min(GAME_W-player.w,player.x));
  // y wird durch Sprung-Physik gesetzt; onGround steuert Boden-Lock

  if(shootCD>0)shootCD-=dt;
  // ── Schießen: NUR Mausklick (Space ist Sprung-Taste)
  if(mouseDown)shoot();

  // ── Sprung: isKey('jump') = konfigurierbare Taste (Standard: Space/W/↑)
  const jumpKey=isKey('jump'); // Space/W/↑ je nach Binding

  // ── Sprung-System ──
  // Boden: Einfach-Sprung (halbe Höhe) ODER Start für Doppel-Sprung
  // In der Luft: einmaliger zweiter Sprung (halbe Höhe), danach gesperrt
  // Reset airJumpUsed erst nach kurzem Boden-Kontakt (jumpCooldown)
  const JUMP_H = 9.5;  // halbe Sprung-Höhe (Einzelsprung + Luft-Sprung gleich)
  if(jumpKey&&!keys['_jumpHeld']){
    if(player.onGround&&player.jumpCooldown<=0){
      // Erster Sprung vom Boden
      player.velY=-JUMP_H;
      player.onGround=false;player.jumpCount=1;player.airJumpUsed=false;
      for(let i=0;i<8;i++) dustParticles.push({
        x:player.x+player.w/2+(Math.random()-.5)*22,y:GROUND-2,
        vx:(Math.random()-.5)*5,vy:-(Math.random()*2+1),
        life:0,maxLife:14+Math.random()*8,col:'rgba(140,130,110,',size:Math.random()*3.5+1,isSpark:false
      });
      shake(2,4);
    } else if(!player.onGround&&!player.airJumpUsed){
      // Luft-Sprung: gleiche Höhe, einmalig
      player.velY=-JUMP_H;
      player.airJumpUsed=true;
      // Cyan-Funken als visuelles Feedback
      for(let i=0;i<10;i++) sparks.push({
        x:player.x+player.w/2+(Math.random()-.5)*18,
        y:player.y+player.h-4,
        vx:(Math.random()-.5)*5,vy:Math.random()*3+1,
        life:8,maxLife:8,color:'#00ccff',size:2.5,muzzle:true
      });
      shake(1,3);
    }
  }
  keys['_jumpHeld']=jumpKey;

  // Gravitation: asymmetrisch für knackiges Feeling
  if(!player.onGround){
    player.velY+=( player.velY<0 ? 0.62 : 1.05 )*dt;
    player.y+=player.velY*dt;
    if(player.y>=GROUND-player.h){
      player.y=GROUND-player.h;player.velY=0;
      player.onGround=true;player.jumpCount=0;
      // Cooldown nur wenn Doppelsprung benutzt wurde
      player.jumpCooldown=player.airJumpUsed?14:0;
      for(let i=0;i<10;i++) dustParticles.push({
        x:player.x+player.w/2+(Math.random()-.5)*28,y:GROUND-2,
        vx:(Math.random()-.5)*6,vy:-(Math.random()*1.5+0.5),
        life:0,maxLife:12+Math.random()*8,col:'rgba(160,140,110,',
        size:Math.random()*4+1,isSpark:Math.random()<0.2
      });
    }
  }
  // airJumpUsed reset: erst nach vollständigem Boden-Kontakt (jumpCooldown abgelaufen)
  if(player.onGround&&player.jumpCooldown<=0) player.airJumpUsed=false;
  if(player.jumpCooldown>0)player.jumpCooldown-=dt;

  // ── Dash-Cooldown (5s) ──
  // staminaRegen: 300→0 = die 5s die der Balken zeigt
  // Wenn staminaRegen=0 → dash bereit (stamina=100)
  if(player.staminaRegen>0){
    player.staminaRegen=Math.max(0,player.staminaRegen-dt);
    player.stamina=0; // während Wartezeit: nicht verfügbar
  } else {
    player.stamina=100; // bereit
  }
  if(player.dashFlash>0)player.dashFlash-=dt;
  if(player.dashInvince>0)player.dashInvince-=dt;

  // Stamina-Balken: zeigt Cooldown-Fortschritt (0=gerade gedashed, 100=bereit)
  // BUGFIX: mit Dash-Perk startete der Balken sonst bei ~50% statt 0%
  const maxRegen=player.staminaRegenMax||130;
  const stamPct=player.staminaRegen>0 ? (1-player.staminaRegen/maxRegen)*100 : 100;
  const stamEl=document.getElementById('stamfill');
  if(stamEl){
    stamEl.style.width=stamPct+'%';
    stamEl.style.background=stamPct>=100?'#00ccff':stamPct>60?'#00aacc':stamPct>30?'#ffaa00':'#ff4444';
    // Label: "BEREIT" oder Countdown
    const stamWrap=document.getElementById('stambar-wrap');
    if(stamWrap){
        stamWrap.firstChild.textContent=stamPct>=100?'DASH BEREIT':'DASH';
    }
  }

  const heatCool=(overheated?HEAT_COOL*0.5:HEAT_COOL)*(stats.heatCoolMult||1.0)*(perkBonuses.heatMult||1.0);
  heat=Math.max(0,heat-heatCool*dt);
  if(overheated&&heat<=OVERHEAT_RECOVER){overheated=false;showMsg('BEREIT!');}
  updateHeatBar();

  if(bgPhase>0&&Math.random()<0.05*dt)
    bgParticles.push({x:Math.random()*GAME_W,y:-10,vy:0.3+Math.random()*0.5,vx:(Math.random()-.5)*0.4,size:Math.random()*3+1,color:bgPhase===2?'rgba(0,255,80,0.14)':'rgba(255,60,0,0.11)',life:220});
  for(let i=bgParticles.length-1;i>=0;i--){
    const p=bgParticles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    if(p.life<=0||p.y>GROUND)bgParticles.splice(i,1);
  }

  // ── Blitz State Machine (ab Welle 4) ──
  if(bgPhase>=1){
    lightning.timer-=dt;
    switch(lightning.phase){
      case 'idle':
        if(lightning.timer<=0){
          // Neues Gewitter-Ereignis starten
          lightning.flashX=GAME_W*0.2+Math.random()*GAME_W*0.6; // Position
          lightning.intensity=0.7+Math.random()*0.5;
          lightning.alpha=1.0;
          lightning.phase='flash1';
          lightning.timer=2+Math.random()*3; // sehr kurzer erster Blitz (2-5 frames)
          shake(3,4);
        }
        break;
      case 'flash1':
        if(lightning.timer<=0){
          lightning.alpha=0;
          // 70% Chance auf zweiten Blitz
          if(Math.random()<0.7){
            lightning.phase='gap';
            lightning.timer=3+Math.random()*5; // kurze Dunkelheit
          } else {
            lightning.phase='fade';
            lightning.alpha=0.3;
            lightning.timer=0;
          }
        }
        break;
      case 'gap':
        if(lightning.timer<=0){
          lightning.alpha=lightning.intensity*1.2; // Hauptblitz heller
          lightning.phase='flash2';
          lightning.timer=6+Math.random()*8; // längerer Hauptblitz
          shake(5,6);
          // Donner etwas nach dem Blitz (Lichtgeschwindigkeit vs Schall)
          const thunderDelay=(200+Math.random()*600);
          setTimeout(()=>sndThunder(lightning.intensity),thunderDelay);
        }
        break;
      case 'flash2':
        if(lightning.timer<=0){
          // 40% Chance auf dritten kurzen Nachblitz
          if(Math.random()<0.4){
            lightning.alpha=0;
            lightning.phase='gap2';
            lightning.timer=2+Math.random()*3;
          } else {
            lightning.phase='fade';
            lightning.timer=0;
          }
        }
        break;
      case 'gap2':
        if(lightning.timer<=0){
          lightning.alpha=lightning.intensity*0.6;
          lightning.phase='flash3';
          lightning.timer=3+Math.random()*4;
        }
        break;
      case 'flash3':
        if(lightning.timer<=0){
          lightning.phase='fade';
          lightning.timer=0;
        }
        break;
      case 'fade':
        // Sanftes Ausfaden
        lightning.alpha-=0.055*dt;
        if(lightning.alpha<=0){
          lightning.alpha=0;
          lightning.phase='idle';
          // Nächstes Gewitter: häufiger in höheren Wellen
          const baseWait=bgPhase>=2?60:110;
          lightning.timer=baseWait+Math.random()*120;
        }
        break;
    }
  }

  // Wellen-Spawn
  if(waveState.active){
    if(waveState.spawned<waveState.total){
      waveState.spawnTimer-=dt;
      if(waveState.spawnTimer<=0){
        spawnEnemy();waveState.spawned++;
        document.getElementById('wavefill').style.width=Math.round(waveState.spawned/waveState.total*100)+'%';
        waveState.spawnTimer=waveState.spawnInterval;
      }
    }
    if(waveState.spawned>=waveState.total&&enemies.length===0&&!boss){
      if(wave>0&&wave%BOSS_WAVE===0){waveState.active=false;spawnBoss();}
      else{waveState.active=false;endWave();}
    }
  }

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.x+=b.vx*dt;b.y+=(b.vy||0)*dt;
    // Plasma-Trail
    if(b.type==='plasma'&&b.trail!==null){
      b.trail.push({x:b.x+b.w/2,y:b.y+b.h/2,life:12});
      if(b.trail.length>8)b.trail.shift();
      b.trail.forEach(t=>t.life-=dt);
    }
    if(b.x<-80||b.x>GAME_W+80||b.y<-60||b.y>GROUND+40)bullets.splice(i,1);
  }

  const now=Date.now(),pcx=player.x+player.w/2,pcy=player.y+player.h/2;
  if(boss)updateBoss(dt,pcx,pcy,now);
  // Feindliche Projektile → treffen Spieler
  // Feindliche Bullets: nur im playing-State und nur wenn Spieler nicht unverwundbar
  if(phase==='playing') for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];if(!b.enemy)continue;
    // Bullet-MITTE muss Spieler-Kern treffen
    const bcx=b.x+b.w/2,bcy=b.y+b.h/2;
    // Spieler-Kern: enger Bereich um Torso (nicht Arme, nicht Rand)
    const pkx=player.x+10, pky=player.y+12;
    const pkw=player.w-20, pkh=player.h-18;
    if(bcx>=pkx&&bcx<=pkx+pkw&&bcy>=pky&&bcy<=pky+pkh){
      hurtPlayer(b.dmg,b.vx>0?1:-1);
      for(let s=0;s<6;s++) sparks.push({
        x:bcx,y:bcy,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,
        life:8,maxLife:8,color:'#ff4400',size:3,muzzle:false
      });
      bullets.splice(i,1);
    }
  }
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];e.legAnim+=0.15*dt;if(e.hitFlash>0)e.hitFlash-=dt;
    if(e.flying&&e.state!=='dead'){
      // Float-Bewegung NUR außerhalb Hover (Flieger bleibt still beim Zielen)
      if(e.state!=='hover'){
        e.floatOffset+=e.floatSpeed*dt;
        e.y+=Math.sin(e.floatOffset)*0.5*dt;
      }
      e.shootCooldown=Math.max(0,e.shootCooldown-dt);
      const flyDist=Math.hypot((e.x+e.w/2)-pcx,(e.y+e.h/2)-pcy);
      if(flyDist<370&&flyDist>130&&e.shootCooldown<=0&&e.state==='chase'){
        e.state='hover'; e.hoverTimer=150;
        // Ziel einmalig beim Hover-Start festlegen
        const aimX=pcx+player.velX*8; // leichte Vorhersage
        const aimY=pcy;
        const adxFix=aimX-(e.x+e.w/2),adyFix=aimY-(e.y+e.h/2);
        const alenFix=Math.hypot(adxFix,adyFix)||1;
        e.laserDirX=adxFix/alenFix;
        e.laserDirY=adyFix/alenFix;
        e.laserFired=false;
      }
      if(e.state==='hover'){
        e.hoverTimer-=dt;
        // Laser-Startpunkt: immer aktueller Flieger-Mittelpunkt (Flieger bleibt still, also stabil)
        e.laserFromX=e.x+e.w/2;
        e.laserFromY=e.y+e.h/2;
        // Phase 1 (150→40): Warn-Laser sichtbar, kein Schuss
        // Phase 2 (40→0):  Schuss einmalig bei Timer=40
        if(!e.hasFired&&e.hoverTimer<=40&&e.hoverTimer>0){
          e.hasFired=true;
          e.laserFired=true; // Laser sofort ausblenden nach Schuss
          const aspd=4.5; // schneller aber noch ausweichbar
          const bStartX=e.laserFromX+(e.laserDirX||0)*32;
          const bStartY=e.laserFromY+(e.laserDirY||0)*32;
          bullets.push({
            x:bStartX-5,y:bStartY-5,
            vx:(e.laserDirX||0)*aspd,
            vy:(e.laserDirY||0)*aspd,
            w:14,h:14,
            dmg:e.dmg,pierce:false,aoe:false,
            type:'enemy',enemy:true
          });
          e.shootCooldown=150;
        }
        if(e.hoverTimer<=0){e.state='chase';e.hasFired=false;e.laserFired=false;}
      }
    }
      const touching=e.x<player.x+player.w&&e.x+e.w>player.x&&e.y<player.y+player.h&&e.y+e.h>player.y;
    const dist=Math.hypot((e.x+e.w/2)-pcx,(e.y+e.h/2)-pcy);

    // ── SPRUNG-STOMP ──
    // Bedingungen: Spieler fällt (velY>1), berührt Gegner,
    // Spieler-Mitte ist ÜBER Gegner-Oberkante+20px
    const stomping = !player.onGround
      && player.velY > 1
      && player.y + player.h*0.5 < e.y + 20  // Spieler-Mitte über Gegner-Kopf
      && !e.stomped
      && e.state!=='dead'; // sterbende Flieger nicht stompen
    if(touching && stomping){
      const stompBase=e.subtype==='tank'?3:e.elite?5:2;
      const stompDmg=Math.round(stompBase*(stats.stompMult||1.0)*(perkBonuses.stompMult||1.0));
      e.hp-=stompDmg;e.hitFlash=8;e.stomped=true;
      dmgNum(e.x+e.w/2,e.y,stompDmg,true);
      player.velY=-9; // Abprall
      player.onGround=false;
      shake(4,6);sndImpact(false);
      floatText(e.x+e.w/2,e.y-10,'STOMP!','#ffd700');
      if(e.hp<=0){
        if(e.flying){startFlyerDeath(e);continue;}
        gore(e.x+e.w/2,e.y+e.h/2,e.elite?30:15,e.elite);
        sndKill(e.elite);freezeFrames=e.elite?3:1;
        dropScrap(e.x+e.w/2,e.y+e.h/2,e.elite?4:1);
        kills++;noDmgStreak++;
        document.getElementById('hkills').textContent=kills;
        checkLevelUp();
        delete lastEnemyHit[e.id];enemies.splice(i,1);continue;
      }
    }
    // stomped zurücksetzen sobald Spieler nicht mehr berührt
    if(!touching) e.stomped=false;
    const prev=e.state;
    // Flieger: kein attack-State durch touching — nur chase/hover
    // Boden-Gegner: normaler State-Wechsel
    if(e.flying){
      if(e.state!=='hover'&&e.state!=='dead'){
        e.state=dist<GAME_W*0.55?'chase':'walk';
      }
    } else {
      e.state=touching?'attack':dist<GAME_W*0.55?'chase':'walk';
    }
    if(prev!=='attack'&&e.state==='attack')e.attackTimer=0;
    if(e.state==='walk')  e.x+=e.vx*dt;
    else if(e.state==='chase'){
      const dir=pcx>e.x+e.w/2?1:-1;
      e.x+=dir*e.baseSpd*1.5*dt;
      if(e.flying){
        // Flieger hält horizontalen Mindestabstand (140px)
        const hDist=Math.abs((e.x+e.w/2)-pcx);
        if(hDist<140){
          // Zu nah: wegbewegen statt verfolgen
          const awayDir=(e.x+e.w/2)<pcx?-1:1;
          e.x+=awayDir*e.baseSpd*dt;
        }
        // Vertikale Position: obere Hälfte des Spielfelds
        const targetY=Math.max(70,Math.min(320,pcy-90)); // variabler
        e.y+=(targetY-(e.y+e.h/2))*0.02*dt;
        e.y=Math.max(60,Math.min(350,e.y)); // mehr Höhenbereich
      }
    } else if(e.state==='hover'){
      // Flieger im Hover: KEIN Nahkampf-Schaden, nur Schuss-KI oben
    } else {
      // attack-State: nur Nahkampf für BODEN-Gegner
      if(!e.flying){
        e.attackTimer+=dt;
        const atkInterval=Math.max(8,16-Math.floor(wave*0.5));
        if(e.attackTimer>=atkInterval){
          const k=e.id; // BUGFIX: Index-Keys wanderten beim Splicen auf andere Gegner
          const atkCooldown=wave>=5?200:300;
          if(!lastEnemyHit[k]||now-lastEnemyHit[k]>atkCooldown){
            lastEnemyHit[k]=now;hurtPlayer(e.dmg,pcx>e.x+e.w/2?1:-1);e.attackTimer=0;
          }
        }
      }
    }
    // Flieger Tod-Explosion
    if(e.state==='dead'&&e.flying){
      e.deathTimer-=dt;
      e.y+=0.9*dt; // BUGFIX: fällt jetzt wirklich (vorher stieg er nach oben)
      // Rauch & Funken während des Absturzes
      if(Math.random()<0.5*dt)sparks.push({
        x:e.x+e.w/2+(Math.random()-.5)*12,y:e.y+e.h/2,
        vx:(Math.random()-.5)*2,vy:-Math.random()*1.5,
        life:14,maxLife:14,color:Math.random()<0.5?'#ff8800':'#666666',size:3,muzzle:true
      });
      if(e.deathTimer<=0){
        // AOE-Explosion
        gore(e.x+e.w/2,e.y+e.h/2,40,true);
        shake(8,12);sndImpact(true);
        // AOE-Schaden
        const exDist=Math.hypot((e.x+e.w/2)-pcx,(e.y+e.h/2)-pcy);
        if(exDist<80) hurtPlayer(8,pcx>e.x+e.w/2?-1:1);
        dropScrap(e.x+e.w/2,e.y+e.h/2,3);
        kills++;noDmgStreak++;sndKill(false);freezeFrames=3;
        document.getElementById('hkills').textContent=kills;
        checkLevelUp();
        delete lastEnemyHit[e.id];enemies.splice(i,1);continue;
      }
    }
    if(e.knockVx!==0){e.x+=e.knockVx*dt;e.knockVx*=Math.pow(0.7,dt);if(Math.abs(e.knockVx)<0.2)e.knockVx=0;}
    if(e.x>GAME_W+90||e.x<-90){
      if(!e.flying) hurtPlayer(Math.ceil(e.dmg*0.4),0); // Flieger geben keinen Rand-Schaden
      enemies.splice(i,1);continue;
    }

    // ── GEGNER-FÄHIGKEITEN ──
    // Elite: langsame Regeneration
    if(e.regen&&e.hp<e.maxHp){
      e.hp=Math.min(e.maxHp,e.hp+0.025*dt); // 3x schneller, deutlich spürbar
      // Gelegentlich "+HP" Text
      if(Math.random()<0.004*dt) floatText(e.x+e.w/2,e.y,'↑ REGEN','#00ff66');
    }
    // Panzer: Absorb-Cooldown
    if(e.absorbCooldown>0) e.absorbCooldown-=dt;

    if(e.state!=='dead')for(let j=bullets.length-1;j>=0;j--){
      const b=bullets[j];if(!b||b.enemy)continue; // feindliche Bullets ignorieren
      if(b.x<e.x+e.w&&b.x+b.w>e.x&&b.y<e.y+e.h&&b.y+b.h>e.y){
        // BUGFIX: Pierce-Bullets trafen denselben Gegner jeden Frame beim Durchflug
        if(b.pierce){
          if(!b.hitIds)b.hitIds={};
          if(b.hitIds[e.id])continue;
          b.hitIds[e.id]=1;
        }
        // Schnell: 20% Ausweich-Chance
        if(e.dodge&&!b.aoe&&Math.random()<0.28){
          const dodgeDir=Math.random()<0.5?1:-1;
          e.x+=dodgeDir*28; // deutlicherer Sprung
          // Mehrere Funken für bessere Sichtbarkeit
          for(let sp=0;sp<8;sp++) sparks.push({
            x:e.x+e.w/2,y:e.y+e.h/2,
            vx:dodgeDir*(Math.random()*5+2),vy:(Math.random()-.5)*4,
            life:10,maxLife:10,color:'#ffcc00',size:2.5,muzzle:true
          });
          floatText(e.x+e.w/2,e.y-8,'DODGE!','#ffcc00');
          if(!b.pierce) bullets.splice(j,1);
          continue;
        }
        // Panzer: 1× Absorption
        if(e.absorb&&!b.aoe&&e.absorbCooldown<=0){
          e.absorb=false; e.absorbCooldown=60;
          e.hitFlash=18; // länger sichtbar
          floatText(e.x+e.w/2,e.y-4,'SCHILD!','#88ff44');
          shake(3,5);
          // Explosion von grünen Partikeln
          for(let sp=0;sp<12;sp++){
            const a=Math.random()*Math.PI*2;
            sparks.push({
              x:e.x+e.w/2,y:e.y+e.h/2,
              vx:Math.cos(a)*5,vy:Math.sin(a)*5,
              life:12,maxLife:12,color:'#88ff44',size:3,muzzle:true
            });
          }
          if(!b.pierce) bullets.splice(j,1);
          continue;
        }
        e.hp-=b.dmg;e.hitFlash=8;
        // Damage Number
        dmgNum(e.x+e.w/2, e.y, b.dmg, b.aoe||b.dmg>=3);
        const kbForce=b.aoe?5:stats.spread>1?3.5:1.2;
        e.knockVx=(b.vx>0?1:-1)*kbForce;
        if(!b.pierce)bullets.splice(j,1);
        // Impact Sparks
        const impX=b.x+b.w/2,impY=b.y+b.h/2;
        for(let sp=0;sp<(b.aoe?8:4);sp++){
          const sa=Math.random()*Math.PI*2,ss=Math.random()*4+2;
          sparks.push({x:impX,y:impY,vx:-b.vx*0.3+Math.cos(sa)*ss,vy:-(b.vy||0)*0.3+Math.sin(sa)*ss,
            life:8,maxLife:8,color:b.aoe?'#ff8800':Math.random()<0.5?'#ffee44':'#ffffff',size:Math.random()*2+1,muzzle:false});
        }
        gore(e.x+e.w/2,e.y+e.h/2,b.aoe?14:6,!!b.aoe);
        shake(b.aoe?14:3,b.aoe?16:4);sndImpact(!!b.aoe);
        if(e.hp<=0){
          if(e.flying){startFlyerDeath(e);break;} // Flieger: Absturz + Explosion statt Sofort-Tod
          gore(e.x+e.w/2,e.y+e.h/2,e.elite?30:20,e.elite);
          shake(e.elite?15:8,13);sndKill(e.elite);
          // Blutfleck
          bloodDecals.push({x:e.x+e.w/2+(Math.random()-.5)*20,y:GROUND,r:e.elite?22:e.flying?8:13,alpha:0.5+Math.random()*0.2,maxAlpha:0.5+Math.random()*0.2,born:Date.now()});
          if(Math.random()<0.5)bloodDecals.push({x:e.x+e.w/2+(Math.random()-.5)*30,y:GROUND,r:e.elite?10:5,alpha:0.3,maxAlpha:0.3,born:Date.now()});
          // Elite-Trümmer
          if(e.elite){
            [[8,14],[12,8],[6,10],[10,6]].forEach(([dw,dh],di)=>{
              debris.push({x:e.x+e.w/2+(Math.random()-.5)*16,y:e.y+e.h/2+(Math.random()-.5)*10,
                vx:(Math.random()-.5)*9,vy:-Math.random()*7-2,rot:Math.random()*Math.PI*2,
                rotSpd:(Math.random()-.5)*0.25,w:dw,h:dh,
                color:['#7a1100','#aa2200','#cc3300','#551100'][di],
                life:90+Math.random()*60,onGround:false});
            });
          }
          // Basis-Schrott: weniger als vorher, Streak-Bonus separat (nicht mit scrapBonus multipliziert)
          const scrAmt=e.elite?4:e.flying?2:1;  // flacher, wave-unabhängig
          const streakBonus=Math.floor(noDmgStreak/8); // schwerer zu erreichen
          dropScrap(e.x+e.w/2,e.y+e.h/2,scrAmt); // scrapBonus wirkt hier
          // Streak-Bonus direkt als Schrott ohne Multiplikator
          if(streakBonus>0){
            scrap+=streakBonus;
            document.getElementById('hscrap').textContent=scrap;
            floatText(e.x+e.w/2,e.y-14,'STREAK +'+streakBonus,'#ffaa00');
          }
          floatText(e.x+e.w/2,e.y,e.elite?'ELITE!':e.flying?'FLIEGER!':'+'+scrAmt,'#ffd700');
          freezeFrames=e.elite?3:1; // FREEZE FRAME
          kills++;noDmgStreak++;document.getElementById('hkills').textContent=kills;
          checkLevelUp();
          delete lastEnemyHit[e.id];enemies.splice(i,1);
        }
        break;
      }
    }
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    if(!p.onGround){p.vy+=0.3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=GROUND){p.y=GROUND;p.onGround=true;p.vx*=0.45;}}
    else p.vx*=Math.pow(0.85,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1);
  }
  for(let i=muzzleFlashes.length-1;i>=0;i--){muzzleFlashes[i].life-=dt;if(muzzleFlashes[i].life<=0)muzzleFlashes.splice(i,1);}
  for(let i=sparks.length-1;i>=0;i--){
    const sp=sparks[i];sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;
    if(!sp.muzzle)sp.vy+=0.35*dt;sp.vx*=Math.pow(0.88,dt);sp.vy*=Math.pow(sp.muzzle?0.7:0.92,dt);sp.life-=dt;
    if(sp.life<=0)sparks.splice(i,1);
  }
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i];
    if(!d.onGround){d.vy+=0.4*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.rotSpd*dt;if(d.y>=GROUND-d.h/2){d.y=GROUND-d.h/2;d.onGround=true;d.vx*=0.4;d.vy=0;}}
    else d.vx*=Math.pow(0.8,dt);d.life-=dt;if(d.life<=0)debris.splice(i,1);
  }

  const nowMs=Date.now();
  for(let i=scraps.length-1;i>=0;i--){
    const s=scraps[i];
    if(nowMs>s.expiry){scraps.splice(i,1);continue;}
    const dist=Math.hypot(s.x-pcx,s.y-pcy);
    if(dist<130||s.attracted){
      s.attracted=true;const dx=pcx-s.x,dy=pcy-s.y,d=Math.hypot(dx,dy)||1;
      s.vx=dx/d*Math.min(10,180/d);s.vy=dy/d*Math.min(10,180/d);
    } else if(!s.settled){s.vy+=0.28*dt;if(s.y>=GROUND-6){s.y=GROUND-6;s.vy=0;s.settled=true;}}
    s.x+=s.vx*dt;s.y+=s.vy*dt;
    if(dist<18){scrap+=s.val;document.getElementById('hscrap').textContent=scrap;scraps.splice(i,1);if(Math.random()<0.3)sndPickup();}
  }
  for(let i=floatTexts.length-1;i>=0;i--){floatTexts[i].y+=floatTexts[i].vy*dt;floatTexts[i].life-=dt;if(floatTexts[i].life<=0)floatTexts.splice(i,1);}

  draw();requestAnimationFrame(update);
}

