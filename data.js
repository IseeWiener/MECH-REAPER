// ═══════════════════════════════════════════════════════════════
// data.js — Konstanten, Spielzustand, Upgrades, Sterne
// ═══════════════════════════════════════════════════════════════
// ── KONSTANTEN ────────────────────────────────────────────────
const GAME_W=1280,GAME_H=600,GROUND=528;
const cv=document.getElementById('c'),cx=cv.getContext('2d');
cv.width=GAME_W;cv.height=GAME_H;
const wrap=document.getElementById('gameWrap');

function applyLetterbox(){
  const scale=Math.min(window.innerWidth/GAME_W,window.innerHeight/GAME_H);
  wrap.style.width=GAME_W+'px';wrap.style.height=GAME_H+'px';
  wrap.style.transform=`scale(${scale})`;
}
applyLetterbox();
window.addEventListener('resize',applyLetterbox);

function toGameCoords(cx2,cy2){
  const r=wrap.getBoundingClientRect();
  return{x:(cx2-r.left)*(GAME_W/r.width),y:(cy2-r.top)*(GAME_H/r.height)};
}

// ── INPUT ────────────────────────────────────────────────────
let keys={},mouseDown=false,mouseX=GAME_W/2,mouseY=GAME_H/2;

// ── Keybindings (anpassbar) ──────────────────────
// Welche Keys sind aktiv? (wird per Einstellungen geändert)
let customBindings={
  left:   'KeyA',
  right:  'KeyD',
  jump:   'Space',
  jump2:  'ArrowUp',
  dash:   'KeyC',        // Standard: C dasht
};
function isKey(action){
  switch(action){
    case 'left':  return !!(keys[customBindings.left]  ||keys['ArrowLeft']);
    case 'right': return !!(keys[customBindings.right] ||keys['ArrowRight']);
    case 'jump':  return !!(keys[customBindings.jump]  ||keys[customBindings.jump2]||keys['ArrowUp']||keys['KeyW']);
    case 'dash':  return !!(keys[customBindings.dash]);
    default: return false;
  }
}
window.addEventListener('keydown',e=>{if(e.code==='Space')e.preventDefault();if(e.code==='Escape')handleEsc();keys[e.code]=true;});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{
  keys={};mouseDown=false;
  // Auto-Pause bei Fokusverlust — verhindert unfaire Treffer im Hintergrund
  if(typeof handleEsc==='function'&&(phase==='playing'||phase==='countdown'))handleEsc();
});
window.addEventListener('mouseup',()=>{mouseDown=false;});
cv.addEventListener('mousedown',e=>{if(e.button===0)mouseDown=true;});
cv.addEventListener('mouseleave',()=>{mouseDown=false;});
cv.addEventListener('mousemove',e=>{
  const g=toGameCoords(e.clientX,e.clientY);
  mouseX=Math.max(-50,Math.min(GAME_W+50,g.x));
  // Y: harter Clamp — verhindert Einfrieren durch schwarzen Balken
  mouseY=Math.max(8,Math.min(GAME_H-8,g.y));
});

// ── ZUSTAND ──────────────────────────────────────────────────
let phase='start';
let kills=0,scrap=0,wave=1,noBreakStreak=0,noDmgStreak=0;
let shootCD=0,shopTimer=null,lastFrameTime=0;
let shakeX=0,shakeY=0,shakeMag=0,shakeFrames=0;
let playerHP=100,playerMaxHP=100,hurtFlash=0;
let lastEnemyHit={};
let parallaxOffset=0;
let freezeFrames=0; // Freeze-Frame bei Kill
let killsForLevelUp=10; // nächster Level-Up bei dieser Kill-Zahl
let levelUpPending=false;
let playerLevel=0; // wie viele Level-Ups bereits passiert
let bgPhase=0,bgParticles=[];
let bgStyle='city'; // 'city'|'industrial'|'ruins' — wechselt pro Akt
// Lightning State Machine:
// phase: 'idle'|'flash1'|'gap'|'flash2'|'gap2'|'flash3'|'fade'
let lightning={phase:'idle',alpha:0,timer:0,nextIn:180,flashX:0,intensity:1.0};
let heat=0;
const HEAT_PER_SHOT=14,HEAT_COOL=0.6,OVERHEAT_MAX=100,OVERHEAT_RECOVER=25;
let overheated=false;
let waveState={total:0,spawned:0,spawnTimer:0,spawnInterval:0,active:false};
let boss=null,bossHP=0,bossMaxHP=0;
const BOSS_WAVE=10;
let countdownVal=0,countdownTimer=null;

