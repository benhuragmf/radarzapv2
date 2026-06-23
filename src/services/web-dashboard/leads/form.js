/**
 * RadarZap — formulário público de leads (embed externo).
 * Uso: <script src="https://SEU-PAINEL/leads/form.js" data-form-key="lfm_..." async></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var publicKey = script.getAttribute('data-form-key');
  if (!publicKey) {
    console.error('[RadarZap Leads] data-form-key ausente no script');
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

  function injectStyles(primary) {
    if (document.getElementById('rz-lead-form-styles')) return;
    var color = primary || '#25D366';
    var css =
      '.rz-lead-form{max-width:420px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a}' +
      '.rz-lead-form *{box-sizing:border-box}' +
      '.rz-lead-form h2{margin:0 0 6px;font-size:1.25rem;font-weight:600}' +
      '.rz-lead-form p.rz-desc{margin:0 0 16px;font-size:0.875rem;color:#555;line-height:1.45}' +
      '.rz-lead-form label{display:block;font-size:0.8rem;font-weight:500;margin-bottom:4px;color:#333}' +
      '.rz-lead-form .rz-field{margin-bottom:12px}' +
      '.rz-lead-form input,.rz-lead-form textarea{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:0.95rem}' +
      '.rz-lead-form input:focus,.rz-lead-form textarea:focus{outline:2px solid ' +
      color +
      '33;border-color:' +
      color +
      '}' +
      '.rz-lead-form textarea{min-height:88px;resize:vertical}' +
      '.rz-lead-form .rz-err{color:#b91c1c;font-size:0.8rem;margin-top:4px}' +
      '.rz-lead-form .rz-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:12px 16px;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;color:#fff;background:' +
      color +
      ';cursor:pointer;margin-top:4px}' +
      '.rz-lead-form .rz-btn:disabled{opacity:0.6;cursor:not-allowed}' +
      '.rz-lead-form .rz-success{padding:16px;border-radius:8px;background:#ecfdf5;color:#065f46;font-size:0.9rem;line-height:1.45}' +
      '.rz-lead-form .rz-global-err{margin-bottom:12px;padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:0.85rem}';
    var style = document.createElement('style');
    style.id = 'rz-lead-form-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mountForm(config) {
    injectStyles(config.primaryColor);

    var containerId = script.getAttribute('data-container');
    var container = containerId ? document.getElementById(containerId) : null;
    if (!container) {
      container = el('div', { id: 'rz-lead-form-root' });
      script.parentNode.insertBefore(container, script.nextSibling);
    }

    var root = el('div', { className: 'rz-lead-form' });
    container.appendChild(root);

    var globalErr = el('div', { className: 'rz-global-err', style: 'display:none' });
    root.appendChild(globalErr);

    root.appendChild(el('h2', { text: config.title || 'Fale conosco' }));
    if (config.description) {
      root.appendChild(el('p', { className: 'rz-desc', text: config.description }));
    }

    var form = el('form', { novalidate: 'novalidate' });
    root.appendChild(form);

    function field(name, label, type, required) {
      var wrap = el('div', { className: 'rz-field' });
      wrap.appendChild(el('label', { for: 'rz-' + name, text: label + (required ? ' *' : '') }));
      var input =
        type === 'textarea'
          ? el('textarea', { id: 'rz-' + name, name: name, rows: '3' })
          : el('input', { id: 'rz-' + name, name: name, type: type || 'text' });
      if (required) input.required = true;
      wrap.appendChild(input);
      var err = el('div', { className: 'rz-err', style: 'display:none' });
      wrap.appendChild(err);
      form.appendChild(wrap);
      return { input: input, err: err };
    }

    var nameF = field('name', 'Nome', 'text', true);
    var phoneF = field('phone', 'WhatsApp / Telefone', 'tel', true);
    var emailF = config.askEmail ? field('email', 'E-mail', 'email', config.requireEmail) : null;
    var msgF = config.askMessage ? field('message', 'Mensagem', 'textarea', config.requireMessage) : null;

    var btn = el('button', { className: 'rz-btn', type: 'submit', text: config.buttonText || 'Enviar' });
    form.appendChild(btn);

    function showErr(f, msg) {
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

      var payload = {
        name: nameF.input.value.trim(),
        phone: phoneF.input.value.trim(),
        sourceUrl: window.location.href,
        pageTitle: document.title,
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
          var ok = el('div', {
            className: 'rz-success',
            text: result.data.successMessage || config.successMessage || 'Enviado com sucesso!',
          });
          root.appendChild(ok);
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

  fetch(apiUrl('/forms/' + encodeURIComponent(publicKey) + '/config'))
    .then(function (res) {
      if (!res.ok) throw new Error('Formulário indisponível');
      return res.json();
    })
    .then(mountForm)
    .catch(function (err) {
      console.error('[RadarZap Leads]', err.message);
    });
})();
