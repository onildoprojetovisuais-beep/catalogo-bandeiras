// Scuderia Bandeiras Esports Cup (ex-Caterham Esports Brasil) — página de inscrição (campeonato-simulador/).
// Arquivo externo por causa da CSP (script-src 'self'). Três partes:
//   1. motion de entrada/scroll (só sem prefers-reduced-motion);
//   2. barra de setores S1–S4 que enche conforme o piloto preenche;
//   3. formulário (lógica do formulário original da Scuderia) enviando para
//      POST /api/inscricao-caterham-esports.
(() => {
  "use strict";

  const ENDPOINT = "/api/inscricao-caterham-esports";
  const root = document.documentElement;
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ 1. motion
  if (!reduz) {
    root.classList.add("js-motion");
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-pronto")));
  }

  const alvos = document.querySelectorAll("[data-revela]");
  if (!reduz && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    alvos.forEach((el) => io.observe(el));
  } else {
    alvos.forEach((el) => el.classList.add("is-in"));
  }

  // contagem dos números da telemetria (02/05/10/30)
  if (!reduz) {
    document.querySelectorAll("[data-conta]").forEach((el, i) => {
      const fim = Number(el.dataset.conta);
      const dur = 1100;
      const atraso = 900 + i * 90;
      el.textContent = "00";
      setTimeout(() => {
        const t0 = performance.now();
        const passo = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const v = Math.round(fim * (1 - Math.pow(1 - p, 4)));
          el.textContent = String(v).padStart(2, "0");
          if (p < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      }, atraso);
    });
  }

  // vídeo do topo: parado com reduced-motion; pausa fora da tela; botão de
  // pausa (WCAG 2.2.2) — pausa do visitante vence o observer
  const video = document.querySelector(".hero__video");
  const pausa = document.querySelector(".hero__pausa");
  if (video) {
    let pausadoPeloVisitante = reduz;
    const sync = () => {
      if (!pausa) return;
      const p = video.paused;
      pausa.classList.toggle("is-pausado", p);
      pausa.setAttribute("aria-label", p ? "Reproduzir vídeo" : "Pausar vídeo");
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    if (pausa) {
      pausa.addEventListener("click", () => {
        if (video.paused) {
          pausadoPeloVisitante = false;
          video.play().catch(() => {});
        } else {
          pausadoPeloVisitante = true;
          video.pause();
        }
      });
    }
    if (reduz) {
      video.removeAttribute("autoplay");
      video.pause();
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !pausadoPeloVisitante) video.play().catch(() => {});
        else if (!e.isIntersecting) video.pause();
      }).observe(video);
    }
    sync();
  }

  // ------------------------------------------------------------ 3. formulário
  const form = document.getElementById("form");
  if (!form) return;
  const academy = document.getElementById("academyExtra");
  const experience = document.getElementById("experienceExtra");
  const alertBox = document.getElementById("alert");
  const success = document.getElementById("success");
  const btn = document.getElementById("submitBtn");
  const checked = (n) => form.querySelector('input[name="' + n + '"]:checked');

  function updateCategory() {
    const show = checked("category")?.value === "Academy";
    academy.hidden = !show;
    academy.querySelectorAll('input[name="academy_fallback_420r"]').forEach((e) => {
      e.required = show;
      if (!show) e.checked = false;
    });
  }
  function updateExperience() {
    const show = checked("real_motorsport_experience")?.value === "Sim";
    experience.hidden = !show;
    form.elements.experience_description.required = show;
    if (!show) form.elements.experience_description.value = "";
  }
  form.querySelectorAll('input[name="category"]').forEach((e) => e.addEventListener("change", updateCategory));
  form.querySelectorAll('input[name="real_motorsport_experience"]').forEach((e) => e.addEventListener("change", updateExperience));

  // ------------------------------------------------------------ 2. setores
  const setores = [...document.querySelectorAll(".setores li[data-setor]")];
  function progresso() {
    setores.forEach((li) => {
      const fs = form.querySelector('fieldset[data-setor="' + li.dataset.setor + '"]');
      if (!fs) return;
      // um "item" por campo obrigatório; grupos de rádio contam uma vez
      const vistos = new Set();
      let total = 0;
      let ok = 0;
      fs.querySelectorAll("input[required], select[required], textarea[required]").forEach((el) => {
        if (el.type === "radio") {
          if (vistos.has(el.name)) return;
          vistos.add(el.name);
          total++;
          if (checked(el.name)) ok++;
        } else {
          total++;
          if (el.checkValidity() && (el.type === "checkbox" ? el.checked : el.value.trim() !== "")) ok++;
        }
      });
      const p = total ? ok / total : 0;
      li.querySelector(".setores__barra span").style.setProperty("--p", p.toFixed(3));
      li.classList.toggle("is-ok", total > 0 && ok === total);
    });
  }
  form.addEventListener("input", progresso);
  form.addEventListener("change", progresso);

  function payload(fd) {
    const p = Object.fromEntries(fd.entries());
    ["accept_regulation", "truth_declaration", "qualifying_ack", "grid_ack", "privacy_consent", "marketing_consent"].forEach((k) => {
      if (!(k in p)) p[k] = "Não";
    });
    p.iracing_customer_id = Number(p.iracing_customer_id);
    p.irating_declared = Number(p.irating_declared);
    p.source = "site_scuderia_bandeiras";
    p.championship = "Scuderia Bandeiras Esports Cup 2026";
    p.submitted_at = new Date().toISOString();
    return p;
  }

  async function send(p) {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error("HTTP " + r.status);
      err.status = r.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  function erro(msg) {
    alertBox.textContent = msg;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "center" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    updateCategory();
    updateExperience();
    form.classList.add("foi-enviado");
    if (!form.checkValidity()) {
      erro("Revise os campos obrigatórios antes de enviar sua inscrição.");
      const primeiro = form.querySelector(":invalid");
      if (primeiro) primeiro.focus({ preventScroll: true });
      form.reportValidity();
      return;
    }
    const fd = new FormData(form);
    if (fd.get("website")) return; // honeypot
    btn.disabled = true;
    btn.textContent = "Enviando...";
    try {
      const result = await send(payload(fd));
      form.hidden = true;
      success.hidden = false;
      if (result.registration_id) {
        document.getElementById("registrationId").textContent = result.registration_id;
        document.getElementById("registrationLine").hidden = false;
      }
      setores.forEach((li) => li.classList.add("is-ok"));
      success.focus({ preventScroll: true });
      success.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
    } catch (err) {
      erro(
        err.status === 503
          ? "As inscrições ainda não estão recebendo envios. Tente novamente em breve."
          : err.status === 400
            ? "Alguns dados não passaram na validação. Confira os campos e tente de novo."
            : "Não foi possível enviar sua inscrição. Tente novamente em alguns instantes."
      );
      btn.disabled = false;
      btn.textContent = "Enviar inscrição";
    }
  });

  updateCategory();
  updateExperience();
  progresso();
})();