// ── PARTIKEL-ARRAYS ──────────────────────────────────────────
let enemyIdCounter=0; // eindeutige Gegner-IDs für Angriffs-Cooldowns & Pierce-Tracking
let bullets=[],enemies=[],particles=[],scraps=[],floatTexts=[];
let muzzleFlashes=[],sparks=[],bloodDecals=[],debris=[];

// ── UPGRADES ─────────────────────────────────────────────────
let upgrades={
  left:[
    {id:'mg',name:'MG',descs:['Rate +40%','Rate +70%','Rate MAX'],costs:[18,30,48],level:0,max:3,color:'#ff6600',effect:(lv)=>{stats.fireRate=[9,7,5][lv-1];stats.heatPerShot=[16,20,26][lv-1];stats.weaponType='mg';}},
    {id:'shotgun',name:'Schrotflinte',descs:['3-Spread','4-Spread','5-Spread'],costs:[25,40,62],level:0,max:3,color:'#ff8800',effect:(lv)=>{stats.spread=[3,4,5][lv-1];stats.fireRate=[24,22,20][lv-1];stats.heatPerShot=[18,20,24][lv-1];stats.weaponType='shotgun';}},
    {id:'laser',name:'Dual-Laser',descs:['Dmg ×2','Dmg ×3','Dmg ×4'],costs:[32,52,78],level:0,max:3,color:'#00ffcc',effect:(lv)=>{stats.bulletDmg=[2,3,4][lv-1];stats.weaponType='laser';}}
  ],
  right:[
    {id:'rocket',name:'Rakete',descs:['AOE Basis','AOE Dmg+','AOE Radius+'],costs:[28,45,70],level:0,max:3,color:'#ff4400',effect:(lv)=>{stats.hasRocket=true;stats.rocketDmg=[3,5,7][lv-1];stats.rocketChance=[0.25,0.35,0.45][lv-1];}},
    {id:'plasma',name:'Plasma',descs:['Groß+langsam','Größer+Piercing','Mega-Plasma'],costs:[30,48,72],level:0,max:3,color:'#aa00ff',effect:(lv)=>{stats.bulletW=[26,30,36][lv-1];stats.bulletH=[13,15,18][lv-1];stats.bulletSpd=[9,8,7][lv-1];if(lv>=2)stats.pierce=true;stats.weaponType='plasma';}},
    {id:'chain',name:'Blitz',descs:['Durchschlag','Dmg+Spd+','Ketten-Blitz'],costs:[38,58,88],level:0,max:3,color:'#ffff00',effect:(lv)=>{stats.pierce=true;stats.bulletSpd=[14,16,18][lv-1];stats.bulletDmg=Math.max(stats.bulletDmg,[1,2,3][lv-1]);stats.weaponType='chain';}}
  ],
  back:[
    {id:'boost',name:'Triebwerk',descs:['Dash stärker','Dash weiter','Dash+Sprint'],costs:[20,32,50],level:0,max:3,color:'#0088ff',effect:(lv)=>{stats.hasDash=true;stats.dashPower=[22,28,34][lv-1];}},
    {id:'shield',name:'Schild',descs:['1× absorbieren','Aufladen-Kosten↓','Doppelschild'],costs:[35,25,55],level:0,max:3,color:'#00ccff',effect:(lv)=>{stats.hasShield=true;stats.shieldUp=true;stats.maxShields=[1,1,2][lv-1];}},
    {id:'ammo',name:'Munitions+',descs:['Schrott +30%','Schrott +60%','Schrott ×2'],costs:[22,36,55],level:0,max:3,color:'#ffd700',effect:(lv)=>{stats.scrapBonus=[1.3,1.6,2.0][lv-1];}},
    {id:'spikes',name:'Stachel-Schuhe',descs:['Stomp ×2','Stomp ×3','Stomp ×4 + Blut'],costs:[24,36,52],level:0,max:3,color:'#cc8800',effect:(lv)=>{stats.spikeBoots=true;stats.stompMult=[2,3,4][lv-1];}}
  ],
  special:[
    {id:'hp',name:'Notfall-Rep.',descs:['FULL HEAL','FULL HEAL','FULL HEAL (MAX)'],costs:[18,25,35],level:0,max:3,color:'#00ff88',effect:()=>{healPlayer(playerMaxHP);}},
    {id:'shield_r',name:'Schild aufladen',descs:['Schild aktiv'],costs:[12],level:0,max:99,color:'#00ccff',effect:()=>{if(stats.hasShield){stats.shieldUp=true;floatText(player.x+player.w/2,player.y-20,'SCHILD AKTIV','#00ccff');}}},
    {id:'cooling',name:'Kühlung+',descs:['Hitze -30%','Hitze -55%','Hitze -75%'],costs:[20,32,48],level:0,max:3,color:'#44aaff',effect:(lv)=>{stats.heatCoolMult=[1.3,1.55,1.75][lv-1];}}
  ]
};

