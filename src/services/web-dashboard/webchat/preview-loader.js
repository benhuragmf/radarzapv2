/**
 * Carrega o widget RadarZap em páginas de preview/teste.
 * Uso: <script src="/webchat/preview-loader.js" data-default-key="wck_..."></script>
 * Não use async — quebra document.currentScript.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var script = document.currentScript;
  if (!script) {
    var nodes = document.querySelectorAll('script[src*="preview-loader"]');
    script = nodes.length ? nodes[nodes.length - 1] : null;
  }
  var defaultKey = script ? script.getAttribute('data-default-key') || '' : '';
  var key = params.get('key') || defaultKey;

  var statusEl = document.getElementById('rz-preview-status');
  if (!key) {
    if (statusEl) {
      statusEl.innerHTML =
        'Informe <code>?key=wck_...</code> na URL (copie em Chat do site → Widgets).';
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = 'Widget ativo — use o botão 💬 no canto da tela.';
  }

  var keyLabel = document.getElementById('rz-preview-key');
  if (keyLabel) keyLabel.textContent = key;

  var origin = location.origin;
  var widgetScript = document.createElement('script');
  widgetScript.src = origin + '/webchat/widget.js?v=2.10.24';
  widgetScript.setAttribute('data-widget-key', key);
  widgetScript.setAttribute('data-base-url', origin);
  widgetScript.async = true;
  widgetScript.onerror = function () {
    if (statusEl) {
      statusEl.textContent =
        'Erro ao carregar widget.js — confira se npm run dev está rodando na porta 3001.';
    }
  };
  document.body.appendChild(widgetScript);
})();
