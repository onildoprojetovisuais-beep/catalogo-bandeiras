/*
  Vídeos com autoplay (LEGADO, EXPERIÊNCIAS/Team Building, CATERHAM ESPORTS, BANDEIRAS EMPRESARIAL)
  — pedido do usuário: já rodar sozinho, sem precisar dar play. Nenhum navegador
  libera autoplay com áudio, então o <video> entra mudo/loop e este módulo cuida de:

  1. Pausa/retomada acessível (QA-003, WCAG 2.2.2): botão .video-pause-toggle,
     nativo <button>, operável por teclado, com nome que anuncia a ação
     ("Pausar vídeo" / "Reproduzir vídeo"). Pausa manual vence o observer:
     o vídeo não volta sozinho ao rolar a página.
  2. prefers-reduced-motion: o vídeo NÃO inicia sozinho (poster visível); o
     botão continua ali para o visitante iniciar quando quiser.
  3. play/pause por IntersectionObserver (não gasta ciclo fora de tela).
  4. Botão de som (.video-sound-toggle), quando existe no quadro.
*/
export function initVideoSoundToggle() {
  const frames = document.querySelectorAll(
    ".bandeiras__video-frame, .legado__frame, .experiencias__momento, .sim__media"
  );
  if (!frames.length) return;

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  frames.forEach((frame) => {
    const video = frame.querySelector("video");
    if (!video) return;
    const soundBtn = frame.querySelector(".video-sound-toggle");
    const pauseBtn = frame.querySelector(".video-pause-toggle");
    let userPaused = false;
    let inView = false;

    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        soundBtn.setAttribute("aria-pressed", String(!video.muted));
        if (!video.muted && !userPaused && !reducedQuery.matches) video.play().catch(() => {});
      });
    }

    const syncPauseBtn = () => {
      if (!pauseBtn) return;
      // o nome reflete a ação do visitante: pausado por ele / reduced-motion,
      // e não pausas automáticas do IntersectionObserver fora da tela (QA-027)
      const paused = userPaused || (video.paused && inView);
      pauseBtn.setAttribute("aria-label", paused ? "Reproduzir vídeo" : "Pausar vídeo");
      pauseBtn.classList.toggle("is-paused", paused);
    };
    video.addEventListener("play", syncPauseBtn);
    video.addEventListener("pause", syncPauseBtn);

    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => {
        if (video.paused) {
          userPaused = false;
          video.play().catch(() => {});
        } else {
          userPaused = true;
          video.pause();
        }
      });
    }

    const applyReduced = () => {
      if (reducedQuery.matches) {
        video.removeAttribute("autoplay");
        video.pause();
        userPaused = true; // só o clique do visitante inicia
      }
      syncPauseBtn();
    };
    applyReduced();
    reducedQuery.addEventListener?.("change", applyReduced);

    if (!("IntersectionObserver" in window)) {
      // sem IntersectionObserver: mantém o autoplay aprovado (o atributo saiu do HTML)
      if (!reducedQuery.matches) video.play().catch(() => {});
      return;
    }

    // QA-048 (Sprint 04): os vídeos de fundo entram com preload="none" e SEM o atributo
    // autoplay (ele fazia o navegador baixar tudo no load, mesmo 4–11 mil px abaixo da
    // dobra). O play() abaixo continua sendo o autoplay aprovado — só acontece quando o
    // vídeo entra na tela. Este observador antecipa o download ~1 tela antes.
    if (!reducedQuery.matches && video.preload === "none") {
      const preloader = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            video.preload = "auto";
            preloader.disconnect();
          }
        },
        { rootMargin: "600px 0px" }
      );
      preloader.observe(video);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          inView = entry.isIntersecting;
          if (inView && !userPaused && !reducedQuery.matches) video.play().catch(() => {});
          else if (!inView) video.pause();
        });
      },
      { threshold: 0.4 }
    );
    io.observe(video);
  });
}

/*
  Bastidores (vídeo com controles nativos, sem autoplay): preload="none" no HTML para não
  puxar ~1 MB de metadados no load de uma página onde ele está ~11 mil px abaixo. Perto da
  viewport (600px) passa a "metadata": a duração e o 1º quadro ficam prontos quando o
  visitante chega; o arquivo inteiro só baixa ao dar play.
*/
export function initBastidoresPreload() {
  const video = document.querySelector('.conteudo__video-frame video[preload="none"]');
  if (!video || !("IntersectionObserver" in window)) {
    if (video) video.preload = "metadata";
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        video.preload = "metadata";
        io.disconnect();
      }
    },
    { rootMargin: "600px 0px" }
  );
  io.observe(video);
}
