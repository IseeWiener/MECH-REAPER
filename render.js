// ═══════════════════════════════════════════════════════════════
// render.js — Hintergrund, Mech, Gegner, Draw-Loop, CRT
// ═══════════════════════════════════════════════════════════════
// ── DRAW ─────────────────────────────────────────────────────
// ── PROZEDURALES GEBÄUDE-SYSTEM ─────────────────────────────
// Kern-Idee: jedes Gebäude hat eine integer Welt-X-Koordinate.
// Screen-X = worldX - Math.floor(player.x * factor)
// Durch Math.floor() auf BEIDE Seiten: immer Ganzzahl-Positionen,
// KEIN Subpixel-Jitter, KEIN Float-Akkumulations-Drift.

// Hash: gibt float in [0,1) für gegebenen Integer-Index zurück
function bHash(n){
  // Wang-Hash — schnell, kein sin(), deterministisch
  n=(n^61)^(n>>>16);n+=n<<3;n^=n>>>4;n*=0x27d4eb2d;n^=n>>>15;
  return (n>>>0)/4294967296;
}

// Gebäude-Cache (bgStyle-abhängig — wird bei Stil-Wechsel geleert)
const _bCache={};
let _bCacheStyle='city';
function getBuilding(idx, layer){
  // Cache leeren wenn Stil wechselt
  if(_bCacheStyle!==bgStyle){
    Object.keys(_bCache).forEach(k=>delete _bCache[k]);
    Object.keys(_bPosCache).forEach(k=>delete _bPosCache[k]);
    _bCacheStyle=bgStyle;
  }
  const key=(layer<<20)|idx;
  if(_bCache[key])return _bCache[key];
  const r1=bHash(idx*3+layer*7+1);
  const r2=bHash(idx*3+layer*7+2);
  const r3=bHash(idx*3+layer*7+3);
  let w,h,gap;
  if(bgStyle==='industrial'){
    // Industrieanlage: breite niedrige Tanks + schmale hohe Türme
    w=layer===0?(30+Math.floor(r1*60)):(20+Math.floor(r1*80));
    h=layer===0?(60+Math.floor(r2*60)):(100+Math.floor(r2*180));
    gap=layer===0?(8+Math.floor(r3*20)):(4+Math.floor(r3*12));
  } else if(bgStyle==='ruins'){
    // Ruinen: unregelmäßig, niedriger, mehr Lücken
    w=layer===0?(20+Math.floor(r1*50)):(30+Math.floor(r1*60));
    h=layer===0?(40+Math.floor(r2*80)):(60+Math.floor(r2*100));
    gap=layer===0?(15+Math.floor(r3*40)):(8+Math.floor(r3*30));
  } else {
    // Stadt: Original
    w=layer===0?(42+Math.floor(r1*28)):(58+Math.floor(r1*52));
    h=layer===0?(112+Math.floor(r2*78)):(145+Math.floor(r2*108));
    gap=layer===0?(5+Math.floor(r3*7)):(3+Math.floor(r3*5));
  }
  return (_bCache[key]={w,h,gap});
}

// Gibt die akkumulierte Welt-X-Position von Gebäude idx zurück (INTEGER)
// Berechnet über Präfix-Summe — keine Floating-Point-Akkumulation
const _bPosCache={};
function getBuildingWorldX(idx, layer){
  if(idx===0)return 0;
  const key=(layer<<20)|idx;
  if(_bPosCache[key])return _bPosCache[key];
  const prev=getBuildingWorldX(idx-1,layer);
  const b=getBuilding(idx-1,layer);
  const pos=prev+b.w+b.gap;
  return(_bPosCache[key]=pos);
}

// Zeichne eine komplette Parallax-Ebene pixelgenau
function drawProceduralLayer(layer, parallaxFactor, drawFn){
  // Scroll-Offset als INTEGER (Math.floor verhindert Subpixel-Jitter)
  const scrollOff = Math.floor(player.x * parallaxFactor);

  // Schätze Startindex: avg Breite pro Layer
  const avgStep = layer===0 ? 59 : 84;
  let idx = Math.max(0, Math.floor(scrollOff/avgStep)-3);

  // Spule idx vor bis worldX des Gebäudes in der Nähe des linken Rands ist
  // Nutze cached Positionen — keine Schleife mit Akkumulation
  while(idx>0 && getBuildingWorldX(idx,layer) > scrollOff-200) idx--;

  // Zeichne bis rechts raus
  for(let iter=0;iter<80;iter++){
    const worldX = getBuildingWorldX(idx,layer);
    // Screen-X: ebenfalls INTEGER durch Math.floor oben
    const sx = worldX - scrollOff;

    if(sx > GAME_W+10) break;
    if(sx + getBuilding(idx,layer).w > -10){
      const b=getBuilding(idx,layer);
      drawFn(sx, b.w, b.h, idx);
    }
    idx++;
  }
}

function drawBackground(){
  const skyColors=['#0d0d1a','#1a0808','#071a07','#1a0400','#0a0005'];
  cx.fillStyle=skyColors[bgPhase];cx.fillRect(0,0,GAME_W,GAME_H);

  // ── 3-Ebenen Sternenhimmel ──
  const now=performance.now();
  stars.forEach(s=>{
    // Flicker: Sinus-basiertes Dimmen
    if(s.flicker){
      s.flickerPhase+=s.flickerSpeed;
      s.a=s.baseA*(0.7+0.3*Math.sin(s.flickerPhase));
    } else {
      s.a=s.baseA;
    }
    // Parallax: Sterne-X verschiebt sich mit parallaxOffset
    const sx=((s.x - player.x*s.parallaxFactor)%GAME_W+GAME_W)%GAME_W;
    const phaseFade=bgPhase===0?1.0:bgPhase===1?0.35:0.2;
    const alpha=s.a*phaseFade;
    if(bgPhase===0)cx.fillStyle=`rgba(200,220,255,${alpha})`;
    else if(bgPhase===1)cx.fillStyle=`rgba(255,180,160,${alpha})`;
    else if(bgPhase===2)cx.fillStyle=`rgba(160,255,200,${alpha})`;
    else if(bgPhase===3)cx.fillStyle=`rgba(255,120,80,${alpha})`;
    else cx.fillStyle=`rgba(220,100,255,${alpha})`;
    const sxi=Math.floor(sx); // Integer-Pixel für Sterne
    cx.fillRect(sxi, s.y, s.size, s.size);
    // Wrap: Stern erscheint auf der anderen Seite
    if(sxi<s.size) cx.fillRect(sxi+GAME_W, s.y, s.size, s.size);
    if(sxi>GAME_W-s.size) cx.fillRect(sxi-GAME_W, s.y, s.size, s.size);
  });

  bgParticles.forEach(p=>{cx.fillStyle=p.color;cx.fillRect(p.x,p.y,p.size,p.size);});

  // ── Gewitter-Blitz: extremer Kontrast-Flash ──
  if(lightning.alpha>0){
    const la=lightning.alpha;
    // Himmel: Blau-Weiß aufleuchten
    const skyFlash=Math.min(1,la*1.2);
    cx.fillStyle=`rgba(180,210,255,${skyFlash*0.55})`;
    cx.fillRect(0,0,GAME_W,GROUND);
    // Bei sehr hellen Blitzen: fast weißer Himmel
    if(la>0.8){
      cx.fillStyle=`rgba(230,240,255,${(la-0.8)*1.5})`;
      cx.fillRect(0,0,GAME_W,GROUND);
    }
  }

  // Farben je Phase
  // Gebäudefarben: deutlich sichtbar gegen den Himmel
  const bldColFar=['#141428','#200808','#061806','#160300','#0d000d'][Math.min(bgPhase,4)];
  const bldCol   =['#1c1c38','#2a0a0a','#081e08','#200400','#120012'][Math.min(bgPhase,4)];
  const winCol   =['rgba(0,255,200,0.12)','rgba(255,80,0,0.14)','rgba(0,255,80,0.11)','rgba(255,60,0,0.18)','rgba(200,0,255,0.13)'][Math.min(bgPhase,4)];

  cx.save();
  cx.beginPath();cx.rect(0,0,GAME_W,GAME_H);cx.clip();

  // Hintere Gebäude-Ebene (layer=0, langsam)
  drawProceduralLayer(0, 0.18, (bx,bw,bh)=>{
    cx.fillStyle=bldColFar;
    cx.fillRect(bx,GROUND-bh,bw,bh);
  });

  // Vordere Gebäude-Ebene (layer=1, schneller, mit Fenstern)
  drawProceduralLayer(1, 0.40, (bx,bw,bh,idx)=>{
    cx.fillStyle=bldCol;
    cx.fillRect(bx,GROUND-bh,bw,bh);
    // Fenster
    cx.fillStyle=winCol;
    for(let wy=GROUND-bh+10;wy<GROUND-10;wy+=18)
      for(let wx=bx+6;wx<bx+bw-8;wx+=14)cx.fillRect(Math.floor(wx),wy,6,9);
  });

  // ── Blitz-Silhouette: Gebäude werden SCHWÄRZER (Kontrast-Effekt) ──
  if(lightning.alpha>0.3){
    cx.save();
    cx.beginPath();cx.rect(0,0,GAME_W,GAME_H);cx.clip();
    const silAlpha=Math.min(0.75,(lightning.alpha-0.3)*1.2);
    // Hintere Gebäude: fast schwarz
    drawProceduralLayer(0, 0.18, (bx,bw,bh)=>{
      cx.fillStyle=`rgba(2,2,8,${silAlpha*0.9})`;
      cx.fillRect(bx,GROUND-bh,bw,bh);
    });
    // Vordere Gebäude: komplett schwarz
    drawProceduralLayer(1, 0.40, (bx,bw,bh)=>{
      cx.fillStyle=`rgba(1,1,4,${silAlpha})`;
      cx.fillRect(bx,GROUND-bh,bw,bh);
    });
    cx.restore();
  }

  cx.restore();

  // Boden
  cx.fillStyle=['#0e0e22','#180606','#051204','#140200','#08000c'][Math.min(bgPhase,4)];
  cx.fillRect(0,GROUND,GAME_W,GAME_H-GROUND);
  const lineCol=['#00ffcc','#ff4400','#00ff44','#ff2200','#aa00ff'][Math.min(bgPhase,4)];
  cx.fillStyle=lineCol;cx.globalAlpha=0.7;cx.fillRect(0,GROUND,GAME_W,2);cx.globalAlpha=1;
}

