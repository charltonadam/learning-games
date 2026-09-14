/* Minimal window.storage shim backed by localStorage.
   The games were written against a host-provided async storage API; on a plain
   static host that object doesn't exist, so progress is lost on every reload.
   Same shape as the original: get -> {value} | null, set, delete. */
(function(){
  if (window.storage) return;

  var prefix = "learning-games:";
  var ok = true;
  try {
    localStorage.setItem(prefix + "probe", "1");
    localStorage.removeItem(prefix + "probe");
  } catch (e) {
    ok = false; /* private browsing, blocked cookies */
  }

  window.storage = {
    get: function(key){
      if (!ok) return Promise.reject(new Error("storage unavailable"));
      var v = localStorage.getItem(prefix + key);
      return Promise.resolve(v === null ? null : { value: v });
    },
    set: function(key, value){
      if (!ok) return Promise.reject(new Error("storage unavailable"));
      localStorage.setItem(prefix + key, String(value));
      return Promise.resolve();
    },
    delete: function(key){
      if (!ok) return Promise.reject(new Error("storage unavailable"));
      localStorage.removeItem(prefix + key);
      return Promise.resolve();
    }
  };
})();
