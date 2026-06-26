// ── i18n ─────────────────────────────────────────────
let _msgs = {};

function normalizeLocale(raw = '') {
  const l = raw.toLowerCase();
  if (l.startsWith('pt')) return 'pt_BR';
  if (l.startsWith('es')) return 'es';
  return 'en';
}

async function loadMessages(locale) {
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const data = await (await fetch(url)).json();
    _msgs = data;
  } catch {
    _msgs = {};
  }
}

const t = (key, ...args) => {
  let msg = _msgs[key]?.message || key;
  return args.reduce((s, a, i) => s.replace(`{${i}}`, a), msg);
};

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}

function setActiveLangBtn(locale) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === locale);
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── State ─────────────────────────────────────────────
let cvText     = '';
let cvFileName = '';
let instFileName = '';

// ── API status pill ───────────────────────────────────
function setApiPill(ok) {
  const pill = document.getElementById('api-pill');
  pill.className = `status-pill ${ok ? 'ok' : 'missing'}`;
  document.getElementById('api-pill-text').textContent = ok ? t('apiStatusOk') : t('apiStatusMissing');
}

// ── CV drop zone helpers ──────────────────────────────
function showEmpty(prefix) {
  document.getElementById(`${prefix}-empty`).hidden = false;
  document.getElementById(`${prefix}-loaded`).hidden = true;
  document.getElementById(`${prefix}-drop`).className = 'drop-zone';
}

function showLoaded(prefix, name, meta, isError = false) {
  document.getElementById(`${prefix}-empty`).hidden = true;
  document.getElementById(`${prefix}-loaded`).hidden = false;
  document.getElementById(`${prefix}-filename`).textContent = name;
  document.getElementById(`${prefix}-status`).textContent = meta;
  document.getElementById(`${prefix}-drop`).className = `drop-zone ${isError ? 'error' : 'loaded'}`;
}

// ── Instructions strip helpers ────────────────────────
function showInstLoaded(name, meta) {
  document.getElementById('inst-loaded').hidden = false;
  document.getElementById('inst-filename').textContent = name;
  document.getElementById('inst-status').textContent = meta;
  instTextarea.hidden = true;
}

function hideInstLoaded() {
  document.getElementById('inst-loaded').hidden = true;
  instFileName = '';
  instTextarea.hidden = false;
}

// ── Load saved state ──────────────────────────────────
async function loadSaved() {
  const data = await chrome.storage.local.get(['apiKey', 'cvText', 'cvFileName', 'extraInstructions', 'instFileName']);

  if (data.apiKey) {
    document.getElementById('api-key').value = data.apiKey;
    setApiPill(true);
  }
  if (data.cvText) {
    cvText = data.cvText;
    cvFileName = data.cvFileName || t('cvLoadedFallback');
    showLoaded('cv', cvFileName, t('charsExtracted', data.cvText.length.toLocaleString()));
  }
  if (data.extraInstructions) {
    const ta = document.getElementById('inst-textarea');
    ta.value = data.extraInstructions;
    ta.dispatchEvent(new Event('input'));
  }
  if (data.instFileName) {
    instFileName = data.instFileName;
    showInstLoaded(data.instFileName, t('charsLoaded', (data.extraInstructions || '').length.toLocaleString()));
  }

  await loadHistory();
}