function drawMech(){
  cx.save();
  // Lauf-Tilt
  const mechCX=player.x+player.w/2,mechCY=player.y+player.h*0.6;
  cx.translate(mechCX,mechCY);cx.rotate(player.tilt);cx.translate(-mechCX,-mechCY);
  if(player.facing===-1){cx.translate(player.x+player.w/2,0);cx.scale(-1,1);cx.translate(-(player.x+player.w/2),0);}

  const rx=player.x,ry=player.y;
  const t=Date.now()*0.013;
  const onGr=player.onGround,airTime=!onGr;
  const lo=onGr&&player.moving?Math.sin(t)*6:0;
  const lo2=onGr&&player.moving?Math.sin(t+Math.PI)*6:0;
  const bob=onGr&&player.moving?Math.abs(Math.sin(t))*2.5:0;
  const hx=hurtFlash>0?(Math.random()-.5)*4:0;
  const by=ry+bob;
  const upg=upgrades.left.some(u=>u.level>0)||upgrades.right.some(u=>u.level>0);
  const mechMidX0=rx+player.w/2;

  // ── 3D-Werte ──
  const rawHoriz0=(mouseX-mechMidX0)*player.facing;
  const dz0=70;
  const hLook=rawHoriz0<-dz0?Math.max(-1,(rawHoriz0+dz0)/110):rawHoriz0>dz0?Math.min(1,(rawHoriz0-dz0)/110):0;
  const vLook=Math.max(-1.8,Math.min(1.2,player.aimTilt));

  // bl: Body-Look 0=frontal, 1=volle Seitenansicht
  // Richtung: positiv=läuft rechts (facing-Seite), negativ=läuft links
  const bl=player.bodyLookSmooth*player.facing; // -1..+1
  const blAbs=Math.abs(bl);                     // 0..1 Stärke

  cx.save();cx.translate(hx,0);

  // ── SCHATTEN ──
  if(airTime){
    const sY=GROUND-2,sDist=GROUND-player.h-player.y;
    const sA=Math.max(0,0.35-sDist*0.003);
    const sW=Math.max(8,(player.w-sDist*0.3)*(1-blAbs*0.4));
    cx.save();cx.globalAlpha=sA;cx.fillStyle='#000018';
    cx.beginPath();cx.ellipse(mechMidX0,sY,sW*0.7,4,0,0,Math.PI*2);cx.fill();cx.restore();
  }

  // ════════════════════════════════════════════════════
  // BEINE — Frontal interpoliert zu Seite
  // ════════════════════════════════════════════════════
  const legDark=upg?'#2a0010':'#1a1a2e';
  const legMid =upg?'#1a000a':'#141428';
  const bootCol='#0044aa';

  if(airTime){
    // Sprung: Beine eingezogen
    const jT=Math.min(1,Math.abs(player.velY)/12);
    cx.fillStyle=legDark;
    cx.save();cx.translate(rx+13,by+40);cx.rotate(-0.4*(1-blAbs));cx.fillRect(-6,-6,12,12);cx.restore();
    cx.save();cx.translate(rx+27*(1-blAbs*0.5),by+40);cx.rotate(0.4*(1-blAbs));cx.fillRect(-6,-6,12*(1-blAbs*0.4),12);cx.restore();
    cx.fillStyle=legMid;
    cx.save();cx.translate(rx+13,by+48);cx.rotate((-0.9+jT*0.3)*(1-blAbs));cx.fillRect(-4,-4,8,14);cx.restore();
    cx.save();cx.translate(rx+27*(1-blAbs*0.5),by+48);cx.rotate((0.9-jT*0.3)*(1-blAbs));cx.fillRect(-4*(1-blAbs*0.5),-4,8*(1-blAbs*0.4),14);cx.restore();
    if(stats.spikeBoots){
      cx.fillStyle='#aa6600';
      cx.save();cx.translate(rx+10,by+56-jT*12);cx.rotate(-0.5*(1-blAbs));
      cx.fillRect(-7,-3,16,6);  // Stiefel
      cx.fillStyle='#ffcc00';
      for(let s=0;s<3;s++)cx.fillRect(-6+s*5,-3+6,3,5);
      cx.restore();
      cx.fillStyle='#aa6600';
      cx.save();cx.translate(rx+30*(1-blAbs*0.45),by+56-jT*12);cx.rotate(0.5*(1-blAbs));
      cx.fillRect(-7*(1-blAbs*0.5),-3,16*(1-blAbs*0.5),6);
      cx.fillStyle='#ffcc00';
      for(let s=0;s<3;s++)cx.fillRect(-5+s*4,-3+6,3,5);
      cx.restore();
    } else {
      cx.fillStyle=bootCol;
      cx.save();cx.translate(rx+10,by+56-jT*12);cx.rotate(-0.5*(1-blAbs));cx.fillRect(-6,-3,14,5);cx.restore();
      cx.save();cx.translate(rx+30*(1-blAbs*0.45),by+56-jT*12);cx.rotate(0.5*(1-blAbs));cx.fillRect(-6*(1-blAbs*0.5),-3,14*(1-blAbs*0.5),5);cx.restore();
    }
  } else {
    // FRONTAL (blAbs=0): zwei Beine nebeneinander
    // SEITE (blAbs=1): ein Bein hinter dem anderen, Lauf-Animation
    // Interpoliert dazwischen
    // Bein-Positionen: beide rücken zusammen wenn Mech sich dreht
    // blAbs=0: links=rx+7, rechts=rx+21 (nebeneinander)
    // blAbs=1: beide bei rx+12/rx+16 (übereinander = Seitenansicht)
    const legLX = rx + 7  + blAbs*5;   // rx+7  → rx+12
    const legRX = rx + 21 - blAbs*5;   // rx+21 → rx+16
    const legRAlpha = 1 - blAbs*0.55;  // hinteres Bein transparenter

    // Animation immer aktiv wenn bewegt (auch während Dreh-Übergang)
    const loA  = player.moving ? lo  : 0;
    const lo2A = player.moving ? lo2 : 0;

    // Vorderes/linkes Bein
    cx.fillStyle=legDark; cx.fillRect(legLX,    by+34, 12, 14+loA);
    cx.fillStyle=legMid;  cx.fillRect(legLX+1,  by+47+loA, 10, 10);
    // Boot + optionale Stacheln
    const bootLY=by+56+loA;
    if(stats.spikeBoots){
      cx.fillStyle='#aa6600'; cx.fillRect(legLX-4, bootLY, 20, 6);   // Stiefel
      cx.fillStyle='#cc8800'; cx.fillRect(legLX-4, bootLY, 20, 3);   // Glanz oben
      cx.fillStyle='#ffcc00';  // Stacheln
      for(let s=0;s<4;s++) cx.fillRect(legLX-3+s*5, bootLY+5, 3, 5+s%2*2);
    } else {
      cx.fillStyle=bootCol; cx.fillRect(legLX-3, bootLY, 18, 5);
      cx.fillStyle='rgba(0,150,255,0.3)'; cx.fillRect(legLX-3, bootLY, 18, 2);
    }
    cx.fillStyle='#2a2a50'; cx.fillRect(legLX+1, by+45+loA, 8, 4);

    // Hinteres/rechtes Bein
    cx.globalAlpha = legRAlpha;
    cx.fillStyle=legDark; cx.fillRect(legRX,    by+34, 12, 14+lo2A);
    cx.fillStyle=legMid;  cx.fillRect(legRX+1,  by+47+lo2A, 10, 10);
    const bootRY=by+56+lo2A;
    if(stats.spikeBoots){
      cx.fillStyle='#aa6600'; cx.fillRect(legRX-4, bootRY, 20, 6);
      cx.fillStyle='#cc8800'; cx.fillRect(legRX-4, bootRY, 20, 3);
      cx.fillStyle='#ffcc00';
      for(let s=0;s<4;s++) cx.fillRect(legRX-3+s*5, bootRY+5, 3, 5+s%2*2);
    } else {
      cx.fillStyle=bootCol; cx.fillRect(legRX-3, bootRY, 18, 5);
    }
    cx.fillStyle='#2a2a50'; cx.fillRect(legRX+1, by+45+lo2A, 8, 4);
    cx.globalAlpha = 1;
  }

  // ════════════════════════════════════════════════════
  // TORSO — Frontal→Seite per cx.scale + Seiten-Blende
  // ════════════════════════════════════════════════════
  // Breite schrumpft auf ~40% bei voller Seite (schmal wie eine Schulter)
  const bodyScaleX=1.0-blAbs*0.60;
  const torsoW=36,torsoH=24;
  const tCX=rx+20,tCY=by+26;
  cx.save();
  cx.translate(tCX,tCY);cx.scale(bodyScaleX,1);cx.translate(-tCX,-tCY);
  cx.fillStyle=upg?'#5a0000':'#1a1a3e';cx.fillRect(rx+2,by+14,torsoW,torsoH);
  cx.fillStyle=upg?'#3a0000':'#111130';
  cx.fillRect(rx+2,by+14,torsoW,5);
  cx.fillRect(rx+2,by+24,torsoW,2);
  // Rückseiten-Blende
  const bSW=Math.max(0,Math.round(5*(1-blAbs*1.1)));
  if(bSW>0){cx.fillStyle='#06060f';cx.fillRect(rx+2,by+14,bSW,torsoH);}
  // Vorderkante-Glanz
  cx.fillStyle=upg?'rgba(255,60,60,0.3)':'rgba(80,120,220,0.3)';
  cx.fillRect(rx+2+torsoW-3,by+15,2,torsoH-2);
  // Schulterplatte oben
  cx.fillStyle=upg?'#500000':'#181838';cx.fillRect(rx+1,by+13,38,5);
  cx.restore();

  // Energie-Kern (weniger Skalierung → bleibt sichtbarer)
  const coreGlow=upg?'rgba(255,0,80,':'rgba(0,200,255,';
  const cCX=tCX,cCY=tCY;
  cx.save();
  cx.translate(cCX,cCY);cx.scale(Math.max(0.3,bodyScaleX),1);cx.translate(-cCX,-cCY);
  cx.fillStyle=coreGlow+'0.18)';cx.fillRect(rx+13,by+17,14,17);
  cx.fillStyle=coreGlow+'0.55)';cx.fillRect(rx+16,by+20,8,11);
  cx.fillStyle=coreGlow+'0.85)';cx.fillRect(rx+18,by+22,4,7);
  cx.fillStyle='rgba(255,255,255,0.25)';cx.fillRect(rx+18,by+22,2,3);
  cx.restore();

  // Schild-Aura
  if(stats.shieldUp){
    cx.strokeStyle='rgba(0,200,255,0.55)';cx.lineWidth=3;
    cx.beginPath();cx.arc(rx+20,by+26,34,0,Math.PI*2);cx.stroke();
    cx.strokeStyle='rgba(0,200,255,0.2)';cx.lineWidth=1;
    cx.beginPath();cx.arc(rx+20,by+26,38,0,Math.PI*2);cx.stroke();
  }

  // ════════════════════════════════════════════════════
  // SCHULTERN — bei Seite nur eine sichtbar
  // ════════════════════════════════════════════════════
  cx.fillStyle='#252545';
  // Vordere Schulter (immer)
  cx.save();cx.translate(tCX,by+12);cx.scale(bodyScaleX,1);cx.translate(-tCX,-(by+12));
  cx.fillRect(rx+34,by+12,8,20);
  cx.fillStyle='#0e0e28';cx.fillRect(rx+39,by+12,3,20);
  cx.fillStyle='rgba(100,100,180,0.4)';cx.fillRect(rx+34,by+12,8,3);
  cx.restore();
  // Hintere Schulter (nur bei Frontal sichtbar)
  cx.globalAlpha=1-blAbs*0.85;
  cx.fillStyle='#252545';
  cx.save();cx.translate(tCX,by+12);cx.scale(bodyScaleX,1);cx.translate(-tCX,-(by+12));
  cx.fillRect(rx-2,by+12,8,20);
  cx.fillStyle='rgba(100,100,180,0.4)';cx.fillRect(rx-2,by+12,8,3);
  cx.restore();
  cx.globalAlpha=1;

  // ════════════════════════════════════════════════════
  // KOPF — hLook (Maus), vLook (Maus Y), unabhängig von bodyLook
  // ════════════════════════════════════════════════════
  const headScaleY=1.0-Math.abs(vLook)*0.18;
  const headScaleX=1.0-Math.abs(hLook)*0.20;
  const visorOffY=vLook*5,visorOffX=hLook*5;
  const backSideW=Math.max(0,Math.round(4*(1-Math.abs(hLook)*1.3)));

  cx.fillStyle='#0a0a1e';cx.fillRect(rx+14,by+8,12,8); // Hals

  const headCX=rx+20,headCY=by+5;
  cx.save();cx.translate(headCX,headCY);cx.scale(headScaleX,headScaleY);cx.translate(-headCX,-headCY);
  cx.fillStyle='#08081a';cx.fillRect(rx+7,by-3,26,18);
  cx.fillStyle='#0e0e24';cx.fillRect(rx+9,by-1,22,14);
  cx.fillStyle=upg?'#ff0055':'#00ffcc';cx.fillRect(rx+10+visorOffX,by+3+visorOffY,20,7);
  cx.fillStyle='rgba(255,255,255,0.5)';cx.fillRect(rx+11+visorOffX,by+3+visorOffY,5,3);
  cx.fillStyle=upg?'rgba(255,0,85,0.3)':'rgba(0,255,200,0.2)';cx.fillRect(rx+10+visorOffX,by+8+visorOffY,20,2);
  cx.fillStyle='#050512';cx.fillRect(rx+7,by-3,3,18);cx.fillRect(rx+30,by-3,3,18);
  if(backSideW>0){cx.fillStyle='#030310';
    if(hLook>=0)cx.fillRect(rx+7,by-3,backSideW+2,18);
    else        cx.fillRect(rx+7+26-backSideW-2,by-3,backSideW+2,18);}
  cx.fillStyle='#00ffcc';cx.fillRect(rx+11,by-6,2,4);cx.fillRect(rx+27,by-5,2,3);
  cx.restore();

  // ════════════════════════════════════════════════════
  // ARME
  // Ruhender Arm: bei Seitenansicht hinter den Körper
  // Schuss-Arm: immer vorne, dreht sich zur Maus
  // ════════════════════════════════════════════════════
  const lUpg=upgrades.left.find(u=>u.level>0);
  const rUpg=upgrades.right.find(u=>u.level>0);
  const shootArmCol=rUpg?rUpg.color:'#00ffcc';
  const stamRatio=player.stamina/100;
  const restBaseCol=lUpg?lUpg.color:'#334466';
  const dashGlow=player.dashFlash>0?(player.dashFlash/12):0;
  const armPivotX=rx+40,armPivotY=by+20;
  const mxMirrored=player.facing===1?mouseX:(2*mechMidX0-mouseX);
  const armAngle=Math.atan2(mouseY-armPivotY,mxMirrored-armPivotX);

  // Ruhender Arm — schwingt deutlich vor und hinter den Körper
  // Vorwärts (positiv): Arm kommt vor den Körper → voll sichtbar
  // Rückwärts (negativ): Arm verschwindet hinter dem Torso → ausblenden
  const armSwingRaw = player.moving ? Math.sin(t+Math.PI) : 0; // -1..+1
  // Mehr Swing: ±0.95 rad (~54°) — deutlich sichtbar vor UND hinter dem Körper
  const armSwing = armSwingRaw * 0.95;

  // Vor dem Körper (positiv): voll sichtbar bis ca. +0.3, dann leicht transparent
  // Hinter dem Körper (negativ): ab -0.25 langsam ausblenden, bei -0.95 fast weg
  const behindBody = armSwing < -0.25 ? Math.min(1, (-armSwing-0.25)/0.70) : 0;
  // Vor dem Körper auch leicht transparent wenn weit vorne (Tiefe-Illusion)
  const frontFade  = armSwing >  0.55 ? Math.min(0.35, (armSwing-0.55)/0.80) : 0;
  const restAlpha  = (1-blAbs*0.75) * (1 - behindBody*0.88 - frontFade);

  // ── RUHENDER ARM: Pivot an Schulter, Arm hängt nach UNTEN
  // 0° = senkrecht nach unten (Neutral-Position)
  // +armSwing = nach vorne (vor den Körper) — sichtbar
  // -armSwing = nach hinten (hinter den Körper) — ausblendet
  // Pivot sitzt an der LINKEN Schulter des Mechs (im gespiegelten Canvas = links)
  const restPivX = rx + 2;  // Schulter: knapp am Körper-Rand
  const restPivY = by + 14; // Schulter-Höhe (oben am Torso)

  cx.globalAlpha = Math.max(0, restAlpha);
  cx.save();
  cx.translate(restPivX, restPivY); // Pivot
  cx.rotate(armSwing);              // Swing um Schulter
  // Arm hängt SENKRECHT nach unten vom Pivot (0,0)
  // Alle Maße: X=horizontal (neg=links), Y=vertikal nach unten
  cx.fillStyle='#2e2e58'; cx.fillRect(-5, 0, 10,  8); // Schulter-Kappe
  cx.fillStyle='#22224a'; cx.fillRect(-6, 7, 12, 10); // Oberarm
  cx.fillStyle='rgba(130,140,210,0.4)'; cx.fillRect(-6,7,12,3); // Highlight
  cx.fillStyle='#2e2e58'; cx.fillRect(-5,16, 10,  5); // Ellenbogen
  cx.fillStyle='#1a1a3c'; cx.fillRect(-6,20, 12,  9); // Unterarm
  cx.fillStyle=stamRatio>0.99?shootArmCol:'#334477';
  cx.fillRect(-7, 28, 13,  6);                         // Faust
  if(stamRatio>0.05){
    cx.fillStyle=stamRatio>0.6?'#00ccff':stamRatio>0.3?'#ffaa00':'#ff4444';
    cx.fillRect(-6, 29, Math.round(11*stamRatio), 3);
  }
  cx.restore();

  if(dashGlow>0){
    cx.globalAlpha=1;
    cx.strokeStyle=`rgba(0,220,255,${dashGlow*0.8})`;
    cx.lineWidth=2;
    // Glow-Box um Arm-Bereich
    cx.save();cx.translate(restPivX,restPivY);cx.rotate(armSwing);
    cx.strokeRect(-8,0,14,34);cx.restore();
  }
  cx.globalAlpha=1;

  // Schuss-Arm mit sichtbarer Waffe — alles RELATIV zum Pivot (0,0)
  // Pivot = armPivotX, armPivotY. Nach translate+rotate ist (0,0) der Pivot.
  // Arm zeigt nach RECHTS (positive X-Richtung) bei Winkel 0.
  const wMG    =upgrades.left.find(u=>u.id==='mg'&&u.level>0);
  const wShotg =upgrades.left.find(u=>u.id==='shotgun'&&u.level>0);
  const wLaser =upgrades.left.find(u=>u.id==='laser'&&u.level>0);
  const wRocket=upgrades.right.find(u=>u.id==='rocket'&&u.level>0);
  const wPlasma=upgrades.right.find(u=>u.id==='plasma'&&u.level>0);
  const wChain =upgrades.right.find(u=>u.id==='chain'&&u.level>0);

  cx.save();
  cx.translate(armPivotX,armPivotY);
  cx.rotate(armAngle);
  // (0,0)=Schulter, X=rechts. Arm+Waffe gesamt max ~36px

  // Oberarm (0..10)
  cx.fillStyle='#252545';cx.fillRect(0,-4,10,8);
  // Unterarm (9..20)
  cx.fillStyle='#1e1e40';cx.fillRect(9,-3,11,6);

  // Waffe ab x=19, max bis x=36
  if(wMG){
    cx.fillStyle='#ff6600';cx.fillRect(19,-5,9,10);   // Gehäuse
    cx.fillStyle='#882200';cx.fillRect(20,4,7,5);     // Magazin unten
    cx.fillStyle='#ff8844';cx.fillRect(27,-2,12,4);   // Lauf
    cx.fillStyle='#cc5500';
    for(let r2=0;r2<3;r2++)cx.fillRect(28+r2*3,-4,1,2); // Kühlrippen oben
    for(let r2=0;r2<3;r2++)cx.fillRect(28+r2*3,2,1,2);  // Kühlrippen unten
    cx.fillStyle='#ffcc44';cx.fillRect(37,-1,3,3);    // Mündung
  } else if(wShotg){
    cx.fillStyle='#663300';cx.fillRect(19,-7,8,14);   // Griffstück
    cx.fillStyle='#ff8800';cx.fillRect(26,-7,11,5);   // Lauf oben
    cx.fillStyle='#cc5500';cx.fillRect(26,-1,11,5);   // Lauf unten
    cx.fillStyle='#111';cx.fillRect(25,-7,2,12);      // Trennsteg
    cx.fillStyle='#ffcc88';cx.fillRect(36,-8,2,6);    // Mündung oben
    cx.fillStyle='#ffcc88';cx.fillRect(36,-1,2,6);    // Mündung unten
  } else if(wLaser){
    cx.fillStyle='#004433';cx.fillRect(19,-5,10,10);  // Gehäuse
    cx.fillStyle='rgba(0,255,200,0.9)';
    cx.shadowColor='#00ffcc';cx.shadowBlur=6;
    cx.beginPath();cx.arc(24,0,5,0,Math.PI*2);cx.fill(); // Energie-Zelle
    cx.shadowBlur=0;
    cx.fillStyle='#007755';cx.fillRect(28,-2,10,4);   // Lauf
    cx.fillStyle='#00ffcc';cx.fillRect(37,-1,3,2);    // Mündung
  } else if(wRocket){
    cx.fillStyle='#222';cx.fillRect(19,-8,19,16);     // Rohr-Rahmen
    cx.fillStyle='#882200';cx.fillRect(20,-7,17,14);  // Rohr
    cx.fillStyle='#cc2200';cx.fillRect(20,-7,6,14);   // Kammer
    cx.fillStyle='#ffaa00';cx.fillRect(27,-4,7,8);    // Rakete
    cx.fillStyle='#ff4444';cx.fillRect(25,-5,3,10);   // Raketen-Spitze
    cx.fillStyle='#555';cx.fillRect(36,-8,3,16);      // Mündungsring
  } else if(wPlasma){
    cx.fillStyle='#330055';cx.fillRect(18,-8,16,16);  // Tank
    cx.fillStyle='#6600aa';
    cx.beginPath();cx.arc(26,0,7,0,Math.PI*2);cx.fill(); // Kugel
    cx.fillStyle='#aa00ff';cx.shadowColor='#aa00ff';cx.shadowBlur=8;
    cx.beginPath();cx.arc(26,0,4,0,Math.PI*2);cx.fill(); // Kern
    cx.shadowBlur=0;
    cx.fillStyle='rgba(220,150,255,0.8)';
    cx.beginPath();cx.arc(26,0,2,0,Math.PI*2);cx.fill(); // Kern-Mitte
    cx.fillStyle='#8800cc';cx.fillRect(32,-2,7,4);    // kurzer Lauf
  } else if(wChain){
    cx.fillStyle='#333300';cx.fillRect(19,-6,10,12);  // Gehäuse
    cx.fillStyle='#888800';cx.fillRect(20,-5,8,10);   // Gehäuse gelb
    cx.fillStyle='#ffff00';cx.shadowColor='#ffff00';cx.shadowBlur=5;
    cx.fillRect(28,-2,10,4);                          // Lauf
    cx.shadowBlur=0;
    cx.fillStyle='#ffff88';cx.fillRect(37,-1,3,3);    // Spitze
  } else {
    cx.fillStyle='#223355';cx.fillRect(19,-4,14,8);   // Pistole
    cx.fillStyle='rgba(0,200,255,0.5)';cx.fillRect(31,-2,4,4);
  }
  cx.restore();

  // Stachel-Schuhe werden direkt in den Bein-Block gezeichnet

  // Boost-Triebwerk
  const bUpg=upgrades.back.find(u=>u.id==='boost'&&u.level>0);
  if(bUpg){
    cx.fillStyle='#003399';cx.fillRect(rx+10,by+30,9,14);cx.fillRect(rx+22,by+30,9,14);
    cx.fillStyle='#0055cc';cx.fillRect(rx+11,by+30,7,4);cx.fillRect(rx+23,by+30,7,4);
    if((player.moving||!onGr)&&stats.dashCD<55){
      cx.fillStyle=`rgba(0,120,255,${0.5+0.3*Math.sin(t*8)})`;
      cx.fillRect(rx+9,by+43,11,5+Math.floor(Math.random()*3));
      cx.fillRect(rx+21,by+43,11,5+Math.floor(Math.random()*3));
    }
  }
  if(overheated){for(let d=0;d<3;d++){cx.fillStyle=`rgba(255,${80+d*20},0,${0.4-d*0.1})`;cx.fillRect(rx+6+d*9,by-6-d*2,7,5+d*2);}}
  cx.restore();cx.restore();
}

