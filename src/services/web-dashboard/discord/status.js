(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var guildId = script.getAttribute('data-guild-id') || '';
  var baseUrl = (script.getAttribute('data-base-url') || '').replace(/\/$/, '');
  if (!baseUrl) {
    try {
      baseUrl = new URL(script.src).origin;
    } catch (e) {
      return;
    }
  }

  var mountId = 'radarchat-discord-status-' + (guildId || 'global');
  var mount = document.getElementById(mountId);
  if (!mount) {
    mount = document.createElement('div');
    mount.id = mountId;
    mount.setAttribute('data-radarchat-discord-status', '1');
    script.parentNode.insertBefore(mount, script.nextSibling);
  }

  function label(status) {
    if (status.automationActive) return 'Bot online · automação ativa';
    if (status.gatewayConnected && status.botInGuild === false) return 'Bot online · fora do servidor';
    if (status.gatewayConnected) return 'Bot online';
    if (status.gatewayStatus === 'connecting') return 'Bot conectando…';
    return 'Bot offline';
  }

  function color(status) {
    if (status.automationActive) return '#22c55e';
    if (status.gatewayConnected) return '#eab308';
    if (status.gatewayStatus === 'connecting') return '#94a3b8';
    return '#ef4444';
  }

  function render(status) {
    var dot = document.createElement('span');
    dot.style.cssText =
      'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:' +
      color(status) +
      ';';
    var text = document.createElement('span');
    text.textContent = label(status);
    if (status.botUsername) {
      text.textContent += ' (@' + status.botUsername + ')';
    }
    mount.innerHTML = '';
    mount.style.cssText =
      'display:inline-flex;align-items:center;font:12px/1.4 system-ui,sans-serif;color:#e2e8f0;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:6px 12px;';
    mount.appendChild(dot);
    mount.appendChild(text);
  }

  function renderError() {
    mount.textContent = 'Status indisponível';
    mount.style.cssText =
      'font:12px system-ui,sans-serif;color:#94a3b8;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px 10px;display:inline-block;';
  }

  var url =
    baseUrl +
    '/api/discord/public/status' +
    (guildId ? '?guildId=' + encodeURIComponent(guildId) : '');

  fetch(url, { credentials: 'omit' })
    .then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(renderError);
})();
