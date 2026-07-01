let _msgs = {};

function normalizeLocale(raw = '') {
  const l = raw.toLowerCase();
  if (l.startsWith('pt')) return 'pt_BR';
  if (l.startsWith('es')) return 'es';
  return 'en';
}

const t = (key, ...args) => {
  let msg = _msgs[key]?.message || chrome.i18n.getMessage(key) || key;
  return args.reduce((s, a, i) => s.replace(`{${i}}`, a), msg);
};

const IS_MAIN_FRAME = window.self === window.top;

// chrome.i18n.getMessage() is already the fallback in t() — no fetch needed in content scripts
const _localeReady = Promise.resolve();

// ── Field validation ──────────────────────────────────
let currentField = null;
let isFilling    = false;

function isValidField(el) {
  if (!el || el.disabled) return false;
  if (el.matches('select')) return true;
  if (el.readOnly) return false;
  if (el.matches('textarea')) return true;
  if (el.contentEditable === 'true') return true;
  if (el.matches('input')) {
    const t = (el.type || '').toLowerCase();
    return !t || ['text', 'email', 'tel', 'url', 'search'].includes(t);
  }
  return false;
}

function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
}

document.addEventListener('focusin', e => {
  if (isValidField(e.target)) currentField = e.target;
});

// ── Context extraction ────────────────────────────────
function getPageLanguage() {
  return document.documentElement.lang?.split('-')[0]?.toLowerCase() || '';
}

function getFieldContext(el) {
  let label = '';
  if (el.id) {
    const lEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lEl) label = lEl.textContent.trim();
  }
  if (!label) label = el.closest('label')?.textContent?.trim() || '';
  if (!label) {
    const ariaLabel  = el.getAttribute('aria-label');
    const labelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabel)   label = ariaLabel;
    else if (labelledBy) label = document.getElementById(labelledBy)?.textContent?.trim() || '';
  }
  const nearby = getNearbyText(el);
  if (!label || label === el.placeholder || label.length < 4)
    label = nearby || el.placeholder || el.name || el.id || 'campo';

  const h1 = document.querySelector('h1')?.textContent?.trim() || '';
  const pageContext = [document.title, h1].filter(Boolean).join(' — ');

  const options = el.matches('select')
    ? Array.from(el.options).filter(o => o.value).map(o => o.text.trim())
    : null;

  return {
    label: label.slice(0, 400),
    pageContext: pageContext.slice(0, 300),
    pageLanguage: getPageLanguage(),
    options,
  };
}

function getNearbyText(el) {
  let node = el;
  for (let depth = 0; depth < 6; depth++) {
    node = node.parentElement;
    if (!node) break;
    const children = Array.from(node.children);
    const branch   = children.find(c => c === el || c.contains(el));
    const idx      = children.indexOf(branch);
    for (let i = idx - 1; i >= 0; i--) {
      const text = children[i].textContent?.trim();
      if (text && text.length > 4 && text.length < 600) return text;
    }
  }
  return '';
}

// ── Keyboard shortcuts ────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!chrome.runtime?.id) { showToast('ShortApply — recarregue a página (F5)'); return; }
  if (msg.type !== 'KEYBOARD_TRIGGER' && msg.type !== 'KEYBOARD_TRIGGER_SINGLE') return;
  _localeReady.then(() => {
    if (msg.type === 'KEYBOARD_TRIGGER' && !isFilling) {
      triggerFillAll();
    } else if (msg.type === 'KEYBOARD_TRIGGER_SINGLE' && !isFilling) {
      const field = (currentField && document.contains(currentField))
        ? currentField
        : (isValidField(document.activeElement) ? document.activeElement : null);
      if (field) triggerFill(field);
      else showToast(t('toastClickFirst'));
    }
  });
});