function drawEnemy(e){
  cx.save();
  const fl=e.hitFlash>0, atk=e.state==='attack';
  const mx=e.x+e.w/2, my=e.y+e.h/2;
  const l1=Math.sin(e.legAnim)*5, l2=Math.sin(e.legAnim+Math.PI)*5;
  const bob=Math.sin(e.legAnim*0.7)*2;

  // ── FLIEGER ──────────────────────────────────────
  if(e.flying){
    const dying=e.state==='dead';
    const fc=fl?'#fff':dying?(Math.sin(e.deathTimer||0)>0?'#ff0000':'#ff8800'):atk?'#ff6600':'#8800cc';
    // Körper: mehrere Kreise = organischer Blob
    cx.fillStyle=fc;
    cx.beginPath();cx.arc(mx,my,e.w/2,0,Math.PI*2);cx.fill();
    cx.fillStyle=fl?'#ddd':'#550088';
    cx.beginPath();cx.arc(mx-3,my-2,e.w/2-5,0,Math.PI*2);cx.fill();
    // Augen leuchten
    cx.fillStyle=fl?'#fff':'#ff2222';
    cx.shadowColor='#ff0000';cx.shadowBlur=fl?0:6;
    cx.beginPath();cx.arc(mx-5,my-3,3.5,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(mx+5,my-3,3.5,0,Math.PI*2);cx.fill();
    cx.shadowBlur=0;
    // Tentakel/Flügel — animiert
    const wa=Math.sin(e.legAnim*2)*0.5;
    cx.fillStyle=`rgba(140,0,220,0.5)`;
    cx.save();cx.translate(mx,my);cx.rotate(wa);
    cx.beginPath();cx.moveTo(-4,0);cx.quadraticCurveTo(-e.w*0.8,-8,-e.w+2,4);cx.quadraticCurveTo(-e.w*0.5,8,-4,6);cx.fill();
    cx.restore();
    cx.save();cx.translate(mx,my);cx.rotate(-wa);
    cx.beginPath();cx.moveTo(4,0);cx.quadraticCurveTo(e.w*0.8,-8,e.w-2,4);cx.quadraticCurveTo(e.w*0.5,8,4,6);cx.fill();
    cx.restore();
    if(atk){cx.strokeStyle='rgba(255,100,0,0.6)';cx.lineWidth=2;cx.beginPath();cx.arc(mx,my,e.w,0,Math.PI*2);cx.stroke();}

  // ── NORMAL (pink/lila) ────────────────────────────
  } else if(!e.elite && (e.subtype||'normal')==='normal'){
    const bc=fl?'#fff':atk?'#ff2200':'#6611aa';
    // Runder Körper
    cx.fillStyle=bc;
    cx.beginPath();cx.arc(mx,e.y+e.h*0.55+bob,e.w*0.48,0,Math.PI*2);cx.fill();
    // Kopf — kleiner ovaler Buckel oben
    cx.fillStyle=fl?'#eee':'#4400aa';
    cx.beginPath();cx.ellipse(mx,e.y+16+bob,e.w*0.32,e.h*0.18,0,0,Math.PI*2);cx.fill();
    // Augen
    cx.fillStyle=fl?'#fff':'#ff2222';cx.shadowColor='#ff0000';cx.shadowBlur=fl?0:5;
    cx.beginPath();cx.arc(mx-6,e.y+15+bob,4,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(mx+6,e.y+15+bob,4,0,Math.PI*2);cx.fill();
    cx.shadowBlur=0;
    // Beine — 4 Stück, organisch gebogen
    cx.strokeStyle=fl?'#fff':'#8833bb';cx.lineWidth=4;cx.lineCap='round';
    cx.beginPath();cx.moveTo(mx-8,e.y+e.h*0.7);cx.quadraticCurveTo(mx-16,e.y+e.h*0.85+l1,mx-12,e.y+e.h+l1);cx.stroke();
    cx.beginPath();cx.moveTo(mx+8,e.y+e.h*0.7);cx.quadraticCurveTo(mx+16,e.y+e.h*0.85+l2,mx+12,e.y+e.h+l2);cx.stroke();
    cx.lineWidth=3;
    cx.beginPath();cx.moveTo(mx-4,e.y+e.h*0.72);cx.quadraticCurveTo(mx-18,e.y+e.h*0.9+l2,mx-16,e.y+e.h+l2);cx.stroke();
    cx.beginPath();cx.moveTo(mx+4,e.y+e.h*0.72);cx.quadraticCurveTo(mx+18,e.y+e.h*0.9+l1,mx+16,e.y+e.h+l1);cx.stroke();
    if(atk){cx.strokeStyle='rgba(255,40,0,0.5)';cx.lineWidth=2;cx.beginPath();cx.arc(mx,my,e.w,0,Math.PI*2);cx.stroke();}

  // ── SCHNELL (gelb) ────────────────────────────────
  } else if((e.subtype||'normal')==='fast'){
    const bc=fl?'#fff':atk?'#ffcc00':'#aa7700';
    // Schlanker länglicher Körper
    cx.fillStyle=bc;
    cx.beginPath();cx.ellipse(mx,e.y+e.h*0.52+bob,e.w*0.35,e.h*0.38,0,0,Math.PI*2);cx.fill();
    // Spitzer Kopf
    cx.fillStyle=fl?'#eee':'#886600';
    cx.beginPath();cx.moveTo(mx,e.y+4+bob);cx.lineTo(mx-8,e.y+20+bob);cx.lineTo(mx+8,e.y+20+bob);cx.closePath();cx.fill();
    // Augen — schmale Schlitze
    cx.fillStyle=fl?'#fff':'#ffff00';cx.shadowColor='#ffff00';cx.shadowBlur=fl?0:6;
    cx.fillRect(mx-7,e.y+12+bob,5,2);cx.fillRect(mx+2,e.y+12+bob,5,2);
    cx.shadowBlur=0;
    // Speed-Streifen
    cx.fillStyle='rgba(255,220,0,0.3)';
    cx.fillRect(e.x+4,e.y+20,3,28);cx.fillRect(e.x+e.w-7,e.y+20,3,28);
    // Dünne schnelle Beine — 6 Stück
    cx.strokeStyle=fl?'#fff':'#aa7700';cx.lineWidth=2.5;cx.lineCap='round';
    for(let li=0;li<3;li++){
      const lx=mx-10+li*10;
      const la=li%2===0?l1:l2;
      cx.beginPath();cx.moveTo(lx,e.y+e.h*0.75);cx.lineTo(lx+(li-1)*6,e.y+e.h+la);cx.stroke();
    }
    if(atk){cx.strokeStyle='rgba(255,200,0,0.5)';cx.lineWidth=2;cx.beginPath();cx.arc(mx,my,e.w*0.9,0,Math.PI*2);cx.stroke();}

  // ── PANZER (grün) ─────────────────────────────────
  } else if((e.subtype||'normal')==='tank'){
    const bc=fl?'#fff':atk?'#88cc00':'#334400';
    // Breiter flacher Körper — Schildkröten-artig
    cx.fillStyle=bc;
    cx.beginPath();cx.ellipse(mx,e.y+e.h*0.6+bob,e.w*0.55,e.h*0.32,0,0,Math.PI*2);cx.fill();
    // Panzer-Rücken (dunkle Segmente)
    cx.fillStyle=fl?'#ddd':'rgba(50,80,20,0.8)';
    cx.beginPath();cx.ellipse(mx,e.y+e.h*0.52+bob,e.w*0.48,e.h*0.22,0,0,Math.PI*2);cx.fill();
    cx.fillStyle=fl?'#ccc':'rgba(80,110,30,0.6)';
    for(let seg=0;seg<3;seg++){cx.fillRect(e.x+8+seg*8,e.y+e.h*0.38+bob,6,12);}
    // Kleiner breiter Kopf
    cx.fillStyle=fl?'#eee':'#223300';
    cx.beginPath();cx.ellipse(mx,e.y+e.h*0.28+bob,e.w*0.28,e.h*0.16,0,0,Math.PI*2);cx.fill();
    // Augen
    cx.fillStyle=fl?'#fff':'#88ff00';cx.shadowColor='#88ff00';cx.shadowBlur=fl?0:5;
    cx.beginPath();cx.arc(mx-5,e.y+e.h*0.26+bob,3,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(mx+5,e.y+e.h*0.26+bob,3,0,Math.PI*2);cx.fill();
    cx.shadowBlur=0;
    // Kurze dicke Beine
    cx.strokeStyle=fl?'#fff':'#445500';cx.lineWidth=6;cx.lineCap='round';
    cx.beginPath();cx.moveTo(mx-12,e.y+e.h*0.8);cx.lineTo(mx-14,e.y+e.h+l1);cx.stroke();
    cx.beginPath();cx.moveTo(mx+12,e.y+e.h*0.8);cx.lineTo(mx+14,e.y+e.h+l2);cx.stroke();
    cx.lineWidth=5;
    cx.beginPath();cx.moveTo(mx-5,e.y+e.h*0.82);cx.lineTo(mx-6,e.y+e.h+l2);cx.stroke();
    cx.beginPath();cx.moveTo(mx+5,e.y+e.h*0.82);cx.lineTo(mx+6,e.y+e.h+l1);cx.stroke();
    if(atk){cx.strokeStyle='rgba(100,200,0,0.5)';cx.lineWidth=2;cx.beginPath();cx.arc(mx,my,e.w*0.95,0,Math.PI*2);cx.stroke();}

  // ── ELITE (rot) ────────────────────────────────────
  } else {
    const bc=fl?'#fff':atk?'#ff5500':'#bb2000';
    // Großer bedrohlicher Körper — asymmetrisch
    cx.fillStyle=bc;
    cx.beginPath();cx.arc(mx,e.y+e.h*0.55+bob,e.w*0.52,0,Math.PI*2);cx.fill();
    // Stacheln oben
    cx.fillStyle=fl?'#eee':'#ff3300';
    for(let sp=0;sp<5;sp++){
      const sx=e.x+6+sp*7, sh=8+Math.sin(sp*1.3)*4;
      cx.beginPath();cx.moveTo(sx,e.y+14+bob);cx.lineTo(sx+3,e.y+14-sh+bob);cx.lineTo(sx+6,e.y+14+bob);cx.fill();
    }
    // Kopf mit Krone-Silhouette
    cx.fillStyle=fl?'#ddd':'#991100';
    cx.beginPath();cx.ellipse(mx,e.y+e.h*0.28+bob,e.w*0.38,e.h*0.2,0,0,Math.PI*2);cx.fill();
    // Leuchtende Augen
    cx.fillStyle=fl?'#fff':'#ff0000';cx.shadowColor='#ff0000';cx.shadowBlur=fl?0:10;
    cx.beginPath();cx.arc(mx-7,e.y+e.h*0.25+bob,5,0,Math.PI*2);cx.fill();
    cx.beginPath();cx.arc(mx+7,e.y+e.h*0.25+bob,5,0,Math.PI*2);cx.fill();
    cx.shadowBlur=0;
    // Schulterplatten
    cx.fillStyle=fl?'#ccc':'#cc2200';
    cx.fillRect(e.x,e.y+e.h*0.35+bob,8,16);cx.fillRect(e.x+e.w-8,e.y+e.h*0.35+bob,8,16);
    // Kräftige Beine
    cx.strokeStyle=fl?'#fff':'#cc2200';cx.lineWidth=5;cx.lineCap='round';
    cx.beginPath();cx.moveTo(mx-10,e.y+e.h*0.75);cx.quadraticCurveTo(mx-18,e.y+e.h*0.88+l1,mx-14,e.y+e.h+l1);cx.stroke();
    cx.beginPath();cx.moveTo(mx+10,e.y+e.h*0.75);cx.quadraticCurveTo(mx+18,e.y+e.h*0.88+l2,mx+14,e.y+e.h+l2);cx.stroke();
    cx.lineWidth=4;
    cx.beginPath();cx.moveTo(mx-3,e.y+e.h*0.77);cx.quadraticCurveTo(mx-10,e.y+e.h*0.9+l2,mx-8,e.y+e.h+l2);cx.stroke();
    cx.beginPath();cx.moveTo(mx+3,e.y+e.h*0.77);cx.quadraticCurveTo(mx+10,e.y+e.h*0.9+l1,mx+8,e.y+e.h+l1);cx.stroke();
    if(atk){cx.strokeStyle='rgba(255,50,0,0.6)';cx.lineWidth=3;cx.beginPath();cx.arc(mx,my,e.w,0,Math.PI*2);cx.stroke();}
  }

  // ── FÄHIGKEITS-EFFEKTE (für alle Boden-Gegner) ──
  if(!e.flying){
    // Panzer: Absorb-Schild pulsierend
    if(e.absorb){
      const sPulse=0.6+0.4*Math.sin(e.legAnim*3);
      cx.strokeStyle=`rgba(100,255,80,${sPulse*0.35})`;cx.lineWidth=12;
      cx.beginPath();cx.arc(mx,my,e.w*0.75,0,Math.PI*2);cx.stroke();
      cx.strokeStyle=`rgba(150,255,120,${sPulse*0.9})`;cx.lineWidth=2;
      cx.beginPath();cx.arc(mx,my,e.w*0.72,0,Math.PI*2);cx.stroke();
    }
    // Elite: Regen-Aura
    if(e.regen&&e.hp<e.maxHp*0.95){
      const rPulse=0.4+0.3*Math.sin(e.legAnim*5);
      cx.strokeStyle=`rgba(0,255,80,${rPulse*0.4})`;cx.lineWidth=10;
      cx.beginPath();cx.arc(mx,my,e.w*0.7,0,Math.PI*2);cx.stroke();
      cx.strokeStyle=`rgba(0,255,80,${rPulse})`;cx.lineWidth=1.5;
      cx.beginPath();cx.arc(mx,my,e.w*0.67,0,Math.PI*2);cx.stroke();
    }
    // Schnell: Speed-Glow
    if(e.dodge){
      const dPulse=0.12+0.08*Math.sin(e.legAnim*6);
      cx.strokeStyle=`rgba(255,200,0,${dPulse})`;cx.lineWidth=4;
      cx.beginPath();cx.arc(mx,e.y+e.h*0.8,e.w*0.45,0,Math.PI*2);cx.stroke();
    }
    // HP-Bar über Gegner (nur wenn beschädigt)
    if(e.hp<e.maxHp){
      const hb=e.hp/e.maxHp;
      cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(e.x,e.y-8,e.w,4);
      cx.fillStyle=hb>0.5?'#00ff44':hb>0.25?'#ffaa00':'#ff2200';
      cx.fillRect(e.x,e.y-8,e.w*hb,4);
    }
  }
  cx.restore();
}

function drawCrosshair(){
  if(phase!=='playing')return;
  // Crosshair nur im Spielfeld sichtbar (nicht in schwarzem Letterbox-Balken)
  if(mouseY<5||mouseY>GAME_H-5)return;
  const col=overheated?'rgba(255,100,0,0.8)':'rgba(255,0,60,0.85)';
  cx.strokeStyle=col;cx.lineWidth=1.5;
  cx.beginPath();cx.moveTo(mouseX-12,mouseY);cx.lineTo(mouseX-4,mouseY);cx.stroke();
  cx.beginPath();cx.moveTo(mouseX+4,mouseY);cx.lineTo(mouseX+12,mouseY);cx.stroke();
  cx.beginPath();cx.moveTo(mouseX,mouseY-12);cx.lineTo(mouseX,mouseY-4);cx.stroke();
  cx.beginPath();cx.moveTo(mouseX,mouseY+4);cx.lineTo(mouseX,mouseY+12);cx.stroke();
  cx.fillStyle=col;cx.beginPath();cx.arc(mouseX,mouseY,2.5,0,Math.PI*2);cx.fill();
  const armX=player.facing===1?player.x+player.w+12:player.x-12,armY=player.y+22;
  cx.strokeStyle='rgba(255,0,60,0.15)';cx.lineWidth=1;cx.setLineDash([4,7]);
  cx.beginPath();cx.moveTo(armX,armY);cx.lineTo(mouseX,mouseY);cx.stroke();
  cx.setLineDash([]);
  const dy=mouseY-armY;
  if(dy<-10){
    const ang=Math.round(Math.abs(Math.atan2(dy,20)*180/Math.PI));
    cx.fillStyle='rgba(255,0,60,0.5)';cx.font='10px Courier New';cx.textAlign='center';
    cx.fillText(ang+'°',mouseX,mouseY-16);cx.textAlign='left';
  }
}


// ── BLOOM EFFEKT ─────────────────────────────────────────────
// Off-Screen Canvas für leuchtende Elemente
const bloomCv=document.createElement('canvas');
bloomCv.width=GAME_W;bloomCv.height=GAME_H;
const bloomCtx=bloomCv.getContext('2d');

function drawBloom(){
  bloomCtx.clearRect(0,0,GAME_W,GAME_H);
  // Nur leuchtende Elemente: Bullets, Muzzle-Flashes, Laser-Effekte
  // Enemy-Bullets: rot
  bullets.forEach(b=>{
    if(!b.enemy)return;
    bloomCtx.fillStyle='rgba(255,50,0,0.6)';
    bloomCtx.beginPath();bloomCtx.arc(b.x+b.w/2,b.y+b.h/2,b.w,0,Math.PI*2);bloomCtx.fill();
  });
  // Spieler-Bullets: je nach Typ
  bullets.forEach(b=>{
    if(b.enemy)return;
    const bc=b.type==='plasma'?'rgba(180,0,255,0.5)':
              b.type==='chain'?'rgba(255,255,0,0.4)':
              b.type==='laser'?'rgba(0,255,200,0.4)':
              b.type==='mg'?'rgba(255,150,0,0.3)':'rgba(0,200,255,0.3)';
    bloomCtx.fillStyle=bc;
    bloomCtx.beginPath();bloomCtx.arc(b.x+b.w/2,b.y+b.h/2,b.w*0.8,0,Math.PI*2);bloomCtx.fill();
  });
  // Muzzle-Flashes
  muzzleFlashes.forEach(mf=>{
    const a=mf.life/mf.maxLife;
    bloomCtx.fillStyle=`rgba(255,220,100,${a*0.7})`;
    bloomCtx.beginPath();bloomCtx.arc(mf.x,mf.y,mf.r*1.5,0,Math.PI*2);bloomCtx.fill();
  });
  // BUGFIX: bloomCv.style.filter (CSS) wirkt NICHT auf drawImage.
  // Stattdessen ctx.filter des Ziel-Canvas verwenden (GPU-beschleunigt in Chrome/FF).
  cx.save();
  if('filter' in cx)cx.filter='blur(6px)';
  cx.globalCompositeOperation='screen'; // Aufhellen statt überdecken
  cx.globalAlpha=0.55;
  cx.drawImage(bloomCv,0,0);
  cx.restore();
}

function draw(){
  cx.clearRect(0,0,GAME_W,GAME_H);
  cx.save();cx.translate(shakeX,shakeY);
  drawBackground();
  if(hurtFlash>0){cx.fillStyle=`rgba(255,0,0,${hurtFlash/16*0.3})`;cx.fillRect(0,0,GAME_W,GAME_H);}
  // Blutflecken — fade out nach 10s, weg nach 13s
  const nowBlood=Date.now();
  for(let i=bloodDecals.length-1;i>=0;i--){
    const d=bloodDecals[i];
    const age=(nowBlood-d.born)/1000; // Sekunden
    const fadeStart=10, fadeEnd=13;
    if(age>fadeEnd){bloodDecals.splice(i,1);continue;}
    if(age>fadeStart){
      d.alpha=d.maxAlpha*(1-(age-fadeStart)/(fadeEnd-fadeStart));
    }
    cx.globalAlpha=Math.max(0,d.alpha);
    cx.fillStyle='#003300';cx.beginPath();cx.ellipse(d.x,d.y,d.r,d.r*0.35,0,0,Math.PI*2);cx.fill();
    cx.fillStyle='#005500';cx.beginPath();cx.ellipse(d.x,d.y,d.r*0.55,d.r*0.2,0,0,Math.PI*2);cx.fill();
    cx.globalAlpha=1;
  }
  // Debris
  debris.forEach(d=>{
    cx.save();cx.globalAlpha=Math.min(1,d.life/30);
    cx.translate(d.x,d.y);cx.rotate(d.rot);
    cx.fillStyle=d.color;cx.fillRect(-d.w/2,-d.h/2,d.w,d.h);
    cx.globalAlpha=1;cx.restore();
  });
  // Gore-Partikel
  particles.forEach(p=>{cx.globalAlpha=Math.min(1,p.life/20);cx.fillStyle=p.color;cx.fillRect(p.x,p.y,p.size,p.size);});
  cx.globalAlpha=1;
  // Schrott
  const nowMs2=Date.now();
  scraps.forEach(s=>{
    const remaining=s.expiry-nowMs2;
    // Blink-Schwelle: früher in höheren Wellen
    const blinkThreshold=Math.min(3000,500+wave*180);
    // Blink-Frequenz steigt mit Welle
    const blinkSpeed=0.012+wave*0.003;
    const blink=remaining<blinkThreshold?Math.sin(nowMs2*blinkSpeed)>0:true;
    if(!blink)return;
    cx.fillStyle='#ffd700';cx.beginPath();cx.arc(s.x,s.y,5,0,Math.PI*2);cx.fill();
    cx.fillStyle='#ffaa00';cx.beginPath();cx.arc(s.x,s.y,3,0,Math.PI*2);cx.fill();
    if(s.attracted){cx.strokeStyle='rgba(255,215,0,0.2)';cx.lineWidth=1;cx.beginPath();cx.arc(s.x,s.y,10,0,Math.PI*2);cx.stroke();}
  });
  enemies.forEach(drawEnemy);
  if(boss)drawBoss();
  // Flieger Warn-Laser
  enemies.forEach(e=>{
    if(!e.flying||e.state!=='hover')return;
    if(e.laserFired||e.hoverTimer>110)return; // nach Schuss weg, vor Warn-Phase weg
    if(!e.laserDirX&&!e.laserDirY)return;     // Richtung noch nicht gesetzt

    // Laser-Start: aktueller Flieger-Mittelpunkt
    const lx0=e.laserFromX, ly0=e.laserFromY;
    const dx=e.laserDirX, dy=e.laserDirY;

    // Rand-Austritt berechnen
    let tMax=2000;
    if(dx>0)  tMax=Math.min(tMax,(GAME_W+50-lx0)/dx);
    if(dx<0)  tMax=Math.min(tMax,(-50-lx0)/dx);
    if(dy>0)  tMax=Math.min(tMax,(GROUND+10-ly0)/dy);
    if(dy<0)  tMax=Math.min(tMax,(-50-ly0)/dy);
    const lxRand=lx0+dx*tMax, lyRand=ly0+dy*tMax; // Rand-Punkt

    // Spieler-Position
    const pcxD=player.x+player.w/2, pcyD=player.y+player.h/2;

    // Punkt-zu-Linie Distanz: ist Spieler im Strahl?
    const tPlayer=Math.max(0,((pcxD-lx0)*dx+(pcyD-ly0)*dy));
    const closestX=lx0+dx*tPlayer, closestY=ly0+dy*tPlayer;
    const distToLaser=Math.hypot(pcxD-closestX,pcyD-closestY);
    const playerInBeam=distToLaser<22;

    // Laser-Ende: Spieler-Position wenn im Strahl, sonst Rand
    const lx1=playerInBeam?pcxD:lxRand;
    const ly1=playerInBeam?pcyD:lyRand;

    // Leuchtpunkt immer am Laser-Ende (= Spieler oder Rand)
    const dotX=lx1, dotY=ly1;

    // Stärke: Elite-Flieger heller/breiter
    const isElite=e.elite;
    const warnAlpha=Math.min(isElite?1.0:0.75, (1-e.hoverTimer/110)*1.4);
    const laserW=isElite?1.5+warnAlpha*3:0.8+warnAlpha*1.8;
    const glowCol=isElite?'rgba(255,0,0,0.35)':'rgba(255,80,0,0.2)';
    const coreCol=isElite?'#ff0000':'#ff4400';
    const dotR=isElite?12+warnAlpha*6:8+warnAlpha*4;

    cx.save();
    cx.globalAlpha=warnAlpha;
    // Glow
    cx.strokeStyle=glowCol;cx.lineWidth=laserW+8;
    cx.beginPath();cx.moveTo(lx0,ly0);cx.lineTo(lx1,ly1);cx.stroke();
    // Kern
    cx.strokeStyle=coreCol;cx.lineWidth=laserW;
    cx.beginPath();cx.moveTo(lx0,ly0);cx.lineTo(lx1,ly1);cx.stroke();
    // Leuchtpunkt
    cx.fillStyle=glowCol;
    cx.beginPath();cx.arc(dotX,dotY,dotR+4,0,Math.PI*2);cx.fill();
    cx.fillStyle=coreCol;
    cx.beginPath();cx.arc(dotX,dotY,dotR,0,Math.PI*2);cx.fill();
    cx.fillStyle='#ffcc88';
    cx.beginPath();cx.arc(dotX,dotY,dotR*0.35,0,Math.PI*2);cx.fill();
    cx.restore();
  });
  // Impact Sparks (hinter Bullets)
  sparks.forEach(sp=>{cx.globalAlpha=sp.life/sp.maxLife;cx.fillStyle=sp.color;cx.fillRect(sp.x-sp.size/2,sp.y-sp.size/2,sp.size,sp.size);});
  cx.globalAlpha=1;
  // Bullets
  bullets.forEach(b=>{
    if(b.enemy){
      // Glow-Effekt
      cx.shadowColor='#ff2200';cx.shadowBlur=12;
      cx.fillStyle='rgba(255,80,0,0.4)';
      cx.beginPath();cx.arc(b.x+b.w/2,b.y+b.h/2,b.w/2+3,0,Math.PI*2);cx.fill();
      cx.fillStyle='#ff2200';
      cx.beginPath();cx.arc(b.x+b.w/2,b.y+b.h/2,b.w/2,0,Math.PI*2);cx.fill();
      cx.fillStyle='#ff8844';
      cx.beginPath();cx.arc(b.x+b.w/2,b.y+b.h/2,b.w/4,0,Math.PI*2);cx.fill();
      cx.shadowBlur=0;return;
    }
    if(b.aoe){
      cx.fillStyle='#ff8800';cx.shadowColor='#ff6600';cx.shadowBlur=7;
      cx.fillRect(b.x,b.y,b.w,b.h);cx.shadowBlur=0;return;
    }
    if(b.type==='plasma'){
      // Plasma-Trail zeichnen
      if(b.trail) b.trail.forEach((t,ti)=>{
        const ta=(t.life/12)*(ti/b.trail.length)*0.5;
        cx.globalAlpha=ta;cx.fillStyle='#aa00ff';
        const ts=b.w*(ti/b.trail.length)*0.8;
        cx.beginPath();cx.arc(t.x,t.y,ts/2,0,Math.PI*2);cx.fill();
      });
      cx.globalAlpha=1;
      cx.fillStyle='#cc44ff';cx.shadowColor='#aa00ff';cx.shadowBlur=10;
      cx.beginPath();cx.arc(b.x+b.w/2,b.y+b.h/2,b.w/2,0,Math.PI*2);cx.fill();
      cx.shadowBlur=0;
    } else if(b.type==='mg'){
      cx.fillStyle='#ffee44';
      cx.fillRect(b.x,b.y,b.w,b.h);
    } else if(b.type==='chain'){
      cx.fillStyle='#00ffaa';cx.shadowColor='#00ffaa';cx.shadowBlur=5;
      cx.fillRect(b.x,b.y,b.w,b.h);cx.shadowBlur=0;
    } else if(b.type==='shotgun'){
      cx.fillStyle='#ffaa44';cx.fillRect(b.x,b.y,b.w,b.h);
    } else {
      cx.fillStyle='#00eeff';cx.fillRect(b.x,b.y,b.w,b.h);
    }
  });
  // Bloom-Overlay für leuchtende Elemente (BUGFIX: wurde nie aufgerufen)
  if(bullets.length||muzzleFlashes.length)drawBloom();
  // ── Boden-Staub & Slide-Funken ──
  dustParticles.forEach(dp=>{
    const t=dp.life/dp.maxLife;
    const alpha=(t<0.25?t/0.25:1.0-((t-0.25)/0.75))*0.65;
    cx.globalAlpha=alpha;
    if(dp.isSpark){
      cx.fillStyle=`rgba(255,180,60,${alpha})`;
    } else {
      cx.fillStyle=dp.col+alpha.toFixed(2)+')';
    }
    cx.fillRect(dp.x-dp.size/2,dp.y-dp.size/2,dp.size,dp.size);
  });
  cx.globalAlpha=1;

  if(phase==='playing'||phase==='paused'||phase==='countdown')drawMech();
  // Muzzle Flash (über Mech)
  muzzleFlashes.forEach(mf=>{
    const a=mf.life/mf.maxLife;
    cx.save();
    cx.globalAlpha=a*0.4;cx.fillStyle=mf.color;cx.beginPath();cx.arc(mf.x,mf.y,mf.r*1.8,0,Math.PI*2);cx.fill();
    cx.globalAlpha=a*0.9;cx.fillStyle='#ffffff';cx.beginPath();cx.arc(mf.x,mf.y,mf.r*0.45,0,Math.PI*2);cx.fill();
    cx.globalAlpha=a*0.75;cx.fillStyle=mf.color;cx.beginPath();cx.arc(mf.x,mf.y,mf.r,0,Math.PI*2);cx.fill();
    cx.strokeStyle=mf.color;cx.lineWidth=1.5;cx.globalAlpha=a*0.6;
    for(let ray=0;ray<6;ray++){const ra=(ray/6)*Math.PI*2;cx.beginPath();cx.moveTo(mf.x+Math.cos(ra)*mf.r*0.6,mf.y+Math.sin(ra)*mf.r*0.6);cx.lineTo(mf.x+Math.cos(ra)*mf.r*1.6,mf.y+Math.sin(ra)*mf.r*1.6);cx.stroke();}
    cx.globalAlpha=1;cx.restore();
  });
  // Float-Texte
  floatTexts.forEach(ft=>{
    const a=ft.isDmg?Math.min(1,ft.life/14):Math.min(1,ft.life/22);
    cx.globalAlpha=a;
    cx.fillStyle=ft.col;
    cx.font=(ft.bold?'bold ':'')+(ft.size||13)+'px Courier New';
    cx.textAlign='center';
    // Damage Numbers: leichter Outline für Lesbarkeit
    if(ft.isDmg){
      cx.strokeStyle='rgba(0,0,0,0.7)';cx.lineWidth=3;cx.lineJoin='round';
      cx.strokeText(ft.txt,ft.x,ft.y);
    }
    cx.fillText(ft.txt,ft.x,ft.y);
  });
  cx.globalAlpha=1;cx.textAlign='left';cx.lineWidth=1;
  drawCrosshair();
  cx.restore();
}


// ── CRT / SHADER-OVERLAY ─────────────────────────────────────
// Simuliert Shader-Effekte mit einem zweiten Canvas:
// - Scanlines (horizontale dunkle Streifen)
// - Vignette (Bildschirmränder dunkler)
// - Leichte Farbverschiebung (Chromatic Aberration Andeutung)
const crtCv=document.getElementById('crt');
const crtCtx=crtCv.getContext('2d');
crtCv.width=GAME_W;crtCv.height=GAME_H;

function drawCRT(){
  crtCtx.clearRect(0,0,GAME_W,GAME_H);

  // Scanlines: jede 2. Zeile leicht abdunkeln
  crtCtx.fillStyle='rgba(0,0,0,0.12)';
  for(let y=0;y<GAME_H;y+=2){
    crtCtx.fillRect(0,y,GAME_W,1);
  }

  // Vignette: Rand-Abdunklung per Radial-Gradient
  const vgr=crtCtx.createRadialGradient(
    GAME_W/2,GAME_H/2,GAME_H*0.3,
    GAME_W/2,GAME_H/2,GAME_H*0.85
  );
  vgr.addColorStop(0,'rgba(0,0,0,0)');
  vgr.addColorStop(1,'rgba(0,0,0,0.55)');
  crtCtx.fillStyle=vgr;
  crtCtx.fillRect(0,0,GAME_W,GAME_H);

  // Leichter Neon-Schimmer an den Seiten (Cyberpunk-Look)
  const sideGlow=crtCtx.createLinearGradient(0,0,60,0);
  sideGlow.addColorStop(0,'rgba(0,255,200,0.04)');
  sideGlow.addColorStop(1,'rgba(0,0,0,0)');
  crtCtx.fillStyle=sideGlow;crtCtx.fillRect(0,0,60,GAME_H);
  const sideGlow2=crtCtx.createLinearGradient(GAME_W,0,GAME_W-60,0);
  sideGlow2.addColorStop(0,'rgba(0,255,200,0.04)');
  sideGlow2.addColorStop(1,'rgba(0,0,0,0)');
  crtCtx.fillStyle=sideGlow2;crtCtx.fillRect(GAME_W-60,0,60,GAME_H);
}

// CRT einmal beim Start zeichnen (statisch, kein Performance-Cost)
// Wird nur bei Resize neu gezeichnet
drawCRT();
window.addEventListener('resize',()=>{
  crtCv.width=GAME_W;crtCv.height=GAME_H;
  drawCRT();
});

loadSave();
draw();requestAnimationFrame(update);
