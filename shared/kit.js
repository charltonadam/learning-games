/* window.Kit — the bits every game needs and none of them should own.
   Load after shared/storage.js. Classic script, no modules, so the games still
   open straight off the filesystem. */
(function(){
  "use strict";

  var mem = {};

  var store = {
    ok: true,
    /* Returns the parsed value, or null on a first run / unavailable storage.
       Falls back to memory so a game still plays through a session. */
    get: function(key){
      return Promise.resolve()
        .then(function(){ return window.storage.get(key); })
        .then(function(r){ return r ? JSON.parse(r.value) : null; })
        .catch(function(){ store.ok = false; return key in mem ? mem[key] : null; });
    },
    set: function(key, value){
      mem[key] = value;
      return Promise.resolve()
        .then(function(){ return window.storage.set(key, JSON.stringify(value)); })
        .catch(function(){ store.ok = false; });
    },
    del: function(key){
      delete mem[key];
      return Promise.resolve()
        .then(function(){ return window.storage.delete(key); })
        .catch(function(){ store.ok = false; });
    }
  };

  function ri(lo, hi){ return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(a){ return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a){
    var x = a.slice(), i, j;
    for (i = x.length - 1; i > 0; i--){
      j = Math.floor(Math.random() * (i + 1));
      var t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }

  /* Debounce a save so a burst of taps writes once. */
  function debounce(fn, ms){
    var t = null;
    return function(){
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(self, args); }, ms || 350);
    };
  }

  /* ---- sound: oscillators only, no audio files ---- */
  var actx = null;
  function audio(){
    /* Browsers want a user gesture before this works — call it from a tap. */
    try{
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      return actx;
    }catch(e){ return null; }
  }
  function tone(freq, dur, when, type, vol){
    if (!Kit.sound.enabled) return;
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, a.currentTime + when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur);
    o.connect(g); g.connect(a.destination);
    o.start(a.currentTime + when);
    o.stop(a.currentTime + when + dur + 0.05);
  }

  /* ---- speech ---- */
  var voice = null;
  function pickVoice(){
    try{
      var vs = speechSynthesis.getVoices().filter(function(v){ return /^en/i.test(v.lang); });
      voice = vs.filter(function(v){ return /female|samantha|karen|moira|zira/i.test(v.name); })[0] || vs[0] || null;
    }catch(e){}
  }
  try{ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }catch(e){}

  /* opts is optional: {onend, onboundary, onerror}. Returns the utterance, or
     null if nothing was spoken — a game reading a long text sentence by
     sentence chains on onend and must stop when it gets null back. */
  function say(text, rate, pitch, opts){
    if (!Kit.speech.enabled) return null;
    try{
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = rate || 0.9;
      u.pitch = pitch || 1.05;
      if (voice) u.voice = voice;
      if (opts){
        if (opts.onend) u.onend = opts.onend;
        if (opts.onboundary) u.onboundary = opts.onboundary;
        if (opts.onerror) u.onerror = opts.onerror;
      }
      speechSynthesis.speak(u);
      return u;
    }catch(e){ return null; }
  }

  /* Shut up mid-sentence — leaving a screen, or the grown-ups panel opening. */
  function hush(){ try{ speechSynthesis.cancel(); }catch(e){} }

  var Kit = {
    store: store,
    ri: ri, pick: pick, shuffle: shuffle, debounce: debounce,
    /* Games mirror their own persisted settings onto these. */
    sound:  { enabled: true },
    speech: { enabled: true },
    audio: audio, tone: tone, say: say, hush: hush
  };

  window.Kit = Kit;
})();
