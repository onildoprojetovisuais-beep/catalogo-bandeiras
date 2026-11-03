/*
  Race League (2026-11-02) — seção #race-league da home e página /race-league/.

  1. initRaceLeague(): só liga classes por IntersectionObserver (wipe do logo,
     risco neon, títulos por linha, "luzes de largada" dos números e o
     letterbox 1× do teaser). Nenhum listener de scroll: os scrubs da home
     (letterbox, zoom, scrim, deriva do "MUITAS DISPUTAS!") são CSS
     scroll-driven (animation-timeline) sob @supports. Mesmo gate do resto do
     site: sem .js-motion (sem JS/IO ou com reduced-motion) não faz nada e o
     CSS-base já é o estado final visível.
  2. initRaceLeagueFilme(): player do filme do topo da página (88 s, com som).
     SEM autoplay (flash ainda não validado). Poster + botão "Assistir";
     controles próprios (play/pausa/"Assistir de novo", som, CC), legenda do
     <track> desenhada numa camada própria (track.mode = "hidden"; em tela
     cheia, "showing"). Sem JS o <video controls> nativo continua valendo.
  3. Boot da página: quando o documento tem [data-rl-pagina] este módulo é o
     entry point (a home usa js/main.js, que importa initRaceLeague()).
*/
import { initMotion, initGrifo, initNavbarScroll } from "./motion.js";
import { initMobileMenu } from "./nav.js";
import { initCTAs } from "./cta.js";

const REVEAL = { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }; // = initMotion()

/*
  Dispara cb uma vez quando o elemento entra (pelo limiar de opts) OU quando ele
  já passou da tela (boundingClientRect.bottom < 0): recarregar no meio do pin
  ou saltar por âncora não deixa nada escondido (QA desktop #2).
  Failsafe POR ELEMENTO (QA desktop #3): 4 s depois de qualquer pixel dele
  aparecer, cb roda mesmo que o limiar não tenha sido atingido. Nada é revelado
  antes de o visitante chegar ao elemento.
*/
function once(el, cb, opts = REVEAL) {
  if (!el) return;
  let done = false;
  let timer = 0;
  const fire = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    io.disconnect();
    guard.disconnect();
    cb();
  };
  const passed = (entry) => entry.boundingClientRect.bottom < 0;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting || passed(entry)) fire();
  }, opts);
  const guard = new IntersectionObserver(([entry]) => {
    if (passed(entry)) fire();
    else if (entry.isIntersecting && !timer) timer = window.setTimeout(fire, 4000);
  }, { threshold: 0 });
  io.observe(el);
  guard.observe(el);
}

export function initRaceLeague() {
  if (!document.documentElement.classList.contains("js-motion")) return;
  const roots = document.querySelectorAll("[data-rl]");
  if (!roots.length) return;

  roots.forEach((root) => {
    const mark = (el) => () => el.classList.add("rl-in");

    // risco e logo: o clip-path fica no <img> filho, então o elemento
    // observado não tem clip e o IO enxerga a interseção (QA desktop #1)
    root.querySelectorAll("[data-rl-risco], [data-rl-wipe]").forEach((el) => once(el, mark(el)));

    // números/tiles/specs: índice para o passo de 120 ms entre células
    root.querySelectorAll("[data-rl-grid]").forEach((grid) => {
      [...grid.children].forEach((li, i) => li.style.setProperty("--i", i));
      once(grid, mark(grid), { threshold: 0.3 });
    });

    // títulos por linha: no palco do teaser, quem dispara é a sentinela do
    // runway (junto com o letterbox 1×); nos demais, o próprio título.
    root.querySelectorAll("[data-rl-linhas]").forEach((titulo) => {
      const runway = titulo.closest(".rl__runway");
      const sentinela = runway?.querySelector("[data-rl-sentinela]");
      if (sentinela) {
        once(sentinela, () => { titulo.classList.add("rl-in"); runway.classList.add("rl-aberta"); }, { threshold: 0 });
      } else {
        once(titulo, mark(titulo));
      }
    });
  });
}

const fmtLabel = (state) => ({
  play: "Reproduzir filme",
  pause: "Pausar filme",
  replay: "Assistir de novo",
}[state]);

