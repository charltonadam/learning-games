/* window.Grownups — the grown-ups panel, identical in every game.
   A little multiplication gate, then a sheet the game fills with its own
   numbers. The game supplies content; this file owns the shape.

   Usage:
     Grownups.open(function(){
       return {
         title:   "How he's doing",
         intro:   "All of this comes from ordinary play — nothing here is a test.",
         stats:   [{ value:"12", label:"Things bought" }],
         sections:[{ title:"Coins he reaches for", html:"<p>…</p>" },
                   { title:"Letters",             node: someElement }],
         settings:[{ label:"Stage", hint:"Auto moves him along on its own",
                     value:"auto",
                     options:[{value:"auto",label:"Auto"},{value:"1",label:"1"}],
                     onPick:function(v){ … } }],
         closeLabel:"Back to the shop",
         onClose:function(){ … },
         reset: { label:"Erase all progress",
                  confirm:"Erase his saved progress and start over?",
                  run:function(){ … } }   // runs instead of onClose, so resume play here
       };
     });

   open() calls the builder every time the panel needs redrawing, so a game
   just mutates its own state in onPick and the panel catches up. */
(function(){
  "use strict";

  var el = null;      // the overlay, created on first use
  var build = null;   // the current game's builder
  var cfg = null;     // its most recent output, kept for onClose
  var open = false;

  function ensure(){
    if (el) return el;
    el = document.createElement("div");
    el.className = "gu-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Grown-ups");
    document.body.appendChild(el);
    el.addEventListener("keydown", function(e){
      if (e.key === "Escape"){ e.stopPropagation(); close(); }
    });
    return el;
  }

  function show(html){
    ensure().innerHTML = '<div class="gu-sheet">' + html + "</div>";
    el.classList.add("open");
    open = true;
  }

  function close(){
    var done = cfg && cfg.onClose;
    if (el){ el.classList.remove("open"); el.innerHTML = ""; }
    open = false;
    build = null; cfg = null;
    if (done) done();
  }

  /* ---- the gate ---- */
  function gate(){
    var a = 3 + Math.floor(Math.random() * 7),
        b = 3 + Math.floor(Math.random() * 7);
    show(
      "<h2>Grown-ups only</h2>" +
      '<p class="gu-muted">Quick check so this stays your page: what is ' + a + " × " + b + "?</p>" +
      '<div class="gu-gate">' +
        '<input id="guGate" inputmode="numeric" autocomplete="off" aria-label="Answer">' +
        '<button class="gu-btn btn" id="guGateGo">Open</button>' +
        '<button class="gu-btn btn quiet ghost" id="guGateNo">Back</button>' +
      "</div>" +
      '<p class="gu-muted" id="guGateMsg"></p>'
    );
    var input = el.querySelector("#guGate");
    input.focus();
    el.querySelector("#guGateNo").onclick = close;
    el.querySelector("#guGateGo").onclick = function(){
      if (+input.value === a * b) panel();
      else {
        el.querySelector("#guGateMsg").textContent = "Not quite — try again.";
        input.value = ""; input.focus();
      }
    };
    input.onkeydown = function(e){ if (e.key === "Enter") el.querySelector("#guGateGo").click(); };
  }

  /* ---- the panel ---- */
  function panel(keepScroll){
    cfg = build();
    var html = "<h2>" + (cfg.title || "How he’s doing") + "</h2>";
    if (cfg.intro) html += '<p class="gu-muted">' + cfg.intro + "</p>";

    if (cfg.stats && cfg.stats.length){
      html += '<div class="gu-stats">' + cfg.stats.map(function(s){
        return '<div class="gu-stat"><b>' + s.value + "</b><span>" + s.label + "</span></div>";
      }).join("") + "</div>";
    }

    (cfg.sections || []).forEach(function(sec, i){
      if (sec.title) html += "<h3>" + sec.title + "</h3>";
      html += sec.node ? '<div data-gu-slot="' + i + '"></div>' : (sec.html || "");
    });

    if (cfg.settings && cfg.settings.length){
      html += "<h3>" + (cfg.settingsTitle || "Settings") + "</h3>";
      cfg.settings.forEach(function(row, i){
        html += '<div class="gu-row"><span>' + row.label +
                (row.hint ? '<small class="gu-hint">' + row.hint + "</small>" : "") +
                '</span><div class="gu-seg" data-gu-set="' + i + '">' +
                row.options.map(function(o){
                  return '<button data-gu-val="' + o.value + '"' +
                         (String(o.value) === String(row.value) ? ' class="on"' : "") +
                         ">" + o.label + "</button>";
                }).join("") +
                "</div></div>";
      });
    }

    if (cfg.footer) html += cfg.footer;

    html += '<div class="gu-actions">' +
      '<button class="gu-btn btn" id="guClose">' + (cfg.closeLabel || "Back to the game") + "</button>" +
      (cfg.reset ? '<button class="gu-btn gu-danger btn danger" id="guReset">' +
                   (cfg.reset.label || "Erase all progress") + "</button>" : "") +
      "</div>";

    var top = keepScroll && el ? el.scrollTop : 0;
    show(html);
    el.scrollTop = top;

    // Game-built nodes (a letter grid, a chart) drop into their placeholders.
    (cfg.sections || []).forEach(function(sec, i){
      if (!sec.node) return;
      var slot = el.querySelector('[data-gu-slot="' + i + '"]');
      if (slot) slot.appendChild(sec.node);
    });

    // Settings save immediately and the panel redraws itself.
    (cfg.settings || []).forEach(function(row, i){
      var seg = el.querySelector('[data-gu-set="' + i + '"]');
      if (!seg) return;
      seg.addEventListener("click", function(e){
        var b = e.target.closest("button[data-gu-val]");
        if (!b) return;
        row.onPick(b.dataset.guVal);
        panel(true);
      });
    });

    el.querySelector("#guClose").onclick = close;
    if (cfg.reset){
      el.querySelector("#guReset").onclick = function(){
        if (!window.confirm(cfg.reset.confirm || "Erase saved progress and start over?")) return;
        var run = cfg.reset.run;
        cfg = null;   // reset.run() resumes play itself, so onClose must not also fire
        close();
        run();
      };
    }
    el.querySelector("#guClose").focus();
  }

  window.Grownups = {
    open: function(builder){ build = builder; cfg = builder(); gate(); },
    refresh: function(){ if (open && build) panel(true); },
    close: close,
    /* Games check this before handling keys or starting a new round. */
    isOpen: function(){ return open; }
  };
})();
