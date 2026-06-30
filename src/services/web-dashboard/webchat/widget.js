(function () {
  'use strict';
  var WIDGET_BUILD = '2.12.75';
  var receiptAckTimer = null;
  var REMOTE_TYPING_IDLE_MS = 8000;
  var REMOTE_TYPING_HIDE_GRACE_MS = 2500;

  if (window.__RZ_WEBCHAT_WIDGET__) {
    console.warn('[Radar Chat WebChat] Script duplicado ignorado (build ' + window.__RZ_WEBCHAT_WIDGET__ + ').');
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
          if (!res.ok) {
            var err = new Error(data.error || 'Erro na requisição');
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
  }

  function showSendError(message) {
    var text = String(message || 'Não foi possível enviar. Tente novamente.').trim();
    state.sendError = text;
    pushChatMessages([
      {
        id: 'sys-send-err-' + Date.now(),
        direction: 'system',
        body: '⚠️ ' + text,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderBubble();
    if (state.sendErrorTimer) clearTimeout(state.sendErrorTimer);
    state.sendErrorTimer = setTimeout(function () {
      state.sendError = '';
      renderBubble();
    }, 15000);
  }

  function handleSendFailure(err, draftText) {
    var msg = (err && err.message) || 'Não foi possível enviar. Tente novamente.';
    if (err && err.status === 429) {
      if (!/aguarde|muitas mensagens/i.test(msg)) {
        msg = 'Você enviou muitas mensagens seguidas. Aguarde alguns segundos e tente de novo.';
      }
    }
    if (String(msg).toLowerCase().indexOf('encerr') >= 0) {
      markConversationClosed();
      renderBubble();
      return;
    }
    showSendError(msg);
    if (draftText) {
      state.keepComposerFocus = true;
      var inp = document.getElementById('rz-webchat-input');
      if (inp) {
        inp.value = draftText;
        inp.style.height = 'auto';
        inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
      }
    }
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

  var VISITOR_EMOJIS = [
    '😀', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎',
    '🤔', '😅', '😢', '😭', '😡', '🙏', '👍', '👎',
    '👋', '🙌', '💪', '❤️', '🔥', '✅', '❌', '⭐',
    '🎉', '💯', '😂', '🤣', '🚗', '📍', '⏰', '💬',
  ];

  /** Runtime dos modelos Chat Box (`previewTemplateId` = `chatbox-*`). */
  var CHATBOX_PREFIX = 'chatbox-';
  var CHATBOX_RUNTIME = {
    'blue-compact': {
      w: 360,
      h: 540,
      radius: 18,
      header: 'gradient',
      footer: '',
      introLines: ['Como podemos ajudar?', 'Respostas rápidas para você.'],
      primaryCta: 'Nova conversa',
      chips: ['Perguntas', 'Status', 'Falar com time'],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'small-chat': {
      w: 320,
      h: 460,
      radius: 20,
      header: 'mini',
      footer: '',
      introLines: ['Olá! 👋', 'Como posso ajudar você hoje?'],
      quickActions: ['Tenho uma dúvida', 'Quero saber mais', 'Falar com um atendente'],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'clean-support': {
      w: 360,
      h: 540,
      radius: 20,
      header: 'compact',
      footer: '',
      faqTitle: 'Perguntas frequentes',
      faqItems: ['Como redefinir minha senha', 'Problemas para fazer login', 'Atualizar dados da conta'],
      infoLine: 'Tempo médio de resposta: 2 min',
      primaryCta: 'Iniciar conversa',
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'support-lite': {
      w: 340,
      h: 500,
      radius: 18,
      header: 'mini',
      footer: '',
      introLines: ['Olá! Como podemos ajudar?', 'Respostas rápidas e sem complicação.'],
      quickActions: ['Abrir chamado', 'Ver status', 'Base de conhecimento'],
      infoLine: 'Médio tempo de resposta: 2min',
      inputPlaceholder: 'Digite sua mensagem...',
      search: true,
      searchPlaceholder: 'Buscar ajuda rápida...',
    },
    'pocket-chat': {
      w: 300,
      h: 560,
      radius: 18,
      header: 'pocket',
      footer: '',
      bottomNav: true,
      introLines: ['Oi! Precisa de ajuda?', 'Respondemos rapidinho.'],
      chips: ['Dúvida', 'Suporte', 'Preços'],
      quickActions: ['Abrir chamado', 'Ver status', 'Base de conhecimento'],
      inputPlaceholder: 'Fale algo...',
    },
    'compact-pro': {
      w: 380,
      h: 620,
      radius: 22,
      header: 'corporate',
      footer: 'Ambiente seguro e confidencial',
      actionRows: [
        'Falar com um especialista',
        'Soluções e serviços',
        'Abrir um ticket',
        'Perguntas frequentes (FAQ)',
      ],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'smart-mini': {
      w: 370,
      h: 600,
      radius: 22,
      header: 'corporate',
      footer: 'IA segura e confiável • Respostas em segundos',
      suggestionsTitle: 'Sugestões para você',
      suggestionsSubtitle: 'Com base na sua pergunta, selecione uma opção para continuar.',
      suggestions: ['Resumir conteúdo', 'Integrar via API', 'Quais são os planos?'],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'workplace-mini': {
      w: 380,
      h: 620,
      radius: 22,
      header: 'workplace',
      footer: 'Conversa interna · Visível apenas para a equipe',
      tiles: ['Políticas internas', 'TI e acessos', 'Recursos humanos', 'Guias e processos'],
      infoLine: 'Dica: Digite sua dúvida para uma resposta rápida.',
      inputPlaceholder: 'Digite sua mensagem...',
    },
    'mini-corporate': {
      w: 390,
      h: 620,
      radius: 20,
      header: 'secure',
      footer: 'Protegido por criptografia de ponta a ponta',
      actionRows: ['Abrir chamado', 'Portal do cliente', 'Ambiente seguro', 'Dados protegidos'],
      infoLine: 'Conexão segura e criptografada',
      inputPlaceholder: 'Escreva sua mensagem...',
    },
    'floating-mini': {
      w: 340,
      h: 520,
      radius: 24,
      header: 'glass',
      footer: 'Experiência moderna e flutuante',
      glass: true,
      toggleSize: 64,
      toggleIcon: '⚡',
      introLines: ['Olá! 👋 Como podemos te ajudar hoje?'],
      chips: ['Começar agora', 'Preços e planos', 'Dúvidas frequentes', 'Falar com especialista'],
      inputPlaceholder: 'Digite sua dúvida...',
    },
  };

  function chatBoxModelId() {
    if (!state.config || !state.config.previewTemplateId) return null;
    var id = String(state.config.previewTemplateId);
    if (id.indexOf(CHATBOX_PREFIX) !== 0) return null;
    return id.slice(CHATBOX_PREFIX.length);
  }

  function chatBoxRuntime() {
    var id = chatBoxModelId();
    if (!id) return null;
    return CHATBOX_RUNTIME[id] || null;
  }

  function applyChatBoxUiPatches(t, rt) {
    if (!rt || !t) return t;
    if (rt.glass) {
      t.panelBg = 'rgba(15,23,42,0.78)';
      t.panelBorder = '1px solid rgba(255,255,255,0.16)';
      t.panelShadow = '0 24px 64px rgba(0,0,0,.45)';
      t.messagesBg = 'transparent';
      t.text = '#f8fafc';
      t.textMuted = 'rgba(248,250,252,0.72)';
      t.footerBg = 'rgba(15,23,42,0.55)';
      t.border = 'rgba(255,255,255,0.12)';
      t.inputBorder = 'rgba(255,255,255,0.2)';
      t.inputBg = 'rgba(255,255,255,0.08)';
      t.inputColor = '#f8fafc';
      t.bubbleAgent = 'rgba(255,255,255,0.12)';
      t.bubbleAgentText = '#f8fafc';
      t.bubbleVisitor = primaryColor();
      t.bubbleVisitorText = '#fff';
      t.attachBg = 'rgba(255,255,255,0.1)';
      t.dismissBg = 'transparent';
      t.dismissBorder = 'rgba(255,255,255,0.25)';
      t.dismissText = '#f8fafc';
    }
    return t;
  }

  function chatBoxHeaderActions(t, dark) {
    var faqBtn = renderFaqHeaderButton();
    if (faqBtn && dark) {
      faqBtn = faqBtn.replace(/border:1px solid [^;]+;/, 'border:1px solid rgba(255,255,255,.35);');
      faqBtn = faqBtn.replace(/background:[^;]+;/, 'background:rgba(255,255,255,.08);');
      faqBtn = faqBtn.replace(/color:[^;]+;/, 'color:#fff;');
    }
    var btnExtra = dark ? '' : 'border-color:' + t.inputBorder + ';background:' + t.attachBg + ';color:' + t.text + ';';
    return (
      (faqBtn || '') +
      '<button type="button" id="rz-webchat-expand" aria-label="' +
      (state.expanded ? 'Reduzir janela' : 'Expandir janela') +
      '" title="' +
      (state.expanded ? 'Reduzir' : 'Expandir') +
      '" style="' +
      headerIconBtn(dark ? '' : btnExtra) +
      '">' +
      (state.expanded ? '⤡' : '⤢') +
      '</button>' +
      '<button type="button" id="rz-webchat-sound" aria-label="Som" title="Som" style="' +
      headerIconBtn(dark ? '' : btnExtra) +
      '">' +
      (state.soundEnabled ? '🔔' : '🔕') +
      '</button>' +
      '<button type="button" id="rz-webchat-close" aria-label="Fechar chat" title="Fechar" style="' +
      headerIconBtn(dark ? '' : btnExtra) +
      '">×</button>'
    );
  }

  function renderChatBoxHeader(title, subtitle, t, rt) {
    var accent = primaryColor();
    var actions = chatBoxHeaderActions(t, rt.header !== 'compact' && rt.header !== 'mini');
    if (rt.header === 'gradient') {
      return (
        '<div style="flex-shrink:0;background:linear-gradient(135deg,' +
        accent +
        ',#1e40af);color:#fff;border-bottom:1px solid rgba(255,255,255,.12);">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:12px 12px 14px;">' +
        '<div style="width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">RZ</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;font-size:14px;line-height:1.2;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:11px;opacity:.85;margin-top:2px;">' +
        escHtml(subtitle || 'Online agora') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        actions +
        '</div></div></div>'
      );
    }
    if (rt.header === 'mini') {
      return (
        '<div style="flex-shrink:0;background:' +
        (isDarkTheme() ? t.headerBg : '#fff') +
        ';color:' +
        (isDarkTheme() ? '#fff' : t.text) +
        ';border-bottom:1px solid ' +
        t.border +
        ';">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">' +
        '<div style="width:28px;height:28px;border-radius:999px;background:' +
        accent +
        '22;border:1px solid ' +
        accent +
        '44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:' +
        accent +
        ';">RZ</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:13px;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:10px;color:' +
        t.textMuted +
        ';">' +
        escHtml(subtitle || 'Online agora') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
        actions +
        '</div></div></div>'
      );
    }
    if (rt.header === 'pocket') {
      return (
        '<div style="flex-shrink:0;background:#0f172a;color:#e5e7eb;border-bottom:1px solid #1e293b;">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">' +
        '<div style="width:30px;height:30px;border-radius:999px;background:' +
        accent +
        ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;">RZ</div>' +
        '<div style="flex:1;font-weight:600;font-size:13px;">Chat</div>' +
        '<span style="font-size:10px;color:#94a3b8;">Online</span>' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
        chatBoxHeaderActions(t, true) +
        '</div></div></div>'
      );
    }
    if (rt.header === 'workplace') {
      return (
        '<div style="flex-shrink:0;background:linear-gradient(135deg,#0f766e,#0e7490);color:#fff;">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 12px;">' +
        '<div style="width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:16px;">👥</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;font-size:14px;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:11px;opacity:.85;margin-top:2px;">' +
        escHtml(subtitle || 'Suporte interno da sua equipe') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        chatBoxHeaderActions(t, true) +
        '</div></div></div>'
      );
    }
    if (rt.header === 'secure') {
      return (
        '<div style="flex-shrink:0;background:#0b1220;color:#fff;border-bottom:1px solid rgba(255,255,255,.08);">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 12px;">' +
        '<div style="width:36px;height:36px;border-radius:999px;background:rgba(59,130,246,.25);display:flex;align-items:center;justify-content:center;font-size:15px;">🛡</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;font-size:14px;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:11px;opacity:.78;margin-top:2px;">' +
        escHtml(subtitle || 'Suporte corporativo • Resposta rápida e segura') +
        '</div></div>' +
        '<span style="font-size:14px;opacity:.7;" aria-hidden="true">🔒</span>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        chatBoxHeaderActions(t, true) +
        '</div></div></div>'
      );
    }
    if (rt.header === 'glass') {
      return (
        '<div style="flex-shrink:0;background:rgba(255,255,255,.08);color:#f8fafc;border-bottom:1px solid rgba(255,255,255,.12);">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;">' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:14px;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:11px;opacity:.75;margin-top:2px;">' +
        escHtml(subtitle || 'Online') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        chatBoxHeaderActions(t, true) +
        '</div></div></div>'
      );
    }
    if (rt.header === 'corporate') {
      return (
        '<div style="flex-shrink:0;background:linear-gradient(135deg,' +
        accent +
        ',#1e3a8a);color:#fff;">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 12px;">' +
        '<div style="width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;">⚡</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;font-size:14px;">' +
        escHtml(title) +
        '</div>' +
        '<div style="font-size:11px;opacity:.85;margin-top:2px;">' +
        escHtml(subtitle || 'Suporte corporativo inteligente') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        chatBoxHeaderActions(t, true) +
        '</div></div></div>'
      );
    }
    return (
      '<div style="flex-shrink:0;background:' +
      (isDarkTheme() ? t.headerBg : accent) +
      ';color:#fff;border-bottom:1px solid ' +
      t.border +
      ';">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px;">' +
      '<div style="width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:14px;">💬</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:700;font-size:14px;">' +
      escHtml(title) +
      '</div>' +
      (subtitle ? '<div style="font-size:11px;opacity:.85;margin-top:2px;">' + escHtml(subtitle) + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
      actions +
      '</div></div></div>'
    );
  }

  function renderChatBoxBottomNav(t) {
    var accent = primaryColor();
    var tab = chatBoxPocketTab();
    var items = [
      { key: 'home', label: 'Início' },
      { key: 'chat', label: 'Chat' },
      { key: 'help', label: 'Ajuda' },
    ];
    return (
      '<div style="flex-shrink:0;display:flex;border-top:1px solid ' +
      t.border +
      ';background:' +
      t.footerBg +
      ';">' +
      items
        .map(function (item) {
          var active = tab === item.key;
          return (
            '<button type="button" class="rz-chatbox-nav" data-tab="' +
            item.key +
            '" aria-label="' +
            escHtml(item.label) +
            '" aria-current="' +
            (active ? 'true' : 'false') +
            '" style="flex:1;text-align:center;padding:10px 4px;font-size:10px;border:none;background:transparent;cursor:pointer;color:' +
            (active ? accent : t.textMuted) +
            ';font-weight:' +
            (active ? '600' : '500') +
            ';">' +
            escHtml(item.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function visitorSentInbound() {
    return state.messages.some(function (m) {
      return m.direction === 'inbound';
    });
  }

  function chatBoxPocketTab() {
    if (!chatBoxRuntime() || !chatBoxRuntime().bottomNav) return 'chat';
    if (visitorSentInbound()) return 'chat';
    return state.chatBoxPocketTab || 'home';
  }

  function renderChatBoxChip(label, t) {
    return (
      '<button type="button" class="rz-chatbox-pick" data-text="' +
      escHtml(label) +
      '" style="padding:5px 10px;border-radius:999px;border:1px solid ' +
      t.inputBorder +
      ';background:' +
      t.attachBg +
      ';color:' +
      t.text +
      ';font-size:11px;cursor:pointer;">' +
      escHtml(label) +
      '</button>'
    );
  }

  function renderChatBoxActionsBlock(t, rt) {
    if (!rt || visitorSentInbound()) return '';
    var accent = primaryColor();
    var html = '';
    if (rt.search) {
      html += renderChatBoxSearchBlock(t, rt);
    }
    if (rt.introLines && rt.introLines.length) {
      html += '<div style="margin-bottom:10px;">';
      for (var li = 0; li < rt.introLines.length; li++) {
        html +=
          '<div style="font-size:13px;line-height:1.45;color:' +
          t.text +
          ';margin-bottom:4px;">' +
          escHtml(rt.introLines[li]) +
          '</div>';
      }
      html += '</div>';
    }
    if (rt.primaryCta) {
      html +=
        '<button type="button" class="rz-chatbox-pick" data-text="' +
        escHtml(rt.primaryCta) +
        '" style="width:100%;padding:10px;border:none;border-radius:10px;background:' +
        accent +
        ';color:#fff;font-weight:600;font-size:13px;cursor:pointer;margin-bottom:10px;">' +
        escHtml(rt.primaryCta) +
        '</button>';
    }
    if (rt.chips && rt.chips.length) {
      html +=
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">' +
        rt.chips.map(function (c) {
          return renderChatBoxChip(c, t);
        }).join('') +
        '</div>';
    }
    if (rt.quickActions && rt.quickActions.length) {
      for (var qa = 0; qa < rt.quickActions.length; qa++) {
        var actionLabel = rt.quickActions[qa];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(actionLabel) +
          '" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:' +
          t.inputBg +
          ';color:' +
          t.text +
          ';font-size:12px;cursor:pointer;">' +
          escHtml(actionLabel) +
          '</button>';
      }
    }
    if (rt.actionRows && rt.actionRows.length) {
      for (var ar = 0; ar < rt.actionRows.length; ar++) {
        var rowLabel = rt.actionRows[ar];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(rowLabel) +
          '" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:' +
          t.inputBg +
          ';color:' +
          t.text +
          ';font-size:12px;cursor:pointer;">' +
          escHtml(rowLabel) +
          '</button>';
      }
    }
    if (rt.tiles && rt.tiles.length) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">';
      for (var ti = 0; ti < rt.tiles.length; ti++) {
        var tileLabel = rt.tiles[ti];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(tileLabel) +
          '" style="min-height:72px;padding:10px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:12px;background:' +
          t.attachBg +
          ';color:' +
          t.text +
          ';font-size:11px;font-weight:600;cursor:pointer;text-align:left;line-height:1.3;">' +
          escHtml(tileLabel) +
          '</button>';
      }
      html += '</div>';
    }
    if (rt.faqItems && rt.faqItems.length) {
      html +=
        '<div style="margin-top:12px;padding:10px;border:1px solid ' +
        t.inputBorder +
        ';border-radius:12px;background:' +
        t.inputBg +
        ';">';
      if (rt.faqTitle) {
        html +=
          '<div style="font-size:11px;font-weight:600;color:' +
          t.textMuted +
          ';margin-bottom:8px;">' +
          escHtml(rt.faqTitle) +
          '</div>';
      }
      for (var fi = 0; fi < rt.faqItems.length; fi++) {
        var faqItem = rt.faqItems[fi];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(faqItem) +
          '" style="display:block;width:100%;text-align:left;padding:6px 0;border:none;background:transparent;color:' +
          t.text +
          ';font-size:11px;cursor:pointer;">• ' +
          escHtml(faqItem) +
          '</button>';
      }
      html += '</div>';
    }
    if (rt.suggestions && rt.suggestions.length) {
      html +=
        '<div style="margin-top:10px;padding:12px;border:1px solid ' +
        t.inputBorder +
        ';border-radius:14px;background:' +
        t.attachBg +
        ';">';
      if (rt.suggestionsTitle) {
        html +=
          '<div style="font-size:12px;font-weight:600;color:' +
          t.text +
          ';">' +
          escHtml(rt.suggestionsTitle) +
          '</div>';
      }
      if (rt.suggestionsSubtitle) {
        html +=
          '<div style="font-size:10px;color:' +
          t.textMuted +
          ';margin-top:4px;margin-bottom:8px;">' +
          escHtml(rt.suggestionsSubtitle) +
          '</div>';
      }
      for (var si = 0; si < rt.suggestions.length; si++) {
        var sug = rt.suggestions[si];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(sug) +
          '" style="display:block;width:100%;text-align:left;padding:8px 10px;margin-bottom:4px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:' +
          (isCopilotLayout() ? '#fff' : t.panelBg) +
          ';color:' +
          t.text +
          ';font-size:11px;cursor:pointer;">' +
          escHtml(sug) +
          '</button>';
      }
      html += '</div>';
    }
    if (rt.infoLine) {
      html +=
        '<div style="margin-top:10px;font-size:10px;color:' +
        t.textMuted +
        ';text-align:center;">' +
        escHtml(rt.infoLine) +
        '</div>';
    }
    if (!html) return '';
    return '<div class="rz-chatbox-actions" style="padding:4px 0 12px;">' + html + '</div>';
  }

  function renderChatBoxPocketHome(t, rt) {
    var greeting = (state.config && state.config.greeting) || '';
    var html =
      '<div style="flex:1;min-height:0;overflow:auto;padding:16px 14px;background:' +
      t.messagesBg +
      ';">';
    if (greeting) {
      html +=
        '<div style="font-size:14px;line-height:1.5;color:' +
        t.text +
        ';margin-bottom:12px;">' +
        escHtml(greeting) +
        '</div>';
    }
    html += renderChatBoxActionsBlock(t, rt);
    html += '</div>';
    return html;
  }

  function renderChatBoxPocketHelp(t, rt) {
    var accent = primaryColor();
    var html =
      '<div style="flex:1;min-height:0;overflow:auto;padding:16px 14px;background:' +
      t.messagesBg +
      ';">' +
      '<div style="font-size:14px;font-weight:600;color:' +
      t.text +
      ';margin-bottom:10px;">Central de ajuda</div>';
    if (state.config && state.config.faqQuickReplies && state.config.faqQuickReplies.length) {
      for (var i = 0; i < state.config.faqQuickReplies.length; i++) {
        var item = state.config.faqQuickReplies[i];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(item.label) +
          '" data-faq-article-id="' +
          escHtml(String(item.id)) +
          '" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:' +
          t.inputBg +
          ';color:' +
          t.text +
          ';font-size:12px;cursor:pointer;">' +
          escHtml(item.label) +
          '</button>';
      }
    } else if (rt && rt.quickActions && rt.quickActions.length) {
      for (var j = 0; j < rt.quickActions.length; j++) {
        var helpAction = rt.quickActions[j];
        html +=
          '<button type="button" class="rz-chatbox-pick" data-text="' +
          escHtml(helpAction) +
          '" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:' +
          t.inputBg +
          ';color:' +
          t.text +
          ';font-size:12px;cursor:pointer;">' +
          escHtml(helpAction) +
          '</button>';
      }
    } else {
      html +=
        '<p style="font-size:12px;color:' +
        t.textMuted +
        ';">Digite sua dúvida na aba Chat ou consulte nosso FAQ.</p>';
    }
    if (faqBrowserEnabled()) {
      html +=
        '<button type="button" id="rz-webchat-faq-open-help" style="margin-top:12px;padding:10px;border:none;border-radius:10px;background:' +
        accent +
        ';color:#fff;font-weight:600;cursor:pointer;width:100%;font-size:13px;">Abrir FAQ</button>';
    }
    html += '</div>';
    return html;
  }

  function chatBoxInputPlaceholder(rt) {
    if (rt && rt.inputPlaceholder) return rt.inputPlaceholder;
    return isCopilotLayout() ? 'Escreva uma mensagem' : 'Envie uma mensagem...';
  }

  function normalizePickText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function isChatBoxSessionStartCta(text) {
    var rt = chatBoxRuntime();
    if (!rt || !text) return false;
    var needle = normalizePickText(text);
    if (!needle) return false;
    if (rt.primaryCta && normalizePickText(rt.primaryCta) === needle) return true;
    var defaults = [
      'iniciar conversa',
      'nova conversa',
      'começar agora',
      'comecar agora',
      'iniciar atendimento',
    ];
    for (var si = 0; si < defaults.length; si++) {
      if (needle === defaults[si]) return true;
    }
    return false;
  }

  function findFaqArticleIdForLabel(label) {
    var needle = normalizePickText(label);
    if (!needle) return null;
    if (state.config && state.config.faqQuickReplies) {
      for (var qi = 0; qi < state.config.faqQuickReplies.length; qi++) {
        var qr = state.config.faqQuickReplies[qi];
        if (normalizePickText(qr.label) === needle || normalizePickText(qr.title) === needle) {
          return qr.id;
        }
      }
    }
    if (!state.faqCatalog || !state.faqCatalog.categories) return null;
    for (var ci = 0; ci < state.faqCatalog.categories.length; ci++) {
      var cat = state.faqCatalog.categories[ci];
      var articles = cat.articles || [];
      for (var ai = 0; ai < articles.length; ai++) {
        var art = articles[ai];
        var artLabel = normalizePickText(art.label);
        var artTitle = normalizePickText(art.title);
        if (artLabel === needle || artTitle === needle) return art.id;
        if (artLabel.indexOf(needle) >= 0 || needle.indexOf(artLabel) >= 0) return art.id;
        if (artTitle.indexOf(needle) >= 0 || needle.indexOf(artTitle) >= 0) return art.id;
      }
    }
    return null;
  }

  function isFaqBrowserLabel(label) {
    var n = normalizePickText(label);
    if (!n) return false;
    return (
      n.indexOf('base de conhecimento') >= 0 ||
      n.indexOf('faq') >= 0 ||
      n.indexOf('perguntas frequentes') >= 0 ||
      n.indexOf('dúvidas frequentes') >= 0
    );
  }

  function isTicketLookupLabel(label) {
    var n = normalizePickText(label);
    return n.indexOf('abrir chamado') >= 0 || n.indexOf('ver status') >= 0;
  }

  function openTicketLookupFlow() {
    if (!ticketLookupEnabled()) return false;
    resetTicketLookup();
    state.ticketLookupStep = 'ref';
    state.chatBoxPocketTab = 'chat';
    renderBubble();
    return true;
  }

  function handleChatBoxPick(text, explicitArticleId) {
    var trimmed = String(text || '').trim();
    if (!trimmed && !explicitArticleId) return;
    state.chatBoxPocketTab = 'chat';

    function runPick() {
      if (isChatBoxSessionStartCta(trimmed)) {
        state.open = true;
        state.chatBoxPocketTab = 'chat';
        if (needsPrechat()) {
          renderBubble();
          return;
        }
        if (!state.started || !state.visitorToken) {
          startSessionCore();
        }
        return;
      }
      if (explicitArticleId && faqBrowserEnabled()) {
        openFaqArticleFromCatalog(explicitArticleId);
        return;
      }
      if (trimmed && isTicketLookupLabel(trimmed)) {
        if (openTicketLookupFlow()) return;
      }
      if (trimmed && isFaqBrowserLabel(trimmed) && faqBrowserEnabled()) {
        openFaqBrowser();
        return;
      }
      var articleId = trimmed ? findFaqArticleIdForLabel(trimmed) : null;
      if (articleId && faqBrowserEnabled()) {
        openFaqArticleFromCatalog(articleId);
        return;
      }
      if (!state.started || !state.visitorToken) {
        state.open = true;
        if (!state.started && !needsPrechat()) startSession();
        setTimeout(function () {
          sendMessageWithText(trimmed);
        }, state.started ? 0 : 600);
        return;
      }
      sendMessageWithText(trimmed);
    }

    if (faqBrowserEnabled() && !state.faqCatalog && trimmed && !explicitArticleId) {
      loadFaqCatalog(function () {
        runPick();
      });
      return;
    }
    runPick();
  }

  function maybePreloadChatBoxFaqCatalog(rt) {
    if (!rt || !faqBrowserEnabled()) return;
    if (rt.faqItems && rt.faqItems.length && !state.faqCatalog && !state.faqLoading) {
      loadFaqCatalog();
    }
    if (rt.search && !state.faqCatalog && !state.faqLoading) {
      loadFaqCatalog();
    }
  }

  function renderChatBoxSearchResults(t, query) {
    var needle = normalizePickText(query);
    if (!needle || !state.faqCatalog || !state.faqCatalog.categories) return '';
    var matches = [];
    for (var ci = 0; ci < state.faqCatalog.categories.length; ci++) {
      var cat = state.faqCatalog.categories[ci];
      var articles = cat.articles || [];
      for (var ai = 0; ai < articles.length; ai++) {
        var art = articles[ai];
        var artLabel = normalizePickText(art.label);
        var artTitle = normalizePickText(art.title);
        if (artLabel.indexOf(needle) >= 0 || artTitle.indexOf(needle) >= 0) {
          matches.push(art);
        }
      }
    }
    if (!matches.length) {
      return (
        '<div style="font-size:11px;color:' +
        t.textMuted +
        ';margin-bottom:8px;">Nenhum resultado para sua busca.</div>'
      );
    }
    var html = '';
    for (var mi = 0; mi < matches.length && mi < 6; mi++) {
      var match = matches[mi];
      html +=
        '<button type="button" class="rz-chatbox-pick" data-text="' +
        escHtml(match.label) +
        '" data-faq-article-id="' +
        escHtml(String(match.id)) +
        '" style="display:block;width:100%;text-align:left;padding:8px 10px;margin-bottom:4px;border:1px solid ' +
        t.inputBorder +
        ';border-radius:8px;background:' +
        t.inputBg +
        ';color:' +
        t.text +
        ';font-size:12px;cursor:pointer;">' +
        escHtml(match.label) +
        '</button>';
    }
    return html;
  }

  function renderChatBoxSearchBlock(t, rt) {
    if (!rt || !rt.search) return '';
    var q = state.chatBoxSearchQuery || '';
    return (
      '<div style="margin-bottom:10px;">' +
      '<input id="rz-chatbox-search" type="search" placeholder="' +
      escHtml(rt.searchPlaceholder || 'Buscar ajuda rápida...') +
      '" value="' +
      escHtml(q) +
      '" autocomplete="off" style="width:100%;padding:10px 12px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:10px;font-size:13px;background:' +
      t.inputBg +
      ';color:' +
      t.inputColor +
      ';outline:none;" />' +
      (state.faqLoading
        ? '<div style="font-size:11px;color:' + t.textMuted + ';margin-top:6px;">Carregando base…</div>'
        : renderChatBoxSearchResults(t, q)) +
      '</div>'
    );
  }

  function renderChatBoxFooterNote(t, note) {
    if (!note) return '';
    return (
      '<div style="flex-shrink:0;padding:6px 12px 4px;text-align:center;font-size:10px;line-height:1.35;color:' +
      t.textMuted +
      ';background:' +
      t.footerBg +
      ';">' +
      escHtml(note) +
      '</div>'
    );
  }

  function panelSizeStyle() {
    if (state.expanded) {
      return (
        'width:min(520px,calc(100vw - 24px));' +
        'height:min(720px,calc(82dvh - 28px - env(safe-area-inset-bottom,0px)));'
      );
    }
    var rt = chatBoxRuntime();
    if (rt) {
      return (
        'width:min(' +
        rt.w +
        'px,calc(100vw - 24px));' +
        'height:min(' +
        rt.h +
        'px,calc(100dvh - 80px - env(safe-area-inset-bottom,0px)));'
      );
    }
    return (
      'width:clamp(320px,min(38vw,400px),calc(100vw - 20px));' +
      'height:clamp(480px,min(68dvh,600px),calc(100dvh - 80px - env(safe-area-inset-bottom,0px)));'
    );
  }

  function headerIconBtn(extra) {
    return (
      'width:34px;height:34px;border:1px solid rgba(255,255,255,.22);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      (extra || '')
    );
  }

  function renderEmojiPicker(t) {
    if (!state.emojiPickerOpen) return '';
    var cells = VISITOR_EMOJIS.map(function (em) {
      return (
        '<button type="button" class="rz-emoji-pick" data-emoji="' +
        em +
        '" title="' +
        em +
        '" style="border:none;background:transparent;font-size:22px;line-height:1;padding:7px 4px;border-radius:10px;cursor:pointer;transition:background .15s;">' +
        em +
        '</button>'
      );
    }).join('');
    return (
      '<div id="rz-webchat-emoji-picker" role="listbox" aria-label="Emojis" style="position:absolute;bottom:calc(100% + 8px);left:0;right:0;padding:10px;border-radius:16px;border:1px solid ' +
      t.inputBorder +
      ';background:' +
      t.panelBg +
      ';box-shadow:' +
      t.panelShadow +
      ';display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:2px;max-height:168px;overflow-y:auto;z-index:5;">' +
      cells +
      '</div>'
    );
  }
  function insertAtCursor(input, text) {
    if (!input) return;
    var start = input.selectionStart;
    var end = input.selectionEnd;
    var val = input.value;
    if (typeof start === 'number' && typeof end === 'number') {
      input.value = val.slice(0, start) + text + val.slice(end);
      var pos = start + text.length;
      input.setSelectionRange(pos, pos);
    } else {
      input.value = val + text;
    }
    input.focus();
  }

  function renderPoweredBy(t) {
    return (
      '<div style="flex-shrink:0;padding:5px 10px 7px;text-align:center;background:' +
      t.footerBg +
      ';border-top:1px solid ' +
      t.border +
      ';">' +
      '<span style="font-size:10px;line-height:1.35;color:' +
      t.textMuted +
      ';">Powered by <strong style="color:' +
      primaryColor() +
      ';font-weight:600;">Radar Chat</strong></span></div>'
    );
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
    if (m.actionLinks && m.actionLinks.length) {
      var pillWrap = isCopilotLayout()
        ? 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;'
        : 'display:flex;flex-direction:column;gap:6px;margin-top:8px;';
      var pillStyle = isCopilotLayout()
        ? 'display:inline-block;padding:8px 14px;border-radius:999px;background:#fff;color:#111827;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(0,0,0,.04);'
        : 'display:inline-block;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.92);color:#111827;font-size:13px;font-weight:600;text-decoration:none;text-align:center;border:1px solid rgba(0,0,0,.08);';
      html +=
        '<div style="' +
        pillWrap +
        '">' +
        m.actionLinks
          .map(function (link) {
            if (!link || !link.url || !link.label) return '';
            var safeUrl = String(link.url);
            if (safeUrl.indexOf('https://') !== 0 && safeUrl.indexOf('http://') !== 0) return '';
            return (
              '<a href="' +
              escHtml(safeUrl) +
              '" target="' +
              (link.openInNewTab !== false ? '_blank' : '_self') +
              '" rel="noopener noreferrer" style="' +
              pillStyle +
              '">' +
              escHtml(link.label) +
              '</a>'
            );
          })
          .join('') +
        '</div>';
    }
    if (m.kbSuggestions && m.kbSuggestions.length) {
      var accent = primaryColor();
      if (isCopilotLayout()) {
        html +=
          '<div class="rz-kb-suggestions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">' +
          m.kbSuggestions
            .map(function (s) {
              if (!s || !s.id || !s.label) return '';
              return (
                '<button type="button" class="rz-kb-pick" data-kb-id="' +
                escHtml(String(s.id)) +
                '" style="display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#111827;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.04);">' +
                escHtml(String(s.label)) +
                '</button>'
              );
            })
            .join('') +
          '</div>';
      } else {
        html +=
        '<div class="rz-kb-suggestions" style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">' +
        m.kbSuggestions
          .map(function (s) {
            if (!s || !s.id || !s.label) return '';
            var num = s.index || 1;
            return (
              '<button type="button" class="rz-kb-pick" data-kb-id="' +
              escHtml(String(s.id)) +
              '" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.95);color:#111827;font-size:13px;font-weight:600;text-align:left;cursor:pointer;">' +
              '<span style="flex-shrink:0;width:26px;height:26px;border-radius:999px;background:' +
              accent +
              ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">' +
              escHtml(String(num)) +
              '</span>' +
              '<span style="flex:1;line-height:1.35;">' +
              escHtml(String(s.label)) +
              '</span></button>'
            );
          })
          .join('') +
        '</div>';
      }
    }
    if (!html && m.body) html = escHtml(m.body);
    return html;
  }

  var script = currentScript();
  var widgetKey = script.getAttribute('data-widget-key') || script.dataset.widgetKey;
  if (!widgetKey) {
    console.warn('[Radar Chat WebChat] data-widget-key ausente no script.');
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

  function writeStore(patch) {
    try {
      var current = readStore();
      if (patch && typeof patch === 'object') {
        Object.keys(patch).forEach(function (key) {
          if (patch[key] === undefined || patch[key] === null) {
            delete current[key];
          } else {
            current[key] = patch[key];
          }
        });
      }
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch (e) {
      /* ignore */
    }
  }

  var PROACTIVE_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  function proactiveDismissRemainingMs() {
    var dismissedAt = Number(readStore().proactiveDismissedAt);
    if (!dismissedAt || isNaN(dismissedAt)) return 0;
    var remaining = PROACTIVE_DISMISS_COOLDOWN_MS - (Date.now() - dismissedAt);
    return remaining > 0 ? remaining : 0;
  }

  function isProactiveDismissCooldownActive() {
    return proactiveDismissRemainingMs() > 0;
  }

  function recordProactiveDismiss() {
    writeStore({ proactiveDismissedAt: Date.now() });
    clearProactiveTimer();
    state.proactiveTeaser = null;
    state.proactiveSkipReason = 'dismissed_cooldown';
    renderBubble();
    sendPresencePing();
  }

  var state = {
    config: null,
    configError: '',
    visitorToken: readStore().visitorToken || null,
    conversationId: readStore().conversationId || null,
    visitorName: '',
    visitorEmail: '',
    visitorIntake: {},
    prechatSkippedOptional: {},
    selectOtherDraft: '',
    conversationStatus: 'open',
    queueStatus: 'bot',
    departmentName: '',
    messages: [],
    open: false,
    socket: null,
    socketPresenceAuth: null,
    sending: false,
    started: false,
    prechatError: '',
    sendError: '',
    sendErrorTimer: null,
    composerFocused: false,
    keepComposerFocus: false,
    composerSelection: null,
    emojiPickerOpen: false,
    expanded: false,
    proactiveTimer: null,
    proactiveTeaser: null,
    proactiveLastError: '',
    proactiveSkipReason: '',
    proactiveScheduledAt: null,
    chatEverOpened: false,
    proactiveInviteClicked: false,
    skipPrechat: false,
    closingConversation: false,
    endConfirmOpen: false,
    presenceId: null,
    presenceTimer: null,
    remoteTyping: null,
    remoteTypingTimer: null,
    visitorTypingStopTimer: null,
    visitorTypingActive: false,
    unreadCount: 0,
    firstUnreadMessageId: null,
    messagePreview: null,
    pulseActive: false,
    pulseTimer: null,
    originalPageTitle: null,
    notificationsReady: false,
    soundEnabled: false,
    userHasInteracted: false,
    ticketLookupStep: null,
    ticketLookupRef: '',
    ticketLookupToken: '',
    ticketLookupResult: null,
    ticketLookupError: '',
    ticketLookupLoading: false,
    ticketLookupResendPhone: '',
    ticketLookupResendEmail: '',
    ticketLookupResendChannel: 'whatsapp',
    ticketLookupResendLoading: false,
    ticketLookupResendNotice: '',
    ticketLookupResendOtp: '',
    faqOpen: false,
    faqCatalog: null,
    faqLoading: false,
    faqError: '',
    pendingFaqArticleId: null,
    faqPendingHint: false,
    chatBoxPocketTab: 'home',
    chatBoxSearchQuery: '',
  };

  function faqBrowserEnabled() {
    if (!state.config || state.config.faqInChatEnabled === false) return false;
    if (state.config.faqCatalogAvailable === false) return false;
    return true;
  }

  function ticketLookupEnabled() {
    return !state.config || state.config.ticketLookupEnabled !== false;
  }

  function resetTicketLookup() {
    state.ticketLookupStep = null;
    state.ticketLookupRef = '';
    state.ticketLookupToken = '';
    state.ticketLookupResult = null;
    state.ticketLookupError = '';
    state.ticketLookupLoading = false;
    state.ticketLookupResendPhone = '';
    state.ticketLookupResendEmail = '';
    state.ticketLookupResendChannel = 'whatsapp';
    state.ticketLookupResendLoading = false;
    state.ticketLookupResendNotice = '';
    state.ticketLookupResendOtp = '';
  }

  function formatTicketDate(iso) {
    try {
      return new Date(iso).toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  }

  function ensureTypingStyles() {
    if (document.getElementById('rz-webchat-typing-style')) return;
    var s = document.createElement('style');
    s.id = 'rz-webchat-typing-style';
    s.textContent =
      '@keyframes rz-typing-bounce{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}' +
      '@keyframes rz-notify-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}' +
      '@keyframes rz-notify-glow{0%,100%{box-shadow:0 8px 24px rgba(0,0,0,.18)}50%{box-shadow:0 8px 28px rgba(0,0,0,.22),0 0 0 4px rgba(255,255,255,.35)}}' +
      '.rz-notify-pulse{animation:rz-notify-pulse .65s ease-in-out 3,rz-notify-glow .65s ease-in-out 3;}';
    document.head.appendChild(s);
  }

  function readSoundPref() {
    try {
      return localStorage.getItem(storageKey + '_sound') === '1';
    } catch (e) {
      return false;
    }
  }

  function writeSoundPref(on) {
    try {
      localStorage.setItem(storageKey + '_sound', on ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  state.soundEnabled = readSoundPref();

  function isNotifiableOutbound(message) {
    if (!message || message.direction !== 'outbound') return false;
    if (isHiddenVisitorSystemMessage(message)) return false;
    return true;
  }

  function formatBadgeCount(count) {
    if (count >= 100) return '99+';
    if (count > 9) return '9+';
    return String(count);
  }

  function messagePreviewText(message) {
    var sender = message.senderName || 'Atendente';
    var body = String(message.body || '').trim();
    if (message.mediaType === 'image') body = '📷 Imagem';
    else if (message.mediaType === 'document') {
      body = '📎 ' + (message.mediaFileName || 'Documento');
    }
    if (!body) body = 'Nova mensagem';
    if (body.length > 80) body = body.slice(0, 77) + '…';
    return sender + ': ' + body;
  }

  function isMessagesAtBottom() {
    var el = document.getElementById('rz-webchat-messages');
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  function markMessagesRead() {
    var hadUiUnread =
      state.unreadCount > 0 || Boolean(state.firstUnreadMessageId) || Boolean(state.messagePreview);
    state.unreadCount = 0;
    state.firstUnreadMessageId = null;
    state.messagePreview = null;
    updateTabTitle();
    if (state.open && state.visitorToken && isMessagesAtBottom()) {
      scheduleAckOutboundReceipts(true);
    }
    if (hadUiUnread) renderBubble();
  }

  function lastOutboundMessageId() {
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].direction === 'outbound') return state.messages[i].id;
    }
    return null;
  }

  function outboundWithoutDelivered() {
    return state.messages
      .filter(function (m) {
        return m.direction === 'outbound' && !m.deliveredAt;
      })
      .map(function (m) {
        return m.id;
      });
  }

  function postMessageReceipts(body) {
    if (!state.visitorToken) return Promise.resolve();
    return apiFetch(baseUrl, '/sessions/message-receipts', {
      method: 'POST',
      headers: {
        'X-WebChat-Visitor': state.visitorToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch(function () {});
  }

  function scheduleAckOutboundReceipts(markRead) {
    if (receiptAckTimer) clearTimeout(receiptAckTimer);
    receiptAckTimer = setTimeout(function () {
      receiptAckTimer = null;
      ackOutboundReceipts(markRead);
    }, 350);
  }

  function ackOutboundReceipts(markRead) {
    var deliveredIds = outboundWithoutDelivered();
    var lastId = markRead ? lastOutboundMessageId() : null;
    if (!deliveredIds.length && !lastId) return;
    var body = {};
    if (deliveredIds.length) body.deliveredMessageIds = deliveredIds;
    if (lastId) body.readThroughMessageId = lastId;
    postMessageReceipts(body);
  }

  function patchInboundReceiptMeta() {
    var t = ui();
    state.messages.forEach(function (m) {
      if (m.direction !== 'inbound') return;
      var el = document.getElementById('rz-msg-meta-' + m.id);
      if (!el) return;
      el.innerHTML = formatTime(m.createdAt) + renderInboundReceiptTicks(m, t);
    });
  }

  function applyMessageReceiptPayload(payload) {
    if (!payload) return;
    var ids = payload.messageIds || [];
    var deliveredAt = payload.deliveredAt;
    var readAt = payload.readAt;
    var touchedInbound = false;
    if (payload.inboundBatch && readAt) {
      state.messages.forEach(function (m) {
        if (m.direction === 'inbound' && !m.readAt) {
          m.readAt = readAt;
          touchedInbound = true;
        }
      });
    } else if ((payload.readThrough || (readAt && ids.length === 1)) && readAt && ids.length >= 1) {
      var anchorId = ids[0];
      var anchor = state.messages.find(function (m) {
        return m.id === anchorId;
      });
      var anchorTime = anchor && anchor.createdAt ? new Date(anchor.createdAt).getTime() : null;
      state.messages.forEach(function (m) {
        if (m.direction !== 'outbound') return;
        if (anchorTime != null && new Date(m.createdAt).getTime() > anchorTime) return;
        if (deliveredAt && !m.deliveredAt) m.deliveredAt = deliveredAt;
        if (readAt && !m.readAt) m.readAt = readAt;
      });
    } else {
      state.messages.forEach(function (m) {
        if (ids.indexOf(m.id) < 0) return;
        if (deliveredAt && m.direction === 'outbound' && !m.deliveredAt) m.deliveredAt = deliveredAt;
        if (readAt && m.direction === 'outbound' && !m.readAt) m.readAt = readAt;
        if (readAt && m.direction === 'inbound' && !m.readAt) {
          m.readAt = readAt;
          touchedInbound = true;
        }
      });
    }
    if (isCopilotLayout()) {
      renderBubble();
    } else if (touchedInbound || payload.inboundBatch) {
      patchInboundReceiptMeta();
    }
  }

  function renderInboundReceiptTicks(m, t) {
    if (m.direction !== 'inbound') return '';
    if (!m.deliveredAt && !m.readAt) return '';
    var read = Boolean(m.readAt);
    var color = read ? primaryColor() : t.textMuted;
      return (
      '<span style="display:inline-flex;align-items:center;margin-left:4px;vertical-align:middle;" aria-label="' +
      (read ? 'Lida' : 'Enviada') +
      '">' +
      '<svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">' +
      '<path d="M1 5.5L3.5 8L7 3" stroke="' +
      color +
      '" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M5.5 5.5L8 8L14 2" stroke="' +
      color +
      '" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></span>'
    );
  }

  function updateTabTitle() {
    if (!state.originalPageTitle) state.originalPageTitle = document.title.replace(/^\(\d+\)\s+/, '');
    if (document.hidden && state.unreadCount > 0) {
      document.title = '(' + state.unreadCount + ') Nova mensagem';
    } else {
      document.title = state.originalPageTitle;
    }
  }

  function triggerNotifyPulse() {
    state.pulseActive = true;
    if (state.pulseTimer) clearTimeout(state.pulseTimer);
    state.pulseTimer = setTimeout(function () {
      state.pulseActive = false;
      state.pulseTimer = null;
      var toggle = document.getElementById('rz-webchat-toggle');
      if (toggle) toggle.classList.remove('rz-notify-pulse');
    }, 2600);
  }

  function playNotifyChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 784;
      gain.gain.value = 0.035;
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
      osc.onended = function () {
        void ctx.close();
      };
    } catch (e) {
      /* ignore */
    }
  }

  function handleNewOutboundMessage(message) {
    if (!state.notificationsReady || !isNotifiableOutbound(message)) return;
    if (state.open && isMessagesAtBottom()) {
      markMessagesRead();
      return;
    }
    state.unreadCount += 1;
    if (!state.firstUnreadMessageId) state.firstUnreadMessageId = message.id;
    state.messagePreview = messagePreviewText(message);
    triggerNotifyPulse();
    if (state.soundEnabled && state.userHasInteracted) playNotifyChime();
    updateTabTitle();
  }

  function renderNewMessageSeparator(t) {
    return (
      '<div style="display:flex;align-items:center;gap:10px;margin:14px 0;color:' +
      t.textMuted +
      ';font-size:11px;font-weight:600;letter-spacing:.04em;">' +
      '<span style="flex:1;height:1px;background:' +
      t.border +
      ';"></span>' +
      'Nova mensagem' +
      '<span style="flex:1;height:1px;background:' +
      t.border +
      ';"></span></div>'
    );
  }

  function renderMessagePreview(t) {
    if (!state.messagePreview || state.open) return '';
    return (
      '<div id="rz-webchat-msg-preview" role="button" tabindex="0" style="max-width:min(280px,92vw);margin-bottom:10px;padding:10px 12px;border-radius:14px 14px 4px 14px;background:' +
      t.panelBg +
      ';border:1px solid ' +
      t.border +
      ';box-shadow:' +
      t.panelShadow +
      ';cursor:pointer;position:relative;">' +
      '<div style="font-size:13px;line-height:1.45;color:' +
      t.text +
      ';padding-right:18px;">' +
      escHtml(state.messagePreview) +
      '</div>' +
      '<button type="button" id="rz-webchat-msg-preview-dismiss" aria-label="Fechar prévia" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border:none;background:transparent;color:' +
      t.textMuted +
      ';font-size:16px;line-height:1;cursor:pointer;border-radius:6px;">×</button></div>'
    );
  }

  function renderUnreadBadge() {
    if (state.open || state.unreadCount <= 0) return '';
    return (
      '<span id="rz-webchat-badge" aria-label="' +
      state.unreadCount +
      ' mensagens não lidas" style="position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.25);border:2px solid #fff;">' +
      escHtml(formatBadgeCount(state.unreadCount)) +
      '</span>'
    );
  }

  function clearRemoteTyping() {
    state.remoteTyping = null;
    if (state.remoteTypingTimer) {
      clearTimeout(state.remoteTypingTimer);
      state.remoteTypingTimer = null;
    }
  }

  function remoteTypingMatches(payload) {
    if (!state.remoteTyping || !payload) return false;
    return (
      state.remoteTyping.senderType === (payload.senderType || 'agent') &&
      String(state.remoteTyping.senderName || '') === String(payload.senderName || '')
    );
  }

  function handleRemoteTyping(payload) {
    if (!payload || payload.senderType === 'visitor') return;
    var convId = payload.conversationId ? String(payload.conversationId) : '';
    if (convId && state.conversationId && String(state.conversationId) !== convId) return;
    if (convId && !state.conversationId) state.conversationId = convId;
    if (!payload.typing) {
      if (!state.remoteTyping) return;
      if (state.remoteTypingTimer) clearTimeout(state.remoteTypingTimer);
      state.remoteTypingTimer = setTimeout(function () {
        clearRemoteTyping();
        renderBubble();
      }, REMOTE_TYPING_HIDE_GRACE_MS);
      return;
    }
    var alreadyVisible = remoteTypingMatches(payload);
    state.remoteTyping = {
      senderType: payload.senderType || 'agent',
      senderName: payload.senderName || '',
    };
    if (state.remoteTypingTimer) clearTimeout(state.remoteTypingTimer);
    state.remoteTypingTimer = setTimeout(function () {
      clearRemoteTyping();
      renderBubble();
    }, REMOTE_TYPING_IDLE_MS);
    if (!alreadyVisible) renderBubble();
  }

  function emitVisitorTyping(typing) {
    if (!state.conversationId || state.conversationStatus === 'closed') return;
    if (state.socket && state.socket.connected) {
      state.socket.emit('webchat:typing', {
        conversationId: state.conversationId,
        typing: typing,
        senderType: 'visitor',
      });
    }
    if (!state.visitorToken) return;
    apiFetch(baseUrl, '/sessions/typing', {
      method: 'POST',
      headers: { 'X-WebChat-Visitor': state.visitorToken },
      body: JSON.stringify({ typing: typing }),
    }).catch(function () {});
  }

  function scheduleVisitorTypingPulse() {
    if (!state.visitorTypingActive) {
      state.visitorTypingActive = true;
      emitVisitorTyping(true);
    }
    if (state.visitorTypingStopTimer) clearTimeout(state.visitorTypingStopTimer);
    state.visitorTypingStopTimer = setTimeout(function () {
      state.visitorTypingActive = false;
      emitVisitorTyping(false);
    }, 2000);
  }

  function renderTypingBubble(t) {
    if (!state.remoteTyping) return '';
    var name =
      state.remoteTyping.senderName ||
      (state.remoteTyping.senderType === 'bot' ? 'Assistente' : 'Atendente');
    var dots =
      '<span style="display:inline-flex;gap:3px;margin-right:6px;vertical-align:middle;">' +
      '<span style="width:5px;height:5px;border-radius:50%;background:' +
      t.bubbleAgentText +
      ';opacity:.5;animation:rz-typing-bounce 1.2s infinite ease-in-out;"></span>' +
      '<span style="width:5px;height:5px;border-radius:50%;background:' +
      t.bubbleAgentText +
      ';opacity:.5;animation:rz-typing-bounce 1.2s infinite ease-in-out;animation-delay:.15s;"></span>' +
      '<span style="width:5px;height:5px;border-radius:50%;background:' +
      t.bubbleAgentText +
      ';opacity:.5;animation:rz-typing-bounce 1.2s infinite ease-in-out;animation-delay:.3s;"></span></span>';
    return (
      '<div id="rz-webchat-typing" style="display:flex;flex-direction:column;align-items:flex-start;margin:10px 0 4px;max-width:88%;">' +
      '<div style="padding:10px 14px;border-radius:18px 18px 18px 4px;background:' +
      t.bubbleAgent +
      ';color:' +
      t.bubbleAgentText +
      ';font-size:13px;line-height:1.4;display:flex;align-items:center;">' +
      dots +
      escHtml(name) +
      ' está digitando…' +
      '</div></div>'
    );
  }

  function ensurePresenceId() {
    if (state.presenceId) return state.presenceId;
    var key = 'rz_presence_' + widgetKey;
    try {
      var stored = sessionStorage.getItem(key);
      if (stored) {
        state.presenceId = stored;
        return stored;
      }
      var id = 'wcp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
      state.presenceId = id;
      return id;
    } catch (e) {
      state.presenceId = 'wcp_' + Date.now();
      return state.presenceId;
    }
  }

  function presenceEngagementKey() {
    return 'rz_presence_eng_' + widgetKey;
  }

  function readPresenceEngagement() {
    try {
      var raw = sessionStorage.getItem(presenceEngagementKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writePresenceEngagement(patch) {
    try {
      var cur = readPresenceEngagement();
      sessionStorage.setItem(presenceEngagementKey(), JSON.stringify(Object.assign(cur, patch)));
    } catch (e) {
      /* ignore */
    }
  }

  function syncPresenceEngagementFromStore() {
    var stored = readPresenceEngagement();
    if (stored.chatEverOpened) state.chatEverOpened = true;
    if (stored.proactiveInviteClicked) state.proactiveInviteClicked = true;
  }

  function recordChatEngagement(opts) {
    state.chatEverOpened = true;
    if (opts && opts.proactiveInvite) {
      state.proactiveInviteClicked = true;
    }
    writePresenceEngagement({
      chatEverOpened: true,
      proactiveInviteClicked: !!(opts && opts.proactiveInvite) || !!state.proactiveInviteClicked,
    });
    sendPresencePing();
  }

  function presenceEngagementFlags() {
    var stored = readPresenceEngagement();
    return {
      chatEverOpened: !!(state.chatEverOpened || stored.chatEverOpened),
      proactiveInviteClicked: !!(state.proactiveInviteClicked || stored.proactiveInviteClicked),
    };
  }

  function sendPresencePing() {
    if (!state.config) return Promise.resolve();
    var engagement = presenceEngagementFlags();
    return apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/presence', {
      method: 'POST',
      body: JSON.stringify({
        presenceId: ensurePresenceId(),
        pageUrl: window.location.href,
        pageTitle: document.title || '',
        referrer: document.referrer || '',
        chatOpened: state.open,
        chatEverOpened: engagement.chatEverOpened,
        proactiveInviteClicked: engagement.proactiveInviteClicked,
        notificationDismissed: isProactiveDismissCooldownActive(),
        visitorToken: state.visitorToken,
      }),
    })
      .then(function (data) {
        if (data && data.socketAuth) state.socketPresenceAuth = data.socketAuth;
      })
      .catch(function () {
        /* ignore */
      });
  }

  function pollPendingEngage() {
    if (!state.config) return;
    apiFetch(
      baseUrl,
      '/widgets/' +
        encodeURIComponent(widgetKey) +
        '/presence/' +
        encodeURIComponent(ensurePresenceId()) +
        '/pending',
      { method: 'GET' },
    )
      .then(function (data) {
        if (data && data.agentEngage) handleAgentEngage(data.agentEngage);
      })
      .catch(function () {
        /* ignore */
      });
  }

  function startPresenceHeartbeat() {
    if (state.presenceTimer) return;
    sendPresencePing().finally(function () {
      connectSocket();
    });
    pollPendingEngage();
    state.presenceTimer = setInterval(function () {
      sendPresencePing();
      pollPendingEngage();
    }, 3000);
  }

  function hasVisitorInbound() {
    return state.messages.some(function (m) {
      return m.direction === 'inbound';
    });
  }

  function clearProactiveTimer() {
    if (state.proactiveTimer) {
      clearTimeout(state.proactiveTimer);
      state.proactiveTimer = null;
    }
  }

  function proactiveMessageText() {
    if (!state.config) return '';
    return String(state.config.proactiveGreetingMessage || 'Olá! Estou por aqui caso precise de ajuda 😊').trim();
  }

  function hasProactiveInMessages() {
    var text = proactiveMessageText();
    if (!text) return false;
    return state.messages.some(function (m) {
      return m.direction === 'outbound' && String(m.body || '').trim() === text;
    });
  }

  function showProactiveTeaser() {
    if (!state.config || !state.config.proactiveGreetingEnabled) return;
    if (state.open || isProactiveDismissCooldownActive()) return;
    var text = proactiveMessageText();
    if (!text) return;
    state.proactiveTeaser = text;
    renderBubble();
  }

  function shouldSkipProactiveServerPersist() {
    if (hasVisitorInbound()) return 'visitor_replied';
    if (hasProactiveInMessages() && !isConversationEnded()) return 'already_sent';
    return '';
  }

  function scheduleProactiveGreeting() {
    clearProactiveTimer();
    if (!state.config || !state.config.proactiveGreetingEnabled) return;
    if (isProactiveDismissCooldownActive()) {
      state.proactiveSkipReason = 'dismissed_cooldown';
      return;
    }
    var delaySec = Number(state.config.proactiveGreetingDelaySeconds);
    if (!delaySec || delaySec < 5) delaySec = 30;
    state.proactiveScheduledAt = Date.now() + delaySec * 1000;
    state.proactiveLastError = '';
    state.proactiveSkipReason = '';
    state.proactiveTimer = setTimeout(function () {
      state.proactiveTimer = null;
      if (isProactiveDismissCooldownActive()) {
        state.proactiveSkipReason = 'dismissed_cooldown';
        return;
      }
      showProactiveTeaser();
      var skipReason = shouldSkipProactiveServerPersist();
      if (skipReason) {
        state.proactiveSkipReason = skipReason;
        if (state.visitorToken && !isConversationEnded()) connectSocket();
        renderBubble();
        return;
      }
      apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/proactive-greeting', {
        method: 'POST',
        body: JSON.stringify({
          visitorToken: state.visitorToken,
          pageUrl: window.location.href,
        }),
      })
        .then(function (data) {
          if (data.visitorToken) state.visitorToken = data.visitorToken;
          if (data.conversationId) state.conversationId = data.conversationId;
          if (data.messages) state.messages = data.messages;
          writeStore({ visitorToken: state.visitorToken, conversationId: state.conversationId });
          state.proactiveSkipReason = data.skipReason || '';
          if (data.sent) {
            state.proactiveSkipReason = '';
            connectSocket();
          }
          if (!state.proactiveTeaser) showProactiveTeaser();
          renderBubble();
        })
        .catch(function (err) {
          state.proactiveLastError = err.message || String(err);
          console.error('[Radar Chat WebChat]', err.message);
        });
    }, delaySec * 1000);
  }

  function legacyPrechatFields(config) {
    var fields = [];
    if (config.askName) {
      fields.push({
        id: 'name',
        label: 'Nome',
        type: 'text',
        enabled: true,
        required: true,
        placeholder: 'Seu nome',
      });
    }
    if (config.askPhone !== false) {
      fields.push({
        id: 'phone',
        label: 'WhatsApp',
        type: 'phone',
        enabled: true,
        required: true,
        placeholder: '(11) 99999-9999',
      });
    }
    if (config.askContactReason !== false) {
      fields.push({
        id: 'contact_reason',
        label: 'Motivo do contato',
        type: 'select',
        enabled: true,
        required: true,
        options:
          config.contactReasonOptions && config.contactReasonOptions.length
            ? config.contactReasonOptions
            : ['Quero saber preços', 'Quero contratar', 'Preciso de suporte', 'Dúvida sobre planos', 'Outro'],
      });
    }
    if (config.askEmail) {
      fields.push({
        id: 'email',
        label: 'E-mail',
        type: 'email',
        enabled: true,
        required: false,
        placeholder: 'seu@email.com',
      });
    }
    return fields;
  }

  function activePrechatFields() {
    if (!state.config) return [];
    if (state.config.prechatFields && state.config.prechatFields.length) {
      return state.config.prechatFields.filter(function (f) {
        return f.enabled;
      });
    }
    return legacyPrechatFields(state.config);
  }

  function prechatFieldsEnabled() {
    return activePrechatFields().length > 0;
  }

  function intakeValue(fieldId) {
    return String((state.visitorIntake && state.visitorIntake[fieldId]) || '').trim();
  }

  function getPrechatStep() {
    if (state.skipPrechat) return null;
    if (!state.config) return null;
    if (state.conversationStatus === 'closed' || isConversationEnded()) return null;
    var fields = activePrechatFields();
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var val = intakeValue(f.id);
      if (f.required && !val) return f.id;
      if (!f.required && !state.prechatSkippedOptional[f.id] && !val) return f.id;
    }
    return null;
  }

  function isFormPrechatMode() {
    return state.config && state.config.prechatMode === 'form';
  }

  function prechatInputId(fieldId) {
    return 'rz-prechat-field-' + fieldId;
  }

  function renderPrechatFieldBlock(field, t, inputStyle, reasonBtnStyle, formMode) {
    var margin = formMode ? 'margin-bottom:12px;' : '';
    var label =
      '<label style="display:block;font-size:12px;color:' +
      t.textMuted +
      ';' +
      margin +
      '">' +
      escHtml(field.label) +
      (field.required ? ' *' : formMode ? '' : '') +
      (formMode && !field.required ? ' <span style="opacity:.7;">(opcional)</span>' : '');

    if (field.type === 'select') {
      if (formMode) {
        var opts = field.options && field.options.length ? field.options : ['Outro'];
        var selected = intakeValue(field.id);
        return (
          label +
          '<select id="' +
          prechatInputId(field.id) +
          '" data-field="' +
          escHtml(field.id) +
          '" style="' +
          inputStyle +
          '"><option value="">Selecione…</option>' +
          opts
            .map(function (opt) {
              return (
                '<option value="' +
                escHtml(opt) +
                '"' +
                (selected === opt ? ' selected' : '') +
                '>' +
                escHtml(opt) +
                '</option>'
              );
            })
            .join('') +
          '</select></label>'
        );
      }
      return '';
    }

    if (field.type === 'textarea') {
      var maxAttr = field.maxLength ? ' maxlength="' + field.maxLength + '"' : '';
      var counter = field.maxLength
        ? '<div style="font-size:10px;color:' +
          t.textMuted +
          ';margin-top:4px;text-align:right;">Máx. ' +
          field.maxLength +
          ' caracteres</div>'
        : '';
      return (
        label +
        '<textarea id="' +
        prechatInputId(field.id) +
        '" data-field="' +
        escHtml(field.id) +
        '" rows="3"' +
        maxAttr +
        ' placeholder="' +
        escHtml(field.placeholder || '') +
        '" style="' +
        inputStyle +
        'resize:vertical;min-height:72px;">' +
        escHtml(intakeValue(field.id)) +
        '</textarea>' +
        counter +
        '</label>'
      );
    }

    var inputType = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text';
    var maxAttr2 = field.maxLength ? ' maxlength="' + field.maxLength + '"' : '';
    return (
      label +
      '<input id="' +
      prechatInputId(field.id) +
      '" data-field="' +
      escHtml(field.id) +
      '" type="' +
      inputType +
      '" value="' +
      escHtml(intakeValue(field.id)) +
      '" placeholder="' +
      escHtml(field.placeholder || '') +
      '"' +
      maxAttr2 +
      ' style="' +
      inputStyle +
      '" /></label>'
    );
  }

  function formPrechatIncomplete() {
    var fields = activePrechatFields();
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.required && !intakeValue(f.id)) return true;
    }
    return false;
  }

  function needsPrechat() {
    if (state.skipPrechat) return false;
    if (!state.config) return false;
    if (state.conversationStatus === 'closed' || isConversationEnded()) return false;
    if (!prechatFieldsEnabled()) return false;
    if (isFormPrechatMode()) {
      if (!state.visitorToken || formPrechatIncomplete()) return true;
      return !state.started;
    }
    return getPrechatStep() !== null;
  }

  function isValidPhone(val) {
    var digits = String(val || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  function isValidEmail(val) {
    return val.indexOf('@') >= 1 && val.indexOf('.') >= 3;
  }

  function visitorFirstName() {
    var n = intakeValue('name') || String(state.visitorName || '').trim();
    return n ? n.split(/\s+/)[0] : '';
  }

  function syncLegacyFromIntake() {
    var fields = activePrechatFields();
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if ((f.preset === 'name' || f.id === 'name') && state.visitorIntake[f.id]) {
        state.visitorName = state.visitorIntake[f.id];
      }
    }
    if (state.visitorIntake.name) state.visitorName = state.visitorIntake.name;
    if (state.visitorIntake.email) state.visitorEmail = state.visitorIntake.email;
  }

  function isHiddenVisitorSystemMessage(message) {
    if (!message || message.direction !== 'system') return false;
    var body = String(message.body || '').trim();
    if (body.indexOf('📋 Dados do visitante') === 0) return true;
    if (/^Prioridade para .+ — aguardando aceite no painel\.$/.test(body)) return true;
    if (body === 'Nenhum atendente online no painel — fila aberta para a equipe assumir.') return true;
    return false;
  }

  function applySessionData(data) {
    if (!data) return;
    if (data.visitorToken) state.visitorToken = data.visitorToken;
    if (data.conversationId) state.conversationId = data.conversationId;
    if (data.visitorName !== undefined) state.visitorName = data.visitorName || '';
    if (data.visitorEmail !== undefined) state.visitorEmail = data.visitorEmail || '';
    if (data.visitorIntake) state.visitorIntake = data.visitorIntake;
    else if (data.visitorName || data.visitorEmail || data.visitorPhone || data.contactReason) {
      var prev = state.visitorIntake || {};
      state.visitorIntake = {
        name: data.visitorName || prev.name,
        email: data.visitorEmail || prev.email,
        phone: data.visitorPhone || prev.phone,
        contact_reason: data.contactReason || prev.contact_reason,
      };
    }
    syncLegacyFromIntake();
    if (data.status) state.conversationStatus = data.status;
    if (data.queueStatus) state.queueStatus = data.queueStatus;
    if (data.departmentName !== undefined) state.departmentName = data.departmentName || '';
    if (data.messages) {
      state.messages = data.messages.filter(function (m) {
        return !isHiddenVisitorSystemMessage(m);
      });
    }
  }

  function pushChatMessages(items) {
    if (!items || !items.length) return;
    items.forEach(function (item) {
      if (!item || !item.id) return;
      if (isHiddenVisitorSystemMessage(item)) return;
      var exists = state.messages.some(function (m) {
        return m.id === item.id;
      });
      if (!exists) {
        if (item.direction === 'inbound' && !item.deliveredAt) {
          item.deliveredAt = item.createdAt || new Date().toISOString();
        }
        state.messages.push(item);
        if (item.direction === 'outbound') handleNewOutboundMessage(item);
      }
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
    return /atendimento encerrad|encerramos o atendimento|foi encerrad|encerrou o atendimento/i.test(
      String(message.body || ''),
    );
  }

  function isConversationEnded() {
    if (state.conversationStatus === 'closed') return true;
    return state.messages.some(function (m) {
      return isClosedSystemMessage(m);
    });
  }

  function resolvePanelMode() {
    if (state.faqOpen) return 'faq';
    if (state.ticketLookupStep === 'ref' || state.ticketLookupStep === 'token' || state.ticketLookupStep === 'resend' || state.ticketLookupStep === 'resend_otp') return 'ticket_lookup';
    if (state.ticketLookupStep === 'result') return 'ticket_result';
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
    var isLeft = (state.config && state.config.position) === 'left';
    var horizontal = isLeft
      ? 'left:max(12px, env(safe-area-inset-left, 0px));'
      : 'right:max(12px, env(safe-area-inset-right, 0px));';
    return horizontal + 'bottom:max(12px, env(safe-area-inset-bottom, 0px));';
  }

  function applyRootPosition() {
    var t = ui();
    root.style.cssText =
      'position:fixed;z-index:2147483000;font-family:' +
      t.font +
      ';' +
      positionStyle();
  }

  function primaryColor() {
    return (state.config && state.config.primaryColor) || '#2563eb';
  }

  function isCopilotLayout() {
    if (!state.config) return false;
    if (state.config.chatLayout === 'copilot') return true;
    return state.config.previewTemplateId === 'copilot';
  }

  function ensureCopilotFont() {
    if (!isCopilotLayout() || document.getElementById('rz-copilot-font')) return;
    var link = document.createElement('link');
    link.id = 'rz-copilot-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  function botDisplayName() {
    return (state.config && state.config.title) || 'Assistente';
  }

  function visitorInitials() {
    var name = visitorFirstName() || state.visitorName || 'V';
    return String(name).trim().charAt(0).toUpperCase() || 'V';
  }

  function copilotAvatarHtml(isBot, label) {
    var accent = primaryColor();
    if (isBot) {
      return (
        '<div style="flex-shrink:0;width:36px;height:36px;border-radius:999px;background:linear-gradient(135deg,' +
        accent +
        ' 0%,#4338ca 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(99,102,241,.35);font-size:15px;color:#fff;font-weight:700;">✦</div>'
      );
    }
    return (
      '<div style="flex-shrink:0;width:36px;height:36px;border-radius:999px;background:linear-gradient(135deg,#e5e7eb,#f9fafb);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#374151;" title="' +
      escHtml(label || 'Visitante') +
      '">' +
      escHtml(visitorInitials()) +
      '</div>'
    );
  }

  function copilotHeaderIconBtn(extra) {
    return (
      'width:32px;height:32px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.06);color:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      (extra || '')
    );
  }

  function renderCopilotHeader(title, subtitle, t) {
    var accent = primaryColor();
    var faqBtn = renderFaqHeaderButton();
    if (faqBtn) {
      faqBtn = faqBtn.replace(/border:1px solid [^;]+;/, 'border:1px solid rgba(255,255,255,.35);');
      faqBtn = faqBtn.replace(/background:[^;]+;/, 'background:rgba(255,255,255,.08);');
      faqBtn = faqBtn.replace(/color:[^;]+;/, 'color:#fff;');
    }
    return (
      '<div style="flex-shrink:0;position:relative;overflow:hidden;background:#181818;color:#fff;border-bottom:1px solid rgba(255,255,255,.08);">' +
      '<div style="pointer-events:none;position:absolute;inset:0;opacity:.12;background-image:radial-gradient(circle at 20% 30%,rgba(99,102,241,.55) 0%,transparent 45%),radial-gradient(circle at 80% 70%,rgba(56,189,248,.25) 0%,transparent 40%),url(\"data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\");"></div>' +
      '<div style="position:relative;display:flex;align-items:center;gap:12px;padding:14px 14px 16px;">' +
      copilotAvatarHtml(true) +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:700;font-size:15px;line-height:1.25;letter-spacing:-.01em;">' +
      escHtml(title) +
      '</div>' +
      (subtitle
        ? '<div style="font-size:12px;color:rgba(255,255,255,.72);margin-top:3px;line-height:1.35;">' +
          escHtml(subtitle) +
          '</div>'
        : '') +
      '</div>' +
      (faqBtn || '') +
      '<button type="button" id="rz-webchat-expand" aria-label="' +
      (state.expanded ? 'Reduzir janela' : 'Expandir janela') +
      '" title="' +
      (state.expanded ? 'Reduzir' : 'Expandir') +
      '" style="' +
      copilotHeaderIconBtn() +
      '">' +
      (state.expanded ? '⤡' : '⤢') +
      '</button>' +
      '<button type="button" id="rz-webchat-sound" aria-label="Som" title="Som" style="' +
      copilotHeaderIconBtn() +
      '">' +
      (state.soundEnabled ? '🔔' : '🔕') +
      '</button>' +
      '<button type="button" id="rz-webchat-close" aria-label="Fechar" title="Fechar" style="' +
      copilotHeaderIconBtn() +
      '">×</button>' +
      '</div></div>'
    );
  }

  function isDarkTheme() {
    return state.config && state.config.theme === 'dark';
  }

  function appearanceConfigSignature(cfg) {
    if (!cfg) return '';
    return [
      cfg.theme || 'light',
      cfg.chatLayout || 'classic',
      cfg.primaryColor || '',
      cfg.title || '',
      cfg.subtitle || '',
      cfg.position || '',
      cfg.prechatMode || 'steps',
      cfg.previewTemplateId || '',
      cfg.greeting || '',
      JSON.stringify(cfg.prechatFields || []),
      cfg.proactiveGreetingEnabled ? '1' : '0',
      cfg.proactiveGreetingMessage || '',
      cfg.ticketLookupEnabled === false ? '0' : '1',
      cfg.faqInChatEnabled === false ? '0' : '1',
      cfg.faqCatalogAvailable ? '1' : '0',
      cfg.businessHoursEnabled ? '1' : '0',
      cfg.outsideHoursMessage || '',
    ].join('|');
  }

  function refreshWidgetConfig() {
    return apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/config', { method: 'GET' })
      .then(function (config) {
        var prevSig = appearanceConfigSignature(state.config);
        state.config = config;
        return prevSig !== appearanceConfigSignature(config);
      })
      .catch(function () {
        return false;
      });
  }

  function ui() {
    if (isCopilotLayout()) {
      var accent = primaryColor();
      return {
        copilot: true,
        panelBg: '#ffffff',
        panelBorder: 'none',
        panelShadow: '0 24px 64px rgba(15,23,42,.18)',
        headerBg: '#181818',
        messagesBg: '#f4f4f5',
        prechatBg: '#f4f4f5',
        footerBg: '#ffffff',
        border: '#e5e7eb',
        inputBorder: '#e5e7eb',
        inputBg: '#fafafa',
        inputColor: '#111827',
        text: '#111827',
        textMuted: '#6b7280',
        bubbleAgent: '#ffffff',
        bubbleAgentText: '#111827',
        bubbleVisitor: '#ffffff',
        bubbleVisitorText: '#111827',
        bubbleSystem: '#eef2ff',
        bubbleSystemText: '#4338ca',
        dismissBg: '#fff',
        dismissBorder: '#e5e7eb',
        dismissText: '#374151',
        attachBg: '#fff',
        toggleShadow: '0 8px 28px rgba(99,102,241,.45)',
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
        font: "'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        accent: accent,
      };
    }
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
        bubbleVisitor: primaryColor(),
        bubbleVisitorText: '#fff',
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
      bubbleVisitor: '#f8fafc',
      bubbleVisitorText: '#0f172a',
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

  function renderProactiveTeaser(t) {
    if (!state.proactiveTeaser || state.open) return '';
    return (
      '<div id="rz-webchat-teaser" role="button" tabindex="0" style="max-width:min(280px,92vw);margin-bottom:10px;padding:10px 12px;border-radius:14px 14px 4px 14px;background:' +
      t.panelBg +
      ';border:1px solid ' +
      t.border +
      ';box-shadow:' +
      t.panelShadow +
      ';cursor:pointer;position:relative;">' +
      '<div style="font-size:13px;line-height:1.45;color:' +
      t.text +
      ';padding-right:18px;">' +
      escHtml(state.proactiveTeaser) +
      '</div>' +
      '<button type="button" id="rz-webchat-teaser-dismiss" aria-label="Fechar" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border:none;background:transparent;color:' +
      t.textMuted +
      ';font-size:16px;line-height:1;cursor:pointer;border-radius:6px;">×</button></div>'
    );
  }

  function restoreComposerFocus() {
    if (!state.open || resolvePanelMode() !== 'chat' || state.conversationStatus === 'closed') return;
    if (!state.composerFocused && !state.keepComposerFocus) return;
    var inp = document.getElementById('rz-webchat-input');
    if (!inp || inp.disabled) return;
    inp.focus();
    if (state.composerSelection) {
      try {
        inp.setSelectionRange(state.composerSelection.start, state.composerSelection.end);
      } catch (e) {
        /* ignore */
      }
    }
    state.keepComposerFocus = false;
  }

  function renderBubble() {
    ensureTypingStyles();
    ensureCopilotFont();
    var savedInput = '';
    var savedSearch = state.chatBoxSearchQuery || '';
    var inputEl = document.getElementById('rz-webchat-input');
    if (inputEl && document.activeElement === inputEl) {
      state.composerFocused = true;
      state.composerSelection = {
        start: inputEl.selectionStart,
        end: inputEl.selectionEnd,
      };
    }
    if (inputEl) savedInput = inputEl.value;
    var searchEl = document.getElementById('rz-chatbox-search');
    if (searchEl) savedSearch = searchEl.value;
    state.chatBoxSearchQuery = savedSearch;
    applyRootPosition();
    var rt = chatBoxRuntime();
    var t = applyChatBoxUiPatches(ui(), rt);
    root.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:' +
      ((state.config && state.config.position) === 'left' ? 'flex-start' : 'flex-end') +
      ';">' +
      (state.open ? renderPanel() : '') +
      (!state.open && state.messagePreview ? renderMessagePreview(t) : renderProactiveTeaser(t)) +
      '<div style="position:relative;display:inline-block;">' +
      '<button type="button" id="rz-webchat-toggle" aria-label="Abrir chat" class="' +
      (state.pulseActive ? 'rz-notify-pulse' : '') +
      '" style="width:' +
      (rt && rt.toggleSize ? rt.toggleSize : 56) +
      'px;height:' +
      (rt && rt.toggleSize ? rt.toggleSize : 56) +
      'px;border-radius:999px;border:none;cursor:pointer;box-shadow:' +
      t.toggleShadow +
      ';background:' +
      primaryColor() +
      ';color:#fff;font-size:24px;line-height:1;">' +
      (rt && rt.toggleIcon ? rt.toggleIcon : '💬') +
      '</button>' +
      renderUnreadBadge() +
      '</div></div>';
    var toggle = document.getElementById('rz-webchat-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', state.open ? 'Fechar chat' : 'Abrir chat');
      toggle.onclick = function () {
        var opening = !state.open;
        state.open = opening;
        state.prechatError = '';
        state.emojiPickerOpen = false;
        if (opening) {
          markMessagesRead();
          refreshWidgetConfig().then(function (changed) {
            recordChatEngagement({ proactiveInvite: false });
            state.proactiveTeaser = null;
            if (!state.started && !needsPrechat()) {
              startSession();
            }
            if (changed) applyRootPosition();
            renderBubble();
            setTimeout(function () {
              scrollMessages();
            }, 50);
          });
        } else {
          sendPresencePing();
          renderBubble();
        }
      };
    }
    var teaser = document.getElementById('rz-webchat-teaser');
    if (teaser) {
      teaser.onclick = function (e) {
        if (
          e.target &&
          (e.target.id === 'rz-webchat-teaser-dismiss' ||
            (e.target.closest && e.target.closest('#rz-webchat-teaser-dismiss')))
        ) {
          return;
        }
        state.open = true;
        recordChatEngagement({ proactiveInvite: true });
        state.proactiveTeaser = null;
        if (!state.started && !needsPrechat()) startSession();
        renderBubble();
      };
    }
    var teaserDismiss = document.getElementById('rz-webchat-teaser-dismiss');
    if (teaserDismiss) {
      teaserDismiss.onclick = function (e) {
        e.stopPropagation();
        recordProactiveDismiss();
      };
    }
    var msgPreview = document.getElementById('rz-webchat-msg-preview');
    if (msgPreview) {
      msgPreview.onclick = function (e) {
        if (
          e.target &&
          (e.target.id === 'rz-webchat-msg-preview-dismiss' ||
            (e.target.closest && e.target.closest('#rz-webchat-msg-preview-dismiss')))
        ) {
          return;
        }
        state.open = true;
        markMessagesRead();
        recordChatEngagement({ proactiveInvite: false });
        if (!state.started && !needsPrechat()) startSession();
        renderBubble();
      };
    }
    var msgPreviewDismiss = document.getElementById('rz-webchat-msg-preview-dismiss');
    if (msgPreviewDismiss) {
      msgPreviewDismiss.onclick = function (e) {
        e.stopPropagation();
        state.messagePreview = null;
        renderBubble();
      };
    }
    bindPanelEvents();
    var newInput = document.getElementById('rz-webchat-input');
    if (newInput && savedInput) newInput.value = savedInput;
    var newSearch = document.getElementById('rz-chatbox-search');
    if (newSearch) {
      newSearch.value = savedSearch;
      newSearch.oninput = function () {
        state.chatBoxSearchQuery = this.value;
        if (faqBrowserEnabled() && !state.faqCatalog && !state.faqLoading) {
          loadFaqCatalog(function () {
            renderBubble();
          });
        } else {
          renderBubble();
        }
      };
    }
    scrollMessages();
    if (state.composerFocused || state.keepComposerFocus) {
      requestAnimationFrame(function () {
        restoreComposerFocus();
      });
    }
  }

  function renderFaqQuickReplies(t) {
    if (!state.config || state.config.faqInChatEnabled === false) return '';
    if (!state.config.faqQuickReplies || !state.config.faqQuickReplies.length) return '';
    if (resolvePanelMode() !== 'chat' || state.conversationStatus === 'closed') return '';
    var chips = state.config.faqQuickReplies
      .map(function (item) {
        return (
          '<button type="button" class="rz-faq-quick" data-faq-label="' +
          escHtml(item.label) +
          '" data-faq-article-id="' +
          escHtml(String(item.id)) +
          '" style="padding:6px 10px;border-radius:999px;border:1px solid ' +
          t.inputBorder +
          ';background:' +
          t.attachBg +
          ';color:' +
          t.text +
          ';font-size:12px;cursor:pointer;white-space:nowrap;">' +
          escHtml(item.label) +
          '</button>'
        );
      })
      .join('');
    return (
      '<div id="rz-webchat-faq-quick" style="flex-shrink:0;padding:8px 12px 4px;background:' +
      t.footerBg +
      ';border-top:1px solid ' +
      t.border +
      ';display:flex;flex-wrap:wrap;gap:6px;">' +
      chips +
      '</div>'
    );
  }

  function renderFaqHeaderButton() {
    if (!faqBrowserEnabled()) return '';
    var accent = primaryColor();
    return (
      '<button type="button" id="rz-webchat-faq-open" aria-label="Perguntas frequentes" title="FAQ" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid ' +
      accent +
      ';background:' +
      (isDarkTheme() ? 'rgba(0,0,0,.28)' : accent + '10') +
      ';color:' +
      accent +
      ';font-size:11px;font-weight:700;letter-spacing:.04em;cursor:pointer;">' +
      '<span style="width:18px;height:18px;border-radius:999px;border:1px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:11px;line-height:1;">?</span>FAQ</button>'
    );
  }

  function loadFaqCatalog(callback) {
    if (state.faqCatalog) {
      if (callback) callback();
      return;
    }
    state.faqLoading = true;
    state.faqError = '';
    renderBubble();
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/faq-catalog', { method: 'GET' })
      .then(function (data) {
        state.faqCatalog = data;
        state.faqLoading = false;
        if (callback) callback();
        renderBubble();
      })
      .catch(function (err) {
        state.faqLoading = false;
        state.faqError = err.message || 'Não foi possível carregar o FAQ.';
        renderBubble();
      });
  }

  function openFaqBrowser() {
    state.faqOpen = true;
    loadFaqCatalog(function () {
      renderBubble();
    });
  }

  function closeFaqBrowser() {
    state.faqOpen = false;
    renderBubble();
  }

  function flushPendingFaqPick() {
    if (!state.pendingFaqArticleId || !state.visitorToken) return;
    var id = state.pendingFaqArticleId;
    state.pendingFaqArticleId = null;
    state.faqPendingHint = false;
    pickKbArticle(id);
  }

  function openFaqArticleFromCatalog(articleId) {
    if (!articleId) return;
    state.faqOpen = false;
    if (state.started && state.visitorToken && !needsPrechat()) {
      pickKbArticle(articleId);
      return;
    }
    state.pendingFaqArticleId = articleId;
    state.faqPendingHint = true;
    if (!needsPrechat()) {
      startSessionCore();
      return;
    }
    renderBubble();
  }

  function renderFaqBrowserPanel(t) {
    var accent = primaryColor();
    var body = '';
    if (state.faqLoading) {
      body =
        '<div style="padding:24px;text-align:center;color:' +
        t.textMuted +
        ';font-size:13px;">Carregando…</div>';
    } else if (state.faqError) {
      body =
        '<div style="padding:24px;text-align:center;color:' +
        t.errorText +
        ';font-size:13px;">' +
        escHtml(state.faqError) +
        '</div>';
    } else if (!state.faqCatalog || !state.faqCatalog.categories || !state.faqCatalog.categories.length) {
      body =
        '<div style="padding:24px;text-align:center;color:' +
        t.textMuted +
        ';font-size:13px;">Nenhum artigo disponível no momento.</div>';
    } else {
      body = state.faqCatalog.categories
        .map(function (cat) {
          var items = (cat.articles || [])
            .map(function (article) {
              return (
                '<button type="button" class="rz-faq-catalog-item" data-faq-article-id="' +
                escHtml(String(article.id)) +
                '" style="display:flex;width:100%;align-items:center;gap:10px;padding:12px 14px;border:none;border-bottom:1px solid ' +
                t.border +
                ';background:transparent;color:' +
                t.text +
                ';font-size:13px;text-align:left;cursor:pointer;">' +
                '<span style="flex:1;line-height:1.35;font-weight:500;">' +
                escHtml(article.label) +
                '</span>' +
                '<span style="color:' +
                t.textMuted +
                ';font-size:16px;">›</span></button>'
              );
            })
            .join('');
          return (
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' +
            accent +
            ';padding:8px 14px 6px;">' +
            escHtml(cat.name) +
            '</div>' +
            '<div style="border:1px solid ' +
            t.border +
            ';border-radius:14px;overflow:hidden;background:' +
            (isDarkTheme() ? 'rgba(255,255,255,.03)' : '#fff') +
            ';">' +
            items +
            '</div></div>'
          );
        })
        .join('');
    }
    return (
      '<div id="rz-webchat-faq-browser" style="flex:1;min-height:0;overflow:auto;padding:12px 14px 16px;background:' +
      t.prechatBg +
      ';">' +
      '<button type="button" id="rz-webchat-faq-back" style="display:inline-flex;align-items:center;gap:6px;padding:0;border:none;background:transparent;color:' +
      accent +
      ';font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;">← Voltar</button>' +
      '<div style="font-size:17px;font-weight:700;color:' +
      t.text +
      ';margin-bottom:4px;">Perguntas frequentes</div>' +
      '<div style="font-size:12px;color:' +
      t.textMuted +
      ';margin-bottom:14px;">Escolha um tema para ver a resposta no chat.</div>' +
      body +
      '</div>'
    );
  }

  function renderConsultTicketLink(t, btnStyle, extraStyle) {
    if (!ticketLookupEnabled()) return '';
    return (
      '<button type="button" class="rz-webchat-ticket-lookup-open" style="' +
      (extraStyle || btnStyle.replace('background:' + primaryColor(), 'background:transparent;border:1px solid ' + t.inputBorder + ';color:' + t.text)) +
      '">Consultar chamado</button>'
    );
  }

  function renderTicketLookupPanel(t, inputStyle, btnStyle) {
    var step = state.ticketLookupStep;
    var title =
      step === 'token'
        ? 'Token de acesso'
        : step === 'resend'
          ? 'Reenviar token'
          : step === 'resend_otp'
            ? 'Código de verificação'
          : step === 'result'
            ? 'Chamado encontrado'
            : 'Consultar chamado';
    var body = '';
    if (step === 'ref') {
      body =
        '<p style="font-size:13px;color:' +
        t.textMuted +
        ';margin:0 0 10px;">Digite o número do seu chamado (ex.: TK-XXXXXX).</p>' +
        '<input id="rz-ticket-lookup-ref" type="text" autocomplete="off" placeholder="TK-…" value="' +
        escHtml(state.ticketLookupRef) +
        '" style="' +
        inputStyle +
        '" />' +
        '<button type="button" id="rz-ticket-lookup-next" style="' +
        btnStyle +
        '">Continuar</button>';
    } else if (step === 'token') {
      var backBtnStyle =
        btnStyle.replace('background:' + primaryColor(), 'background:transparent;border:1px solid ' + t.inputBorder + ';color:' + t.text + ';margin-top:6px;');
      var linkStyle =
        'display:block;margin-top:12px;padding:0;border:none;background:transparent;color:' +
        primaryColor() +
        ';font-size:13px;font-weight:600;cursor:pointer;text-align:center;text-decoration:underline;';
      body =
        '<p style="font-size:13px;color:' +
        t.textMuted +
        ';margin:0 0 10px;">Chamado <strong>' +
        escHtml(state.ticketLookupRef) +
        '</strong> — digite o token recebido no chat, WhatsApp ou e-mail.</p>' +
        (state.ticketLookupResendNotice
          ? '<p style="font-size:12px;color:' +
            t.text +
            ';margin:0 0 10px;padding:8px 10px;border-radius:10px;background:' +
            t.bubbleSystem +
            ';">' +
            escHtml(state.ticketLookupResendNotice) +
            '</p>'
          : '') +
        '<input id="rz-ticket-lookup-token" type="text" autocomplete="off" placeholder="XXXX-XXXX" value="' +
        escHtml(state.ticketLookupToken) +
        '" style="' +
        inputStyle +
        '" />' +
        '<button type="button" id="rz-ticket-lookup-submit" style="' +
        btnStyle +
        '">' +
        (state.ticketLookupLoading ? 'Consultando…' : 'Consultar') +
        '</button>' +
        '<button type="button" id="rz-ticket-lookup-resend-open" style="' +
        linkStyle +
        '">Perdi meu token — reenviar</button>' +
        '<button type="button" id="rz-ticket-lookup-back" style="' +
        backBtnStyle +
        '">Voltar</button>';
    } else if (step === 'resend') {
      var ch = state.ticketLookupResendChannel === 'email' ? 'email' : 'whatsapp';
      var tabStyle =
        'flex:1;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ' +
        t.inputBorder +
        ';';
      var tabActiveStyle = tabStyle + 'background:' + primaryColor() + ';color:#fff;border-color:' + primaryColor() + ';';
      var tabInactiveStyle = tabStyle + 'background:transparent;color:' + t.text + ';';
      body =
        '<p style="font-size:13px;color:' +
        t.textMuted +
        ';margin:0 0 10px;">Chamado <strong>' +
        escHtml(state.ticketLookupRef) +
        '</strong>. Enviaremos um código de verificação por ' +
        (ch === 'email' ? 'e-mail' : 'WhatsApp') +
        ' antes do novo token (o anterior deixa de valer).</p>' +
        (state.ticketLookupResendNotice
          ? '<p style="font-size:12px;color:' +
            t.text +
            ';margin:0 0 10px;padding:8px 10px;border-radius:10px;background:' +
            t.bubbleSystem +
            ';">' +
            escHtml(state.ticketLookupResendNotice) +
            '</p>'
          : '') +
        '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<button type="button" id="rz-ticket-lookup-resend-ch-wa" style="' +
        (ch === 'whatsapp' ? tabActiveStyle : tabInactiveStyle) +
        '">WhatsApp</button>' +
        '<button type="button" id="rz-ticket-lookup-resend-ch-email" style="' +
        (ch === 'email' ? tabActiveStyle : tabInactiveStyle) +
        '">E-mail</button>' +
        '</div>' +
        (ch === 'email'
          ? '<input id="rz-ticket-lookup-resend-email" type="email" autocomplete="email" placeholder="seu@email.com" value="' +
            escHtml(state.ticketLookupResendEmail) +
            '" style="' +
            inputStyle +
            '" />'
          : '<input id="rz-ticket-lookup-resend-phone" type="tel" autocomplete="tel" placeholder="DDD + número (ex.: 66996819456)" value="' +
            escHtml(state.ticketLookupResendPhone) +
            '" style="' +
            inputStyle +
            '" />') +
        '<button type="button" id="rz-ticket-lookup-resend-submit" style="' +
        btnStyle +
        '">' +
        (state.ticketLookupResendLoading ? 'Enviando…' : 'Enviar código') +
        '</button>' +
        '<button type="button" id="rz-ticket-lookup-resend-back" style="' +
        btnStyle.replace('background:' + primaryColor(), 'background:transparent;border:1px solid ' + t.inputBorder + ';color:' + t.text + ';margin-top:6px;') +
        '">Voltar</button>';
    } else if (step === 'resend_otp') {
      var chOtp = state.ticketLookupResendChannel === 'email' ? 'e-mail' : 'WhatsApp';
      body =
        '<p style="font-size:13px;color:' +
        t.textMuted +
        ';margin:0 0 10px;">Chamado <strong>' +
        escHtml(state.ticketLookupRef) +
        '</strong>. Informe o código de 6 dígitos enviado por ' +
        chOtp +
        '.</p>' +
        (state.ticketLookupResendNotice
          ? '<p style="font-size:12px;color:' +
            t.text +
            ';margin:0 0 10px;padding:8px 10px;border-radius:10px;background:' +
            t.bubbleSystem +
            ';">' +
            escHtml(state.ticketLookupResendNotice) +
            '</p>'
          : '') +
        '<input id="rz-ticket-lookup-resend-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" value="' +
        escHtml(state.ticketLookupResendOtp) +
        '" style="' +
        inputStyle +
        'letter-spacing:4px;text-align:center;font-size:18px;" />' +
        '<button type="button" id="rz-ticket-lookup-resend-confirm" style="' +
        btnStyle +
        '">' +
        (state.ticketLookupResendLoading ? 'Verificando…' : 'Confirmar e reenviar token') +
        '</button>' +
        '<button type="button" id="rz-ticket-lookup-resend-otp-back" style="' +
        btnStyle.replace('background:' + primaryColor(), 'background:transparent;border:1px solid ' + t.inputBorder + ';color:' + t.text + ';margin-top:6px;') +
        '">Solicitar novo código</button>';
    } else if (step === 'result' && state.ticketLookupResult) {
      var r = state.ticketLookupResult;
      var msgs = (r.recentMessages || [])
        .map(function (m) {
          return (
            '<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:' +
            t.bubbleSystem +
            ';font-size:13px;color:' +
            t.bubbleSystemText +
            ';white-space:pre-wrap;">' +
            escHtml(m.body) +
            '</div>'
          );
        })
        .join('');
      body =
        '<div style="font-size:13px;color:' +
        t.text +
        ';line-height:1.5;">' +
        '<div><strong>' +
        escHtml(r.ticketRef) +
        '</strong></div>' +
        '<div style="margin-top:6px;">Status: <strong>' +
        escHtml(r.statusLabel || r.status) +
        '</strong></div>' +
        (r.departmentName
          ? '<div style="margin-top:4px;color:' + t.textMuted + ';">Setor: ' + escHtml(r.departmentName) + '</div>'
          : '') +
        (r.subject
          ? '<div style="margin-top:4px;color:' + t.textMuted + ';">Assunto: ' + escHtml(r.subject) + '</div>'
          : '') +
        '<div style="margin-top:4px;color:' +
        t.textMuted +
        ';">Última atualização: ' +
        escHtml(formatTicketDate(r.updatedAt)) +
        '</div>' +
        (msgs ? '<div style="margin-top:12px;">' + msgs + '</div>' : '') +
        '</div>' +
        (r.canContinueInChat
          ? '<button type="button" id="rz-ticket-lookup-resume" style="' + btnStyle + '">Continuar atendimento</button>'
          : r.channel === 'whatsapp'
            ? '<p style="font-size:12px;color:' +
              t.textMuted +
              ';margin-top:12px;">Este chamado foi aberto pelo WhatsApp. Continue por lá ou inicie uma nova conversa.</p>'
            : '<p style="font-size:12px;color:' +
              t.textMuted +
              ';margin-top:12px;">Este chamado não pode ser retomado pelo chat no momento.</p>') +
        '<button type="button" id="rz-ticket-lookup-close" style="' +
        btnStyle.replace('background:' + primaryColor(), 'background:transparent;border:1px solid ' + t.inputBorder + ';color:' + t.text + ';margin-top:6px;') +
        '">Fechar</button>';
    }
    if (state.ticketLookupError) {
      body +=
        '<div style="font-size:12px;color:' + t.errorText + ';margin-top:8px;">' +
        escHtml(state.ticketLookupError) +
        '</div>';
    }
    return (
      '<div id="rz-webchat-ticket-lookup" style="flex:1;min-height:0;overflow:auto;padding:14px;background:' +
      t.prechatBg +
      ';">' +
      '<div style="font-size:13px;font-weight:600;color:' +
      t.text +
      ';margin-bottom:10px;">' +
      escHtml(title) +
      '</div>' +
      body +
      '</div>'
    );
  }

  function submitTicketLookupRef() {
    var input = document.getElementById('rz-ticket-lookup-ref');
    var ref = input ? String(input.value || '').trim() : state.ticketLookupRef.trim();
    if (!ref) {
      state.ticketLookupError = 'Informe o número do chamado.';
      renderBubble();
      return;
    }
    state.ticketLookupRef = ref;
    state.ticketLookupError = '';
    state.ticketLookupStep = 'token';
    renderBubble();
  }

  function submitTicketLookupResend() {
    if (state.ticketLookupResendLoading) return;
    var channel = state.ticketLookupResendChannel === 'email' ? 'email' : 'whatsapp';
    var phone = '';
    var email = '';
    if (channel === 'email') {
      var emailInput = document.getElementById('rz-ticket-lookup-resend-email');
      email = emailInput ? String(emailInput.value || '').trim() : state.ticketLookupResendEmail.trim();
      if (!email || email.indexOf('@') < 1) {
        state.ticketLookupError = 'Informe o e-mail cadastrado no chamado.';
        renderBubble();
        return;
      }
      state.ticketLookupResendEmail = email;
    } else {
      var phoneInput = document.getElementById('rz-ticket-lookup-resend-phone');
      phone = phoneInput ? String(phoneInput.value || '').trim() : state.ticketLookupResendPhone.trim();
      if (!phone || phone.replace(/\D/g, '').length < 10) {
        state.ticketLookupError = 'Informe seu WhatsApp com DDD.';
        renderBubble();
        return;
      }
      state.ticketLookupResendPhone = phone;
    }
    state.ticketLookupError = '';
    state.ticketLookupResendLoading = true;
    state.ticketLookupResendNotice = '';
    renderBubble();
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/tickets/resend-token', {
      method: 'POST',
      body: JSON.stringify({
        ticketRef: state.ticketLookupRef,
        channel: channel,
        phone: phone || undefined,
        email: email || undefined,
      }),
    })
      .then(function (result) {
        state.ticketLookupResendLoading = false;
        state.ticketLookupResendNotice =
          (result && result.message) ||
          'Se o chamado e o contato conferirem, você receberá um código em instantes.';
        state.ticketLookupStep = 'resend_otp';
        state.ticketLookupResendOtp = '';
        state.ticketLookupError = '';
        renderBubble();
      })
      .catch(function (err) {
        state.ticketLookupResendLoading = false;
        state.ticketLookupError =
          (err && err.message) || 'Não foi possível solicitar o reenvio. Tente novamente.';
        renderBubble();
      });
  }

  function submitTicketLookupResendConfirm() {
    if (state.ticketLookupResendLoading) return;
    var channel = state.ticketLookupResendChannel === 'email' ? 'email' : 'whatsapp';
    var otpInput = document.getElementById('rz-ticket-lookup-resend-otp');
    var code = otpInput
      ? String(otpInput.value || '')
          .replace(/\D/g, '')
          .slice(0, 6)
      : state.ticketLookupResendOtp.replace(/\D/g, '').slice(0, 6);
    if (!code || code.length !== 6) {
      state.ticketLookupError = 'Informe o código de 6 dígitos.';
      renderBubble();
      return;
    }
    state.ticketLookupResendOtp = code;
    state.ticketLookupError = '';
    state.ticketLookupResendLoading = true;
    renderBubble();
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/tickets/resend-token/confirm', {
      method: 'POST',
      body: JSON.stringify({
        ticketRef: state.ticketLookupRef,
        channel: channel,
        phone: channel === 'whatsapp' ? state.ticketLookupResendPhone : undefined,
        email: channel === 'email' ? state.ticketLookupResendEmail : undefined,
        verificationCode: code,
      }),
    })
      .then(function (result) {
        state.ticketLookupResendLoading = false;
        if (result && result.ok) {
          state.ticketLookupResendNotice =
            result.message ||
            'Se a verificação foi concluída, você receberá o novo token em instantes.';
          state.ticketLookupStep = 'token';
          state.ticketLookupResendOtp = '';
          state.ticketLookupError = '';
        } else {
          state.ticketLookupError =
            (result && result.message) || 'Código inválido ou expirado. Solicite um novo código.';
        }
        renderBubble();
      })
      .catch(function (err) {
        state.ticketLookupResendLoading = false;
        state.ticketLookupError =
          (err && err.message) || 'Código inválido ou expirado. Solicite um novo código.';
        renderBubble();
      });
  }

  function submitTicketLookupToken() {
    if (state.ticketLookupLoading) return;
    var input = document.getElementById('rz-ticket-lookup-token');
    var token = input ? String(input.value || '').trim().toUpperCase() : state.ticketLookupToken.trim().toUpperCase();
    if (!token) {
      state.ticketLookupError = 'Informe o token de acesso.';
      renderBubble();
      return;
    }
    state.ticketLookupToken = token;
    state.ticketLookupError = '';
    state.ticketLookupLoading = true;
    renderBubble();
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/tickets/lookup', {
      method: 'POST',
      body: JSON.stringify({ ticketRef: state.ticketLookupRef, accessToken: token }),
    })
      .then(function (result) {
        state.ticketLookupLoading = false;
        state.ticketLookupResult = result;
        state.ticketLookupStep = 'result';
        state.ticketLookupError = '';
        renderBubble();
      })
      .catch(function (err) {
        state.ticketLookupLoading = false;
        state.ticketLookupError =
          (err && err.message) ||
          'Não encontramos um chamado com esses dados. Verifique o número e o token e tente novamente.';
        renderBubble();
      });
  }

  function resumeTicketFromLookup() {
    if (state.ticketLookupLoading || !state.ticketLookupResult) return;
    state.ticketLookupLoading = true;
    state.ticketLookupError = '';
    renderBubble();
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/tickets/resume', {
      method: 'POST',
      body: JSON.stringify({
        ticketRef: state.ticketLookupRef,
        accessToken: state.ticketLookupToken,
        pageUrl: window.location.href,
        pageTitle: document.title,
      }),
    })
      .then(function (data) {
        state.ticketLookupLoading = false;
        resetTicketLookup();
        finishAgentEngageSession(data);
      })
      .catch(function (err) {
        state.ticketLookupLoading = false;
        state.ticketLookupError = (err && err.message) || 'Não foi possível retomar o atendimento.';
        renderBubble();
      });
  }

  function renderCopilotMessageRow(m, t) {
    var isInbound = m.direction === 'inbound';
    var isSystem = m.direction === 'system';
    if (isSystem) {
      return (
        '<div style="display:flex;justify-content:center;margin:12px 0;">' +
        '<div style="padding:8px 12px;border-radius:12px;background:' +
        t.bubbleSystem +
        ';color:' +
        t.bubbleSystemText +
        ';font-size:12px;text-align:center;max-width:90%;">' +
        escHtml(m.body || '') +
        '</div></div>'
      );
    }
    var senderLabel = isInbound ? visitorFirstName() || 'Você' : m.senderName || botDisplayName();
    var metaLine =
      '<div style="font-size:11px;font-weight:600;color:' +
      t.textMuted +
      ';margin-bottom:8px;line-height:1.3;">' +
      escHtml(senderLabel) +
      ' <span style="font-weight:400;">' +
      formatTime(m.createdAt) +
      '</span>' +
      (isInbound ? renderInboundReceiptTicks(m, t) : '') +
      '</div>';
    var radius = isInbound ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
    return (
      '<div style="display:flex;gap:10px;align-items:flex-end;margin:14px 0;' +
      (isInbound ? 'flex-direction:row-reverse;' : '') +
      '">' +
      copilotAvatarHtml(!isInbound, senderLabel) +
      '<div style="max-width:min(82%,320px);' +
      (isInbound ? 'display:flex;flex-direction:column;align-items:flex-end;' : '') +
      '">' +
      '<div style="padding:14px 16px;background:#fff;border-radius:' +
      radius +
      ';color:' +
      t.bubbleAgentText +
      ';font-size:14px;line-height:1.5;box-shadow:0 1px 2px rgba(0,0,0,.06),0 4px 14px rgba(0,0,0,.05);white-space:pre-wrap;word-break:break-word;">' +
      metaLine +
      renderMessageBody(m) +
      '</div></div></div>'
    );
  }

  function renderPanel() {
    var rt = chatBoxRuntime();
    maybePreloadChatBoxFaqCatalog(rt);
    var t = applyChatBoxUiPatches(ui(), rt);
    var title = (state.config && state.config.title) || 'Fale conosco';
    var subtitle = (state.config && state.config.subtitle) || '';
    var mode = resolvePanelMode();
    var prechatStep = getPrechatStep();
    var stepField = null;
    if (prechatStep) {
      var allFields = activePrechatFields();
      for (var fi = 0; fi < allFields.length; fi++) {
        if (allFields[fi].id === prechatStep) {
          stepField = allFields[fi];
          break;
        }
      }
    }
    var inputStyle =
      'width:100%;margin-top:4px;padding:10px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:8px;font-size:14px;background:' +
      t.inputBg +
      ';color:' +
      t.inputColor +
      ';';
    var btnStyle =
      'width:100%;padding:10px;border:none;border-radius:10px;background:' +
      primaryColor() +
      ';color:#fff;font-weight:600;cursor:pointer;margin-top:10px;';
    var reasonBtnStyle =
      'display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:8px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:10px;background:' +
      t.inputBg +
      ';color:' +
      t.inputColor +
      ';font-size:13px;cursor:pointer;';

    var prechatTitle = 'Antes de começar';
    var prechatBody = '';
    var formMode = isFormPrechatMode();

    if (formMode && needsPrechat()) {
      prechatTitle = 'Preencha para iniciar o atendimento';
      prechatBody = activePrechatFields()
        .map(function (field) {
          return renderPrechatFieldBlock(field, t, inputStyle, reasonBtnStyle, true);
        })
        .join('');
    } else if (stepField) {
      var isFirst = activePrechatFields()[0] && activePrechatFields()[0].id === stepField.id;
      if (isFirst && stepField.id === 'name') {
        prechatTitle = 'Olá! Estou aqui para te ajudar 😊';
      } else if (stepField.id === 'name') {
        prechatTitle = stepField.label;
      } else if (visitorFirstName()) {
        prechatTitle = 'Obrigado, ' + escHtml(visitorFirstName()) + '.';
      } else {
        prechatTitle = stepField.label;
      }

      if (stepField.type === 'select') {
        var opts = stepField.options && stepField.options.length ? stepField.options : ['Outro'];
        prechatBody =
          '<p style="font-size:13px;color:' +
          t.textMuted +
          ';margin:0 0 10px;">' +
          escHtml(stepField.label) +
          (stepField.required ? '' : ' (opcional)') +
          '</p><div id="rz-webchat-reason-list">' +
          opts
            .map(function (opt) {
              return (
                '<button type="button" class="rz-prechat-pick" data-field="' +
                escHtml(stepField.id) +
                '" data-value="' +
                escHtml(opt) +
                '" style="' +
                reasonBtnStyle +
                (state.selectOtherDraft === opt ? 'border-color:' + primaryColor() + ';' : '') +
                '">' +
                escHtml(opt) +
                '</button>'
              );
            })
            .join('') +
          '</div>' +
          (state.selectOtherDraft === 'Outro'
            ? '<label style="display:block;font-size:12px;color:' +
              t.textMuted +
              ';margin-top:4px;">Descreva brevemente' +
              '<input id="rz-prechat-other" data-field="' +
              escHtml(stepField.id) +
              '" value="' +
              escHtml(intakeValue(stepField.id)) +
              '" placeholder="Sua resposta" style="' +
              inputStyle +
              '" /></label>'
            : '');
      } else {
        var inputType = stepField.type === 'email' ? 'email' : stepField.type === 'phone' ? 'tel' : 'text';
        var optionalHint =
          !stepField.required
            ? '<p style="font-size:12px;color:' +
              t.textMuted +
              ';margin:0 0 8px;">Opcional — pode continuar em branco.</p>'
            : '';
        if (stepField.type === 'textarea') {
          prechatBody =
            optionalHint +
            renderPrechatFieldBlock(stepField, t, inputStyle, reasonBtnStyle, false);
        } else {
          prechatBody =
            optionalHint +
            '<label style="display:block;font-size:12px;color:' +
            t.textMuted +
            ';">' +
            escHtml(stepField.label) +
            (stepField.required ? ' *' : '') +
            '<input id="' +
            prechatInputId(stepField.id) +
            '" data-field="' +
            escHtml(stepField.id) +
            '" type="' +
            inputType +
            '" value="' +
            escHtml(intakeValue(stepField.id)) +
            '" placeholder="' +
            escHtml(stepField.placeholder || '') +
            '"' +
            (stepField.maxLength ? ' maxlength="' + stepField.maxLength + '"' : '') +
            ' style="' +
            inputStyle +
            '" /></label>';
        }
      }
    }

    var prechat =
      '<div id="rz-webchat-prechat" style="flex:1;min-height:0;overflow:auto;padding:14px;background:' +
      t.prechatBg +
      ';">' +
      '<div style="font-size:13px;font-weight:600;color:' +
      t.text +
      ';margin-bottom:10px;">' +
      escHtml(prechatTitle) +
      '</div>' +
      (state.faqPendingHint
        ? '<div style="font-size:12px;line-height:1.45;padding:10px 12px;border-radius:12px;margin-bottom:10px;background:' +
          primaryColor() +
          '18;color:' +
          t.text +
          ';border:1px solid ' +
          primaryColor() +
          '44;">Complete o cadastro abaixo para ver a resposta escolhida no chat.</div>'
        : '') +
      prechatBody +
      (state.prechatError
        ? '<div style="font-size:12px;color:' + t.errorText + ';margin-top:8px;">' + escHtml(state.prechatError) + '</div>'
        : '') +
      (formMode && needsPrechat()
        ? '<button type="button" id="rz-webchat-prechat-next" style="' + btnStyle + '">Iniciar conversa</button>'
        : prechatStep &&
          (!stepField ||
            stepField.type !== 'select' ||
            (stepField.type === 'select' && state.selectOtherDraft === 'Outro') ||
            !stepField.required)
          ? '<button type="button" id="rz-webchat-prechat-next" style="' + btnStyle + '">Continuar</button>'
          : '') +
      renderConsultTicketLink(
        t,
        btnStyle,
        'width:100%;padding:10px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:10px;background:transparent;color:' +
          t.text +
          ';font-weight:600;cursor:pointer;margin-top:8px;font-size:13px;'
      ) +
      '</div>';
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
      renderConsultTicketLink(
        t,
        '',
        'width:100%;padding:10px 14px;border:1px solid ' +
          t.dismissBorder +
          ';border-radius:10px;background:' +
          t.dismissBg +
          ';color:' +
          t.dismissText +
          ';font-weight:600;cursor:pointer;font-size:13px;'
      ) +
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
          (state.config.outsideHoursMessage
            ? '<div style="margin-top:4px;opacity:.9;">' +
              escHtml(state.config.outsideHoursMessage) +
              '</div>'
            : state.config.scheduleSummary
              ? '<div style="margin-top:4px;opacity:.85;">' +
                escHtml(state.config.scheduleSummary) +
                '</div>'
              : '') +
          '</div>'
        : '';

    var configErrorBanner = state.configError
      ? '<div style="padding:10px 14px;background:rgba(220,38,38,.12);border-bottom:1px solid rgba(220,38,38,.35);font-size:12px;color:#fecaca;line-height:1.45;">' +
        escHtml(state.configError) +
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
          '<div style="margin-top:4px;opacity:.9;">Você está na fila de atendimento. Assim que um atendente estiver disponível, ele continuará por aqui.</div>' +
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
        var separator =
          state.open &&
          state.firstUnreadMessageId &&
          m.id === state.firstUnreadMessageId
            ? renderNewMessageSeparator(t)
            : '';
        if (isCopilotLayout()) {
          return separator + renderCopilotMessageRow(m, t);
        }
        var isInbound = m.direction === 'inbound';
        var isSystem = m.direction === 'system';
        var align = isInbound ? 'flex-end' : 'flex-start';
        var bg = isSystem ? t.bubbleSystem : isInbound ? t.bubbleVisitor : t.bubbleAgent;
        var color = isSystem ? t.bubbleSystemText : isInbound ? t.bubbleVisitorText : t.bubbleAgentText;
        var radius = isInbound
          ? '18px 18px 4px 18px'
          : isSystem
            ? '12px'
            : '18px 18px 18px 4px';
        var meta =
          !isInbound && !isSystem && m.senderName
            ? escHtml(m.senderName) + ' · '
            : '';
        meta += formatTime(m.createdAt);
        if (isInbound) meta += renderInboundReceiptTicks(m, t);
        return (
          separator +
          '<div style="display:flex;flex-direction:column;align-items:' +
          (isInbound ? 'flex-end' : 'flex-start') +
          ';margin:10px 0;max-width:88%;' +
          (isInbound ? 'margin-left:auto;' : '') +
          '">' +
          '<div style="padding:12px 14px;border-radius:' +
          radius +
          ';background:' +
          bg +
          ';color:' +
          color +
          ';font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word;' +
          (isInbound ? 'box-shadow:0 2px 12px rgba(0,0,0,.12);' : '') +
          '">' +
          renderMessageBody(m) +
          '</div>' +
          '<div id="rz-msg-meta-' +
          escHtml(m.id) +
          '" style="font-size:10px;color:' +
          t.textMuted +
          ';margin-top:5px;padding:0 4px;display:flex;align-items:center;' +
          (isInbound ? 'justify-content:flex-end;' : '') +
          '">' +
          meta +
          '</div></div>'
        );
      })
      .join('') +
      renderChatBoxActionsBlock(t, rt) +
      renderTypingBubble(t);

    var messagesBlock =
      '<div id="rz-webchat-messages" style="flex:1;min-height:0;overflow:auto;padding:16px 14px 12px;background:' +
      t.messagesBg +
      (isDarkTheme()
        ? ';background-image:linear-gradient(rgba(34,211,238,.025) 1px, transparent 1px),linear-gradient(90deg, rgba(34,211,238,.025) 1px, transparent 1px);background-size:28px 28px;'
        : '') +
      '">' +
      messagesHtml +
      '</div>';

    var toolBtn =
      'padding:0;width:34px;height:34px;border:1px solid ' +
      t.inputBorder +
      ';border-radius:999px;background:' +
      t.attachBg +
      ';cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;color:' +
      t.textMuted +
      ';';

    var composer =
      '<div style="flex-shrink:0;padding:10px 12px 6px;background:' +
      t.footerBg +
      ';border-top:1px solid ' +
      t.border +
      ';position:relative;">' +
      renderEmojiPicker(t) +
      (state.sendError
        ? '<div style="font-size:12px;color:' +
          t.errorText +
          ';margin-bottom:8px;line-height:1.4;padding:8px 10px;border-radius:10px;background:' +
          (isDarkTheme() ? 'rgba(248,113,113,.12)' : 'rgba(220,38,38,.08)') +
          ';border:1px solid ' +
          (isDarkTheme() ? 'rgba(248,113,113,.35)' : 'rgba(220,38,38,.25)') +
          ';">' +
          escHtml(state.sendError) +
          '</div>'
        : '') +
      '<form id="rz-webchat-form">' +
      '<input type="file" id="rz-webchat-file" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none;" />' +
      '<div style="border:1px solid ' +
      t.inputBorder +
      ';border-radius:18px;background:' +
      t.inputBg +
      ';padding:10px 12px 8px;">' +
      '<textarea id="rz-webchat-input" rows="1" placeholder="' +
      chatBoxInputPlaceholder(rt) +
      '" autocomplete="off" style="width:100%;min-height:22px;max-height:120px;padding:0;border:none;font-size:14px;line-height:1.45;background:transparent;color:' +
      t.inputColor +
      ';outline:none;resize:none;font-family:inherit;"></textarea>' +
      '<div style="display:flex;align-items:center;margin-top:8px;gap:8px;">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
      '<button type="button" id="rz-webchat-attach" title="Anexar arquivo" style="' +
      toolBtn +
      '">+</button>' +
      '<button type="button" id="rz-webchat-emoji" title="Emojis" aria-expanded="' +
      (state.emojiPickerOpen ? 'true' : 'false') +
      '" style="' +
      toolBtn +
      '">😊</button>' +
      '</div>' +
      '<div style="flex:1;min-width:8px;"></div>' +
      '<button type="submit" id="rz-webchat-send" title="Enviar" style="flex-shrink:0;width:38px;height:38px;border:none;border-radius:999px;background:' +
      primaryColor() +
      ';color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18);">↑</button>' +
      '</div></div></form>' +
      '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:8px;padding:0 4px;min-height:28px;">' +
      (state.endConfirmOpen
        ? '<span style="font-size:11px;color:' +
          t.textMuted +
          ';white-space:nowrap;">Encerrar atendimento?</span>' +
          '<button type="button" id="rz-webchat-end-confirm-yes" style="padding:5px 12px;border:none;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Sim</button>' +
          '<button type="button" id="rz-webchat-end-confirm-no" style="padding:5px 12px;border:1px solid ' +
          t.inputBorder +
          ';border-radius:999px;background:' +
          t.attachBg +
          ';color:' +
          t.text +
          ';font-size:11px;cursor:pointer;white-space:nowrap;">Não</button>'
        : '<button type="button" id="rz-webchat-end" style="padding:6px 8px;border:none;background:transparent;color:' +
          t.textMuted +
          ';font-size:11px;line-height:1.3;cursor:pointer;text-decoration:underline;">Encerrar atendimento</button>') +
      '</div></div>';

    var pocketTab = rt && rt.bottomNav ? chatBoxPocketTab() : 'chat';
    var panelBody = '';
    if (mode === 'faq') {
      panelBody = renderFaqBrowserPanel(t);
    } else if (mode === 'ticket_lookup' || mode === 'ticket_result') {
      panelBody = configErrorBanner + offlineBanner + renderTicketLookupPanel(t, inputStyle, btnStyle);
    } else if (mode === 'prechat') {
      panelBody = configErrorBanner + offlineBanner + prechat;
    } else if (mode === 'closed') {
      panelBody = messagesBlock + closedFooter;
    } else if (rt && rt.bottomNav && pocketTab === 'home') {
      panelBody = configErrorBanner + offlineBanner + renderChatBoxPocketHome(t, rt);
    } else if (rt && rt.bottomNav && pocketTab === 'help') {
      panelBody = configErrorBanner + offlineBanner + renderChatBoxPocketHelp(t, rt);
    } else {
      panelBody = configErrorBanner + offlineBanner + queueBanner + messagesBlock + renderFaqQuickReplies(t) + composer;
    }

    var panelRadius = rt && rt.radius ? String(rt.radius) + 'px' : isCopilotLayout() ? '16px' : '20px';
    var glassStyle = rt && rt.glass ? 'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);' : '';
    var chatBoxId = chatBoxModelId();
    var headerBlock = isCopilotLayout()
      ? renderCopilotHeader(title, subtitle, t)
      : rt
        ? renderChatBoxHeader(title, subtitle, t, rt)
        : '<div style="flex-shrink:0;background:' +
        (isDarkTheme() ? t.headerBg : '#fff') +
        ';color:' +
        (isDarkTheme() ? '#fff' : t.text) +
        ';border-bottom:1px solid ' +
        t.border +
        ';">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 0;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button type="button" id="rz-webchat-expand" aria-label="' +
        (state.expanded ? 'Reduzir janela' : 'Expandir janela') +
        '" title="' +
        (state.expanded ? 'Reduzir janela' : 'Expandir janela') +
        '" style="' +
        headerIconBtn(isDarkTheme() ? '' : 'border-color:' + t.inputBorder + ';background:' + t.attachBg + ';color:' + t.text + ';') +
        '">' +
        (state.expanded ? '⤡' : '⤢') +
        '</button>' +
        '<button type="button" id="rz-webchat-sound" aria-label="' +
        (state.soundEnabled ? 'Desativar som de notificação' : 'Ativar som de notificação') +
        '" title="' +
        (state.soundEnabled ? 'Som ligado' : 'Som desligado') +
        '" style="' +
        headerIconBtn(isDarkTheme() ? '' : 'border-color:' + t.inputBorder + ';background:' + t.attachBg + ';color:' + t.text + ';') +
        '">' +
        (state.soundEnabled ? '🔔' : '🔕') +
        '</button></div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        renderFaqHeaderButton() +
        '<button type="button" id="rz-webchat-close" aria-label="Fechar chat" title="Fechar" style="' +
        headerIconBtn(isDarkTheme() ? '' : 'border-color:' + t.inputBorder + ';background:' + t.attachBg + ';color:' + t.text + ';') +
        '">×</button></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 16px 14px;gap:6px;">' +
        '<div style="width:44px;height:44px;border-radius:999px;background:' +
        (isDarkTheme() ? 'rgba(255,255,255,.16)' : primaryColor() + '18') +
        ';border:1px solid ' +
        (isDarkTheme() ? 'rgba(255,255,255,.2)' : t.inputBorder) +
        ';display:flex;align-items:center;justify-content:center;font-size:20px;color:' +
        (isDarkTheme() ? '#fff' : primaryColor()) +
        ';">💬</div>' +
        '<div style="font-weight:700;font-size:15px;line-height:1.2;">' +
        escHtml(title) +
        '</div>' +
        (subtitle
          ? '<div style="font-size:12px;opacity:.82;line-height:1.35;">' + escHtml(subtitle) + '</div>'
          : '<div style="font-size:12px;opacity:.72;">Assistente virtual</div>') +
        (visitorLabel && mode === 'chat'
          ? '<div style="font-size:11px;opacity:.7;">' + visitorLabel + '</div>'
          : '') +
        '</div></div>';

    return (
      '<div id="rz-webchat-panel" data-rz-mode="' +
      mode +
      '" data-rz-theme="' +
      (isCopilotLayout() ? 'copilot' : isDarkTheme() ? 'dark' : 'light') +
      '" data-rz-layout="' +
      (isCopilotLayout() ? 'copilot' : chatBoxId ? 'chatbox-' + chatBoxId : 'classic') +
      '" data-rz-build="' +
      WIDGET_BUILD +
      '" style="' +
      panelSizeStyle() +
      ';margin-bottom:12px;background:' +
      t.panelBg +
      ';border:' +
      t.panelBorder +
      ';border-radius:' +
      panelRadius +
      ';box-shadow:' +
      t.panelShadow +
      ';' +
      (glassStyle ? glassStyle + ';' : '') +
      'display:flex;flex-direction:column;overflow:hidden;font-family:' +
      t.font +
      ';">' +
      headerBlock +
      panelBody +
      (rt && rt.bottomNav && mode === 'chat' ? renderChatBoxBottomNav(t) : '') +
      (rt && rt.footer ? renderChatBoxFooterNote(t, rt.footer) : '') +
      renderPoweredBy(t) +
      '</div>'
    );
  }

  function scrollMessages() {
    var el = document.getElementById('rz-webchat-messages');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (state.open && isMessagesAtBottom()) markMessagesRead();
  }

  function closeConversationByVisitor() {
    if (!state.visitorToken || state.conversationStatus === 'closed' || state.closingConversation) return;
    state.endConfirmOpen = false;
    state.closingConversation = true;
    renderBubble();
    apiFetch(baseUrl, '/sessions/close', {
      method: 'POST',
      headers: { 'X-WebChat-Visitor': state.visitorToken },
      body: JSON.stringify({}),
    })
      .then(function () {
        state.closingConversation = false;
        markConversationClosed();
        var exists = state.messages.some(function (m) {
          return m.direction === 'system' && isClosedSystemMessage(m);
        });
        if (!exists) {
          state.messages.push({
            id: 'local-close-' + Date.now(),
            direction: 'system',
            body: 'Atendimento encerrado. Obrigado pelo contato!',
            createdAt: new Date().toISOString(),
          });
        }
        renderBubble();
        sendPresencePing();
      })
      .catch(function (err) {
        state.closingConversation = false;
        if (String(err.message).toLowerCase().indexOf('encerr') >= 0) {
          markConversationClosed();
        }
        renderBubble();
      });
  }

  function bindPanelEvents() {
    var lookupOpenBtns = document.getElementsByClassName('rz-webchat-ticket-lookup-open');
    for (var li = 0; li < lookupOpenBtns.length; li++) {
      lookupOpenBtns[li].onclick = function () {
        resetTicketLookup();
        state.ticketLookupStep = 'ref';
        renderBubble();
      };
    }
    var ticketLookupNext = document.getElementById('rz-ticket-lookup-next');
    if (ticketLookupNext) {
      ticketLookupNext.onclick = function () {
        submitTicketLookupRef();
      };
    }
    var ticketLookupSubmit = document.getElementById('rz-ticket-lookup-submit');
    if (ticketLookupSubmit) {
      ticketLookupSubmit.onclick = function () {
        submitTicketLookupToken();
      };
      ticketLookupSubmit.disabled = !!state.ticketLookupLoading;
    }
    var ticketLookupBack = document.getElementById('rz-ticket-lookup-back');
    if (ticketLookupBack) {
      ticketLookupBack.onclick = function () {
        state.ticketLookupStep = 'ref';
        state.ticketLookupError = '';
        state.ticketLookupResendNotice = '';
        renderBubble();
      };
    }
    var ticketLookupResendOpen = document.getElementById('rz-ticket-lookup-resend-open');
    if (ticketLookupResendOpen) {
      ticketLookupResendOpen.onclick = function () {
        state.ticketLookupStep = 'resend';
        state.ticketLookupError = '';
        if (!state.ticketLookupResendPhone && state.visitorIntake && state.visitorIntake.phone) {
          state.ticketLookupResendPhone = state.visitorIntake.phone;
        }
        if (!state.ticketLookupResendEmail && state.visitorIntake && state.visitorIntake.email) {
          state.ticketLookupResendEmail = state.visitorIntake.email;
        }
        renderBubble();
      };
    }
    var ticketLookupResendChWa = document.getElementById('rz-ticket-lookup-resend-ch-wa');
    if (ticketLookupResendChWa) {
      ticketLookupResendChWa.onclick = function () {
        state.ticketLookupResendChannel = 'whatsapp';
        state.ticketLookupError = '';
        renderBubble();
      };
    }
    var ticketLookupResendChEmail = document.getElementById('rz-ticket-lookup-resend-ch-email');
    if (ticketLookupResendChEmail) {
      ticketLookupResendChEmail.onclick = function () {
        state.ticketLookupResendChannel = 'email';
        state.ticketLookupError = '';
        renderBubble();
      };
    }
    var ticketLookupResendSubmit = document.getElementById('rz-ticket-lookup-resend-submit');
    if (ticketLookupResendSubmit) {
      ticketLookupResendSubmit.onclick = function () {
        submitTicketLookupResend();
      };
      ticketLookupResendSubmit.disabled = !!state.ticketLookupResendLoading;
    }
    var ticketLookupResendBack = document.getElementById('rz-ticket-lookup-resend-back');
    if (ticketLookupResendBack) {
      ticketLookupResendBack.onclick = function () {
        state.ticketLookupStep = 'token';
        state.ticketLookupError = '';
        renderBubble();
      };
    }
    var ticketLookupResendConfirm = document.getElementById('rz-ticket-lookup-resend-confirm');
    if (ticketLookupResendConfirm) {
      ticketLookupResendConfirm.onclick = function () {
        submitTicketLookupResendConfirm();
      };
      ticketLookupResendConfirm.disabled = !!state.ticketLookupResendLoading;
    }
    var ticketLookupResendOtpBack = document.getElementById('rz-ticket-lookup-resend-otp-back');
    if (ticketLookupResendOtpBack) {
      ticketLookupResendOtpBack.onclick = function () {
        state.ticketLookupStep = 'resend';
        state.ticketLookupResendOtp = '';
        state.ticketLookupError = '';
        renderBubble();
      };
    }
    var ticketLookupResume = document.getElementById('rz-ticket-lookup-resume');
    if (ticketLookupResume) {
      ticketLookupResume.onclick = function () {
        resumeTicketFromLookup();
      };
      ticketLookupResume.disabled = !!state.ticketLookupLoading;
    }
    var ticketLookupClose = document.getElementById('rz-ticket-lookup-close');
    if (ticketLookupClose) {
      ticketLookupClose.onclick = function () {
        resetTicketLookup();
        renderBubble();
      };
    }
    var ticketRefInput = document.getElementById('rz-ticket-lookup-ref');
    if (ticketRefInput) {
      ticketRefInput.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTicketLookupRef();
        }
      };
    }
    var ticketTokenInput = document.getElementById('rz-ticket-lookup-token');
    if (ticketTokenInput) {
      ticketTokenInput.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTicketLookupToken();
        }
      };
    }
    var faqOpenBtn = document.getElementById('rz-webchat-faq-open');
    if (faqOpenBtn) {
      faqOpenBtn.onclick = function () {
        openFaqBrowser();
      };
    }
    var faqBackBtn = document.getElementById('rz-webchat-faq-back');
    if (faqBackBtn) {
      faqBackBtn.onclick = function () {
        closeFaqBrowser();
      };
    }
    var faqCatalogItems = document.getElementsByClassName('rz-faq-catalog-item');
    for (var fc = 0; fc < faqCatalogItems.length; fc++) {
      faqCatalogItems[fc].onclick = function () {
        var articleId = this.getAttribute('data-faq-article-id') || '';
        openFaqArticleFromCatalog(articleId);
      };
    }
    var faqQuickBtns = document.getElementsByClassName('rz-faq-quick');
    for (var fq = 0; fq < faqQuickBtns.length; fq++) {
      faqQuickBtns[fq].onclick = function () {
        var label = this.getAttribute('data-faq-label') || '';
        var articleId = this.getAttribute('data-faq-article-id') || '';
        if (articleId && faqBrowserEnabled()) {
          if (!state.started || !state.visitorToken) {
            state.open = true;
            if (!state.started && !needsPrechat()) startSession();
            setTimeout(function () {
              openFaqArticleFromCatalog(articleId);
            }, state.started ? 0 : 600);
            return;
          }
          openFaqArticleFromCatalog(articleId);
          return;
        }
        if (!label) return;
        if (!state.started || !state.visitorToken) {
          state.open = true;
          if (!state.started && !needsPrechat()) startSession();
          setTimeout(function () {
            sendMessageWithText(label);
          }, state.started ? 0 : 600);
          return;
        }
        sendMessageWithText(label);
      };
    }

    var chatBoxNavBtns = document.getElementsByClassName('rz-chatbox-nav');
    for (var cn = 0; cn < chatBoxNavBtns.length; cn++) {
      chatBoxNavBtns[cn].onclick = function () {
        var tab = this.getAttribute('data-tab') || 'chat';
        state.chatBoxPocketTab = tab;
        renderBubble();
      };
    }
    var chatBoxPickBtns = document.getElementsByClassName('rz-chatbox-pick');
    for (var cp = 0; cp < chatBoxPickBtns.length; cp++) {
      chatBoxPickBtns[cp].onclick = function () {
        var text = this.getAttribute('data-text') || '';
        var articleId = this.getAttribute('data-faq-article-id') || '';
        handleChatBoxPick(text, articleId);
      };
    }
    var faqOpenHelp = document.getElementById('rz-webchat-faq-open-help');
    if (faqOpenHelp) {
      faqOpenHelp.onclick = function () {
        openFaqBrowser();
      };
    }

    var kbPickBtns = document.getElementsByClassName('rz-kb-pick');
    for (var kb = 0; kb < kbPickBtns.length; kb++) {
      kbPickBtns[kb].onclick = function () {
        var articleId = this.getAttribute('data-kb-id') || '';
        if (!articleId || state.sending || !state.visitorToken) return;
        pickKbArticle(articleId);
      };
    }

    var prechatNext = document.getElementById('rz-webchat-prechat-next');
    if (prechatNext) {
      prechatNext.onclick = function () {
        advancePrechatStep();
      };
    }
    var reasonPicks = document.getElementsByClassName('rz-prechat-pick');
    for (var ri = 0; ri < reasonPicks.length; ri++) {
      reasonPicks[ri].onclick = function () {
        var fieldId = this.getAttribute('data-field') || '';
        var value = this.getAttribute('data-value') || '';
        state.selectOtherDraft = value;
        if (value !== 'Outro') {
          state.visitorIntake[fieldId] = value;
          state.selectOtherDraft = '';
          advancePrechatStep();
        } else {
          renderBubble();
        }
      };
    }
    var newBtn = document.getElementById('rz-webchat-new');
    if (newBtn) {
      newBtn.onclick = function () {
        startNewConversation();
      };
    }
    var endBtn = document.getElementById('rz-webchat-end');
    if (endBtn) {
      endBtn.onclick = function () {
        state.endConfirmOpen = true;
        state.emojiPickerOpen = false;
        renderBubble();
      };
    }
    var endConfirmYes = document.getElementById('rz-webchat-end-confirm-yes');
    if (endConfirmYes) {
      endConfirmYes.onclick = function () {
        closeConversationByVisitor();
      };
      endConfirmYes.disabled = !!state.closingConversation;
      endConfirmYes.style.opacity = state.closingConversation ? '0.6' : '1';
      if (state.closingConversation) endConfirmYes.textContent = '…';
    }
    var endConfirmNo = document.getElementById('rz-webchat-end-confirm-no');
    if (endConfirmNo) {
      endConfirmNo.onclick = function () {
        state.endConfirmOpen = false;
        renderBubble();
      };
      endConfirmNo.disabled = !!state.closingConversation;
    }
    var closeBtn = document.getElementById('rz-webchat-close');
    if (closeBtn) {
      closeBtn.onclick = function () {
        state.open = false;
        state.emojiPickerOpen = false;
        state.expanded = false;
        renderBubble();
      };
    }
    var expandBtn = document.getElementById('rz-webchat-expand');
    if (expandBtn) {
      expandBtn.onclick = function () {
        state.expanded = !state.expanded;
        renderBubble();
      };
    }
    var soundBtn = document.getElementById('rz-webchat-sound');
    if (soundBtn) {
      soundBtn.onclick = function () {
        state.userHasInteracted = true;
        state.soundEnabled = !state.soundEnabled;
        writeSoundPref(state.soundEnabled);
        if (state.soundEnabled) playNotifyChime();
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
    var chatInput = document.getElementById('rz-webchat-input');
    if (chatInput) {
      chatInput.onfocus = function () {
        state.composerFocused = true;
      };
      chatInput.onblur = function () {
        var panel = document.getElementById('rz-webchat-panel');
        window.setTimeout(function () {
          if (state.keepComposerFocus) return;
          var active = document.activeElement;
          if (active && active.id === 'rz-webchat-input') return;
          if (panel && active && panel.contains(active)) return;
          state.composerFocused = false;
          state.composerSelection = null;
        }, 120);
      };
      chatInput.onkeydown = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      };
      chatInput.oninput = function () {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        if (chatInput.value.trim()) {
          scheduleVisitorTypingPulse();
        } else {
          emitVisitorTyping(false);
        }
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
    var emojiBtn = document.getElementById('rz-webchat-emoji');
    if (emojiBtn) {
      emojiBtn.onclick = function (e) {
        e.preventDefault();
        state.emojiPickerOpen = !state.emojiPickerOpen;
        renderBubble();
      };
    }
    var emojiPicks = document.getElementsByClassName('rz-emoji-pick');
    for (var ei = 0; ei < emojiPicks.length; ei++) {
      emojiPicks[ei].onclick = function (e) {
        e.preventDefault();
        var em = this.getAttribute('data-emoji') || '';
        var input = document.getElementById('rz-webchat-input');
        insertAtCursor(input, em);
        if (input && input.oninput) input.oninput();
      };
    }
    var messagesScroll = document.getElementById('rz-webchat-messages');
    if (messagesScroll) {
      messagesScroll.onscroll = function () {
        if (state.open && isMessagesAtBottom()) markMessagesRead();
      };
    }
  }

  function finishAgentEngageSession(data) {
    applySessionData(data);
    state.skipPrechat = true;
    state.conversationStatus = 'open';
    state.started = true;
    if (data.visitorToken) {
      state.visitorToken = data.visitorToken;
      state.conversationId = data.conversationId || state.conversationId;
      writeStore({ visitorToken: state.visitorToken, conversationId: state.conversationId });
    }
    connectSocket();
    renderBubble();
    sendPresencePing();
    setTimeout(function () {
      scrollMessages();
    }, 0);
  }

  function resumeEngageSession() {
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/sessions', {
      method: 'POST',
      body: JSON.stringify({
        visitorToken: state.visitorToken,
        visitorName: state.visitorName || undefined,
        visitorEmail: state.visitorEmail || undefined,
        pageUrl: window.location.href,
      }),
    })
      .then(function (data) {
        finishAgentEngageSession(data);
      })
      .catch(function () {
        connectSocket({ presenceOnly: true });
        renderBubble();
      });
  }

  function handleAgentEngage(payload) {
    if (!payload || !payload.conversationId) return;
    state.skipPrechat = payload.skipPrechat !== false;
    state.open = true;
    markMessagesRead();
    state.chatEverOpened = true;
    state.proactiveTeaser = null;
    state.started = true;
    state.conversationStatus = 'open';
    state.messages = [];
    if (payload.visitorToken) {
      state.visitorToken = payload.visitorToken;
      state.conversationId = payload.conversationId;
      writeStore({ visitorToken: state.visitorToken, conversationId: state.conversationId });
    } else {
      state.conversationId = payload.conversationId;
    }
    writePresenceEngagement({ chatEverOpened: true });
    renderBubble();
    if (state.visitorToken) {
      apiFetch(baseUrl, '/sessions/messages', {
        method: 'GET',
        headers: { 'X-WebChat-Visitor': state.visitorToken },
      })
        .then(function (data) {
          if (!data || data.status === 'closed') {
            state.visitorToken = payload.visitorToken || state.visitorToken;
            state.conversationId = payload.conversationId;
            state.conversationStatus = 'open';
            state.skipPrechat = true;
            state.started = true;
            if (payload.visitorToken) {
              writeStore({ visitorToken: payload.visitorToken, conversationId: payload.conversationId });
            }
            connectSocket();
            renderBubble();
            sendPresencePing();
            return;
          }
          finishAgentEngageSession(data);
        })
        .catch(function () {
          resumeEngageSession();
        });
    } else {
      resumeEngageSession();
    }
  }

  function connectSocket(opts) {
    opts = opts || {};
    loadSocketIo(baseUrl, function (io) {
      if (!io) return;
      if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
      }
      var auth = {
        webchatPresenceId: ensurePresenceId(),
        webchatPublicKey: widgetKey,
      };
      if (state.socketPresenceAuth) auth.webchatPresenceAuth = state.socketPresenceAuth;
      if (state.visitorToken && !opts.presenceOnly) {
        auth.webchatVisitorToken = state.visitorToken;
      }
      state.socket = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: auth,
      });
      state.socket.on('webchat:agent-engage', handleAgentEngage);
      state.socket.on('connect_error', function () {
        if (!opts.presenceOnly && state.visitorToken) {
          connectSocket({ presenceOnly: true });
        }
      });
      if (!state.visitorToken || opts.presenceOnly) return;
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
          if (payload.message.direction === 'outbound') {
            clearRemoteTyping();
            handleNewOutboundMessage(payload.message);
            scheduleAckOutboundReceipts(state.open && isMessagesAtBottom());
          }
          state.messages.push(payload.message);
          renderBubble();
        } else if (payload.message.direction === 'inbound') {
          var existing = state.messages.find(function (m) {
            return m.id === payload.message.id;
          });
          if (existing) {
            if (payload.message.deliveredAt) existing.deliveredAt = payload.message.deliveredAt;
            if (payload.message.readAt) existing.readAt = payload.message.readAt;
          }
          patchInboundReceiptMeta();
        }
      });
      state.socket.on('webchat:message-receipt', function (payload) {
        if (!payload) return;
        if (payload.conversationId && state.conversationId && payload.conversationId !== state.conversationId) {
          return;
        }
        applyMessageReceiptPayload(payload);
      });
      state.socket.on('webchat:typing', handleRemoteTyping);
      state.socket.on('webchat:conversation', function (payload) {
        if (!payload || !payload.conversation) return;
        applyConversationMeta(payload.conversation);
        if (payload.conversation.status === 'closed') {
          markConversationClosed();
          renderBubble();
        } else if (payload.conversation.status === 'open') {
          state.conversationStatus = 'open';
          if (!state.socket || !state.socket.connected) {
            connectSocket();
          }
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
    state.visitorName = '';
    state.visitorEmail = '';
    state.visitorIntake = {};
    state.prechatSkippedOptional = {};
    state.selectOtherDraft = '';
    state.endConfirmOpen = false;
    state.closingConversation = false;
    state.unreadCount = 0;
    state.firstUnreadMessageId = null;
    state.messagePreview = null;
    state.chatBoxPocketTab = 'home';
    state.chatBoxSearchQuery = '';
    writeStore({ visitorToken: null, conversationId: null });
    renderBubble();
    if (!needsPrechat()) {
      startSession();
    }
  }

  function readFieldValueFromDom(field) {
    var el = document.getElementById(prechatInputId(field.id));
    return el ? String(el.value || '').trim() : intakeValue(field.id);
  }

  function validateFieldValue(field, val) {
    if (!val) {
      if (field.required) return 'Preencha "' + field.label + '" para continuar.';
      return null;
    }
    if (field.type === 'phone' && !isValidPhone(val)) {
      return 'Informe um telefone válido em "' + field.label + '".';
    }
    if (field.type === 'email' && !isValidEmail(val)) {
      return 'Informe um e-mail válido em "' + field.label + '".';
    }
    if (field.maxLength && val.length > field.maxLength) {
      return '"' + field.label + '" deve ter no máximo ' + field.maxLength + ' caracteres.';
    }
    return null;
  }

  function advancePrechatForm() {
    state.prechatError = '';
    var fields = activePrechatFields();
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var val = readFieldValueFromDom(f);
      var err = validateFieldValue(f, val);
      if (err) {
        state.prechatError = err;
        renderBubble();
        return;
      }
      if (val) state.visitorIntake[f.id] = val;
      else delete state.visitorIntake[f.id];
    }
    syncLegacyFromIntake();
    startSessionCore();
  }

  function advancePrechatStep() {
    if (isFormPrechatMode()) {
      advancePrechatForm();
      return;
    }
    state.prechatError = '';
    var stepId = getPrechatStep();
    if (!stepId) {
      startSessionCore();
      return;
    }

    var stepField = null;
    var fields = activePrechatFields();
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].id === stepId) {
        stepField = fields[i];
        break;
      }
    }
    if (!stepField) {
      startSessionCore();
      return;
    }

    if (stepField.type === 'select') {
      if (state.selectOtherDraft === 'Outro') {
        var otherEl = document.getElementById('rz-prechat-other');
        if (!otherEl || !otherEl.value.trim()) {
          state.prechatError = 'Descreva brevemente para continuar.';
          renderBubble();
          return;
        }
        state.visitorIntake[stepField.id] = otherEl.value.trim();
        state.selectOtherDraft = '';
      } else if (!intakeValue(stepField.id)) {
        state.prechatError = 'Escolha uma opção para continuar.';
        renderBubble();
        return;
      }
    } else {
      var val = readFieldValueFromDom(stepField);
      if (!val) {
        if (stepField.required) {
          state.prechatError = 'Preencha este campo para continuar.';
          renderBubble();
          return;
        }
        state.prechatSkippedOptional[stepField.id] = true;
      } else {
        if (stepField.type === 'phone' && !isValidPhone(val)) {
          state.prechatError = 'Informe um telefone válido (com DDD).';
          renderBubble();
          return;
        }
        if (stepField.type === 'email' && !isValidEmail(val)) {
          state.prechatError = 'Informe um e-mail válido.';
          renderBubble();
          return;
        }
        if (stepField.maxLength && val.length > stepField.maxLength) {
          state.prechatError = 'Máximo de ' + stepField.maxLength + ' caracteres.';
          renderBubble();
          return;
        }
        state.visitorIntake[stepField.id] = val;
      }
    }

    syncLegacyFromIntake();

    if (needsPrechat()) {
      renderBubble();
      return;
    }
    startSessionCore();
  }

  function startSessionCore() {
    syncLegacyFromIntake();
    var body = {
      visitorToken: state.visitorToken,
      visitorIntake: state.visitorIntake,
      visitorName: state.visitorIntake.name || state.visitorName || undefined,
      visitorEmail: state.visitorIntake.email || state.visitorEmail || undefined,
      visitorPhone: state.visitorIntake.phone || undefined,
      contactReason: state.visitorIntake.contact_reason || undefined,
      pageUrl: window.location.href,
      pageTitle: document.title || '',
    };
    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then(function (data) {
        applySessionData(data);
        state.started = true;
        state.selectOtherDraft = '';
        state.prechatSkippedOptional = {};
        writeStore({ visitorToken: state.visitorToken, conversationId: state.conversationId });
        connectSocket();
        renderBubble();
        if (state.open) {
          setTimeout(function () {
            scheduleAckOutboundReceipts(isMessagesAtBottom());
          }, 100);
        }
        flushPendingFaqPick();
      })
      .catch(function (err) {
        console.error('[Radar Chat WebChat]', err.message);
        state.prechatError =
          err.message || 'Não foi possível iniciar a conversa. Tente novamente.';
        renderBubble();
      });
  }

  function startSession() {
    if (needsPrechat()) {
      advancePrechatStep();
      return;
    }
    startSessionCore();
  }

  function pickKbArticle(articleId) {
    if (!articleId || state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    state.sending = true;
    apiFetch(baseUrl, '/sessions/faq-pick', {
      method: 'POST',
      headers: {
        'X-WebChat-Visitor': state.visitorToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ articleId: articleId }),
    })
      .then(function (data) {
        if (data.message) pushChatMessages([data.message]);
        patchInboundReceiptMeta();
        renderBubble();
      })
      .catch(function (err) {
        console.error('[Radar Chat WebChat]', err.message);
      })
      .finally(function () {
        state.sending = false;
      });
  }

  function sendMessageWithText(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed || state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    state.chatBoxPocketTab = 'chat';
    state.keepComposerFocus = true;
    clearProactiveTimer();
    state.proactiveTeaser = null;
    state.sending = true;
    state.emojiPickerOpen = false;
    state.sendError = '';
    apiFetch(baseUrl, '/messages', {
      method: 'POST',
      headers: { 'X-WebChat-Visitor': state.visitorToken },
      body: JSON.stringify({ body: trimmed }),
    })
      .then(function (data) {
        state.sendError = '';
        if (data.message) pushChatMessages([data.message]);
        if (data.replies && data.replies.length) pushChatMessages(data.replies);
        patchInboundReceiptMeta();
        renderBubble();
      })
      .catch(function (err) {
        console.error('[Radar Chat WebChat]', err.message);
        handleSendFailure(err);
      })
      .finally(function () {
        state.sending = false;
      });
  }

  function sendMessage() {
    if (state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    state.chatBoxPocketTab = 'chat';
    state.keepComposerFocus = true;
    var input = document.getElementById('rz-webchat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    var draft = text;
    input.value = '';
    input.style.height = 'auto';
    emitVisitorTyping(false);
    state.sending = true;
    state.emojiPickerOpen = false;
    state.sendError = '';
    apiFetch(baseUrl, '/messages', {
      method: 'POST',
      headers: { 'X-WebChat-Visitor': state.visitorToken },
      body: JSON.stringify({ body: draft }),
    })
      .then(function (data) {
        state.sendError = '';
        if (data.message) pushChatMessages([data.message]);
        if (data.replies && data.replies.length) pushChatMessages(data.replies);
        patchInboundReceiptMeta();
        renderBubble();
      })
      .catch(function (err) {
        console.error('[Radar Chat WebChat]', err.message);
        handleSendFailure(err, draft);
      })
      .finally(function () {
        state.sending = false;
      });
  }

  function sendAttachment(file) {
    if (state.sending || !state.visitorToken || state.conversationStatus === 'closed') return;
    if (!file || file.size > 5 * 1024 * 1024) {
      console.error('[Radar Chat WebChat]', 'Imagem muito grande (máx. 5 MB)');
      return;
    }
    var allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.indexOf(file.type) < 0) {
      console.error('[Radar Chat WebChat]', 'Tipo de arquivo não permitido');
      return;
    }
    state.keepComposerFocus = true;
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
          console.error('[Radar Chat WebChat]', err.message);
          handleSendFailure(err);
        })
        .finally(function () {
          state.sending = false;
        });
    };
    reader.onerror = function () {
      state.sending = false;
      console.error('[Radar Chat WebChat]', 'Falha ao ler arquivo');
    };
    reader.readAsDataURL(file);
  }

  document.addEventListener('visibilitychange', function () {
    updateTabTitle();
    if (document.visibilityState !== 'visible' || !state.config) return;
    refreshWidgetConfig().then(function (changed) {
      if (changed) {
        applyRootPosition();
        renderBubble();
      }
    });
  });

  root.addEventListener('click', function () {
    state.userHasInteracted = true;
  });

    apiFetch(baseUrl, '/widgets/' + encodeURIComponent(widgetKey) + '/config', { method: 'GET' })
    .then(function (config) {
      state.config = config;
      state.configError = '';
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
          if (state.open && state.messages.length) {
            setTimeout(function () {
              scheduleAckOutboundReceipts(isMessagesAtBottom());
            }, 150);
          }
        });
      }
    })
    .catch(function (err) {
      console.error('[Radar Chat WebChat]', err.message);
      state.configError = err.message || 'Falha ao carregar configuração do widget.';
    })
    .finally(function () {
      syncPresenceEngagementFromStore();
      state.notificationsReady = true;
      renderBubble();
      scheduleProactiveGreeting();
      startPresenceHeartbeat();
    });

  window.__RZ_WEBCHAT_DEBUG__ = function () {
    var panel = document.getElementById('rz-webchat-panel');
    return {
      build: WIDGET_BUILD,
      configLoaded: !!state.config,
      theme: state.config ? state.config.theme || 'light' : null,
      isDarkTheme: isDarkTheme(),
      panelTheme: panel ? panel.getAttribute('data-rz-theme') : null,
      primaryColor: state.config ? state.config.primaryColor : null,
      title: state.config ? state.config.title : null,
      proactiveEnabled: !!(state.config && state.config.proactiveGreetingEnabled),
      proactiveDelaySec: state.config ? state.config.proactiveGreetingDelaySeconds : null,
      proactiveTimerActive: !!state.proactiveTimer,
      proactiveScheduledAt: state.proactiveScheduledAt,
      proactiveTeaser: state.proactiveTeaser,
      proactiveInHistory: hasProactiveInMessages(),
      conversationEnded: isConversationEnded(),
      hasVisitorInbound: hasVisitorInbound(),
      proactiveDismissCooldownMs: proactiveDismissRemainingMs(),
      proactiveLastError: state.proactiveLastError || null,
      proactiveSkipReason: state.proactiveSkipReason || null,
      prechatMode: state.config ? state.config.prechatMode || 'steps' : null,
      chatOpen: state.open,
      chatEverOpened: presenceEngagementFlags().chatEverOpened,
      proactiveInviteClicked: presenceEngagementFlags().proactiveInviteClicked,
      visitorToken: state.visitorToken ? 'set' : null,
      messageCount: state.messages.length,
      unreadCount: state.unreadCount,
      soundEnabled: state.soundEnabled,
      messagePreview: state.messagePreview || null,
    };
  };
})();