// ── Fill ALL fields ───────────────────────────────────
async function triggerFillAll() {
  if (!chrome.runtime?.id) { showToast(t('toastReload')); return; }

  const allFields = Array.from(
    document.querySelectorAll('input, textarea, select, [contenteditable="true"]')
  ).filter(el => isValidField(el) && isVisible(el));

  if (!allFields.length) { if (IS_MAIN_FRAME) showToast(t('toastNoFields')); return; }

  const snapshots = allFields.map(el => ({
    el,
    original: el.tagName === 'SELECT' ? el.value
            : el.contentEditable === 'true' ? el.textContent
            : el.value,
  }));

  const fields = allFields.map((el, i) => ({ id: i, ...getFieldContext(el) }));

  isFilling = true;
  const overlay = document.createElement('div');
  overlay.className = 'jaa-fill-overlay';
  overlay.innerHTML = `<div class="jaa-fill-overlay-card"><div class="jaa-spinner"></div><span>${escHtml(t('toastFilling', fields.length))}</span></div>`;
  document.body.appendChild(overlay);

  try {
    const response = await new Promise((resolve, reject) =>
      chrome.runtime.sendMessage(
        { type: 'GENERATE_ALL', fields },
        res => { if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(res); }
      )
    );

    if (!response) throw new Error(t('toastNoResponse'));
    if (response.error === 'not_configured') { showToast(t('toastConfigure')); return; }
    if (response.error) throw new Error(response.error);
    if (!Array.isArray(response.results)) throw new Error('invalid_response');

    let filled = 0;
    const skipped = [];
    const details = [];

    for (const { id, answer } of response.results) {
      if (typeof id !== 'number' || id < 0 || id >= allFields.length) continue;
      if (answer === null || answer === '') {
        skipped.push(fields[id]?.label || `campo ${id}`);
        continue;
      }
      const fieldLabel = fields[id]?.label || `campo ${id}`;
      const displayVal = fields[id]?.options
        ? (() => {
            const num = parseInt(answer, 10);
            const opts = Array.from(allFields[id].options || []).filter(o => o.value);
            return (!isNaN(num) && opts[num - 1]) ? opts[num - 1].text.trim() : answer;
          })()
        : answer;
      insertText(allFields[id], String(answer), true);
      details.push({ label: fieldLabel, value: displayVal });
      filled++;
    }

    showBulkConfirmBar(filled, skipped, details, () => {
      for (const { el, original } of snapshots) insertText(el, original);
    }, response.provider);

    if (skipped.length) {
      setTimeout(() => showToast(t('toastSkipped', skipped.join(', ')), 8000), 300);
    }

    // Feature 5: save application history
    if (filled > 0 && IS_MAIN_FRAME) saveHistory(filled);

  } catch (err) {
    const errMsg = err.message.includes('context') || err.message.includes('Extension')
      ? t('toastReload') : err.message;
    showToast(t('toastError', errMsg));
  } finally {
    isFilling = false;
    overlay.remove();
  }
}

// ── Save application history ──────────────────────────
async function saveHistory(count) {
  try {
    const { appHistory = [] } = await chrome.storage.local.get('appHistory');
    const entry = {
      domain: location.hostname,
      title: document.title.slice(0, 80),
      date: new Date().toISOString(),
      count,
    };
    // keep last 50 entries, newest first
    const updated = [entry, ...appHistory].slice(0, 50);
    await chrome.storage.local.set({ appHistory: updated });
  } catch { /* storage errors are non-fatal */ }
}

