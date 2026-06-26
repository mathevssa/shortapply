# ShortApply ✦

> Fill job application forms with AI — so you can spend less time copy-pasting and more time actually getting hired.

[Buy me a coffee ☕](https://buymeacoffee.com/mathevssa)

---

## What is this?

ShortApply is a Chrome Extension that reads your CV and uses Claude AI to fill out job application forms for you. You hit a shortcut, it fills all the fields. Done.

It handles text inputs, textareas, and dropdowns. It works on most ATS platforms — Greenhouse, Lever, Gupy, Workday, LinkedIn Easy Apply, and plenty more. It even reaches inside iframes, which is where a lot of those modal-based forms hide.

---

## Why I built this

Applying for jobs is mostly the same 15 questions over and over. Name, email, phone, LinkedIn, years of experience, cover letter, salary expectation — repeated across dozens of platforms with slightly different layouts. It's tedious, and that tedium shouldn't stand between good candidates and good jobs.

I wanted something that understood *my* CV and answered those questions the way *I* would — not a generic autofill that just pastes stored values into fields.

---

## How it works

1. You upload your CV as a PDF. The extension extracts the text client-side using PDF.js.
2. You press **⌘⇧F** (or Ctrl+Shift+F on Windows/Linux) on any job application page.
3. ShortApply scans the visible form fields, sends their labels + your CV to Claude (Anthropic's API), and gets back answers for each field.
4. The fields get filled instantly with a green flash. A confirmation bar appears at the bottom — you have 20 seconds to undo everything if something looks off.

For a single focused field, **⌘⇧U** fills just that one — useful for tricky textarea questions where you want to review the answer before moving on.

---

## Features

- **Bulk fill** — fills all visible form fields in one shot (⌘⇧F)
- **Single field fill** — fill just the focused field (⌘⇧U)
- **Undo bar** — optimistic UI with a 20s window to revert everything
- **Expandable field summary** — see exactly what was filled and what was skipped
- **Edit modal** — tweak the AI's answer before inserting it
- **iframe support** — works inside modal forms (Gupy, V8.Tech, etc.)
- **Additional instructions** — paste a `.md` file or write freeform instructions for Claude (salary expectation, preferred language, things not in the CV)
- **Application history** — keeps a log of which pages you've filled and how many fields
- **Language detection** — detects the page language and instructs Claude to respond accordingly
- **Prompt caching** — your CV is cached on Anthropic's side, so repeat calls are ~10x cheaper on the CV tokens
- **i18n** — Portuguese 🇧🇷, English 🇺🇸, and Spanish 🇪🇸

---

## Setup

1. Clone the repo
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the `shortapply/` folder
4. Click the extension icon and paste your [Anthropic API key](https://console.anthropic.com)
5. Upload your CV as a PDF
6. Navigate to any job application and press ⌘⇧F

> **Cost:** Claude Haiku is extremely cheap — roughly **$0.001 per field** without caching, less with it. A full application with 10 fields costs about a cent.

---

## Tech stack

| Thing | What it does |
|---|---|
| Chrome Extension MV3 | Manifest version 3, service worker architecture |
| Claude Haiku (`claude-haiku-4-5`) | The AI model doing the actual reasoning |
| Anthropic Prompt Caching | Caches the CV block between calls |
| PDF.js (bundled) | Extracts text from the uploaded CV locally |
| Vanilla JS | No frameworks — the whole extension is plain JS + CSS |

No backend. No servers. Your CV and API key stay in Chrome's local storage. The only external call is to `api.anthropic.com`.

---

## Project structure

```
shortapply/
├── manifest.json       # MV3 config — permissions, commands, content scripts
├── background.js       # Service worker — calls Anthropic API, handles commands
├── content.js          # Injected into every page — finds fields, fills them
├── content.css         # Confirm bar, toast, overlay, flash animation
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic — CV upload, instructions, history
├── popup.css           # Popup styles
├── _locales/           # i18n strings (pt_BR, en, es)
├── lib/                # Bundled PDF.js
├── icons/              # Extension icons
└── brand/              # Logo assets
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘⇧F / Ctrl+Shift+F | Fill all visible fields |
| ⌘⇧U / Ctrl+Shift+U | Fill the currently focused field |

Shortcuts can be reconfigured at `chrome://extensions/shortcuts`.

---

## Security

- Your API key is stored in `chrome.storage.local` — never sent anywhere except `api.anthropic.com`
- CV text is sent directly from the service worker to Anthropic — the content script never touches your key or your CV
- All prompts include an injection guard to prevent adversarial content in form labels from hijacking the AI's behavior
- No analytics, no telemetry, no external servers

---

## Limitations

- Only works on pages where Chrome's content scripts can run (not `chrome://` pages, PDFs opened in the browser, etc.)
- Quality of answers depends on how well-structured your CV is — the better the CV, the better the fill
- Some platforms with aggressive anti-bot measures may block the field value events

---

## Privacy

ShortApply runs entirely on your machine. There are no servers, no databases, no accounts, and no analytics.

The only data that leaves your device is what's strictly necessary to generate answers: your CV text and the form field labels are sent directly to [Anthropic's API](https://www.anthropic.com/privacy) when you trigger a fill. Your API key is stored locally in Chrome's storage and is never transmitted anywhere else.

**You are responsible for the data you choose to process with this extension.** Do not use it with sensitive documents you wouldn't be comfortable sending to a third-party AI provider. By using ShortApply, you agree that the author bears no liability for any data exposure resulting from your own use of the tool, misconfiguration of your environment, or Anthropic's handling of API requests.

For details on how Anthropic handles API data, refer to their [Privacy Policy](https://www.anthropic.com/privacy).

---

## License

MIT
