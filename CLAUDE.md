# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small static site of learning games for one kid (early elementary), served from GitHub
Pages. No build step, no dependencies, no tests, no framework. `index.html` at the root is the
menu; each game is a single `games/<name>/index.html` holding its own CSS, SVG/emoji art and JS
in one `<script>` IIFE, on top of four shared files in `shared/`.

**What is shared and what is copied is a deliberate line: share what must stay identical
across games, keep in the game what is allowed to differ.**

Shared (`shared/`, load in this order):

| file | what it owns |
|---|---|
| `storage.js` | `window.storage` — a promise-based `get`/`set`/`delete` over `localStorage`, prefixed `learning-games:`, no-ops safely when storage is blocked |
| `kit.js` | `window.Kit` — `store` (JSON + in-memory fallback), `ri`/`pick`/`shuffle`, `debounce`, `audio`/`tone`, `say`, and the `sound`/`speech` enable flags |
| `grownups.js` | `window.Grownups` — the math gate and the whole grown-ups panel |
| `kit.css` | the panel's chrome, every class prefixed `gu-`, themed by `--kit-*` vars |

In the game: art, layout, colour theme, all kid-facing copy, and the progression logic. Those
are meant to differ per game — do not push them into `shared/`.

Classic scripts that hang a global off `window`, never ES modules: modules are blocked by CORS
on `file://`, and the games should still run when opened straight off the filesystem.

## Running and checking

No build, lint or test commands exist. To see a change:

```bash
python -m http.server 8777        # from the repo root
# then open http://localhost:8777/games/<name>/
```

Use a server, not `file://` — the Chrome tool refuses `file://` URLs.