// ── Fill single field ─────────────────────────────────
async function triggerFill(el) {
  if (!chrome.runtime?.id) { showToast(t('toastReload')); return; }
  if (!document.contains(el)) {
    const a = document.activeElement;
    if (isValidField(a)) el = a; else { showToast(t('toastClickFirst')); return; }
  }

  isFilling = true;
  const loadingToast = showToast('✦ …', 0);

  const fieldContext  = getFieldContext(el);
  const originalValue = el.contentEditable === 'true' ? el.textContent : el.value;

  try {
    const response = await new Promise((resolve, reject) =>
      chrome.runtime.sendMessage(
        { type: 'GENERATE', fieldContext },
        res => { if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(res); }
      )
    );

    if (!response) throw new Error(t('toastNoResponse'));
    if (response.error === 'not_configured') { showToast(t('toastConfigure')); return; }
    if (response.error) throw new Error(response.error);
    if (typeof response.text !== 'string') throw new Error('invalid_response');

    insertText(el, response.text);

    const displayText = fieldContext.options
      ? (() => {
          const num = parseInt(response.text.trim(), 10);
          const validOpts = Array.from(el.options).filter(o => o.value);
          return (!isNaN(num) && validOpts[num - 1]) ? validOpts[num - 1].text.trim() : response.text;
        })()
      : response.text;

    showConfirmBar(fieldContext, originalValue, el, displayText, response.provider);

  } catch (err) {
    const errMsg = err.message.includes('context') || err.message.includes('Extension')
      ? t('toastReload') : err.message;
    showToast(t('toastError', errMsg));
  } finally {
    isFilling = false;
    loadingToast.remove();
  }
}

// ── Confirm bar (single field) ────────────────────────
function showConfirmBar(fieldContext, originalValue, targetEl, displayText, provider = 'anthropic') {
  document.querySelector('.jaa-confirm-bar')?.remove();

  const bar = document.createElement('div');
  bar.className = 'jaa-confirm-bar';

  const label = displayText
    ? `${fieldContext.label}: ${displayText}`
    : fieldContext.label;
  const truncated = label.length > 70 ? label.slice(0, 70) + '…' : label;
  const providerLabel = provider === 'deepseek' ? 'DeepSeek' : 'Anthropic';

  bar.innerHTML = `
    <div class="jaa-confirm-info">
      <span class="jaa-confirm-star">✦</span>
      <span class="jaa-confirm-label">${escHtml(truncated)}</span>
    </div>
    <div class="jaa-confirm-actions">
      <span class="jaa-provider-badge">${escHtml(providerLabel)}</span>
      <button class="jaa-cbar-btn jaa-cbar-edit">${t('barEdit')}</button>
      <button class="jaa-cbar-btn jaa-cbar-undo">${t('barUndo')}</button>
    </div>
    <div class="jaa-confirm-progress" style="animation-duration:15s"></div>
  `;

  document.body.appendChild(bar);
  const timer = setTimeout(() => bar.remove(), 15000);

  bar.querySelector('.jaa-cbar-undo').addEventListener('click', () => {
    clearTimeout(timer); insertText(targetEl, originalValue); bar.remove();
  });
  bar.querySelector('.jaa-cbar-edit').addEventListener('click', () => {
    clearTimeout(timer); bar.remove(); openEditModal(fieldContext, targetEl);
  });
}

