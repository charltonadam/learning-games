# Adding a game

**Start by copying `games/_template/` to `games/<your-game>/`.** It is a working
game — open it and play it — wired with everything below already in place. Search
it for `REPLACE` to find every spot that is placeholder content.

The point of this file is that you should not have to read another game to build
one. CLAUDE.md covers the *judgement* — what belongs in `shared/`, the progression
contract, the panel's voice. This covers the *mechanics*: exact signatures, the
boilerplate every game repeats, and which patterns are worth stealing from where.

> `_template` starts with an underscore so GitHub Pages skips it and it never
> ships as a playable game. Keep the underscore. (Adding a `.nojekyll` at the
> repo root would start publishing it.)

---

## The shared API, exactly

Load order is fixed, and `kit.css` must come before the game's own `<style>`:

```html
<script src="../../shared/storage.js"></script>
<script src="../../shared/kit.js"></script>
<script src="../../shared/grownups.js"></script>
<link rel="stylesheet" href="../../shared/kit.css">
```

Classic scripts hanging globals off `window` — never ES modules. Modules are
blocked by CORS on `file://`, and the games must still run opened off the disk.

### `Kit.store` — persistence

| call | returns |
|---|---|
| `store.get(key)` | Promise of the **parsed** value, or `null` on a first run |
| `store.set(key, value)` | Promise; stringifies for you |
| `store.del(key)` | Promise |
| `store.ok` | `false` once any call has failed — storage is blocked |

Falls back to memory, so a game still plays through a session when storage is
blocked. `store.ok` is what the panel's footer warning keys off.

### `Kit` — the rest

```js
Kit.ri(lo, hi)              // random int, INCLUSIVE both ends
Kit.pick(array)             // one element
Kit.shuffle(array)          // a shuffled COPY; the original is untouched
Kit.debounce(fn, ms = 350)  // wrap the save so a burst of taps writes once

Kit.sound.enabled           // read/write flags the game mirrors its own state onto
Kit.speech.enabled

Kit.audio()                 // resumes/creates the AudioContext; returns it or null
Kit.tone(freq, dur, when, type = "triangle", vol = 0.16)
Kit.say(text, rate = 0.9, pitch = 1.05, opts)
Kit.hush()                  // cancel mid-sentence
```

- `tone`'s `when` is an offset **in seconds from now**, which is how you build a
  chord or an arpeggio: `[523,659,784].forEach((f,i) => tone(f, .26, i*.11))`.
- `tone` is a no-op unless `Kit.sound.enabled`. `say` returns `null` — not an
  utterance — when `Kit.speech.enabled` is false, so anything chaining on
  `onend` to read a long text sentence by sentence **must stop on `null`**.
- `opts` is `{onend, onboundary, onerror}`.
- `AudioContext` needs a user gesture, so call `Kit.audio()` from the first tap
  and from the keydown handler. Both fail silently otherwise.

### `Grownups` — the panel

```js
Grownups.open(builderFn)   // builderFn is re-run on EVERY redraw
Grownups.refresh()         // redraw after a game-built node changed something
Grownups.close()
Grownups.isOpen()          // check this in keydown handlers and round loops
```

The builder returns:

```js
{
  title, intro,
  stats:    [{ value, label }],                    // a few big plain-language numbers
  sections: [{ title, html } | { title, node }],   // node for interactive content
  settingsTitle,                                   // optional, defaults to "Settings"
  settings: [{ label, hint, value,
               options: [{ value, label }],
               onPick(v){ … } }],
  footer,                                          // the storage warning, usually
  closeLabel, onClose(){ … },
  reset: { label, confirm, run(){ … } }
}
```

Three things that will bite you:

1. **The builder runs immediately, before the math gate is passed.** `open()`
   calls it once to stash the config, then shows the gate. Keep it free of side
   effects.
2. **`onClose` fires even if the gate is never passed** — the Back button on the
   gate closes the panel the same way. Games rely on this to resume play.
3. **`reset.run()` runs *instead of* `onClose`**, so it has to resume play
   itself. Copy the template's: rebuild state, `applySettings()`, save, redraw,
   start a round.

Every `onPick` redraws the panel by re-running the builder, so just mutate state
and save — don't try to patch the DOM.

The gate is a random `a × b` with both in 3–9. That is deliberately just hard
enough for a grown-up and too hard for the kid the games are for.

### `kit.css` — what it owns, and what it expects from you

Every class is prefixed `gu-`. Useful in your own `sections` HTML:
`gu-muted` (the quiet grey paragraph), `gu-hint`, `gu-stats` / `gu-stat`.

Theme it by setting these in the game's `:root`. All thirteen are set by every
game; copy the block from the template and repoint the values:

```
--kit-font  --kit-ink  --kit-muted  --kit-paper  --kit-line  --kit-tile
--kit-accent  --kit-accent-ink  --kit-danger  --kit-danger-ink
--kit-scrim  --kit-focus  --kit-radius
```

Optionally `--kit-on` / `--kit-on-ink` — the *chosen* button in a settings row.
They default to `--kit-ink` / `--kit-paper`; only deep-dive overrides them.

