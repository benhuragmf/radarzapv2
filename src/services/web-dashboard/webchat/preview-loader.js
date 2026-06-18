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
  var pageStartedAt = Date.now();
  var apiConfig = null;
  var apiConfigError = '';

  var skipReasonLabels = {
    disabled: 'desativada no widget',
    no_message: 'mensagem vazia',
    already_sent: 'mensagem já gravada — balão ainda reaparece nesta visita',
    visitor_replied: 'visitante já respondeu',
    has_outbound: 'conversa já tem resposta outbound',
    dismissed_cooldown: 'visitante fechou o balão (cooldown 24h)',
  };

  function skipReasonLabel(code) {
    return skipReasonLabels[code] || code;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatElapsed(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return pad2(m) + ':' + pad2(s);
  }

  function createDebugHud() {
    var hud = document.createElement('div');
    hud.id = 'rz-preview-debug';
    hud.setAttribute('aria-live', 'polite');
    hud.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:2147482999;max-width:min(320px,calc(100vw - 24px));' +
      'padding:12px 14px;border-radius:12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'background:rgba(15,23,42,.92);color:#e2e8f0;border:1px solid rgba(34,211,238,.35);' +
      'box-shadow:0 8px 32px rgba(0,0,0,.45);pointer-events:none;';
    hud.innerHTML =
      '<div style="font-weight:700;color:#22d3ee;margin-bottom:6px;">⏱ Debug saudação proativa</div>' +
      '<div id="rz-debug-elapsed">Tempo na página: 00:00</div>' +
      '<div id="rz-debug-api">Config API: carregando…</div>' +
      '<div id="rz-debug-widget">Widget: aguardando script…</div>' +
      '<div id="rz-debug-status" style="margin-top:6px;color:#94a3b8;">—</div>';
    document.body.appendChild(hud);
    return hud;
  }

  function fetchApiConfig(origin, widgetKey) {
    fetch(origin + '/api/webchat/public/widgets/' + encodeURIComponent(widgetKey) + '/config')
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
          apiConfig = data;
        });
      })
      .catch(function (err) {
        apiConfigError = err.message || String(err);
      });
  }

  function updateDebugHud() {
    var elapsedEl = document.getElementById('rz-debug-elapsed');
    var apiEl = document.getElementById('rz-debug-api');
    var widgetEl = document.getElementById('rz-debug-widget');
    var statusEl = document.getElementById('rz-debug-status');
    if (!elapsedEl) return;

    var elapsedMs = Date.now() - pageStartedAt;
    var elapsedSec = Math.floor(elapsedMs / 1000);
    elapsedEl.textContent = 'Tempo na página: ' + formatElapsed(elapsedMs) + ' (' + elapsedSec + 's)';

    if (apiConfigError) {
      apiEl.textContent = 'Config API: erro — ' + apiConfigError;
      apiEl.style.color = '#fca5a5';
    } else if (apiConfig) {
      var enabled = !!apiConfig.proactiveGreetingEnabled;
      var delay = Number(apiConfig.proactiveGreetingDelaySeconds) || 30;
      apiEl.textContent =
        'Config API: proativa ' +
        (enabled ? 'LIGADA' : 'DESLIGADA') +
        (enabled ? ' · delay ' + delay + 's' : '');
      apiEl.style.color = enabled ? '#6ee7b7' : '#fcd34d';
      if (enabled && elapsedSec >= delay) {
        apiEl.textContent += ' · tempo já passou!';
      } else if (enabled) {
        apiEl.textContent += ' · falta ' + Math.max(0, delay - elapsedSec) + 's';
      }
    } else {
      apiEl.textContent = 'Config API: carregando…';
      apiEl.style.color = '#94a3b8';
    }

    var dbg = typeof window.__RZ_WEBCHAT_DEBUG__ === 'function' ? window.__RZ_WEBCHAT_DEBUG__() : null;
    if (!dbg) {
      widgetEl.textContent = 'Widget: script ainda não carregou';
      widgetEl.style.color = '#94a3b8';
    } else {
      widgetEl.textContent =
        'Widget ' +
        dbg.build +
        ': proativa ' +
        (dbg.proactiveEnabled ? 'sim' : 'não') +
        (dbg.proactiveEnabled ? ' · timer ' + (dbg.proactiveTimerActive ? 'ativo' : 'inativo') : '') +
        (dbg.proactiveTeaser ? ' · balão visível' : '') +
        (dbg.proactiveInHistory ? ' · msg no histórico' : '');
      widgetEl.style.color = dbg.proactiveEnabled ? '#6ee7b7' : '#fcd34d';

      var teaserDom = document.getElementById('rz-webchat-teaser');
      var lines = [];
      if (dbg.proactiveLastError) {
        lines.push('Erro: ' + dbg.proactiveLastError);
        statusEl.style.color = '#fca5a5';
      } else if (dbg.proactiveDismissCooldownMs > 0) {
        var totalMins = Math.ceil(dbg.proactiveDismissCooldownMs / 60000);
        var hrs = Math.floor(totalMins / 60);
        var mins = totalMins % 60;
        lines.push(
          'Cooldown após fechar (×): ~' +
            hrs +
            'h' +
            (mins > 0 ? ' ' + mins + 'min' : '') +
            ' — balão oculto de propósito',
        );
        statusEl.style.color = '#fcd34d';
      } else if (dbg.proactiveSkipReason) {
        lines.push('Bloqueado: ' + skipReasonLabel(dbg.proactiveSkipReason));
        statusEl.style.color = '#fcd34d';
      } else if (teaserDom || dbg.proactiveTeaser) {
        lines.push('✓ Saudação apareceu (balão ou teaser)');
        statusEl.style.color = '#6ee7b7';
      } else if (dbg.proactiveEnabled && dbg.proactiveTimerActive && dbg.proactiveScheduledAt) {
        var remain = Math.max(0, Math.ceil((dbg.proactiveScheduledAt - Date.now()) / 1000));
        lines.push('Aguardando balão em ~' + remain + 's (reaparece a cada visita)');
        statusEl.style.color = '#93c5fd';
      } else if (dbg.proactiveEnabled && dbg.proactiveInHistory && !dbg.proactiveTeaser) {
        lines.push('Msg já no histórico — balão volta após o delay nesta visita');
        statusEl.style.color = '#93c5fd';
      } else if (dbg.proactiveEnabled && !dbg.configLoaded) {
        lines.push('Config do widget ainda não carregou');
        statusEl.style.color = '#94a3b8';
      } else if (!dbg.proactiveEnabled) {
        lines.push('Ative e salve no painel → Saudação proativa');
        statusEl.style.color = '#fcd34d';
      } else {
        lines.push('Monitorando… não abra o chat ainda');
        statusEl.style.color = '#94a3b8';
      }
      statusEl.textContent = lines.join(' · ');
    }
  }

  var statusEl = document.getElementById('rz-preview-status');
  if (!key) {
    if (statusEl) {
      statusEl.innerHTML =
        'Informe <code>?key=wck_...</code> na URL (copie em Chat do site → Widgets).';
    }
    return;
  }

  createDebugHud();
  setInterval(updateDebugHud, 500);
  updateDebugHud();

  if (statusEl) {
    statusEl.textContent = 'Widget ativo — use o botão 💬 no canto da tela.';
  }

  var keyLabel = document.getElementById('rz-preview-key');
  if (keyLabel) keyLabel.textContent = key;

  var origin = location.origin;
  fetchApiConfig(origin, key);

  var widgetScript = document.createElement('script');
  widgetScript.src = origin + '/webchat/widget.js?v=2.10.37';
  widgetScript.setAttribute('data-widget-key', key);
  widgetScript.setAttribute('data-base-url', origin);
  widgetScript.async = true;
  widgetScript.onerror = function () {
    if (statusEl) {
      statusEl.textContent =
        'Erro ao carregar widget.js — confira se npm run dev está rodando na porta 3001.';
    }
    var widgetEl = document.getElementById('rz-debug-widget');
    if (widgetEl) {
      widgetEl.textContent = 'Widget: ERRO ao carregar widget.js';
      widgetEl.style.color = '#fca5a5';
    }
  };
  document.body.appendChild(widgetScript);
})();
