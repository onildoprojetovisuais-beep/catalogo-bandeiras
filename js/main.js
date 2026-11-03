import { initMotion, initGrifo, initNavbarScroll, initStatCounters } from "./motion.js";
import { initMobileMenu, initScrollSpy } from "./nav.js";
import { initCTAs } from "./cta.js";
import { initPilotoCards } from "./pilotos.js";
import { initVideoSoundToggle, initBastidoresPreload } from "./video-sound-toggle.js";
import { initInstagramFeed } from "./instagram-feed.js";
import { initCarrossel } from "./carrossel.js";
import { initExperiencias } from "./experiencias.js";
import { initRaceLeague } from "./race-league.js";

// Largura da barra de rolagem em --sbw: 100vw a inclui, o .container não —
// sem isso o --content-inset (tokens.css) fica meia barra à direita do eixo.
const syncScrollbar = () => document.documentElement.style.setProperty(
  "--sbw", `${window.innerWidth - document.documentElement.clientWidth}px`);
syncScrollbar();
window.addEventListener("resize", syncScrollbar);

initMotion();
initGrifo();
initStatCounters();
initNavbarScroll();
initMobileMenu();
initScrollSpy();
initCTAs();
initPilotoCards();
initVideoSoundToggle();
initBastidoresPreload();
initInstagramFeed();
initCarrossel();
initExperiencias();
initRaceLeague(); // depois de initMotion(): depende de .js-motion