**The panel borrows the game's buttons.** `grownups.js` emits exactly three
class combinations, so define all four rules or the panel will look wrong:

| emitted | you must style |
|---|---|
| `gu-btn btn` | `.btn` |
| `gu-btn btn quiet ghost` | `.btn.quiet` **and** `.btn.ghost` |
| `gu-btn gu-danger btn danger` | `.btn.danger` |

(The existing games are inconsistent here — deep-dive defines `ghost` but not
`quiet`, letter-train the reverse. The template defines all four.)

---

## The boilerplate every game repeats

The template has all of this; this is what it is and why.

```js
const KEY = "yourgame:v1";                       // one key per game
const persist = Kit.debounce(() => store.set(KEY, S), 350);

function applySettings(){                        // the game's state is the source
  Kit.sound.enabled  = S.sound;                  // of truth; Kit only mirrors it
  Kit.speech.enabled = S.voice;
}

function freshState(){ return { /* … */ }; }

// boot
const saved = await store.get(KEY);
S = saved && saved.<a-field-that-has-always-existed>
  ? Object.assign(freshState(), saved)           // backfills new fields
  : freshState();
applySettings();

setInterval(() => { if (S){ S.seconds += 15; persist(); } }, 15000);
window.addEventListener("beforeunload", () => { if (S) store.set(KEY, S); });
```

The `Object.assign(freshState(), saved)` merge is the rule from CLAUDE.md — a
code change must never wipe a kid's progress. Bump the key's suffix only when
the shape changes in a way the merge genuinely can't absorb.

Keys in use: `deepdive-progress`, `lettertrain:v1`, `coinshop:v1`,
`sillystories:v1`, `robotfactory:v1`.

### Screen shell

```css
html,body{height:100%;margin:0}
body{overflow:hidden;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#app{height:100dvh;display:flex;flex-direction:column}
```

Kid-facing screens never scroll. Size everything with `clamp()` so one layout
covers phone → tablet → desktop. Bottom-anchored controls need
`calc(… + env(safe-area-inset-bottom,0px))`.

End the game's CSS with:

```css
@media (prefers-reduced-motion:reduce){ *{animation:none!important;transition:none!important} }
```

`kit.css` already covers the panel's own animations.

### Keyboard

Always alongside touch, and always guarded by **both** gates:

```js
document.addEventListener("keydown", e => {
  if (!R || $("#overlay").classList.contains("open") || Grownups.isOpen()) return;
  Kit.audio();
  /* … */
});
```

### Back link

`<a href="../../">← Games</a>` in the top-left of every game.

---

## Patterns worth stealing, and where from

`shared/` holds what must stay *identical* across games. These are things that
recur but are allowed to differ, so they get copied, not shared:

| you need | copy from |
|---|---|
| numeric keypad (0–9, delete, go) | `games/_template/`, originally `deep-dive-math` |
| promotion / demotion overlay | `games/_template/` (`#overlay` + `.sheet`) |
| a stage ladder + a separate difficulty rung | `games/coin-shop/` — the clearest two-axis example |
| per-fact timing, resurfacing *slow* facts | `games/deep-dive-math/` (`save.facts[key].avg`) |
| a grid/array that resizes to fit its box | `games/robot-factory/` (`sizeCells`) |
| a hint ladder that points at one thing | `games/coin-shop/` (`hint()`) |
| a game-built interactive `node` in the panel | `games/letter-train/` |

---

## The menu card

Add an `<li>` to the root `index.html`, and a colour block next to the other
per-game accents:

```css
.yours .art{background:linear-gradient(…)}
.yours .go{color:#…}
.yours .tag{background:#…;color:#…}
```

```html
<li>
  <a class="card yours" href="games/your-game/">
    <div class="art">
      <svg viewBox="0 0 320 180" role="img" aria-label="…">…</svg>
    </div>
    <div class="card-body">
      <h2>Your Game</h2>
      <p>One or two sentences, same voice as the others.</p>
      <span class="go">Call to action
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h10M8 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <div class="tags">
        <span class="tag">Skill one</span>
        <span class="tag">Skill two</span>
      </div>
    </div>
  </a>
</li>
```

The art is a 16:9 inline SVG. No image files, no icon fonts anywhere in this
repo — inline SVG or emoji only. The favicon is an emoji in an SVG data URI.

---

## Before you call it done

- [ ] Plays start to finish in a browser, on a narrow window as well as wide
- [ ] Promotes **and** demotes; both show an overlay explaining the new rule
- [ ] Panel carries all six parts in order (framing → stats → what the numbers
      mean → settings → reset → footer), with "Auto" first and selected
- [ ] Every setting the game auto-adjusts has a manual override in the panel
- [ ] Sound and speech toggles both work and survive a reload
- [ ] Reload mid-round lands on the same question with progress intact
- [ ] Keyboard works; `Escape` closes the panel
- [ ] Menu card added, with its accent block
- [ ] `node --check` passes (see CLAUDE.md for the one-liner)