function defaultStats(){
  return{fireRate:14,bulletDmg:1,bulletW:10,bulletH:5,bulletSpd:14,
    spread:1,hasRocket:false,pierce:false,hasDash:false,hasShield:false,
    shieldUp:false,scrapBonus:1.0,dashCD:0,eliteEarlyWave:5,spawnMult:1.0,
    heatPerShot:HEAT_PER_SHOT,dashPower:22,rocketDmg:3,rocketChance:0.25,maxShields:1,heatCoolMult:1.0,
    spikeBoots:false,stompMult:1.0,weaponType:null};
}
let stats=defaultStats();

let player={x:GAME_W/2-20,y:GROUND-52,w:40,h:52,spd:4,facing:1,
            dashVx:0,moving:false,knockVx:0,tilt:0,tiltVel:0,
            velX:0,velY:0,aimTilt:0,onGround:true,
            jumpCount:0,jumpCooldown:0,airJumpUsed:false,dashInvince:0,
            jumpStrength:11,bodyLookSmooth:0,
            stamina:100,     // 0..100, Dash-Ausdauer
            staminaRegen:0,  // Regen-Cooldown
            dashFlash:0};    // visueller Dash-Flash
let idleParticles=[];
let dustParticles=[]; // Boden-Staub beim Laufen/Schlittern
let stars=[];

function generateStars(){
  stars=[];
  // Ebene 0: weit weg — winzig, sehr langsam, kein Flicker
  for(let i=0;i<80;i++) stars.push({
    x:Math.random()*GAME_W, y:Math.random()*(GROUND*0.7),
    baseA:0.03+Math.random()*0.07, a:0.05, size:1,
    layer:0, parallaxFactor:0.02, flicker:false
  });
  // Ebene 1: mittel — mittelgroß, etwas Bewegung, leichter Flicker
  for(let i=0;i<50;i++) stars.push({
    x:Math.random()*GAME_W, y:Math.random()*(GROUND*0.75),
    baseA:0.07+Math.random()*0.12, a:0.1, size:1,
    layer:1, parallaxFactor:0.06, flicker:Math.random()<0.3,
    flickerPhase:Math.random()*Math.PI*2, flickerSpeed:0.03+Math.random()*0.04
  });
  // Ebene 2: nah — groß, deutliche Bewegung, starkes Flicker
  for(let i=0;i<25;i++) stars.push({
    x:Math.random()*GAME_W, y:Math.random()*(GROUND*0.65),
    baseA:0.15+Math.random()*0.25, a:0.2, size:Math.random()<0.5?2:1,
    layer:2, parallaxFactor:0.12, flicker:true,
    flickerPhase:Math.random()*Math.PI*2, flickerSpeed:0.05+Math.random()*0.08
  });
}
generateStars();

