/*
  Sistema de motion — reveal por IntersectionObserver
  Fonte: doc/VISUAL-DIRECTION.md §12

  Regra central: o CSS já renderiza tudo visível (css/base.css @layer motion-base).
  Esta camada SÓ adiciona a classe .js-motion ao <html> quando JS roda, IO existe
  e o usuário não pediu reduced-motion — e só então o CSS de reveal (opacity:0 -
  translateY) passa a valer. Falha de qualquer uma dessas condições = página
  100% visível sem motion, sem esperar nada.

  Failsafe (§12.5): se por qualquer razão um elemento nunca receber .is-in
  (ex.: erro de JS no meio da execução), um temporizador de 4s força todos os
  [data-reveal] a aparecer. Nenhum conteúdo fica invisível para sempre.
*/

export function initMotion() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  if (prefersReduced || !hasIO) {
    // Estado final já é o visível (definido em base.css) — nada a fazer.
    return;
  }

  document.documentElement.classList.add("js-motion");

  const targets = document.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );

  targets.forEach((el) => observer.observe(el));

  // Failsafe: nada fica invisível para sempre.
  window.setTimeout(() => {
    document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => {
      el.classList.add("is-in");
    });
  }, 4000);

  // Stagger controlado por CSS var, setado via atributo data-stagger-index
  document.querySelectorAll("[data-stagger] > *").forEach((child, i) => {
    child.style.setProperty("--stagger-delay", `${Math.min(i, 4) * 60}ms`);
  });
}

/*
  Grifo — destaque animado e REVERSÍVEL nos títulos grandes (.grifo, em
  index.template.html). Ao contrário do reveal acima (unobserve após o
  primeiro "entrou"), aqui a marca continua observada e a classe .is-in
  é ligada/desligada a cada cruzamento: entra em cena → grifo pinta;
  volta a rolar pra cima e sai de cena → grifo desfaz. threshold 0.4 =
  dispara perto do meio da viewport, não na borda.

  Só faz sentido dentro de .js-motion (JS + IO + sem reduced-motion) — é
  exatamente a mesma condição que initMotion() já verificou. Fora dela,
  css/base.css mantém o grifo sempre pintado (estado final estático).
*/
export function initGrifo() {
  if (!document.documentElement.classList.contains("js-motion")) return;

  const marks = document.querySelectorAll(".grifo");
  if (!marks.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle("is-active", entry.isIntersecting);
      }
    },
    { threshold: 0.4, rootMargin: "0px 0px -15% 0px" }
  );

  marks.forEach((el) => observer.observe(el));
}

/*
  Navbar: fundo sólido após rolar, header some ao rolar para baixo (volta ao
  rolar para cima), tudo por sentinela IO — nunca scroll listener contínuo.
*/
export function initNavbarScroll() {
  const nav = document.querySelector("[data-nav]");
  if (!nav) return;

  const sentinel = document.querySelector("[data-nav-sentinel]");
  if (sentinel && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        nav.classList.toggle("is-solid", !entry.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(sentinel);
  }

  let lastY = window.scrollY;
  let ticking = false;
  const hideThreshold = 80;

  function onScroll() {
    const y = window.scrollY;
    if (!nav.matches(":focus-within")) {
      if (y > lastY && y > hideThreshold) {
        nav.classList.add("is-hidden");
      } else {
        nav.classList.remove("is-hidden");
      }
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );
}

/*
  Contador (count-up) — núcleo compartilhado. O valor final está SEMPRE no
  HTML como texto; a animação só reescreve o texto de 0 até ele. Sem JS,
  sem IO ou com reduced-motion o número final fica estático, nunca vazio.

  Largura travada: antes de contar, o span recebe min-width = largura do
  valor final (numerais tabulares) e alinha à direita — os dígitos "enchem"
  da direita pra esquerda e a unidade ao lado não dança durante a contagem.
*/
const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

export function animateCount(el, target, { duration = 1100, delay = 0, ease = easeOutExpo } = {}) {
  el.style.display = "inline-block";
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  el.style.textAlign = "right";
  el.textContent = "0";

  let start;
  function tick(now) {
    start ??= now + delay;
    const p = Math.max(0, Math.min((now - start) / duration, 1));
    el.textContent = Math.round(target * ease(p)).toLocaleString("pt-BR");
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString("pt-BR"); // garante o valor exato ao final
  }
  requestAnimationFrame(tick);
}

/*
  Números de destaque (trio da abertura do Bandeiras Empresarial).
  Marcação: <span data-count-up="300" data-count-delay="120">300</span>

  Dispara com o MESMO limiar do reveal (initMotion): o reset para "0"
  acontece enquanto o <li> ainda está em opacity 0, então nunca se vê o
  valor final "piscar" antes da contagem. Uma vez só — unobserve após
  disparar, voltar a rolar não repete. data-count-delay acompanha o
  stagger do reveal para os três números entrarem em cascata.
*/
export function initStatCounters() {
  if (!document.documentElement.classList.contains("js-motion")) return;

  const nums = document.querySelectorAll("[data-count-up]");
  if (!nums.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const target = Number(el.dataset.countUp);
        io.unobserve(el);
        if (Number.isFinite(target)) {
          // mede a largura final só com a fonte carregada (fallback é mais larga)
          const start = () => animateCount(el, target, {
            duration: 1300,
            delay: Number(el.dataset.countDelay) || 0,
          });
          (document.fonts?.ready ?? Promise.resolve()).then(start);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );

  nums.forEach((el) => io.observe(el));
}
