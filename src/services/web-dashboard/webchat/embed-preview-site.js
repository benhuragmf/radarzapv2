/**
 * Fallback: site cadastrado na empresa (via API — nunca ?site= na URL).
 * Com embed-preview-layout.js: só registra a URL e dispara evento (modo inline).
 * Sem layout.js: fundo fixo legado atrás do formulário.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var publicKey = params.get('key') || params.get('formKey');
  if (!publicKey) return;

  var hasInlineLayout = !!document.querySelector('script[src*="embed-preview-layout"]');

  var apiPath = null;
  if (publicKey.indexOf('wck_') === 0) {
    apiPath =
      '/api/webchat/public/widgets/' + encodeURIComponent(publicKey) + '/preview-site';
  } else if (publicKey.indexOf('lfm_') === 0) {
    apiPath = '/api/leads/public/forms/' + encodeURIComponent(publicKey) + '/preview-site';
  }
  if (!apiPath) return;

  fetch(location.origin + apiPath, { credentials: 'same-origin' })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    })
    .then(function (result) {
      if (!result.ok || !result.data || !result.data.site) return;
      var site = String(result.data.site);
      if (!/^https:\/\//i.test(site)) return;
      if (hasInlineLayout) {
        registerSiteUrl(site);
      } else {
        startFixedBackground(site);
      }
    })
    .catch(function () {});

  function registerSiteUrl(url) {
    var holder = document.getElementById('rz-embed-site-url');
    if (!holder) {
      holder = document.createElement('meta');
      holder.id = 'rz-embed-site-url';
      holder.setAttribute('name', 'rz-embed-site-url');
      document.head.appendChild(holder);
    }
    holder.setAttribute('content', url);

    try {
      window.dispatchEvent(
        new CustomEvent('rz-embed-site-ready', { detail: { site: url } }),
      );
    } catch (e) {}
  }

  function startFixedBackground(url) {
    var FALLBACK_MS = 5000;
    var applied = false;
    var timer = null;

    var style = document.createElement('style');
    style.id = 'rz-embed-site-preview-style';
    style.textContent =
      'html,body.rz-embed-site-preview{margin:0!important;padding:0!important;overflow:hidden!important;' +
      'min-height:100vh!important;}' +
      'body.rz-embed-site-preview>header,body.rz-embed-site-preview>main,body.rz-embed-site-preview>.wrap,' +
      'body.rz-embed-site-preview>#rz-preview-debug{display:none!important;}' +
      '#rz-site-bg{position:fixed;inset:0;z-index:1;background:#e2e8f0;overflow:hidden;opacity:0;transition:opacity .35s ease;}' +
      '#rz-site-bg.rz-site-ready{opacity:1;}' +
      '#rz-site-bg iframe{width:100%;height:100%;border:0;pointer-events:none;}' +
      '#rz-form-overlay{position:fixed;z-index:8;max-width:min(480px,92vw);width:calc(100% - 24px);' +
      'padding:0 12px;box-sizing:border-box;}' +
      'body.rz-embed-site-preview [id^="rz-webchat"]{z-index:10!important;}';
    document.head.appendChild(style);

    var bg = document.createElement('div');
    bg.id = 'rz-site-bg';
    bg.setAttribute('aria-hidden', 'true');

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'Site do cliente';
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    bg.appendChild(iframe);
    document.body.insertBefore(bg, document.body.firstChild);

    function teardown() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (bg.parentNode) bg.parentNode.removeChild(bg);
      document.body.classList.remove('rz-embed-site-preview');
      var overlay = document.getElementById('rz-form-overlay');
      if (overlay) {
        var mount = document.getElementById('form-mount');
        var wrap = document.querySelector('.wrap');
        if (mount && wrap) {
          var card = wrap.querySelector('.card:last-child');
          if (card) card.appendChild(mount);
          overlay.parentNode.removeChild(overlay);
        }
      }
    }

    function isIframeBlockedByBrowser() {
      try {
        var win = iframe.contentWindow;
        if (!win || !win.location || !win.location.href) return false;
        var href = String(win.location.href);
        return (
          href.indexOf('chrome-error://') === 0 ||
          href.indexOf('about:blank') === 0 ||
          href.indexOf('about:srcdoc') === 0
        );
      } catch (e) {
        return false;
      }
    }

    function applySiteBackground() {
      if (applied) return;
      applied = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      document.body.classList.add('rz-embed-site-preview');
      bg.classList.add('rz-site-ready');
      try {
        window.dispatchEvent(new CustomEvent('rz-embed-site-ready', { detail: { site: url } }));
      } catch (e) {}
    }

    function onIframeSettled() {
      if (applied) return;
      if (isIframeBlockedByBrowser()) {
        teardown();
        return;
      }
      applySiteBackground();
    }

    timer = setTimeout(teardown, FALLBACK_MS);
    iframe.onload = function () {
      setTimeout(onIframeSettled, 350);
    };
    iframe.onerror = function () {
      teardown();
    };
  }
})();
