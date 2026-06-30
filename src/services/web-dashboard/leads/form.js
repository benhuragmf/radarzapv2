/**
 * Radar Chat — formulário público de leads (embed externo).
 * Uso: <script src="https://SEU-PAINEL/leads/form.js" data-form-key="lfm_..." async></script>
 */
(function () {
  'use strict';

  function resolveScriptEl() {
    var current = document.currentScript;
    if (current && current.getAttribute('data-form-key')) return current;
    return document.querySelector('script[data-form-key][src*="form.js"]:not([data-rz-lead-init])');
  }

  var script = resolveScriptEl();
  if (!script) {
    console.error('[Radar Chat Leads] tag script não encontrada (use data-form-key no embed)');
    return;
  }
  script.setAttribute('data-rz-lead-init', '1');

  var publicKey = script.getAttribute('data-form-key');
  if (!publicKey) {
    console.error('[Radar Chat Leads] data-form-key ausente no script');
    return;
  }

  var scriptSrc = script.src || '';
  var baseUrl = scriptSrc.replace(/\/leads\/form\.js(\?.*)?$/, '');

  function apiUrl(path) {
    return baseUrl + '/api/leads/public' + path;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'value') node.value = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function resolveTheme(config) {
    var t = config.theme || 'auto';
    if (t === 'auto') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (e) {
        return 'light';
      }
    }
    return t === 'dark' ? 'dark' : 'light';
  }

  function maxWidthForSize(size) {
    if (size === 'compact') return '320px';
    if (size === 'wide') return '560px';
    return '420px';
  }

  function cssImp(value) {
    return value + ' !important';
  }

  function readPreviewOverrides(container) {
    if (!container || !/\/preview-page/i.test(window.location.pathname)) return null;
    var o = {};
    var theme = container.getAttribute('data-preview-theme');
    if (theme) o.theme = theme;
    var size = container.getAttribute('data-preview-size');
    if (size) o.size = size;
    var br = container.getAttribute('data-preview-border-radius');
    if (br !== null && br !== '') {
      var n = Number(br);
      if (!isNaN(n)) o.borderRadius = n;
    }
    var sl = container.getAttribute('data-preview-show-logo');
    if (sl === '1') o.showLogo = true;
    if (sl === '0') o.showLogo = false;
    var pc = container.getAttribute('data-preview-primary-color');
    if (pc) o.primaryColor = pc;
    return Object.keys(o).length ? o : null;
  }

  function injectStyles(config) {
    var styleId = 'rz-lead-form-styles-' + (config.publicKey || 'default');
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    var color = config.primaryColor || '#25D366';
    var theme = resolveTheme(config);
    var radius = typeof config.borderRadius === 'number' ? config.borderRadius : 8;
    var maxW = maxWidthForSize(config.size || 'default');
    var isDark = theme === 'dark';
    var text = isDark ? '#f3f4f6' : '#1a1a1a';
    var muted = isDark ? '#9ca3af' : '#555';
    var label = isDark ? '#e5e7eb' : '#333';
    var border = isDark ? '#374151' : '#d1d5db';
    var inputBg = isDark ? '#111827' : '#fff';
    var successBg = isDark ? '#064e3b' : '#ecfdf5';
    var successText = isDark ? '#a7f3d0' : '#065f46';
    var errBg = isDark ? '#450a0a' : '#fef2f2';
    var errText = isDark ? '#fecaca' : '#991b1b';

    var css =
      '.rz-lead-form{max-width:' +
      cssImp(maxW) +
      ';width:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:' +
      cssImp(text) +
      ';margin:0 auto}' +
      '.rz-lead-form.rz-theme-light{color-scheme:light}' +
      '.rz-lead-form.rz-theme-dark{color-scheme:dark}' +
      '.rz-lead-form.rz-theme-dark{color:' +
      cssImp(text) +
      '}' +
      '.rz-lead-form *{box-sizing:border-box}' +
      '.rz-lead-form h2{margin:0 0 6px;font-size:1.25rem;font-weight:600;color:' +
      cssImp(text) +
      '}' +
      '.rz-lead-form p.rz-desc{margin:0 0 16px;font-size:0.875rem;color:' +
      cssImp(muted) +
      ';line-height:1.45}' +
      '.rz-lead-form label{display:block;font-size:0.8rem;font-weight:500;margin-bottom:4px;color:' +
      cssImp(label) +
      '}' +
      '.rz-lead-form .rz-field{margin-bottom:12px}' +
      '.rz-lead-form .rz-check-label{display:flex;align-items:flex-start;gap:8px;font-weight:400;cursor:pointer}' +
      '.rz-lead-form .rz-check-label input{margin-top:3px;flex-shrink:0}' +
      '.rz-lead-form input,.rz-lead-form textarea,.rz-lead-form select{width:100%;padding:10px 12px;border:1px solid ' +
      border +
      ';border-radius:' +
      cssImp(radius + 'px') +
      ';font-size:0.95rem;background:' +
      cssImp(inputBg) +
      ';color:' +
      cssImp(text) +
      ';font-family:inherit}' +
      '.rz-lead-form input:focus,.rz-lead-form textarea:focus,.rz-lead-form select:focus{outline:2px solid ' +
      color +
      '33;border-color:' +
      cssImp(color) +
      '}' +
      '.rz-lead-form textarea{min-height:88px;resize:vertical}' +
      '.rz-lead-form .rz-err{color:#b91c1c;font-size:0.8rem;margin-top:4px}' +
      '.rz-lead-form button.rz-btn,.rz-lead-form .rz-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:12px 16px;border:none;border-radius:' +
      cssImp(radius + 'px') +
      ';font-size:0.95rem;font-weight:600;color:' +
      cssImp('#fff') +
      ';background:' +
      cssImp(color) +
      ';cursor:pointer;margin-top:4px;font-family:inherit}' +
      '.rz-lead-form .rz-btn:disabled{opacity:0.6;cursor:not-allowed}' +
      '.rz-lead-form .rz-success{padding:16px;border-radius:' +
      radius +
      'px;background:' +
      cssImp(successBg) +
      ';color:' +
      cssImp(successText) +
      ';font-size:0.9rem;line-height:1.45}' +
      '.rz-lead-form .rz-global-err{margin-bottom:12px;padding:10px;border-radius:' +
      radius +
      'px;background:' +
      cssImp(errBg) +
      ';color:' +
      cssImp(errText) +
      ';font-size:0.85rem}' +
      '.rz-lead-form .rz-logo{margin-top:12px;text-align:center;font-size:0.65rem;line-height:1.35;opacity:0.72;color:' +
      cssImp(muted) +
      '}' +
      '.rz-lead-form .rz-logo a{color:inherit;text-decoration:none;border-bottom:1px solid transparent}' +
      '.rz-lead-form .rz-logo a:hover{opacity:1;border-bottom-color:currentColor}' +
      '.rz-lead-form .rz-consent{font-size:0.8rem;line-height:1.4;color:' +
      cssImp(label) +
      '}' +
      '.rz-lead-form .rz-consent a{color:' +
      cssImp(color) +
      '}';

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
    return theme;
  }

  function parseUtmFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var utm = {
        source: params.get('utm_source') || undefined,
        medium: params.get('utm_medium') || undefined,
        campaign: params.get('utm_campaign') || undefined,
        term: params.get('utm_term') || undefined,
        content: params.get('utm_content') || undefined,
      };
      if (utm.source || utm.medium || utm.campaign || utm.term || utm.content) return utm;
    } catch (e) {}
    return undefined;
  }

  function buildCustomField(cf, formEl) {
    if (cf.type === 'hidden') {
      var hidden = el('input', {
        type: 'hidden',
        id: 'rz-' + cf.id,
        name: cf.id,
        value: cf.placeholder || (cf.options && cf.options[0]) || '',
      });
      formEl.appendChild(hidden);
      return {
        key: cf.id,
        getValue: function () {
          return hidden.value.trim();
        },
        validate: function () {
          return true;
        },
        err: { style: { display: 'none' }, textContent: '' },
      };
    }

    var wrap = el('div', { className: 'rz-field' });
    var err = el('div', { className: 'rz-err', style: 'display:none' });
    var input;

    if (cf.type === 'select') {
      wrap.appendChild(el('label', { for: 'rz-' + cf.id, text: cf.label + (cf.required ? ' *' : '') }));
      input = el('select', { id: 'rz-' + cf.id, name: cf.id });
      input.appendChild(el('option', { value: '', text: cf.placeholder || 'Selecione…' }));
      (cf.options || []).forEach(function (opt) {
        input.appendChild(el('option', { value: opt, text: opt }));
      });
      wrap.appendChild(input);
    } else if (cf.type === 'checkbox') {
      input = el('input', { type: 'checkbox', id: 'rz-' + cf.id, name: cf.id });
      var lbl = el('label', { className: 'rz-check-label', for: 'rz-' + cf.id });
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(' ' + cf.label + (cf.required ? ' *' : '')));
      wrap.appendChild(lbl);
    } else {
      wrap.appendChild(el('label', { for: 'rz-' + cf.id, text: cf.label + (cf.required ? ' *' : '') }));
      var inputType =
        cf.type === 'textarea'
          ? 'textarea'
          : cf.type === 'email'
            ? 'email'
            : cf.type === 'tel'
              ? 'tel'
              : 'text';
      if (inputType === 'textarea') {
        input = el('textarea', {
          id: 'rz-' + cf.id,
          name: cf.id,
          rows: '3',
          placeholder: cf.placeholder || '',
        });
      } else {
        input = el('input', {
          id: 'rz-' + cf.id,
          name: cf.id,
          type: inputType,
          placeholder: cf.placeholder || '',
        });
      }
      if (cf.required && cf.type !== 'checkbox') input.required = true;
      wrap.appendChild(input);
    }

    wrap.appendChild(err);
    formEl.appendChild(wrap);

    return {
      key: cf.id,
      cfg: cf,
      err: err,
      getValue: function () {
        if (cf.type === 'checkbox') return input.checked ? 'true' : '';
        return (input.value || '').trim();
      },
      validate: function () {
        var val = this.getValue();
        if (cf.required && cf.type === 'checkbox' && !input.checked) {
          err.textContent = 'Campo obrigatório';
          err.style.display = 'block';
          return false;
        }
        if (cf.required && cf.type !== 'checkbox' && !val) {
          err.textContent = 'Campo obrigatório';
          err.style.display = 'block';
          return false;
        }
        err.style.display = 'none';
        return true;
      },
    };
  }

  function mountForm(config) {
    var containerId = script.getAttribute('data-container');
    var container = containerId ? document.getElementById(containerId) : null;
    var overrides = container ? readPreviewOverrides(container) : null;
    if (overrides) {
      config = Object.assign({}, config, overrides);
    }

    var theme = injectStyles(config);

    if (!container) {
      container = el('div', { id: 'rz-lead-form-root' });
      script.parentNode.insertBefore(container, script.nextSibling);
    }

    var root = el('div', {
      className: 'rz-lead-form' + (theme === 'dark' ? ' rz-theme-dark' : ' rz-theme-light'),
    });
    container.innerHTML = '';
    container.appendChild(root);

    var globalErr = el('div', { className: 'rz-global-err', style: 'display:none' });
    root.appendChild(globalErr);

    root.appendChild(el('h2', { text: config.title || 'Fale conosco' }));
    if (config.description) {
      root.appendChild(el('p', { className: 'rz-desc', text: config.description }));
    }

    var form = el('form', { novalidate: 'novalidate' });
    root.appendChild(form);

    function field(name, label, type, required, placeholder) {
      var wrap = el('div', { className: 'rz-field' });
      wrap.appendChild(el('label', { for: 'rz-' + name, text: label + (required ? ' *' : '') }));
      var input =
        type === 'textarea'
          ? el('textarea', { id: 'rz-' + name, name: name, rows: '3', placeholder: placeholder || '' })
          : el('input', { id: 'rz-' + name, name: name, type: type || 'text', placeholder: placeholder || '' });
      if (required) input.required = true;
      wrap.appendChild(input);
      var err = el('div', { className: 'rz-err', style: 'display:none' });
      wrap.appendChild(err);
      form.appendChild(wrap);
      return { input: input, err: err, key: name };
    }

    var nameF = field('name', 'Nome', 'text', true);
    var phoneF = field('phone', 'WhatsApp / Telefone', 'tel', true);
    var emailF = config.askEmail ? field('email', 'E-mail', 'email', config.requireEmail) : null;
    var msgF = config.askMessage ? field('message', 'Mensagem', 'textarea', config.requireMessage) : null;

    var customFs = (config.customFields || []).map(function (cf) {
      return buildCustomField(cf, form);
    });

    var honeypotWrap = null;
    if (config.honeypot !== false) {
      honeypotWrap = el('div', { style: 'position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden' });
      honeypotWrap.appendChild(el('input', { type: 'text', name: 'rz_hp', tabindex: '-1', autocomplete: 'off' }));
      form.appendChild(honeypotWrap);
    }

    var consentInput = null;
    if (config.requireConsent) {
      var consentWrap = el('div', { className: 'rz-field' });
      var consentLabel = config.consentText || 'Concordo em ser contatado.';
      if (config.consentPolicyUrl) {
        consentLabel +=
          ' <a href="' +
          config.consentPolicyUrl +
          '" target="_blank" rel="noopener noreferrer">Política de privacidade</a>';
      }
      consentWrap.appendChild(
        el('label', {
          className: 'rz-consent',
          html: '<input type="checkbox" id="rz-consent" required /> ' + consentLabel,
        }),
      );
      form.appendChild(consentWrap);
      consentInput = consentWrap.querySelector('#rz-consent');
    }

    var btn = el('button', { className: 'rz-btn', type: 'submit', text: config.buttonText || 'Enviar' });
    form.appendChild(btn);

    if (config.showLogo) {
      var brandUrl = (config.brandUrl || 'https://radarchat.com.br').replace(/"/g, '');
      root.appendChild(
        el('p', {
          className: 'rz-logo',
          html:
            'Powered by <a href="' +
            brandUrl +
            '" target="_blank" rel="noopener noreferrer">Radar Chat</a>',
        }),
      );
    }

    function showErr(f, msg) {
      if (!f || !f.err) return;
      f.err.textContent = msg;
      f.err.style.display = msg ? 'block' : 'none';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      globalErr.style.display = 'none';
      showErr(nameF, '');
      showErr(phoneF, '');
      if (emailF) showErr(emailF, '');
      if (msgF) showErr(msgF, '');

      var okCustom = true;
      customFs.forEach(function (f) {
        if (!f.validate()) okCustom = false;
      });
      if (!okCustom) return;

      var payload = {
        name: nameF.input.value.trim(),
        phone: phoneF.input.value.trim(),
        sourceUrl: window.location.href,
        pageTitle: document.title,
        customFields: {},
        utm: parseUtmFromUrl(),
        consent: consentInput ? consentInput.checked : undefined,
        honeypot: honeypotWrap ? honeypotWrap.querySelector('input').value : undefined,
      };
      if (emailF) payload.email = emailF.input.value.trim();
      if (msgF) payload.message = msgF.input.value.trim();

      if (!payload.name) {
        showErr(nameF, 'Informe seu nome');
        return;
      }
      if (!payload.phone) {
        showErr(phoneF, 'Informe seu telefone');
        return;
      }
      if (emailF && config.requireEmail && !payload.email) {
        showErr(emailF, 'Informe seu e-mail');
        return;
      }
      if (msgF && config.requireMessage && !payload.message) {
        showErr(msgF, 'Informe uma mensagem');
        return;
      }

      customFs.forEach(function (f) {
        var val = f.getValue();
        if (val) payload.customFields[f.key] = val;
      });

      btn.disabled = true;
      btn.textContent = 'Enviando…';

      fetch(apiUrl('/forms/' + encodeURIComponent(publicKey) + '/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error((result.data && result.data.error) || 'Falha ao enviar');
          }
          form.remove();
          var okBox = el('div', {
            className: 'rz-success',
            text: result.data.successMessage || config.successMessage || 'Enviado com sucesso!',
          });
          root.appendChild(okBox);
          if (result.data.redirectUrl) {
            setTimeout(function () {
              window.location.href = result.data.redirectUrl;
            }, 1500);
          }
        })
        .catch(function (err) {
          globalErr.textContent = err.message || 'Não foi possível enviar. Tente novamente.';
          globalErr.style.display = 'block';
          btn.disabled = false;
          btn.textContent = config.buttonText || 'Enviar';
        });
    });
  }

  var isPanelPreview =
    /\/leads\/preview\.html/i.test(window.location.pathname) ||
    /\/preview-page/i.test(window.location.pathname);
  var configPath = isPanelPreview
      ? '/forms/' + encodeURIComponent(publicKey) + '/preview-config'
      : '/forms/' + encodeURIComponent(publicKey) + '/config';

  fetch(apiUrl(configPath))
    .then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'Formulário indisponível');
        return data;
      });
    })
    .then(mountForm)
    .catch(function (err) {
      console.error('[Radar Chat Leads]', err.message);
      var containerId = script.getAttribute('data-container');
      var container = containerId ? document.getElementById(containerId) : null;
      if (container) {
        container.innerHTML =
          '<p style="color:#b91c1c;font-size:0.875rem;margin:0;line-height:1.45">' +
          (err.message || 'Formulário indisponível') +
          '</p>';
      }
    });
})();
