(function () {
  'use strict';

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
    conversationStatus: 'open',
    messages: [],
    open: false,
    socket: null,
    sending: false,
    started: false,
  };

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

  function renderBubble() {
    root.innerHTML =
      '<div style="' +
      positionStyle() +
      'display:flex;flex-direction:column;align-items:' +
      ((state.config && state.config.position) === 'left' ? 'flex-start' : 'flex-end') +
      ';">' +
      (state.open ? renderPanel() : '') +
      '<button type="button" id="rz-webchat-toggle" aria-label="Abrir chat" style="width:56px;height:56px;border-radius:999px;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);background:' +
      primaryColor() +
      ';color:#fff;font-size:24px;line-height:1;">💬</button></div>';
    var toggle = document.getElementById('rz-webchat-toggle');
    if (toggle) {
      toggle.onclick = function () {
        state.open = !state.open;
        if (state.open && !state.started) {
          startSession();
        }
        renderBubble();
      };
    }
    bindPanelEvents();
    scrollMessages();
  }

  function renderPanel() {
    var title = (state.config && state.config.title) || 'Fale conosco';
    var subtitle = (state.config && state.config.subtitle) || '';
  var askName = state.config && state.config.askName;
  var askEmail = state.config && state.config.askEmail;
  var showPrechat = !state.started && (askName || askEmail);
  var isClosed = state.conversationStatus === 'closed';

    var closedBanner = isClosed
      ? '<div style="padding:12px 14px;background:#fef2f2;border-bottom:1px solid #fecaca;text-align:center;">' +
        '<div style="font-size:13px;color:#991b1b;margin-bottom:8px;">Atendimento encerrado</div>' +
        '<button type="button" id="rz-webchat-new" style="padding:8px 14px;border:none;border-radius:8px;background:' +
        primaryColor() +
        ';color:#fff;font-weight:600;cursor:pointer;font-size:13px;">Nova conversa</button></div>'
      : '';

    var messagesHtml = state.messages
      .map(function (m) {
        var align = m.direction === 'inbound' ? 'flex-end' : 'flex-start';
        var bg =
          m.direction === 'system'
            ? '#f3f4f6'
            : m.direction === 'inbound'
              ? primaryColor()
              : '#e5e7eb';
        var color = m.direction === 'inbound' ? '#fff' : '#111827';
        return (
          '<div style="display:flex;justify-content:' +
          align +
          ';margin:6px 0;">' +
          '<div style="max-width:85%;padding:10px 12px;border-radius:14px;background:' +
          bg +
          ';color:' +
          color +
          ';font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;">' +
          escHtml(m.body) +
          '<div style="font-size:10px;opacity:.7;margin-top:4px;">' +
          formatTime(m.createdAt) +
          '</div></div></div>'
        );
      })
      .join('');

    var prechat =
      showPrechat
        ? '<div id="rz-webchat-prechat" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#fafafa;">' +
          (askName
            ? '<input id="rz-webchat-name" placeholder="Seu nome" style="width:100%;margin-bottom:8px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;" />'
            : '') +
          (askEmail
            ? '<input id="rz-webchat-email" type="email" placeholder="Seu e-mail" style="width:100%;margin-bottom:8px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;" />'
            : '') +
          '<button type="button" id="rz-webchat-start" style="width:100%;padding:10px;border:none;border-radius:8px;background:' +
          primaryColor() +
          ';color:#fff;font-weight:600;cursor:pointer;">Iniciar conversa</button></div>'
        : '';

    return (
      '<div id="rz-webchat-panel" style="width:min(360px,calc(100vw - 40px));height:480px;margin-bottom:12px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="padding:14px 16px;background:' +
      primaryColor() +
      ';color:#fff;">' +
      '<div style="font-weight:700;font-size:16px;">' +
      escHtml(title) +
      '</div>' +
      (subtitle ? '<div style="font-size:12px;opacity:.9;margin-top:2px;">' + escHtml(subtitle) + '</div>' : '') +
      '</div>' +
      prechat +
      closedBanner +
      '<div id="rz-webchat-messages" style="flex:1;overflow:auto;padding:12px 14px;background:#fff;">' +
      messagesHtml +
      '</div>' +
      '<form id="rz-webchat-form" style="display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fafafa;">' +
      '<input id="rz-webchat-input" placeholder="Digite sua mensagem..." autocomplete="off" ' +
      (showPrechat || isClosed ? 'disabled' : '') +
      ' style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:999px;font-size:14px;" />' +
      '<button type="submit" ' +
      (showPrechat || isClosed ? 'disabled' : '') +
      ' style="padding:10px 14px;border:none;border-radius:999px;background:' +
      primaryColor() +
      ';color:#fff;font-weight:600;cursor:pointer;">Enviar</button></form></div>'
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
    var form = document.getElementById('rz-webchat-form');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        sendMessage();
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
        var exists = state.messages.some(function (m) {
          return m.id === payload.message.id;
        });
        if (!exists) {
          state.messages.push(payload.message);
          renderBubble();
        }
      });
      state.socket.on('webchat:conversation', function (payload) {
        if (payload && payload.conversation && payload.conversation.status === 'closed') {
          state.conversationStatus = 'closed';
          if (state.socket) {
            state.socket.disconnect();
            state.socket = null;
          }
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
    state.messages = [];
    state.started = false;
    writeStore({});
    startSession();
  }

  function startSession() {
    var nameEl = document.getElementById('rz-webchat-name');
    var emailEl = document.getElementById('rz-webchat-email');
    var body = {
      visitorToken: state.visitorToken,
      visitorName: nameEl ? nameEl.value : undefined,
      visitorEmail: emailEl ? emailEl.value : undefined,
      pageUrl: window.location.href,
    };
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then(function (data) {
        state.visitorToken = data.visitorToken;
        state.conversationId = data.conversationId;
        state.conversationStatus = 'open';
        state.messages = data.messages || [];
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
        if (data.message) {
          var exists = state.messages.some(function (m) {
            return m.id === data.message.id;
          });
          if (!exists) state.messages.push(data.message);
        }
        renderBubble();
      })
      .catch(function (err) {
        console.error('[RadarZap WebChat]', err.message);
        if (String(err.message).toLowerCase().indexOf('encerr') >= 0) {
          state.conversationStatus = 'closed';
          renderBubble();
        } else {
          input.value = text;
        }
      })
      .finally(function () {
        state.sending = false;
      });
  }

  apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/config', { method: 'GET' })
    .then(function (config) {
      state.config = config;
      if (state.visitorToken) {
        return apiFetch(baseUrl, '/sessions/messages', {
          method: 'GET',
          headers: { 'X-WebChat-Visitor': state.visitorToken },
        }).then(function (data) {
          state.conversationId = data.conversationId;
          state.conversationStatus = data.status || 'open';
          state.messages = data.messages || [];
          state.started = true;
          if (data.status === 'open') connectSocket();
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