// ── API key ───────────────────────────────────────────
document.getElementById('toggle-key').addEventListener('click', () => {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('api-key').addEventListener('input', (e) => {
  setApiPill(e.target.value.trim().length > 0);
});

// ── Language toggle ───────────────────────────────────
document.getElementById('lang-toggle').addEventListener('click', async (e) => {
  const btn = e.target.closest('.lang-btn');
  if (!btn) return;
  const locale = btn.dataset.lang;
  await chrome.storage.local.set({ lang: locale });
  await loadMessages(locale);
  setActiveLangBtn(locale);
  applyI18n();
  setApiPill(document.getElementById('api-key').value.trim().length > 0);
  if (cvText) showLoaded('cv', cvFileName, t('charsExtracted', cvText.length.toLocaleString()));
  if (instFileName) {
    const chars = document.getElementById('inst-textarea').value.length;
    showInstLoaded(instFileName, t('charsLoaded', chars.toLocaleString()));
  }
  await loadHistory();
});

// ── CV PDF drop zone ──────────────────────────────────
const fileInput = document.getElementById('file-input');
const cvDrop    = document.getElementById('cv-drop');

cvDrop.addEventListener('click', (e) => {
  if (!e.target.closest('#cv-clear')) fileInput.click();
});
cvDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!cvDrop.classList.contains('loaded')) cvDrop.classList.add('drag-over');
});
cvDrop.addEventListener('dragleave', () => cvDrop.classList.remove('drag-over'));
cvDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  cvDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processPdf(file);
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processPdf(file);
  fileInput.value = '';
});
document.getElementById('cv-clear').addEventListener('click', (e) => {
  e.stopPropagation();
  showEmpty('cv');
  cvText = ''; cvFileName = '';
});

async function processPdf(file) {
  if (!file.name.endsWith('.pdf')) {
    showLoaded('cv', file.name, t('pdfInvalid'), true);
    return;
  }
  showLoaded('cv', file.name, t('pdfExtracting'));
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
    const buffer = await file.arrayBuffer();
    const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages  = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    cvText     = pages.join('\n\n').trim();
    cvFileName = file.name;
    showLoaded('cv', file.name, t('pdfPages', cvText.length.toLocaleString(), pdf.numPages));
  } catch (err) {
    showLoaded('cv', file.name, t('pdfError', err.message), true);
  }
}

// ── Instructions .md import ───────────────────────────
const instTextarea = document.getElementById('inst-textarea');

instTextarea.addEventListener('input', () => {
  instTextarea.style.height = 'auto';
  instTextarea.style.height = Math.min(instTextarea.scrollHeight, 160) + 'px';
});

document.getElementById('inst-md-btn').addEventListener('click', () => {
  document.getElementById('inst-file-input').click();
});

document.getElementById('inst-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !file.name.endsWith('.md')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result.trim();
    instTextarea.value = text;
    instTextarea.dispatchEvent(new Event('input'));
    instFileName = file.name;
    showInstLoaded(file.name, t('charsLoaded', text.length.toLocaleString()));
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('inst-clear').addEventListener('click', () => {
  hideInstLoaded();
});

// ── Application history ───────────────────────────────
async function loadHistory() {
  const { appHistory = [] } = await chrome.storage.local.get('appHistory');
  const card = document.getElementById('history-card');
  const list = document.getElementById('history-list');

  if (!appHistory.length) { card.hidden = true; return; }
  card.hidden = false;

  list.innerHTML = appHistory.slice(0, 15).map(entry => {
    const date  = new Date(entry.date).toLocaleDateString();
    const title = (entry.title || entry.domain).slice(0, 70);
    return `<div class="history-item">
      <div class="history-title">${escHtml(title)}</div>
      <div class="history-meta">${escHtml(entry.domain)} · ${escHtml(date)} · ${escHtml(t('historyFields', entry.count))}</div>
    </div>`;
  }).join('');
}

// ── Save ──────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', async () => {
  const apiKey           = document.getElementById('api-key').value.trim();
  const extraInstructions = instTextarea.value.trim() || null;

  const toSave = {
    apiKey,
    extraInstructions: extraInstructions || null,
    instFileName: instFileName || null,
  };
  if (cvText) { toSave.cvText = cvText; toSave.cvFileName = cvFileName; }

  await chrome.storage.local.set(toSave);
  setApiPill(!!apiKey);

  const msg = document.getElementById('save-msg');
  msg.textContent = t('savedMsg');
  setTimeout(() => { msg.textContent = ''; }, 2500);
});

// ── Shortcuts link ────────────────────────────────────
document.getElementById('shortcuts-link').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ── Init ──────────────────────────────────────────────
(async () => {
  const { lang } = await chrome.storage.local.get('lang');
  const locale   = lang || normalizeLocale(chrome.i18n.getUILanguage());
  await loadMessages(locale);
  setActiveLangBtn(locale);
  applyI18n();
  await loadSaved();
})();