**Editing a file in `shared/` and not seeing the change is almost always the browser cache**
(a cache-busting query on the HTML doesn't help — the stale copy is the CSS/JS). Force it:

```js
await fetch('/shared/kit.css', {cache:'reload'}); location.reload();
```

Syntax-check a game without a browser:

```bash
python -c "import io;s=io.open('games/coin-shop/index.html',encoding='utf-8').read();io.open('c.js','w',encoding='utf-8').write(s.split('<script>')[-1].rsplit('</script>',1)[0])"
node --check c.js && rm c.js
```

Driving a game from the browser tool is easiest via `javascript_tool` clicking real elements
(`document.querySelector('#payBtn').click()`), since all game state lives in a closure.

Careful when clearing a game's saved progress: every game re-saves on `beforeunload`, so
clearing `localStorage` then reloading restores it. Navigate to another page of the same
origin first, clear there, then navigate back.

## Persistence

Games talk to `Kit.store` (`get` parses JSON, `set` stringifies, `del`), which falls back to
memory so a game still plays through a session when storage is blocked; `Kit.store.ok` says
whether it's really saving, and the panel tells the parent when it isn't.

One key per game: `deepdive-progress`, `lettertrain:v1`, `coinshop:v1`. Bump the suffix or
migrate defensively (`Object.assign(freshState(), saved)`, backfilling new fields) — kids'
progress should survive a code change.

## The shared idea: the game reads the kid, not a level select

Every game measures ordinary play and moves difficulty itself. The mechanism differs per game
but the contract is the same — no menus of levels, no score to chase, and it can move *down*:

- **deep-dive-math** — depth is the ladder. Right answers add metres, wrong ones subtract, and
  crossing a `ZONES[]` threshold changes both the problem generator and the scenery. Per-fact
  timing (`facts[key].avg`) resurfaces facts that are slow, not just wrong — slow is the signal
  that a fact isn't automatic yet.
- **letter-train** — per-glyph `{streak, right, wrong, mastered}`. Three in a row masters a
  letter and introduces the next one from `INTRO_ORDER`; mastered letters stay in as
  distractors. Lookalike letters are held back until 4-choice rounds.
- **coin-shop** — a rolling window of the last N purchases. Three stages (running total → fewest
  coins → no total); promote on 7-of-8 clean, demote on ≤2-of-6, and a separate price-difficulty
  rung moves on 5-of-6 / 2-of-6. Stage changes clear the window so the next judgement is fresh.

When adding progression: require a *window* of evidence (not one right answer), include a
demotion path, and celebrate a promotion with an overlay that explains the new rule in the
kid's words.

## The grown-ups panel

`shared/grownups.js` owns the shape so every game's panel is the same: a random `a × b` (3–9)
gate, then a sheet. A game supplies only content, through a builder function that is re-run
every time the panel redraws:

```js
Grownups.open(function(){
  return {
    title, intro,
    stats:    [{value, label}],              // a few big plain-language numbers
    sections: [{title, html} | {title, node}],   // node for interactive game-built content
    settings: [{label, hint, value, options:[{value,label}], onPick(v){…}}],
    footer,                                  // e.g. the "not saving in this window" note
    closeLabel, onClose(){…},
    reset: {label, confirm, run(){…}}        // runs INSTEAD of onClose — resume play in run()
  };
});
```

`Grownups.refresh()` redraws after a game-built node changes something; `Grownups.isOpen()` is
what a game's keydown handler and round loop check before reacting.

What the content must carry, in this order and this voice:

1. A one-line framing that this is measured from play — *"nothing here is a test."*
2. The `stats` row.
3. **What the numbers mean for a kid this age** — the most valuable part. Name the actual skill
   and the sticking point (slow-but-correct facts aren't automatic yet; he walks past the
   quarter because counting by 25s is a separate skill), not just percentages.
4. `settings` covering *everything the game auto-adjusts*, with an "Auto" option selected by
   default, plus sound/speech toggles where the game has them.
5. `reset`, always behind its `confirm`.
6. `footer` with the storage warning when `Kit.store.ok` is false.

Settings save immediately — no Save button, no modals inside modals. A game mirrors its own
persisted toggles onto `Kit.sound.enabled` / `Kit.speech.enabled` in an `applySettings()` it
calls at boot and from `onPick`; the game's saved state stays the source of truth.

Copy refers to the child as "he/him" throughout, addresses the parent as "you", and avoids
edu-jargon. Kid-facing text is short, concrete and never scolds ("It was 7. Try the next one.").

## Front-end conventions

- Kid-facing screens are full-viewport `height:100dvh` flex columns that never scroll;
  `overflow:hidden` on body, `touch-action:manipulation`, `-webkit-tap-highlight-color:transparent`.
- Everything is sized with `clamp()` so one layout covers phone → tablet → desktop.
- Art is inline SVG or emoji — no image files, no icon fonts. Favicon is an emoji in an
  SVG data URI in `<link rel="icon">`.
- Fonts: the menu and deep-dive `@import` Fredoka + Nunito; letter-train and coin-shop use a
  system stack. Either is fine, but pick one per game and stay with it.
- Sound is `Kit.tone()` (WebAudio oscillators, never audio files) and speech is `Kit.say()`.
  Both fail silently. `AudioContext` needs a user gesture, so call `Kit.audio()` on the first tap.
- Every game ends with `@media (prefers-reduced-motion:reduce){*{animation:none!important;
  transition:none!important;}}` for its own animations; `kit.css` covers the panel.
- Keyboard support alongside touch (digits/Enter/Backspace in deep-dive; coin keys in coin-shop).
- Back link to `../../` in the top-left of every game.

## Adding a game

1. Create `games/<name>/index.html` with, in the head:

   ```html
   <script src="../../shared/storage.js"></script>
   <script src="../../shared/kit.js"></script>
   <script src="../../shared/grownups.js"></script>
   <link rel="stylesheet" href="../../shared/kit.css">
   ```

   `kit.css` must come before the game's own `<style>`, so the game's `.btn` rules win and the
   panel's buttons look like the rest of that game.
2. Theme the panel by setting the `--kit-*` vars in the game's `:root` (see any game for the
   list) and wire the grown-ups button to `Grownups.open(panelConfig)`.
3. Add a card to the root `index.html`: an `<li><a class="card <accent>">` with a 16:9 inline
   SVG `.art`, title, one-sentence description in the same voice, a `.go` link line, and two
   `.tag` chips naming the skills. Add the `.<accent> .art/.go/.tag` colour block next to the
   other per-game accents.
