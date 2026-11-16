// Client-side filters for listing pages, taco calculator and form handling. No dependencies.
(function () {
  var box = document.querySelector("[data-filters]");
  var list = document.querySelector("[data-list]");
  if (box && list) {
    var cards = Array.prototype.slice.call(list.querySelectorAll(".card"));
    var ads = Array.prototype.slice.call(list.querySelectorAll(".ad"));
    var on = {}, city = "", sort = "best", q = "";
    var countEl = document.querySelector("[data-count]");
    var clearBtn = document.querySelector("[data-clear]");
    var empty = document.querySelector("[data-empty]");
    function has(c, s) { return (" " + c.dataset.styles + " ").indexOf(" " + s + " ") !== -1; }
    function pass(c) {
      var d = c.dataset;
      if (q && d.text.indexOf(q) === -1) return false;
      if (city && d.city !== city) return false;
      if (on.onsite && d.onsite !== "true") return false;
      if (on.truck && !has(c, "truck")) return false;
      if (on.dropoff && !(has(c, "dropoff") || has(c, "taquiza"))) return false;
      if (on.trompo && d.trompo !== "true") return false;
      if (on.staff && d.staff !== "true") return false;
      if (on.local && d.chain === "true") return false;
      if (on.priced && d.priced !== "true") return false;
      if (on.official && d.conf !== "official") return false;
      return true;
    }
    function render() {
      var shown = cards.filter(pass);
      shown.sort(function (a, b) {
        var f = (+b.dataset.feat) - (+a.dataset.feat);
        if (f) return f;
        if (sort === "price") return (+a.dataset.pp) - (+b.dataset.pp) || a.dataset.name.localeCompare(b.dataset.name);
        if (sort === "name") return a.dataset.name.localeCompare(b.dataset.name);
        return (+b.dataset.info) - (+a.dataset.info) || a.dataset.name.localeCompare(b.dataset.name);
      });
      cards.forEach(function (c) { c.hidden = true; });
      ads.forEach(function (a) { a.remove(); });
      shown.forEach(function (c, i) {
        c.hidden = false; list.appendChild(c);
        if (i === 3 && ads[0]) list.appendChild(ads[0]);
        if (i === 11 && ads[1]) list.appendChild(ads[1]);
      });
      var n = shown.length;
      if (countEl) countEl.textContent = n === 1 ? countEl.dataset.one : countEl.dataset.many.replace("{n}", n);
      if (empty) empty.hidden = n > 0;
      var active = Object.keys(on).some(function (k) { return on[k]; }) || city || q;
      if (clearBtn) clearBtn.hidden = !active;
    }
    box.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { var k = b.dataset.f; on[k] = !on[k]; b.setAttribute("aria-pressed", on[k] ? "true" : "false"); render(); });
    });
    var cs = box.querySelector("[data-city]"), ss = box.querySelector("[data-sort]"), qs = box.querySelector("[data-q]");
    if (cs) cs.addEventListener("change", function () { city = cs.value; render(); });
    if (ss) ss.addEventListener("change", function () { sort = ss.value; render(); });
    if (qs) qs.addEventListener("input", function () { q = qs.value.trim().toLowerCase(); render(); });
    if (clearBtn) clearBtn.addEventListener("click", function () {
      on = {}; city = ""; q = "";
      box.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      if (cs) cs.value = ""; if (qs) qs.value = "";
      render();
    });
  }

  // Tacos-per-person calculator
  var calc = document.querySelector("[data-calc]");
  if (calc) {
    var a = calc.querySelector("[data-a]"), k = calc.querySelector("[data-k]"), m = calc.querySelector("[data-m]"), out = calc.querySelector("[data-out]");
    var upd = function () { var per = +m.value; var n = Math.ceil((+a.value || 0) * per + (+k.value || 0) * Math.min(2, per)); out.textContent = n.toLocaleString(); };
    [a, k, m].forEach(function (el) { el.addEventListener("input", upd); el.addEventListener("change", upd); }); upd();
  }

  // Quote and business forms. Saves submissions to Supabase via data-endpoint.
  var form = document.getElementById("leadform");
  if (form) {
    var t0 = Date.now();
    // No event dates in the past (uses the visitor's local date).
    var dt = form.querySelector('input[type="date"]');
    if (dt) { var now = new Date(); dt.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
    var itf = document.getElementById("itemField");
    try { var v = new URLSearchParams(location.search).get("caterer"); if (v && itf) itf.value = v; } catch (e) {}
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var es = form.dataset.lang === "es";
      var ok = document.getElementById("leadok");
      var btn = form.querySelector('button[type="submit"]');
      var data = {}; new FormData(form).forEach(function (val, key) { data[key] = val; });
      function show(msg, bad) { ok.textContent = msg; ok.hidden = false; ok.classList.toggle("error", !!bad); }
      var thanks = form.dataset.type === "listing"
        ? (es ? "¡Gracias! Revisaremos su información y le escribiremos pronto." : "Thanks! We'll review your listing and get back to you soon.")
        : (es ? "¡Listo! Recibirá respuesta en 1–2 días hábiles." : "Done! Expect replies within 1–2 business days.");
      // Spam traps: hidden honeypot field, or a form sent faster than a person can fill it.
      if (data.company_website || Date.now() - t0 < 2500) { form.reset(); show(thanks); return; }
      if (!form.dataset.endpoint) { show(es ? "Gracias. Esta es una vista previa: el formulario se activará al publicar el sitio." : "Thanks. This is a preview: the form goes live when the site launches."); return; }
      // Saves the submission to Supabase (insert-only public key; visitors can't read entries).
      var skip = { company_website: 1, name: 1, email: 1, phone: 1, date: 1, lang: 1, site: 1 };
      var details = {}; Object.keys(data).forEach(function (k) { if (!skip[k] && data[k] !== "") details[k] = data[k]; });
      var row = { site: form.dataset.site, form_type: form.dataset.type, language: es ? "es" : "en", name: data.name || null, email: data.email, phone: data.phone || null, event_date: data.date || null, details: details };
      if (btn) btn.disabled = true;
      fetch(form.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "apikey": form.dataset.key, "Prefer": "return=minimal" }, body: JSON.stringify(row) })
        .then(function (r) { if (!r.ok) throw 0; form.reset(); show(thanks); if (window.gtag) gtag("event", "generate_lead", { form: data.form }); })
        .catch(function () { show(es ? "No se pudo enviar. Intente de nuevo." : "Couldn't send. Please try again.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }
})();
