/* The Silly Stories engine: a tiny story DSL, the word types it knows, and the
   code that turns a story plus the kid's words into finished text.
   Classic script, loads before the files in stories/, each of which is one
   Stories.add(`…`) call.

   ─── writing a story ──────────────────────────────────────────────────────
   Copy an existing file in stories/, then add a <script> line for it in
   index.html. A story file is one call and looks like this:

     Stories.add(`
     title: The Dragon Who Lost His Socks
     emoji: 🐉
     about: A dragon turns his whole cave upside down.
     level: 1

     One {adjective} morning a dragon named {name #hero} woke up with
     freezing cold {bodypart}.

     {#hero} had lost every single one of his {plural}!
     `);

   Header lines are `key: value`, then ONE BLANK LINE, then the story itself.
   title / emoji / about are what the cover shows. level is 1, 2 or 3 — how
   hard the story is — and defaults to 1; the game only offers stories at or
   below the rung he's on. A blank line in the story starts a new paragraph;
   a single newline is just a line wrap and disappears.

   Inside {curly braces}:
     {adjective}              one of the word types listed below
     {adjective: a word for a monster}   same, but you write the question
     {name #hero}             names the blank so the same word can come back
     {#hero}                  the word he already gave for that blank
     {type of pet}            not a known type? The whole thing becomes the
                              question, and the type is guessed from the words
                              in it ("pet" → an animal), so anything you write
                              works — it just won't have a word list.

   Curly braces are reserved. The story is a JS template literal, so a literal
   backtick or ${ has to be backslash-escaped.

   Don't fuss over "a" vs "an" or capital letters at the start of a sentence:
   write `a {animal}` and the game fixes both when it fills the word in.
   ────────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";

  function list(s){ return s.split(/\s*,\s*/).filter(Boolean); }

  /* ---------------- the word types ----------------
     label   the question the kid is asked
     hint    the examples under it — always three, always concrete
     family  what part of speech this really is; a word from a different
             family is the signal that he missed the grammar, not the story
     free    nothing to judge (a name can be any word at all), so answers are
             never counted right or wrong
     test    a suffix rule, which beats any word list: "right", "wrong", null  */
  var TYPES = {
    name: {
      label:"a name", hint:"anybody — Milo, Grandma, Captain Bean", family:"noun", free:true,
      words:list("Milo, Ruby, Grandma, Grandpa, Mrs. Puddle, Captain Bean, Professor Toots, Nana, Wiggles, Sir Fluffington, Betty, Otto, Pickle Pete, Auntie Jo, Doctor Bop, Zed")
    },
    animal: {
      label:"an animal", hint:"like a dog, a penguin, a hippo", family:"noun",
      words:list("dog, cat, elephant, penguin, hamster, giraffe, shark, frog, llama, hippo, bunny, tiger, owl, goat, dolphin, walrus, sloth, chicken")
    },
    food: {
      label:"a food", hint:"like pizza, pickles, ice cream", family:"noun",
      words:list("pizza, banana, spaghetti, pickle, taco, ice cream, broccoli, pancake, cheese, donut, popcorn, meatball, jelly, soup, waffle, cupcake, hot dog, mango")
    },
    color: {
      label:"a colour", hint:"like purple, gold, rainbow", family:"adj",
      words:list("red, blue, green, purple, orange, pink, yellow, gold, silver, rainbow, black, white, turquoise, lime")
    },
    number: {
      label:"a number", hint:"like 3, 12, a hundred", family:"number",
      test:function(w){ return /^\d+$/.test(w) ? "right" : null; },
      words:list("one, two, three, seven, ten, twelve, twenty, fifty, one hundred, a million, zero, six")
    },
    place: {
      label:"a place", hint:"like the moon, a treehouse, the zoo", family:"noun",
      words:list("the moon, a treehouse, the zoo, school, the beach, a cave, Grandma's house, the swimming pool, a castle, the grocery store, the jungle, under the bed, a volcano, the library")
    },
    noun: {
      label:"a thing you can touch", hint:"like a hat, a rock, a spoon", family:"noun",
      words:list("hat, rock, spoon, sock, bucket, pillow, robot, tooth, boot, lamp, sandwich, ladder, balloon, trumpet, mop, sled, jar, broom")
    },
    plural: {
      label:"more than one thing", hint:"it usually ends in s — socks, turtles, bubbles", family:"plural",
      test:function(w){
        if (/^(mice|teeth|feet|geese|children|people|men|women)$/.test(w)) return "right";
        if (/(es|[^su]s)$/.test(w) && w.length > 3) return "right";
        return null;
      },
      words:list("socks, turtles, bananas, robots, cousins, pickles, noodles, mice, teeth, feet, ducks, buttons, monsters, bubbles, pancakes, sneakers")
    },
    adjective: {
      label:"a describing word", hint:"like sparkly, grumpy, enormous", family:"adj",
      words:list("sparkly, grumpy, enormous, slimy, fuzzy, tiny, brave, smelly, loud, sleepy, wobbly, spicy, fancy, gigantic, squishy, silly, frozen, stinky")
    },
    verb: {
      label:"an action word", hint:"something you can do — jump, sing, wiggle", family:"verb",
      words:list("jump, sing, wiggle, run, dance, sneeze, giggle, stomp, swim, yell, hop, tickle, snore, spin, juggle, wobble, march, burp")
    },
    verbing: {
      label:"an action word ending in -ing", hint:"like jumping, singing, wiggling", family:"verbing",
      test:function(w){ return /ing$/.test(w) ? "right" : null; },
      words:list("jumping, singing, wiggling, dancing, sneezing, giggling, stomping, swimming, yelling, hopping, tickling, snoring, spinning, juggling, marching, burping")
    },
    adverb: {
      label:"a word that tells how", hint:"it ends in -ly — slowly, loudly, politely", family:"adverb",
      test:function(w){ return /ly$/.test(w) ? "right" : null; },
      words:list("slowly, loudly, politely, quickly, sleepily, wildly, gently, bravely, silently, happily, rudely, carefully")
    },
    exclamation: {
      label:"something you shout", hint:"like Wow, Yikes, Hooray", family:"other", free:true,
      words:list("Wow, Yikes, Oh no, Hooray, Uh oh, Whoa, Yippee, Good grief, Holy moly, Yum, Bonkers, Aaargh")
    },
    bodypart: {
      label:"a body part", hint:"like an elbow, a nose, ten toes", family:"noun",
      words:list("elbow, nose, toe, knee, ear, thumb, belly button, eyebrow, ankle, tongue, shoulder, pinky")
    },
    sound: {
      label:"a sound", hint:"like boing, splat, beep", family:"other", free:true,
      words:list("boing, splat, beep, crash, squeak, whoosh, honk, bloop, kaboom, ding, ka-thunk, zzzzz")
    },
    job: {
      label:"a job", hint:"like a pirate, a dentist, a bus driver", family:"noun",
      words:list("pirate, dentist, bus driver, astronaut, chef, teacher, firefighter, wizard, farmer, plumber, ballerina, knight, librarian, clown")
    },
    vehicle: {
      label:"something you ride in", hint:"like a bus, a rocket, a skateboard", family:"noun",
      words:list("bus, rocket, skateboard, canoe, tractor, hot air balloon, bicycle, submarine, sled, unicycle, fire truck, spaceship")
    },
    silly: {
      label:"a made-up silly word", hint:"anything at all — blorf, zoopity, wumpus", family:"other", free:true,
      words:list("zoopity, blorf, snorkleblat, fizzbanger, wumpus, glorp, doodlebop, kerfluffle, bibble, snazzlepop")
    }
  };

  /* What you're allowed to write inside the braces for each type. Longest
     match wins, so "plural noun" beats "noun". */
  var ALIASES = {
    "name":"name", "person":"name", "boy's name":"name", "girl's name":"name", "someone's name":"name",
    "animal":"animal", "pet":"animal", "type of pet":"animal", "type of animal":"animal",
    "food":"food", "snack":"food", "type of food":"food",
    "color":"color", "colour":"color",
    "number":"number",
    "place":"place", "location":"place",
    "noun":"noun", "thing":"noun", "object":"noun",
    "plural":"plural", "plural noun":"plural", "plural nouns":"plural", "more than one thing":"plural",
    "adjective":"adjective", "describing word":"adjective",
    "verb":"verb", "action word":"verb", "action":"verb",
    "verbing":"verbing", "verb ending in -ing":"verbing", "verb ending in ing":"verbing",
    "action word ending in -ing":"verbing", "-ing word":"verbing", "ing word":"verbing", "gerund":"verbing",
    "adverb":"adverb", "-ly word":"adverb", "ly word":"adverb",
    "exclamation":"exclamation", "shout":"exclamation",
    "bodypart":"bodypart", "body part":"bodypart",
    "sound":"sound", "noise":"sound",
    "job":"job", "occupation":"job",
    "vehicle":"vehicle",
    "silly":"silly", "silly word":"silly", "made-up word":"silly", "nonsense word":"silly"
  };
  var ALIAS_KEYS = Object.keys(ALIASES).sort(function(a,b){ return b.length - a.length; });

  /* What to call a type in a sentence to a grown-up, or in a "you don't need
     the word list any more" cheer. */
  var SHORT = {
    name:"names", animal:"animals", food:"foods", color:"colours", number:"numbers",
    place:"places", noun:"things", plural:"more-than-one words", adjective:"describing words",
    verb:"action words", verbing:"-ing words", adverb:"-ly words", exclamation:"shouts",
    bodypart:"body parts", sound:"sounds", job:"jobs", vehicle:"rides", silly:"silly words"
  };

  /* word -> which families it belongs to, for spotting a word from the wrong
     part of speech. Built once from every list above. */
  var INDEX = {};
  Object.keys(TYPES).forEach(function(k){
    var t = TYPES[k];
    t.key = k;
    t.short = SHORT[k] || k;
    t.set = {};
    t.words.forEach(function(w){
      w = w.toLowerCase();
      t.set[w] = true;
      (INDEX[w] || (INDEX[w] = {}))[t.family] = true;
    });
  });

  /* "right"  — the right part of speech
     "wrong"  — a real word, but the wrong part of speech
     "own"    — a word we don't know, which is a fine answer and no evidence  */
  function classify(key, answer){
    var t = TYPES[key];
    var w = String(answer || "").trim().toLowerCase();
    if (!t || !w || t.free) return "own";
    if (t.test){
      var r = t.test(w);
      if (r) return r;
    }
    if (t.set[w]) return "right";
    var fams = INDEX[w];
    if (fams && !fams[t.family]) return "wrong";
    return "own";
  }

  /* ---------------- parsing ---------------- */

  function typeFromText(text){
    var t = text.toLowerCase().replace(/[.!?]+$/, "").trim();
    if (ALIASES[t]) return ALIASES[t];
    for (var i = 0; i < ALIAS_KEYS.length; i++){
      var k = ALIAS_KEYS[i];
      if (new RegExp("(^|[^a-z-])" + k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "($|[^a-z])").test(t)) return ALIASES[k];
    }
    return null;
  }

  /* One {…}: returns a blank, or {reuse:"hero"} for a bare {#hero}. */
  function parseSpec(spec){
    var raw = spec.trim();
    var name = null;
    var m = /\s*#([A-Za-z0-9_-]+)\s*$/.exec(raw);
    if (m){ name = m[1]; raw = raw.slice(0, m.index).trim(); }
    if (!raw) return { reuse: name };

    var key = null, label = null;
    var colon = raw.indexOf(":");
    if (colon > -1){
      key = typeFromText(raw.slice(0, colon));
      label = raw.slice(colon + 1).trim() || null;
    } else if (TYPES[raw.toLowerCase()]){
      key = raw.toLowerCase();
    } else {
      key = typeFromText(raw);
      label = raw;
    }
    if (!key) key = "noun";
    return {
      type: key,
      name: name,
      label: label || TYPES[key].label,
      hint: label ? (TYPES[key].hint || "") : TYPES[key].hint
    };
  }

  function slug(s){
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  function parse(src){
    var lines = String(src).replace(/\r/g, "").split("\n");
    var i = 0, meta = {};
    while (i < lines.length && lines[i].trim() === "") i++;
    for (; i < lines.length; i++){
      if (lines[i].trim() === ""){ i++; break; }
      var h = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(lines[i]);
      if (!h) break;                       // no header block at all
      meta[h[1].toLowerCase()] = h[2].trim();
    }

    var story = {
      id: slug(meta.title || "story-" + (all.length + 1)),
      title: meta.title || "A Silly Story",
      emoji: meta.emoji || "\u{1F4D6}",
      about: meta.about || "",
      level: Math.max(1, Math.min(3, parseInt(meta.level, 10) || 1)),
      blanks: [],
      paras: []
    };

    var byName = {};
    lines.slice(i).join("\n").trim().split(/\n\s*\n/).forEach(function(para){
      var text = para.replace(/\s*\n\s*/g, " ").trim();
      if (!text) return;
      var toks = [], re = /\{([^}]*)\}/g, at = 0, m;
      while ((m = re.exec(text))){
        if (m.index > at) toks.push({ t: text.slice(at, m.index) });
        at = m.index + m[0].length;
        var spec = parseSpec(m[1]);
        if (spec.reuse){
          if (byName[spec.reuse] !== undefined){ toks.push({ b: byName[spec.reuse] }); continue; }
          spec = { type:"noun", name:spec.reuse, label:TYPES.noun.label, hint:TYPES.noun.hint };
        }
        var blank = { i: story.blanks.length, type: spec.type, label: spec.label, hint: spec.hint, name: spec.name };
        story.blanks.push(blank);
        if (spec.name) byName[spec.name] = blank.i;
        toks.push({ b: blank.i });
      }
      if (at < text.length) toks.push({ t: text.slice(at) });
      story.paras.push(toks);
    });

    return story;
  }

  /* ---------------- filling it in ----------------
     Returns paragraphs of {text} and {word, blank} pieces, with "a"/"an" and
     the capital letter at the start of a sentence sorted out. */
  var VOWEL = /^[aeiou]/i;

  function fill(story, answers){
    return story.paras.map(function(toks){
      var out = [];
      toks.forEach(function(tok){
        if (tok.t !== undefined){ out.push({ text: tok.t }); return; }

        var blank = story.blanks[tok.b];
        var word = String(answers[tok.b] === undefined ? "" : answers[tok.b]).trim() || "——";
        var prev = out.length ? out[out.length - 1] : null;
        var before = prev && prev.text !== undefined ? prev.text : null;

        // a  ->  an, and back again
        if (before !== null){
          var art = /(^|[\s("'“])(a|an|A|An)(\s+)$/.exec(before);
          if (art){
            var want = VOWEL.test(word) ? "an" : "a";
            if (art[2] === "A" || art[2] === "An") want = want.charAt(0).toUpperCase() + want.slice(1);
            prev.text = before.slice(0, art.index) + art[1] + want + art[3];
          }
        }

        // Capital letter at the start of a sentence, after an opening quote,
        // and always for a name. Walk back past plain spaces to find the last
        // thing that was actually said.
        var starts = true;
        for (var k = out.length - 1; k >= 0; k--){
          if (out[k].word !== undefined){ starts = false; break; }
          var tail = out[k].text.replace(/\s+$/, "");
          if (tail === "") continue;
          starts = /[.!?:]["')\u201d]?$/.test(tail) || /[\u201c"(]$/.test(tail);
          break;
        }
        if (starts || blank.type === "name") word = word.charAt(0).toUpperCase() + word.slice(1);

        out.push({ word: word, blank: tok.b });
      });
      return out;
    });
  }

  function plain(filled){
    return filled.map(function(para){
      return para.map(function(p){ return p.text !== undefined ? p.text : p.word; }).join("");
    }).join("\n\n");
  }

  /* ---------------- the shelf ---------------- */
  var all = [];

  window.Stories = {
    TYPES: TYPES,
    add: function(src){
      try {
        var s = parse(src);
        if (s.blanks.length) all.push(s);
        return s;
      } catch (e) {
        if (window.console) console.error("Silly Stories: couldn't read a story —", e);
        return null;
      }
    },
    all: function(){ return all.slice(); },
    get: function(id){ return all.filter(function(s){ return s.id === id; })[0] || null; },
    type: function(key){ return TYPES[key] || TYPES.noun; },
    classify: classify,
    fill: fill,
    plain: plain
  };
})();
