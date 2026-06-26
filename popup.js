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

// ── State ─────────────────────────────────────────────
let cvText = '';
let cvFileName = '';

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
  if (data.extraInstructions && data.instFileName) {
    document.getElementById('inst-file-input')._pendingText = data.extraInstructions;
    document.getElementById('inst-file-input')._pendingName = data.instFileName;
    showLoaded('inst', data.instFileName, t('charsLoaded', data.extraInstructions.length.toLocaleString()));
  }
}

function setApiPill(ok) {
  const pill = document.getElementById('api-pill');
  pill.className = `status-pill ${ok ? 'ok' : 'missing'}`;
  document.getElementById('api-pill-text').textContent = ok ? t('apiStatusOk') : t('apiStatusMissing');
}

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

// ── API key toggle ────────────────────────────────────
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
  // Re-render dynamic strings that are already visible
  setApiPill(document.getElementById('api-key').value.trim().length > 0);
  const cvMeta = document.getElementById('cv-status').textContent;
  if (cvText) showLoaded('cv', cvFileName, t('charsExtracted', cvText.length.toLocaleString()));
  const instInput = document.getElementById('inst-file-input');
  if (instInput._pendingText) {
    showLoaded('inst', instInput._pendingName, t('charsLoaded', instInput._pendingText.length.toLocaleString()));
  }
});

// ── Drop zone helper ──────────────────────────────────
function setupDropZone(prefix, fileInput, processFile) {
  const zone = document.getElementById(`${prefix}-drop`);
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.drop-clear')) fileInput.click();
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!zone.classList.contains('loaded')) zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    fileInput.value = '';
  });
  document.getElementById(`${prefix}-clear`).addEventListener('click', (e) => {
    e.stopPropagation();
    showEmpty(prefix);
    if (prefix === 'cv') { cvText = ''; cvFileName = ''; }
    else { fileInput._pendingText = null; fileInput._pendingName = null; }
  });
}

// ── CV PDF processing ─────────────────────────────────
setupDropZone('cv', document.getElementById('file-input'), async (file) => {
  if (!file.name.endsWith('.pdf')) {
    showLoaded('cv', file.name, t('pdfInvalid'), true);
    return;
  }
  showLoaded('cv', file.name, t('pdfExtracting'));
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    cvText = pages.join('\n\n').trim();
    cvFileName = file.name;
    showLoaded('cv', file.name, t('pdfPages', cvText.length.toLocaleString(), pdf.numPages));
  } catch (err) {
    showLoaded('cv', file.name, t('pdfError', err.message), true);
  }
});

// ── Instructions .md processing ───────────────────────
const instInput = document.getElementById('inst-file-input');
setupDropZone('inst', instInput, (file) => {
  if (!file.name.endsWith('.md')) {
    showLoaded('inst', file.name, t('instInvalid'), true);
    return;
  }
  showLoaded('inst', file.name, t('instReading'));
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result.trim();
    instInput._pendingText = text;
    instInput._pendingName = file.name;
    showLoaded('inst', file.name, t('charsLoaded', text.length.toLocaleString()));
  };
  reader.onerror = () => showLoaded('inst', file.name, t('instReadError'), true);
  reader.readAsText(file);
});

// ── Save ──────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key').value.trim();
  const extraInstructions = instInput._pendingText ?? null;
  const instFileName = instInput._pendingName ?? null;

  const toSave = { apiKey };
  if (cvText)            { toSave.cvText = cvText; toSave.cvFileName = cvFileName; }
  if (extraInstructions) { toSave.extraInstructions = extraInstructions; toSave.instFileName = instFileName; }

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
  const locale = lang || normalizeLocale(chrome.i18n.getUILanguage());
  await loadMessages(locale);
  setActiveLangBtn(locale);
  applyI18n();
  await loadSaved();
})();