// ── Confirm bar (bulk fill) ───────────────────────────
function showBulkConfirmBar(filled, skipped, details, undoFn, provider = 'anthropic') {
  document.querySelector('.jaa-confirm-bar')?.remove();

  const bar = document.createElement('div');
  bar.className = 'jaa-confirm-bar jaa-confirm-bar--bulk';

  const summary = skipped.length
    ? t('barFilledSkipped', filled, skipped.length)
    : t('barFilledOnly', filled);
  const providerLabel = provider === 'deepseek' ? 'DeepSeek' : 'Anthropic';

  const detailRows = details.map(d =>
    `<div class="jaa-cbar-detail-row">
      <span class="jaa-cbar-detail-label">${escHtml(d.label)}</span>
      <span class="jaa-cbar-detail-value">${escHtml(String(d.value).slice(0, 80))}</span>
    </div>`
  ).join('');

  bar.innerHTML = `
    <div class="jaa-cbar-main">
      <div class="jaa-confirm-info">
        <span class="jaa-confirm-star">✦</span>
        <span class="jaa-confirm-label">${escHtml(summary)}</span>
        ${details.length ? `<button class="jaa-cbar-toggle">${t('barSeeDetails')}</button>` : ''}
      </div>
      <div class="jaa-confirm-actions">
        <span class="jaa-provider-badge">${escHtml(providerLabel)}</span>
        <button class="jaa-cbar-btn jaa-cbar-undo">${t('barUndoAll')}</button>
      </div>
    </div>
    ${details.length ? `<div class="jaa-cbar-details" hidden>${detailRows}</div>` : ''}
    <div class="jaa-confirm-progress" style="animation-duration:20s"></div>
  `;

  document.body.appendChild(bar);
  const timer = setTimeout(() => bar.remove(), 20000);

  bar.querySelector('.jaa-cbar-undo').addEventListener('click', () => {
    clearTimeout(timer); undoFn(); bar.remove();
  });

  if (details.length) {
    const toggle = bar.querySelector('.jaa-cbar-toggle');
    const detailsEl = bar.querySelector('.jaa-cbar-details');
    toggle.addEventListener('click', () => {
      const open = !detailsEl.hidden;
      detailsEl.hidden = open;
      toggle.textContent = open ? t('barSeeDetails') : t('barHideDetails');
    });
  }
}

// ── Edit modal ────────────────────────────────────────
function openEditModal(fieldContext, targetEl) {
  const currentText = targetEl.contentEditable === 'true' ? targetEl.textContent : targetEl.value;

  const overlay = document.createElement('div');
  overlay.className = 'jaa-overlay';

  const card = document.createElement('div');
  card.className = 'jaa-card';

  const header = document.createElement('div');
  header.className = 'jaa-header';
  header.innerHTML = `
    <div class="jaa-question-label">${t('modalAnsweringLabel')}</div>
    <div class="jaa-question-text">${escHtml(fieldContext.label)}</div>
  `;

  const body = document.createElement('div');
  body.className = 'jaa-body';
  const ta = document.createElement('textarea');
  ta.className = 'jaa-textarea';
  ta.value = currentText;
  body.appendChild(ta);

  const footer = document.createElement('div');
  footer.className = 'jaa-footer';
  footer.innerHTML = `
    <button class="jaa-btn jaa-btn-secondary">${t('modalCancel')}</button>
    <button class="jaa-btn jaa-btn-primary">${t('modalInsert')}</button>
  `;

  card.append(header, body, footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => ta.focus());

  const close = () => overlay.remove();
  footer.querySelector('.jaa-btn-secondary').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  footer.querySelector('.jaa-btn-primary').addEventListener('click', () => { insertText(targetEl, ta.value); close(); });

  function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }
  document.addEventListener('keydown', onKey);
}

// ── Text insertion ────────────────────────────────────
function insertText(el, text, flash = false) {
  text = sanitizeForInsert(text);
  if (!text && text !== '') return;
  if (flash) {
    el.classList.add('jaa-filled-flash');
    setTimeout(() => el.classList.remove('jaa-filled-flash'), 1000);
  }
  if (el.tagName === 'SELECT') {
    const validOpts = Array.from(el.options).filter(o => o.value);
    const num = parseInt(text.trim(), 10);
    const opt = !isNaN(num) && num >= 1 && num <= validOpts.length
      ? validOpts[num - 1]
      : validOpts.find(o => o.text.trim().toLowerCase() === text.toLowerCase().trim());
    if (opt) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      showToast(t('toastNoOption', text));
    }
    return;
  }
  if (el.contentEditable === 'true') {
    el.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, text);
    return;
  }
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.focus();
}

// ── Utilities ─────────────────────────────────────────
function showToast(msg, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = 'jaa-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

const _esc = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'};
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => _esc[c]); }

const MAX_INSERT_LEN = 5000;
function sanitizeForInsert(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, MAX_INSERT_LEN);
}
