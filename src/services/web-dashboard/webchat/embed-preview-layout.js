/**
 * Prévia inline: iframe do site com “buraco” na faixa do formulário (mask).
 * O conteúdo do site não aparece atrás do form — continua só abaixo, empurrado.
 * postMessage { type: 'rz-preview-layout', slotTop?, bgY?, formX?, reset? }
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var publicKey = params.get('key') || params.get('formKey') || 'default';
  var STORAGE_KEY = 'rz-embed-preview-layout:' + publicKey;
  var SITE_IFRAME_H = 7000;
  var GAP_BG = '#07111f';

  var SLOT_MIN = 0;
  var SLOT_MAX = 2400;
  var BG_MIN = -600;
  var BG_MAX = 600;

  var defaults = { slotTop: 380, bgY: 0, formX: 50 };
  var state = loadState();
  var draggingSlot = false;
  var dragStartY = 0;
  var dragStartSlot = 0;
  var inlineBuilt = false;
  var scrollToFormOnce = false;

  var style = document.createElement('style');
  style.textContent =
    'html,body.rz-embed-site-preview{margin:0!important;padding:0!important;overflow:hidden!important;height:100%!important;}' +
    'body.rz-embed-site-preview>header,body.rz-embed-site-preview>main,body.rz-embed-site-preview>.wrap,' +
    'body.rz-embed-site-preview>#rz-preview-debug,body.rz-embed-site-preview>#rz-site-bg,' +
    'body.rz-embed-site-preview>#rz-site-above,body.rz-embed-site-preview>#rz-site-below,' +
    'body.rz-embed-site-preview>#rz-form-bg{display:none!important;}' +
    '#rz-inline-root{height:100vh;overflow-x:hidden;overflow-y:auto;background:' +
    GAP_BG +
    ';-webkit-overflow-scrolling:touch;}' +
    '#rz-inline-stage{position:relative;width:100%;}' +
    '#rz-site-layer{position:absolute;top:0;left:0;right:0;z-index:0;overflow:hidden;pointer-events:none;}' +
    '#rz-site-layer iframe{display:block;width:100%;border:0;}' +
    '#rz-flow{position:relative;z-index:1;width:100%;}' +
    '#rz-spacer-top,#rz-spacer-bottom{width:100%;pointer-events:none;}' +
    '#rz-form-slot{position:relative;box-sizing:border-box;width:100%;background:transparent;pointer-events:auto;overflow:visible;}' +
    '#rz-form-slot-inner{position:relative;width:100%;max-width:min(520px,94vw);margin:0 auto;}' +
    '#rz-form-slot #form-mount{min-height:0;margin:0;}' +
    '#rz-form-slot .card{border:none!important;box-shadow:none!important;padding:0!important;margin:0!important;background:transparent!important;}' +
    '#rz-preview-slot-handle{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 10px;' +
    'padding:6px 10px;border-radius:8px;font:11px/1.35 system-ui,sans-serif;color:#94a3b8;' +
    'background:rgba(7,17,31,.92);border:1px dashed rgba(148,163,184,.4);cursor:ns-resize;user-select:none;}' +
    '#rz-preview-slot-handle:active{cursor:grabbing;}' +
    '#rz-inline-root.rz-slot-dragging{cursor:ns-resize;user-select:none;}' +
    '#rz-preview-inline-hint{position:sticky;top:0;z-index:9;padding:7px 12px;font:10px/1.35 system-ui,sans-serif;' +
    'text-align:center;color:#e2e8f0;background:rgba(7,17,31,.95);border-bottom:1px solid rgba(148,163,184,.2);}';
  document.head.appendChild(style);

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, defaults);
      var parsed = JSON.parse(raw);
      return {
        slotTop:
          typeof parsed.slotTop === 'number'
            ? parsed.slotTop
            : parsed.formY
              ? Math.round(parsed.formY * 8)
              : defaults.slotTop,
        bgY: typeof parsed.bgY === 'number' ? parsed.bgY : defaults.bgY,
        formX: typeof parsed.formX === 'number' ? parsed.formX : defaults.formX,
      };
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getSiteUrl() {
    var meta = document.getElementById('rz-embed-site-url');
    if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
    var layer = document.querySelector('#rz-site-layer iframe');
    if (layer && layer.src) return layer.src;
    return '';
  }

  function removeLegacyNodes() {
    ['rz-form-overlay', 'rz-form-bg', 'rz-site-above', 'rz-site-below', 'rz-site-bg'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function ensureMountInSlot(formSlot) {
    var mount = document.getElementById('form-mount');
    if (!mount) return;

    var inner = document.getElementById('rz-form-slot-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.id = 'rz-form-slot-inner';
      formSlot.appendChild(inner);
    }

    if (mount.parentElement !== inner) {
      inner.appendChild(mount);
    }

    if (!document.getElementById('rz-preview-slot-handle')) {
      var handle = document.createElement('div');
      handle.id = 'rz-preview-slot-handle';
      handle.textContent = '↕ Arraste — role para baixo e veja o site continuando';
      inner.insertBefore(handle, mount);
      enableSlotDrag(handle);
    }
  }

  function buildInlineRoot(siteUrl) {
    removeLegacyNodes();

    var existing = document.getElementById('rz-inline-root');
    if (existing) {
      inlineBuilt = true;
      var iframe = document.querySelector('#rz-site-layer iframe');
      if (iframe && !iframe.src) iframe.src = siteUrl;
      var slot = document.getElementById('rz-form-slot');
      if (slot) ensureMountInSlot(slot);
      return existing;
    }

    document.body.classList.add('rz-embed-site-preview');

    var root = document.createElement('div');
    root.id = 'rz-inline-root';

    var hint = document.createElement('div');
    hint.id = 'rz-preview-inline-hint';
    hint.textContent =
      'Formulário no fluxo — o site some na faixa do form e continua empurrado abaixo';

    var stage = document.createElement('div');
    stage.id = 'rz-inline-stage';

    var siteLayer = document.createElement('div');
    siteLayer.id = 'rz-site-layer';
    var siteIframe = document.createElement('iframe');
    siteIframe.src = siteUrl;
    siteIframe.title = 'Site do cliente';
    siteIframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    siteLayer.appendChild(siteIframe);

    var flow = document.createElement('div');
    flow.id = 'rz-flow';

    var spacerTop = document.createElement('div');
    spacerTop.id = 'rz-spacer-top';

    var formSlot = document.createElement('div');
    formSlot.id = 'rz-form-slot';

    var spacerBottom = document.createElement('div');
    spacerBottom.id = 'rz-spacer-bottom';

    flow.appendChild(spacerTop);
    flow.appendChild(formSlot);
    flow.appendChild(spacerBottom);

    stage.appendChild(siteLayer);
    stage.appendChild(flow);

    root.appendChild(hint);
    root.appendChild(stage);
    document.body.appendChild(root);

    ensureMountInSlot(formSlot);

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        applyInlineLayout();
      }).observe(formSlot);
    }

    siteIframe.addEventListener('load', function () {
      applyInlineLayout();
    });

    inlineBuilt = true;
    return root;
  }

  function measureFormHeight() {
    var slot = document.getElementById('rz-form-slot');
    if (slot) return Math.max(slot.scrollHeight, slot.offsetHeight, 120);
    return 300;
  }

  function applySiteMask(siteLayer, slotTop, spliceY, totalH) {
    var topPx = Math.max(0, slotTop);
    var bottomPx = Math.min(totalH, spliceY);
    var topPct = ((topPx / totalH) * 100).toFixed(3);
    var bottomPct = ((bottomPx / totalH) * 100).toFixed(3);
    var mask =
      'linear-gradient(to bottom, #000 0, #000 ' +
      topPct +
      '%, transparent ' +
      topPct +
      '%, transparent ' +
      bottomPct +
      '%, #000 ' +
      bottomPct +
      '%, #000 100%)';
    siteLayer.style.maskImage = mask;
    siteLayer.style.webkitMaskImage = mask;
    siteLayer.style.maskSize = '100% 100%';
    siteLayer.style.webkitMaskSize = '100% 100%';
  }

  function applyInlineLayout() {
    var stage = document.getElementById('rz-inline-stage');
    var siteLayer = document.getElementById('rz-site-layer');
    var spacerTop = document.getElementById('rz-spacer-top');
    var spacerBottom = document.getElementById('rz-spacer-bottom');
    var formSlot = document.getElementById('rz-form-slot');
    var inner = document.getElementById('rz-form-slot-inner');
    if (!stage || !siteLayer || !spacerTop || !spacerBottom || !formSlot) return;

    var slotTop = clamp(Math.round(state.slotTop), SLOT_MIN, SLOT_MAX);
    var formH = measureFormHeight();
    var offset = Math.round(state.bgY);
    var padX = clamp(state.formX, 8, 92);
    var spliceY = slotTop + formH;
    var bottomH = Math.max(520, SITE_IFRAME_H - spliceY);
    var totalH = slotTop + formH + bottomH;

    stage.style.height = totalH + 'px';
    siteLayer.style.height = totalH + 'px';

    spacerTop.style.height = slotTop + 'px';
    spacerBottom.style.height = bottomH + 'px';
    formSlot.style.minHeight = formH + 'px';

    if (inner) {
      inner.style.transform = 'translateX(' + Math.round((padX - 50) * 2.4) + 'px)';
    }

    applySiteMask(siteLayer, slotTop, spliceY, totalH);

    var iframe = siteLayer.querySelector('iframe');
    if (iframe) {
      iframe.style.height = SITE_IFRAME_H + 'px';
      iframe.style.transform = 'translate3d(0,' + offset + 'px,0)';
    }

    if (!scrollToFormOnce && inlineBuilt) {
      scrollToFormOnce = true;
      var root = document.getElementById('rz-inline-root');
      if (root) {
        requestAnimationFrame(function () {
          root.scrollTop = Math.max(0, slotTop - 24);
        });
      }
    }
  }

  function tryBuildInline() {
    var url = getSiteUrl();
    if (!url) return false;
    buildInlineRoot(url);
    applyInlineLayout();
    return true;
  }

  function enableSlotDrag(handle) {
    if (handle.getAttribute('data-rz-slot-drag')) return;
    handle.setAttribute('data-rz-slot-drag', '1');

    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      draggingSlot = true;
      dragStartY = ev.clientY;
      dragStartSlot = state.slotTop;
      var root = document.getElementById('rz-inline-root');
      if (root) root.classList.add('rz-slot-dragging');
      try {
        handle.setPointerCapture(ev.pointerId);
      } catch (e) {}
      ev.preventDefault();
    });

    handle.addEventListener('pointermove', function (ev) {
      if (!draggingSlot) return;
      state.slotTop = clamp(
        Math.round(dragStartSlot + (ev.clientY - dragStartY)),
        SLOT_MIN,
        SLOT_MAX,
      );
      applyInlineLayout();
      notifyParent();
      ev.preventDefault();
    });

    function endDrag() {
      if (!draggingSlot) return;
      draggingSlot = false;
      var root = document.getElementById('rz-inline-root');
      if (root) root.classList.remove('rz-slot-dragging');
      saveState();
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function notifyParent() {
    if (window.parent === window) return;
    try {
      window.parent.postMessage(
        {
          type: 'rz-preview-layout-state',
          slotTop: state.slotTop,
          bgY: state.bgY,
          formX: state.formX,
        },
        location.origin,
      );
    } catch (e) {}
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin) return;
    var msg = ev.data;
    if (!msg || msg.type !== 'rz-preview-layout') return;

    if (msg.reset) {
      state = Object.assign({}, defaults);
      scrollToFormOnce = false;
    } else {
      if (typeof msg.slotTop === 'number') state.slotTop = clamp(msg.slotTop, SLOT_MIN, SLOT_MAX);
      if (typeof msg.bgY === 'number') state.bgY = clamp(msg.bgY, BG_MIN, BG_MAX);
      if (typeof msg.formX === 'number') state.formX = clamp(msg.formX, 8, 92);
    }

    tryBuildInline();
    applyInlineLayout();
    saveState();
    notifyParent();
  });

  window.addEventListener(
    'wheel',
    function (ev) {
      if (!ev.shiftKey) return;
      if (
        ev.target.closest &&
        ev.target.closest('#rz-form-slot input, #rz-form-slot textarea, #rz-form-slot select')
      ) {
        return;
      }
      state.bgY = clamp(Math.round(state.bgY - ev.deltaY * 0.4), BG_MIN, BG_MAX);
      applyInlineLayout();
      notifyParent();
      ev.preventDefault();
    },
    { passive: false },
  );

  function boot() {
    removeLegacyNodes();
    tryBuildInline();
    applyInlineLayout();
    notifyParent();
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'rz-preview-ready' }, location.origin);
    }
  }

  window.addEventListener('rz-embed-site-ready', function (ev) {
    var url = ev && ev.detail && ev.detail.site;
    if (url) {
      var holder = document.getElementById('rz-embed-site-url');
      if (!holder) {
        holder = document.createElement('meta');
        holder.id = 'rz-embed-site-url';
        document.head.appendChild(holder);
      }
      holder.setAttribute('content', url);
    }
    setTimeout(function () {
      tryBuildInline();
      applyInlineLayout();
      notifyParent();
    }, 50);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  var ticks = 0;
  var timer = setInterval(function () {
    if (tryBuildInline()) applyInlineLayout();
    ticks += 1;
    if (ticks > 40) clearInterval(timer);
  }, 200);
})();