export function initRaceLeagueFilme() {
  const palco = document.querySelector("[data-rl-filme]");
  const video = palco?.querySelector("video");
  if (!video) return;

  const playBig = palco.querySelector("[data-rl-play]");
  const playBigTexto = palco.querySelector("[data-rl-play-texto]");
  const controles = palco.querySelector("[data-rl-controles]");
  const btnToggle = palco.querySelector("[data-rl-toggle]");
  const btnSom = palco.querySelector("[data-rl-som]");
  const btnCC = palco.querySelector("[data-rl-cc-toggle]");
  const ccSpan = palco.querySelector("[data-rl-cc] > span");
  const track = video.textTracks && video.textTracks[0];

  // celular em retrato toca a versão 9:16 (o <source> escolhe pelo mesmo media);
  // o pôster acompanha, senão o 16:9 aparece cortado no quadro vertical
  if (window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches) {
    video.poster = "/assets-build/video/race-league-filme-poster-9x16.jpg";
  }

  // os controles próprios assumem
  video.removeAttribute("controls");
  palco.classList.add("is-custom");
  controles.hidden = false;
  playBig.hidden = false;

  let ccOn = true;
  let autoPaused = false;
  let inView = false;

  const syncToggle = () => {
    const state = video.ended ? "replay" : video.paused ? "play" : "pause";
    btnToggle.setAttribute("aria-label", fmtLabel(state));
    btnToggle.dataset.state = state;
    palco.classList.toggle("is-playing", !video.paused);
  };
  const syncSom = () => btnSom.setAttribute("aria-pressed", String(!video.muted));

  const start = () => {
    if (video.ended) video.currentTime = 0;
    autoPaused = false;
    playBig.hidden = true;
    video.play().catch(() => {
      playBig.hidden = false;
    });
  };

  let primeiroPlay = true;
  playBig.addEventListener("click", () => {
    // 1º play (gesto explícito): começa com som e legenda ligada. No "Assistir
    // de novo" a escolha de som do visitante é mantida (QA desktop #10).
    if (primeiroPlay) { video.muted = false; primeiroPlay = false; }
    syncSom();
    start();
    btnToggle.focus({ preventScroll: true });
  });
  btnToggle.addEventListener("click", () => {
    if (video.paused || video.ended) start();
    else { autoPaused = false; video.pause(); }
  });
  btnSom.addEventListener("click", () => {
    video.muted = !video.muted;
    syncSom();
    // ligar o som com o filme parado (antes do 1º play, ou depois de uma pausa
    // automática por sair da tela / trocar de aba) também dá play: senão o ícone
    // acende "som ligado" e não sai áudio nenhum.
    if (!video.muted && (video.paused || video.ended)) {
      primeiroPlay = false;
      start();
    }
  });

  video.addEventListener("play", syncToggle);
  video.addEventListener("pause", syncToggle);
  video.addEventListener("ended", () => {
    syncToggle();
    playBigTexto.textContent = "Assistir de novo";
    playBig.hidden = false;
  });
  video.addEventListener("volumechange", syncSom);

  // ---- legendas: VTT como fonte única, camada própria aria-hidden ----
  if (track && ccSpan) {
    track.mode = "hidden";
    const draw = () => {
      const cue = track.activeCues && track.activeCues[0];
      ccSpan.textContent = ccOn && cue ? cue.text.replace(/<[^>]+>/g, "") : "";
    };
    track.addEventListener("cuechange", draw);
    btnCC.addEventListener("click", () => {
      ccOn = !ccOn;
      btnCC.setAttribute("aria-pressed", String(ccOn));
      draw();
    });
    const fullscreen = (full) => {
      track.mode = full && ccOn ? "showing" : "hidden";
      if (!full) draw();
    };
    document.addEventListener("fullscreenchange", () => fullscreen(!!document.fullscreenElement));
    video.addEventListener("webkitbeginfullscreen", () => fullscreen(true));
    video.addEventListener("webkitendfullscreen", () => fullscreen(false));
  } else {
    btnCC?.remove();
  }

  // ---- fora da tela / aba oculta: pausa. Volta sozinho só se estiver mudo. ----
  const autoPause = () => {
    if (!video.paused && !video.ended) { autoPaused = true; video.pause(); }
  };
  const autoResume = () => {
    if (autoPaused && video.muted && inView && !document.hidden) { autoPaused = false; video.play().catch(() => {}); }
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) autoResume(); else autoPause();
    }, { threshold: 0.25 });
    io.observe(video);
  } else {
    inView = true;
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? autoPause() : autoResume()));

  syncToggle();
  syncSom();
}

/* Cards: grava a posição do ponteiro no card como --tx/--ty (-1..1); o CSS
   transforma isso em tilt 3D. Só com mouse e sem reduced-motion. */
function initCardTilt() {
  const fino = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  if (!fino.matches) return;
  document.querySelectorAll(".rl-card").forEach((card) => {
    let raf = 0;
    card.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ty = ((e.clientY - r.top) / r.height) * 2 - 1;
        card.style.setProperty("--tx", Math.max(-1, Math.min(1, tx)).toFixed(3));
        card.style.setProperty("--ty", Math.max(-1, Math.min(1, ty)).toFixed(3));
      });
    });
    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      raf = 0;
      card.style.removeProperty("--tx");
      card.style.removeProperty("--ty");
    });
  });
}

function bootPagina() {
  const syncScrollbar = () => document.documentElement.style.setProperty(
    "--sbw", `${window.innerWidth - document.documentElement.clientWidth}px`);
  syncScrollbar();
  window.addEventListener("resize", syncScrollbar);

  initMotion();
  initGrifo();
  initNavbarScroll();
  initMobileMenu();
  initCTAs();
  initRaceLeague();
  initCardTilt();
  // h1 acima da dobra: o wipe roda já no carregamento, sem esperar o IO
  const h1 = document.querySelector(".rl-filme__logo[data-rl-wipe]");
  if (h1 && document.documentElement.classList.contains("js-motion")) {
    requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add("rl-in")));
  }
  initRaceLeagueFilme();
}

if (document.querySelector("[data-rl-pagina]")) bootPagina();
