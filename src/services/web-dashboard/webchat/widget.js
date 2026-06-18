(function () {
  'use strict';
  var WIDGET_BUILD = '2.10.17';

  if (window.__RZ_WEBCHAT_WIDGET__) {
    console.warn('[RadarZap WebChat] Script duplicado ignorado (build ' + window.__RZ_WEBCHAT_WIDGET__ + ').');
    return;
  }
  window.__RZ_WEBCHAT_WIDGET__ = WIDGET_BUILD;

  var staleRoots = document.querySelectorAll('#rz-webchat-root');
  for (var i = 0; i < staleRoots.length; i++) {
    if (staleRoots[i].parentNode) staleRoots[i].parentNode.removeChild(staleRoots[i]);
  }

  var STORAGE_PREFIX = 'rz_webchat_';

  function currentScript() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  }

  function scriptBaseUrl(script) {
    var src = script.src || '';
    if (!src) return window.location.origin;
    return src.replace(/\/webchat\/widget\.js(\?.*)?$/, '');
  }

  function loadSocketIo(baseUrl, cb) {
    if (window.io) {
      cb(window.io);
      return;
    }
    var s = document.createElement('script');
    s.src = baseUrl + '/socket.io/socket.io.js';
    s.async = true;
    s.onload = function () {
      cb(window.io);
    };
    s.onerror = function () {
      cb(null);
    };
    document.head.appendChild(s);
  }

  function apiFetch(baseUrl, path, options) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(baseUrl + '/api/webchat/public' + path, Object.assign({}, options, { headers: headers }))
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Erro na requisição');
          return data;
        });
      });
  }

  function escHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function visitorMediaSrc(mediaUrl) {
    if (!mediaUrl || !state.visitorToken) return null;
    var parts = String(mediaUrl).split('/');
    var filename = parts[parts.length - 1];
    if (!filename) return null;
    return (
      baseUrl +
      '/api/webchat/public/media/' +
      encodeURIComponent(filename) +
      '?v=' +
      encodeURIComponent(state.visitorToken)
    );
  }

  function renderMessageBody(m) {
    var html = '';
    if (m.mediaType === 'image' && m.mediaUrl) {
      var src = visitorMediaSrc(m.mediaUrl);
      if (src) {
        html +=
          '<a href="' +
          src +
          '" target="_blank" rel="noreferrer" style="display:block;">' +
          '<img src="' +
          src +
          '" alt="" style="max-width:100%;max-height:200px;border-radius:8px;display:block;margin-bottom:4px;" />' +
          '</a>';
      }
    } else if (m.mediaType === 'document' && m.mediaUrl) {
      var docSrc = visitorMediaSrc(m.mediaUrl);
      var label = escHtml(m.mediaFileName || 'Documento PDF');
      if (docSrc) {
        html +=
          '<a href="' +
          docSrc +
          '" target="_blank" rel="noreferrer" style="display:block;font-size:13px;text-decoration:underline;margin-bottom:4px;">📎 ' +
          label +
          '</a>';
      }
    }
    if (m.body && (!m.mediaUrl || m.body.indexOf('📎') !== 0)) {
      html += '<div>' + escHtml(m.body) + '</div>';
    }
    if (!html && m.body) html = escHtml(m.body);
    return html;
  }

  var script = currentScript();
  var widgetKey = script.getAttribute('data-widget-key') || script.dataset.widgetKey;
  if (!widgetKey) {
    console.warn('[RadarZap WebChat] data-widget-key ausente no script.');
    return;
  }

  var baseUrl = (script.getAttribute('data-base-url') || script.dataset.baseUrl || scriptBaseUrl(script)).replace(/\/$/, '');
  var storageKey = STORAGE_PREFIX + widgetKey;

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  var state = {
    config: null,
    visitorToken: readStore().visitorToken || null,
    conversationId: readStore().conversationId || null,
    visitorName: '',
    visitorEmail: '',
    conversationStatus: 'open',
    queueStatus: 'bot',
    departmentName: '',
    messages: [],
    open: false,
    socket: null,
    sending: false,
    started: false,
    prechatError: '',
  };

  function needsPrechat() {
    if (!state.config) return false;
    if (state.conversationStatus === 'closed' || isConversationEnded()) return false;
    if (state.messages.length > 0) return false;
    var askName = !!state.config.askName;
    var askEmail = !!state.config.askEmail;
    if (!askName && !askEmail) return false;
    if (askName && !String(state.visitorName || '').trim()) return true;
    if (askEmail && !String(state.visitorEmail || '').trim()) return true;
    return !state.started;
  }

  function applySessionData(data) {
    if (!data) return;
    if (data.visitorToken) state.visitorToken = data.visitorToken;
    if (data.conversationId) state.conversationId = data.conversationId;
    if (data.visitorName !== undefined) state.visitorName = data.visitorName || '';
    if (data.visitorEmail !== undefined) state.visitorEmail = data.visitorEmail || '';
    if (data.status) state.conversationStatus = data.status;
    if (data.queueStatus) state.queueStatus = data.queueStatus;
    if (data.departmentName !== undefined) state.departmentName = data.departmentName || '';
    if (data.messages) state.messages = data.messages;
  }

  function pushChatMessages(items) {
    if (!items || !items.length) return;
    items.forEach(function (item) {
      if (!item || !item.id) return;
      var exists = state.messages.some(function (m) {
        return m.id === item.id;
      });
      if (!exists) state.messages.push(item);
    });
  }

  function applyConversationMeta(conv) {
    if (!conv) return;
    if (conv.queueStatus) state.queueStatus = conv.queueStatus;
    if (conv.departmentName !== undefined) state.departmentName = conv.departmentName || '';
    if (conv.status) {
      if (state.conversationStatus === 'closed' && conv.status === 'open') return;
      state.conversationStatus = conv.status;
    }
  }

  function markConversationClosed() {
    if (state.conversationStatus === 'closed') return;
    state.conversationStatus = 'closed';
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
  }

  function isClosedSystemMessage(message) {
    if (!message || message.direction !== 'system') return false;
    return /atendimento encerrad|encerramos o atendimento|foi encerrad/i.test(String(message.body || ''));
  }

  function isConversationEnded() {
    if (state.conversationStatus === 'closed') return true;
    return state.messages.some(function (m) {
      return isClosedSystemMessage(m);
    });
  }

  function resolvePanelMode() {
    if (isConversationEnded()) {
      if (state.conversationStatus !== 'closed') {
        markConversationClosed();
      }
      return 'closed';
    }
    if (needsPrechat()) return 'prechat';
    return 'chat';
  }

  var root = document.createElement('div');
  root.id = 'rz-webchat-root';
  root.style.cssText = 'position:fixed;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';
  document.body.appendChild(root);

  function positionStyle() {
    var side = (state.config && state.config.position) === 'left' ? 'left:20px;' : 'right:20px;';
    return side + 'bottom:20px;';
  }

  function primaryColor() {
    return (state.config && state.config.primaryColor) || '#2563eb';
  }

  function isDarkTheme() {
    return state.config && state.config.theme === 'dark';
  }

  function ui() {
    if (!isDarkTheme()) {
      return {
        panelBg: '#fff',
        panelBorder: 'none',
        panelShadow: '0 16px 48px rgba(0,0,0,.2)',
        headerBg: primaryColor(),
        messagesBg: '#fff',
        prechatBg: '#fafafa',
        footerBg: '#fafafa',
        border: '#e5e7eb',
        inputBorder: '#d1d5db',
        inputBg: '#fff',
        inputColor: '#111827',
        text: '#111827',
        textMuted: '#64748b',
        bubbleAgent: '#e5e7eb',
        bubbleAgentText: '#111827',
        bubbleSystem: '#f3f4f6',
        bubbleSystemText: '#374151',
        dismissBg: '#fff',
        dismissBorder: '#d1d5db',
        dismissText: '#374151',
        attachBg: '#fff',
        toggleShadow: '0 8px 24px rgba(0,0,0,.18)',
        offlineBg: '#fffbeb',
        offlineBorder: '#fde68a',
        offlineText: '#92400e',
        queueWaitBg: '#eff6ff',
        queueWaitBorder: '#bfdbfe',
        queueWaitText: '#1e40af',
        queueAgentBg: '#ecfdf5',
        queueAgentBorder: '#a7f3d0',
        queueAgentText: '#065f46',
        errorText: '#b91c1c',
        font: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      };
    }
    var accent = primaryColor();
    return {
      panelBg: '#0b1120',
      panelBorder: '1px solid rgba(34,211,238,.18)',
      panelShadow: '0 20px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(34,211,238,.08)',
      headerBg: 'linear-gradient(135deg, ' + accent + ' 0%, #1e293b 55%, #0f172a 100%)',
      messagesBg: '#060b14',
      prechatBg: '#060b14',
      footerBg: '#111827',
      border: 'rgba(148,163,184,.18)',
      inputBorder: 'rgba(148,163,184,.28)',
      inputBg: '#1e293b',
      inputColor: '#e2e8f0',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      bubbleAgent: '#1e293b',
      bubbleAgentText: '#e2e8f0',
      bubbleSystem: 'rgba(148,163,184,.14)',
      bubbleSystemText: '#94a3b8',
      dismissBg: 'transparent',
      dismissBorder: 'rgba(148,163,184,.35)',
      dismissText: '#cbd5e1',
      attachBg: '#1e293b',
      toggleShadow: '0 8px 32px rgba(6,182,212,.4)',
      offlineBg: 'rgba(245,158,11,.12)',
      offlineBorder: 'rgba(245,158,11,.35)',
      offlineText: '#fcd34d',
      queueWaitBg: 'rgba(59,130,246,.12)',
      queueWaitBorder: 'rgba(59,130,246,.35)',
      queueWaitText: '#93c5fd',
      queueAgentBg: 'rgba(16,185,129,.12)',
      queueAgentBorder: 'rgba(16,185,129,.35)',
      queueAgentText: '#6ee7b7',
      errorText: '#fca5a5',
      font: "'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    };
  }

  function renderBubble() {
    var t = ui();
    root.style.fontFamily = t.font;
    root.innerHTML =
      '<div style="' +
      positionStyle() +
      'display:flex;flex-direction:column;align-items:' +
      ((state.config && state.config.position) === 'left' ? 'flex-start' : 'flex-end') +
      ';">' +
      (state.open ? renderPanel() : '') +
      '<button type="button" id="rz-webchat-toggle" aria-label="Abrir chat" style="width:56px;height:56px;border-radius:999px;border:none;cursor:pointer;box-shadow:' +
      t.toggleShadow +
      ';background:' +
      primaryColor() +
      ';color:#fff;font-size:24px;line-height:1;">💬</button></div>';
    var toggle = document.getElementById('rz-webchat-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', state.open ? 'Fechar chat' : 'Abrir chat');
      toggle.onclick = function () {
        state.open = !state.open;
        state.prechatError = '';
        if (state.open && !state.started && !needsPrechat()) {
          startSession();
        }
        renderBubble();
      };
    }
    bindPanelEvents();
    scrollMessages();
  }

  function renderPanel() {
    var t = ui();
    var title = (state.config && state.config.title) || 'Fale conosco';
    var subtitle = (state.config && state.config.subtitle) || '';
    var askName = state.config && state.config.askName;
    var askEmail = state.config && state.config.askEmail;
    var mode = resolvePanelMode();
    var visitorLabel =
      state.visitorName || state.visitorEmail
        ? escHtml(state.visitorName || state.visitorEmail)
        : '';

    var closedFooter =
      '<div style="padding:12px 14px;border-top:1px solid ' +
      t.border +
      ';background:' +
      t.footerBg +
      ';display:flex;flex-direction:column;gap:8px;">' +
      '<div style="font-size:13px;color:' +
      t.textMuted +
      ';text-align:center;">Este atendimento foi encerrado.</div>' +
      '<button type="button" id="rz-webchat-new" style="width:100%;padding:10px 14px;border:none;border-radius:10px;background:' +
      primaryColor() +
      ';color:#fff;font-weight:600;cursor:pointer;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.15);">Nova conversa</button>' +
      '<button type="button" id="rz-webchat-dismiss" style="width:100%;padding:8px 14px;border:1px solid ' +
      t.dismissBorder +
      ';border-radius:10px;background:' +
      t.dismissBg +
      ';color:' +
      t.dismissText +
      ';font-size:13px;cursor:pointer;">Fechar janela</button></div>';

    var offlineBanner =
      state.config && state.config.businessHoursEnabled && state.config.isOnline === false
        ? '<div style="padding:10px 14px;background:' +
          t.offlineBg +
          ';border-bottom:1px solid ' +
          t.offlineBorder +
          ';font-size:12px;color:' +
          t.offlineText +
          ';line-height:1.4;">' +
          '<strong>Fora do horário</strong>' +
          (state.config.scheduleSummary
            ? '<div style="margin-top:4px;opacity:.85;">' + escHtml(state.config.scheduleSummary) + '</div>'
            : '') +
          '</div>'
        : '';

    var queueBanner = '';
    if (mode === 'chat') {
      if (state.queueStatus === 'waiting_human') {
        queueBanner =
          '<div style="padding:10px 14px;background:' +
          t.queueWaitBg +
          ';border-bottom:1px solid ' +
          t.queueWaitBorder +
          ';font-size:12px;color:' +
          t.queueWaitText +
          ';line-height:1.4;">' +
          '<strong>Aguardando atendente</strong>' +
          (state.departmentName
            ? '<div style="margin-top:4px;opacity:.9;">Setor: ' + escHtml(state.departmentName) + '</div>'
            : '') +
          '</div>';
      } else if (state.queueStatus === 'with_agent') {
        queueBanner =
          '<div style="padding:10px 14px;background:' +
          t.queueAgentBg +
          ';border-bottom:1px solid ' +
          t.queueAgentBorder +
          ';font-size:12px;color:' +
          t.queueAgentText +
          ';line-height:1.4;">' +
          '<strong>Atendente conectado</strong>' +
          '</div>';
      }
    }

    var messagesHtml = state.messages
      .map(function (m) {
        var align = m.direction === 'inbound' ? 'flex-end' : 'flex-start';
        var bg =
          m.direction === 'system'
            ? t.bubbleSystem
            : m.direction === 'inbound'
              ? primaryColor()
              : t.bubbleAgent;
        var color =
          m.direction === 'system'
            ? t.bubbleSystemText
            : m.direction === 'inbound'
              ? '#fff'
              : t.bubbleAgentText;
        var nameLabel =
          m.direction === 'outbound' && m.senderName
            ? '<div style="font-size:10px;font-weight:600;opacity:.85;margin-bottom:4px;">' +
              escHtml(m.senderName) +
              '</div>'
            : '';
        return (
          '<div style="display:flex;justify-content:' +
          align +
          ';margin:6px 0;">' +
          '<div style="max-width:85%;padding:10px 12px;border-radius:' +
          (isDarkTheme() ? '12px 12px 12px 4px' : '14px') +
          ';background:' +
          bg +
          ';color:' +
          color +
          ';font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;' +
          (m.direction === 'inbound' && isDarkTheme()
            ? 'box-shadow:0 2px 12px rgba(6,182,212,.25);border-radius:12px 12px 4px 12px;'
            : '') +
          '">' +
          nameLabel +
          renderMessageBody(m) +
          '<div style="font-size:10px;opacity:.7;margin-top:4px;">' +
          formatTime(m.createdAt) +
          '</div></div></div>'
        );
      })
      .join('');

    var prechat =
      '<div id="rz-webchat-prechat" style="flex:1;overflow:auto;padding:14px;background:' +
      t.prechatBg +
      ';">' +
      '<div style="font-size:13px;font-weight:600;color:' +
      t.text +
      ';margin-bottom:10px;">Antes de começar</div>' +
      (askName
        ? '<label style="display:block;font-size:12px;color:' +
          t.textMuted +
          ';margin-bottom:4px;">Nome *' +
          '<input id="rz-webchat-name" value="' +
          escHtml(state.visitorName || '') +
          '" placeholder="Seu nome" style="width:100%;margin-top:4px;padding:10px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:8px;font-size:14px;background:' +
          t.inputBg +
          ';color:' +
          t.inputColor +
          ';" /></label>'
        : '') +
      (askEmail
        ? '<label style="display:block;font-size:12px;color:' +
          t.textMuted +
          ';margin-bottom:8px;' +
          (askName ? 'margin-top:8px;' : '') +
          '">E-mail *' +
          '<input id="rz-webchat-email" type="email" value="' +
          escHtml(state.visitorEmail || '') +
          '" placeholder="seu@email.com" style="width:100%;margin-top:4px;padding:10px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:8px;font-size:14px;background:' +
          t.inputBg +
          ';color:' +
          t.inputColor +
          ';" /></label>'
        : '') +
      (state.prechatError
        ? '<div style="font-size:12px;color:' + t.errorText + ';margin-bottom:8px;">' + escHtml(state.prechatError) + '</div>'
        : '') +
      '<button type="button" id="rz-webchat-start" style="width:100%;padding:10px;border:none;border-radius:10px;background:' +
      primaryColor() +
      ';color:#fff;font-weight:600;cursor:pointer;">Iniciar conversa</button></div>';

    var messagesBlock =
      '<div id="rz-webchat-messages" style="flex:1;overflow:auto;padding:12px 14px;background:' +
      t.messagesBg +
      (isDarkTheme()
        ? ';background-image:linear-gradient(rgba(34,211,238,.03) 1px, transparent 1px),linear-gradient(90deg, rgba(34,211,238,.03) 1px, transparent 1px);background-size:24px 24px;'
        : '') +
      '">' +
      messagesHtml +
      '</div>';

    var composer =
      '<form id="rz-webchat-form" style="display:flex;gap:8px;padding:12px;border-top:1px solid ' +
      t.border +
      ';background:' +
      t.footerBg +
      ';align-items:center;">' +
      '<input type="file" id="rz-webchat-file" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none;" />' +
      '<button type="button" id="rz-webchat-attach" title="Enviar imagem" style="padding:10px 12px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:999px;background:' +
      t.attachBg +
      ';cursor:pointer;font-size:16px;line-height:1;">📎</button>' +
      '<input id="rz-webchat-input" placeholder="Digite sua mensagem..." autocomplete="off" style="flex:1;padding:10px 12px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:999px;font-size:14px;background:' +
      t.inputBg +
      ';color:' +
      t.inputColor +
      ';" />' +
      '<button type="submit" style="padding:10px 14px;border:none;border-radius:999px;background:' +
      primaryColor() +
      ';color:#fff;font-weight:600;cursor:pointer;">Enviar</button></form>';

    var panelBody = '';
    if (mode === 'prechat') {
      panelBody = offlineBanner + prechat;
    } else if (mode === 'closed') {
      panelBody = messagesBlock + closedFooter;
    } else {
      panelBody = offlineBanner + queueBanner + messagesBlock + composer;
    }

    return (
      '<div id="rz-webchat-panel" data-rz-mode="' +
      mode +
      '" data-rz-theme="' +
      (isDarkTheme() ? 'dark' : 'light') +
      '" data-rz-build="' +
      WIDGET_BUILD +
      '" style="width:min(360px,calc(100vw - 40px));height:480px;margin-bottom:12px;background:' +
      t.panelBg +
      ';border:' +
      t.panelBorder +
      ';border-radius:16px;box-shadow:' +
      t.panelShadow +
      ';display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="padding:14px 16px;background:' +
      t.headerBg +
      ';color:#fff;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
      '<div style="min-width:0;">' +
      '<div style="font-weight:700;font-size:16px;">' +
      escHtml(title) +
      '</div>' +
      (subtitle ? '<div style="font-size:12px;opacity:.9;margin-top:2px;">' + escHtml(subtitle) + '</div>' : '') +
      (visitorLabel && mode === 'chat'
        ? '<div style="font-size:11px;opacity:.85;margin-top:4px;">' + visitorLabel + '</div>'
        : '') +
      '</div>' +
      '<button type="button" id="rz-webchat-close" aria-label="Fechar chat" style="flex-shrink:0;width:32px;height:32px;border:none;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font-size:18px;line-height:1;cursor:pointer;">×</button>' +
      '</div>' +
      panelBody +
      '</div>'
    );
  }

  function scrollMessages() {
    var el = document.getElementById('rz-webchat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function bindPanelEvents() {
    var startBtn = document.getElementById('rz-webchat-start');
    if (startBtn) {
      startBtn.onclick = function () {
        startSession();
      };
    }
    var newBtn = document.getElementById('rz-webchat-new');
    if (newBtn) {
      newBtn.onclick = function () {
        startNewConversation();
      };
    }
    var closeBtn = document.getElementById('rz-webchat-close');
    if (closeBtn) {
      closeBtn.onclick = function () {
        state.open = false;
        renderBubble();
      };
    }
    var dismissBtn = document.getElementById('rz-webchat-dismiss');
    if (dismissBtn) {
      dismissBtn.onclick = function () {
        state.open = false;
        renderBubble();
      };
    }
    var form = document.getElementById('rz-webchat-form');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        sendMessage();
      };
    }
    var attachBtn = document.getElementById('rz-webchat-attach');
    var fileInput = document.getElementById('rz-webchat-file');
    if (attachBtn && fileInput) {
      attachBtn.onclick = function () {
        if (!attachBtn.disabled) fileInput.click();
      };
      fileInput.onchange = function () {
        if (!fileInput.files || !fileInput.files[0]) return;
        sendAttachment(fileInput.files[0]);
        fileInput.value = '';
      };
    }
  }

  function connectSocket() {
    if (!state.visitorToken) return;
    loadSocketIo(baseUrl, function (io) {
      if (!io) return;
      if (state.socket) {
        state.socket.disconnect();
      }
      state.socket = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { webchatVisitorToken: state.visitorToken },
      });
      state.socket.on('webchat:message', function (payload) {
        if (!payload || !payload.message) return;
        if (payload.conversationId && state.conversationId && payload.conversationId !== state.conversationId) return;
        applyConversationMeta(payload.conversation);
        if (isClosedSystemMessage(payload.message)) {
          markConversationClosed();
        }
        var exists = state.messages.some(function (m) {
          return m.id === payload.message.id;
        });
        if (!exists) {
          state.messages.push(payload.message);
          renderBubble();
        }
      });
      state.socket.on('webchat:conversation', function (payload) {
        if (!payload || !payload.conversation) return;
        applyConversationMeta(payload.conversation);
        if (payload.conversation.status === 'closed') {
          markConversationClosed();
          renderBubble();
        } else if (payload.conversation.status === 'open') {
          state.conversationStatus = 'open';
          connectSocket();
          renderBubble();
        } else {
          renderBubble();
        }
      });
    });
  }

  function startNewConversation() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    state.visitorToken = null;
    state.conversationId = null;
    state.conversationStatus = 'open';
    state.queueStatus = 'bot';
    state.departmentName = '';
    state.messages = [];
    state.started = false;
    state.prechatError = '';
    writeStore({});
    renderBubble();
    if (!needsPrechat()) {
      startSession();
    }
  }

  function validatePrechatInputs(nameEl, emailEl) {
    if (state.config && state.config.askName) {
      if (!nameEl || !nameEl.value.trim()) {
        state.prechatError = 'Informe seu nome para continuar.';
        return false;
      }
    }
    if (state.config && state.config.askEmail) {
      if (!emailEl || !emailEl.value.trim()) {
        state.prechatError = 'Informe seu e-mail para continuar.';
        return false;
      }
      var email = emailEl.value.trim();
      if (email.indexOf('@') < 1 || email.indexOf('.') < 3) {
        state.prechatError = 'Informe um e-mail válido.';
        return false;
      }
    }
    state.prechatError = '';
    return true;
  }

  function startSession() {
    var nameEl = document.getElementById('rz-webchat-name');
    var emailEl = document.getElementById('rz-webchat-email');
    if (needsPrechat() && !validatePrechatInputs(nameEl, emailEl)) {
      renderBubble();
      return;
    }
    var body = {
      visitorToken: state.visitorToken,
      visitorName: nameEl ? nameEl.value.trim() : state.visitorName || undefined,
      visitorEmail: emailEl ? emailEl.value.trim() : state.visitorEmail || undefined,
      pageUrl: window.location.href,
    };
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then(function (data) {
        applySessionData(data);
        state.started = true;
        writeStore({ visitorToken: state.visitorToken, conversationId: state.conversationId });
        connectSocket();
        renderBubble();
      })
      .catch(function (err) {
        console.error('[RadarZap WebChat]', err.message);
      });
  }

  function sendMessage() {
    if (state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    var input = document.getElementById('rz-webchat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    state.sending = true;
    input.value = '';
    apiFetch(baseUrl, '/messages', {
      method: 'POST',
      headers: { 'X-WebChat-Visitor': state.visitorToken },
      body: JSON.stringify({ body: text }),
    })
      .then(function (data) {
        if (data.message) pushChatMessages([data.message]);
        if (data.replies && data.replies.length) pushChatMessages(data.replies);
        renderBubble();
      })
      .catch(function (err) {
        console.error('[RadarZap WebChat]', err.message);
        if (String(err.message).toLowerCase().indexOf('encerr') >= 0) {
          markConversationClosed();
          renderBubble();
        } else {
          input.value = text;
        }
      })
      .finally(function () {
        state.sending = false;
      });
  }

  function sendAttachment(file) {
    if (state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    if (!file || file.size > 5 * 1024 * 1024) {
      console.error('[RadarZap WebChat]', 'Imagem muito grande (máx. 5 MB)');
      return;
    }
    var allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.indexOf(file.type) < 0) {
      console.error('[RadarZap WebChat]', 'Tipo de arquivo não permitido');
      return;
    }
    state.sending = true;
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      var base64 = result.indexOf(',') >= 0 ? result.split(',')[1] : result;
      apiFetch(baseUrl, '/messages/attachment', {
        method: 'POST',
        headers: { 'X-WebChat-Visitor': state.visitorToken },
        body: JSON.stringify({
          dataBase64: base64,
          mimeType: file.type,
          fileName: file.name,
        }),
      })
        .then(function (data) {
          if (data.message) pushChatMessages([data.message]);
          if (data.replies && data.replies.length) pushChatMessages(data.replies);
          renderBubble();
        })
        .catch(function (err) {
          console.error('[RadarZap WebChat]', err.message);
        })
        .finally(function () {
          state.sending = false;
        });
    };
    reader.onerror = function () {
      state.sending = false;
      console.error('[RadarZap WebChat]', 'Falha ao ler arquivo');
    };
    reader.readAsDataURL(file);
  }

  apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/config', { method: 'GET' })
    .then(function (config) {
      state.config = config;
      if (state.visitorToken) {
        return apiFetch(baseUrl, '/sessions/messages', {
          method: 'GET',
          headers: { 'X-WebChat-Visitor': state.visitorToken },
        }).then(function (data) {
          applySessionData(data);
          if (isConversationEnded()) {
            markConversationClosed();
            state.started = true;
          } else if (state.messages.length > 0 || state.visitorToken) {
            state.started = true;
            if (data.status === 'open') connectSocket();
          } else if (needsPrechat()) {
            state.started = false;
          } else {
            state.started = true;
            if (data.status === 'open') connectSocket();
          }
        });
      }
    })
    .catch(function (err) {
      console.error('[RadarZap WebChat]', err.message);
    })
    .finally(function () {
      renderBubble();
    });
})();
