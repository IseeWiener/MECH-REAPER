# MECH-REAPER — Projektstruktur

## Änderungen (Bugfix-Update)

**Kritische Fixes:**
- `fightOn()`: Der Weiter-Kämpfen-Bonus wurde nie gutgeschrieben (`scrap+=bonus` war in einen Kommentar gerutscht)
- Countdown-Softlock: Pause exakt bei "KAMPF!" (Countdown 0) → Resume startete die Welle nie
- Gegner-Fähigkeiten aktiviert: Elite-**Regeneration**, Panzer-**Absorb-Schild** und Schnell-**Dodge** wurden geprüft, aber nie gesetzt
- Flieger-**Todesexplosion** aktiviert: Der komplette Absturz-/AOE-Code existierte, wurde aber nie ausgelöst (Flieger fallen jetzt, rauchen und explodieren — Abstand halten!)
- Pierce-Geschosse trafen denselben Gegner/Boss **jeden Frame** beim Durchflug (bis zu 5× Schaden am Boss)

**Weitere Fixes:**
- Angriffs-Cooldowns nutzten Array-Indizes — beim Entfernen von Gegnern wanderten Cooldowns auf andere Gegner (jetzt eindeutige IDs)
- Level-Up-Perk „Dash-Schaden+" wurde nie angewendet; Dash-Kills zählten nicht für Level-Ups
- Bloom-Effekt war implementiert, aber nie aufgerufen (und der CSS-Filter-Ansatz hätte nicht funktioniert) — jetzt aktiv via `ctx.filter`
- Waffen-Optik/Sound folgen jetzt der **zuletzt gekauften** Waffe statt fester MG>Plasma>Schrot-Priorität
- `resetGame()`: Max-HP (Panzerung+-Perks), Sprung-/Dash-Physik und Stamina wurden nicht zurückgesetzt
- Boss: nur 1 Treffer pro Frame möglich (Schrotflinten-Pellets verpufften teilweise)
- Special-Shop: Kosten (z. B. Notfall-Reparatur) skalierten nie mit dem Level
- Stamina-Balken sprang mit Dash-Cooldown-Perk auf ~50 % statt bei 0 % zu starten
- Tastenbelegung: Escape bricht Rebind jetzt ab (statt gebunden zu werden), doppelt belegte Tasten werden getauscht
- Wellen-Vorschau zählte den Serien-Bonus doppelt
- Upgrade-Text „SHIFT=Dash" korrigiert (Dash liegt auf C bzw. der gewählten Taste)

**Verbesserungen:**
- Auto-Pause bei Tab-/Fensterwechsel (keine unfairen Treffer im Hintergrund)
- Sterbende Flieger ziehen eine Rauch-/Funkenspur
- Toter Code entfernt (ungenutztes `bindings`-Objekt)

## Dateien

| Datei | Inhalt | Zeilen |
|-------|--------|--------|
| `index.html` | HTML-Struktur, CSS, alle Menüs | ~350 |
| `data.js` | Konstanten, Spielzustand, Upgrades, Sterne | ~155 |
| `audio.js` | Web Audio Engine, alle Sounds, Musik | ~140 |
| `ui.js` | Keybindings, LocalStorage, Screens, Shop, Reset | ~510 |
| `game.js` | Schießen, Boss, Update-Loop, Spieler-Physik | ~665 |
| `render.js` | Hintergrund, drawMech, Gegner, Draw-Loop, CRT | ~665 |

## Starten

**Wichtig:** Browser blockieren lokale JS-Dateien via `file://`.
Du brauchst einen lokalen Server:

### Option 1: VS Code
1. Extension "Live Server" installieren
2. Rechtsklick auf `index.html` → "Open with Live Server"

### Option 2: Python (überall verfügbar)
```bash
cd /pfad/zum/ordner
python -m http.server 8080
# Dann: http://localhost:8080
```

### Option 3: Node.js
```bash
npx serve .
# Dann: http://localhost:3000
```

## Ladereihenfolge
Scripts müssen in dieser Reihenfolge geladen werden (Abhängigkeiten):
1. `data.js` — Variablen und Konstanten für alle anderen
2. `audio.js` — Audio-Funktionen (braucht nichts)
3. `ui.js` — Shop, Screens (braucht data.js, audio.js)
4. `game.js` — Spiellogik (braucht alle oben)
5. `render.js` — Draw + Game-Start (braucht alle oben)
