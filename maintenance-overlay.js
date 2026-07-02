/* ============================================================
   MAINTENANCE OVERLAY — Scuderia Bandeiras
   ------------------------------------------------------------
   Componente independente e não-destrutivo. Não altera nenhuma
   estrutura, conteúdo ou seção existente da página.

   COMO USAR
   - Ativar overlay:  MAINTENANCE_MODE = true
   - Desativar overlay: MAINTENANCE_MODE = false
   - Remover completamente: apague o <script src="maintenance-overlay.js">
     do index.html (nenhuma outra alteração é necessária).
   ============================================================ */
(function () {
  'use strict';

  var MAINTENANCE_MODE = true;

  if (!MAINTENANCE_MODE) return;

  var CONFIG = {
    logo: 'Brand/1124_Bandeiras_RGB_L-RW.png',
    whatsappUrl: 'https://wa.me/5515981282808',
    instagramUrl: 'https://www.instagram.com/scuderiabandeiras/'
  };

  function init() {
    injectStyles();
    injectMarkup();
    lockScroll();
  }

  function injectStyles() {
    var css = ''
      /* ── BASE / ATMOSPHERE ── */
      + '#mo-overlay{position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;'
      + 'display:flex;align-items:center;justify-content:center;overflow:hidden;'
      + 'padding:clamp(14px,4vw,40px);background:rgba(6,6,6,.88);'
      + '-webkit-backdrop-filter:blur(28px);backdrop-filter:blur(28px);'
      + 'opacity:0;animation:mo-fade .5s ease forwards;}'
      + '#mo-overlay *{box-sizing:border-box;}'
      + '@keyframes mo-fade{from{opacity:0}to{opacity:1}}'
      + '@keyframes mo-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}'
      + '@keyframes mo-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}'
      + '@keyframes mo-sweep{0%{transform:translateX(-30%) rotate(8deg)}100%{transform:translateX(30%) rotate(8deg)}}'
      + '@keyframes mo-blink{0%,100%{opacity:1}50%{opacity:.25}}'
      + '.mo-glow{position:absolute;top:50%;left:50%;width:min(1100px,140vw);height:min(1100px,140vw);'
      + 'transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(248,1,0,.24),rgba(248,1,0,0) 62%);'
      + 'animation:mo-pulse 5s ease-in-out infinite;pointer-events:none;}'
      + '.mo-noise{position:absolute;inset:-10%;opacity:.05;pointer-events:none;mix-blend-mode:overlay;'
      + 'background-image:url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)"/></svg>\');}'
      + '.mo-sweep-beam{position:absolute;top:-20%;left:0;width:36%;height:140%;pointer-events:none;'
      + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.05) 45%,rgba(248,1,0,.10) 50%,rgba(255,255,255,.05) 55%,transparent);'
      + 'animation:mo-sweep 7s ease-in-out infinite alternate;}'
      + '.mo-checker-corner{position:absolute;bottom:-90px;right:-90px;width:280px;height:280px;pointer-events:none;'
      + 'opacity:.07;transform:rotate(-18deg);'
      + 'background-image:repeating-conic-gradient(#fff 0% 25%,transparent 0% 50%);background-size:28px 28px;}'
      /* ── CARD ── */
      + '.mo-card{position:relative;width:100%;max-width:980px;max-height:92vh;overflow-y:auto;'
      + 'background:linear-gradient(155deg,#161616,#0a0a0a 60%);'
      + 'border:1px solid rgba(255,255,255,.09);border-top:3px solid #F80100;'
      + 'box-shadow:0 40px 100px rgba(0,0,0,.6),0 0 0 1px rgba(248,1,0,.05),0 0 90px rgba(248,1,0,.12);'
      + 'padding:clamp(30px,4.5vw,56px) clamp(24px,5vw,64px) clamp(28px,4vw,48px);color:#fff;'
      + 'font-family:"Inter",sans-serif;opacity:0;animation:mo-rise .7s .12s cubic-bezier(.25,.1,.25,1) forwards;}'
      + '.mo-badge{display:inline-flex;align-items:center;gap:9px;padding:7px 16px 7px 12px;'
      + 'border:1px solid rgba(248,1,0,.35);background:rgba(248,1,0,.08);border-radius:30px;'
      + 'font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:12px;letter-spacing:3px;'
      + 'text-transform:uppercase;color:#fff;margin-bottom:22px;opacity:0;animation:mo-rise .6s .25s ease forwards;}'
      + '.mo-badge-dot{width:8px;height:8px;border-radius:50%;background:#F80100;flex-shrink:0;'
      + 'box-shadow:0 0 8px rgba(248,1,0,.9);animation:mo-blink 1.3s ease-in-out infinite;}'
      + '.mo-head{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;'
      + 'margin-bottom:8px;opacity:0;animation:mo-rise .6s .18s ease forwards;}'
      + '.mo-logo{display:block;max-width:168px;height:auto;}'
      + '.mo-flag{font-size:34px;line-height:1;}'
      + '.mo-checker-rule{height:9px;width:100%;margin:22px 0 30px;border-radius:2px;overflow:hidden;'
      + 'background-image:repeating-linear-gradient(90deg,#fff 0 10px,#0a0a0a 10px 20px);'
      + 'transform:skewX(-18deg);opacity:.9;box-shadow:0 2px 18px rgba(0,0,0,.5);'
      + 'opacity:0;animation:mo-rise .6s .3s ease forwards;}'
      + '.mo-title{font-family:"Barlow Condensed",sans-serif;font-weight:900;text-transform:uppercase;'
      + 'font-size:clamp(34px,6vw,64px);letter-spacing:-1px;line-height:.96;margin-bottom:22px;color:#fff;'
      + 'opacity:0;animation:mo-rise .65s .35s cubic-bezier(.25,.1,.25,1) forwards;}'
      + '.mo-title em{font-style:normal;color:#F80100;}'
      + '.mo-body{display:grid;grid-template-columns:1.35fr 1fr;gap:clamp(24px,4vw,48px);align-items:start;}'
      + '@media(max-width:760px){.mo-body{grid-template-columns:1fr;}}'
      + '.mo-copy{opacity:0;animation:mo-rise .6s .42s ease forwards;}'
      + '.mo-text{font-size:15.5px;line-height:1.65;color:rgba(255,255,255,.62);margin-bottom:12px;}'
      + '.mo-text-strong{color:#fff;font-weight:600;}'
      /* ── TELEMETRY PANEL ── */
      + '.mo-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);'
      + 'border-radius:10px;padding:22px 22px 20px;opacity:0;animation:mo-rise .6s .5s ease forwards;}'
      + '.mo-panel-label{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:11.5px;'
      + 'letter-spacing:3px;text-transform:uppercase;color:#F80100;margin-bottom:14px;}'
      + '.mo-gauge{position:relative;height:14px;border-radius:3px;overflow:hidden;margin-bottom:18px;'
      + 'background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.09) 0 5px,rgba(255,255,255,.03) 5px 9px);'
      + 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);}'
      + '.mo-gauge-fill{position:absolute;top:0;left:-35%;height:100%;width:35%;border-radius:3px;'
      + 'background:linear-gradient(90deg,transparent,#F80100 45%,#ff6a45 60%,transparent);'
      + 'filter:drop-shadow(0 0 10px rgba(248,1,0,.75));animation:mo-load 2.1s ease-in-out infinite;}'
      + '@keyframes mo-load{0%{left:-35%}100%{left:100%}}'
      + '.mo-panel-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;'
      + 'border-top:1px solid rgba(255,255,255,.07);font-size:13px;}'
      + '.mo-panel-row:first-of-type{border-top:none;}'
      + '.mo-panel-row span{color:rgba(255,255,255,.45);letter-spacing:.3px;}'
      + '.mo-panel-row strong{color:#fff;font-weight:600;}'
      + '.mo-live{display:inline-flex;align-items:center;gap:6px;color:#F80100 !important;}'
      + '.mo-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#F80100;'
      + 'box-shadow:0 0 7px rgba(248,1,0,.9);animation:mo-blink 1.3s ease-in-out infinite;}'
      /* ── ACTIONS ── */
      + '.mo-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px;'
      + 'opacity:0;animation:mo-rise .6s .58s ease forwards;}'
      + '.mo-btn{display:inline-flex;align-items:center;gap:10px;font-family:"Barlow Condensed",sans-serif;'
      + 'font-weight:800;letter-spacing:2.5px;text-transform:uppercase;font-size:14.5px;flex:1 1 200px;'
      + 'justify-content:center;padding:18px 30px;border-radius:3px;text-decoration:none;color:#fff;'
      + 'transition:background .25s ease,transform .2s ease,box-shadow .25s ease;position:relative;overflow:hidden;}'
      + '.mo-btn::before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;'
      + 'background:rgba(255,255,255,.12);transition:left .4s ease;}'
      + '.mo-btn:hover::before{left:100%;}'
      + '.mo-btn svg{width:19px;height:19px;fill:#fff;flex-shrink:0;}'
      + '.mo-btn-wa{background:#25D366;}'
      + '.mo-btn-wa:hover{background:#1ebe5a;transform:translateY(-3px);box-shadow:0 14px 28px rgba(37,211,102,.28);}'
      + '.mo-btn-ig{background:#F80100;}'
      + '.mo-btn-ig:hover{background:#C50000;transform:translateY(-3px);box-shadow:0 14px 28px rgba(248,1,0,.3);}'
      + '@media(max-width:480px){.mo-card{padding:26px 20px 26px;}.mo-actions{flex-direction:column;}'
      + '.mo-head{gap:14px;}.mo-logo{max-width:128px;}}'
      + '@media(prefers-reduced-motion:reduce){#mo-overlay *{animation-duration:.01ms !important;'
      + 'animation-iteration-count:1 !important;transition:none !important;}}';

    var style = document.createElement('style');
    style.id = 'mo-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    var overlay = document.createElement('div');
    overlay.id = 'mo-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Site em atualização');

    overlay.innerHTML =
      '<div class="mo-glow"></div>' +
      '<div class="mo-sweep-beam"></div>' +
      '<div class="mo-checker-corner"></div>' +
      '<div class="mo-noise"></div>' +
      '<div class="mo-card">' +
        '<span class="mo-badge"><span class="mo-badge-dot"></span>Atualização em andamento</span>' +
        '<div class="mo-head">' +
          '<img class="mo-logo" src="' + CONFIG.logo + '" alt="Scuderia Bandeiras">' +
          '<span class="mo-flag">🏁</span>' +
        '</div>' +
        '<div class="mo-checker-rule"></div>' +
        '<h2 class="mo-title">Estamos <em>ajustando</em><br>o carro.</h2>' +
        '<div class="mo-body">' +
          '<div class="mo-copy">' +
            '<p class="mo-text">A Scuderia Bandeiras está passando por uma atualização importante.</p>' +
            '<p class="mo-text">Estamos reorganizando nosso ecossistema para refletir o novo momento da equipe.</p>' +
            '<p class="mo-text">Em breve você verá uma experiência totalmente atualizada.</p>' +
            '<p class="mo-text mo-text-strong">Apertem os cintos. Voltamos em instantes.</p>' +
          '</div>' +
          '<div class="mo-panel">' +
            '<div class="mo-panel-label">Status do Pit Stop</div>' +
            '<div class="mo-gauge"><div class="mo-gauge-fill"></div></div>' +
            '<div class="mo-panel-row"><span>Sistema</span><strong>Em renovação</strong></div>' +
            '<div class="mo-panel-row"><span>Previsão</span><strong>Em breve</strong></div>' +
            '<div class="mo-panel-row"><span>Status</span><strong class="mo-live">Trabalhando</strong></div>' +
          '</div>' +
        '</div>' +
        '<div class="mo-actions">' +
          '<a class="mo-btn mo-btn-wa" href="' + CONFIG.whatsappUrl + '" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">' +
            '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.05c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.2 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2 .9 2.14.07.15.12.32.02.52-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.63-.14.26.09 1.66.78 1.94.92.28.14.47.21.53.33.07.12.07.68-.17 1.36z"/></svg>' +
            'WhatsApp' +
          '</a>' +
          '<a class="mo-btn mo-btn-ig" href="' + CONFIG.instagramUrl + '" target="_blank" rel="noopener" aria-label="Seguir no Instagram">' +
            '<svg viewBox="0 0 24 24"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.9 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.63 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.63 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-10.85a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z"/></svg>' +
            'Instagram' +
          '</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
  }

  function lockScroll() {
    var scrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
