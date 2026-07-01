# Updates

## 2026-07-01 - Dropdown Improvements & Security Hardening

### Changes
- **Dropdowns**: Enhanced matching logic for dropdown option selection
  - Flexible matching: tries number → exact match → partial match → reverse match
  - Strips quotes and special characters before comparison
  - Works even when AI returns option text instead of number

- **Prompts**: Optimized prompts for dropdown fields
  - More explicit instructions to respond with NUMBER ONLY
  - Reduces errors when using DeepSeek

- **Security**: Added multiple sanitization layers
  - `sender.tab` validation to reject unauthorized messages
  - Input sanitization (removes control characters, RTL overrides)
  - Size limits on labels (200 chars) and context (150 chars)
  - Response sanitization before DOM insertion
  - API response structure validation

- **UI**: Provider badge on confirmation bar
  - Shows which API was used (Anthropic or DeepSeek)
  - Appears on both single field and bulk fill

### Objective
Fix issue where dropdowns weren't being filled correctly with DeepSeek, plus strengthen security against prompt injection and XSS attacks.

---

## 2026-07-01 - Multi-Provider API Support

### Changes
- **Provider Dropdown**: Added Anthropic/DeepSeek selector in popup
  - Saves separate API keys for each provider
  - Automatic key swap when switching providers
  - Dynamic placeholder and link updates

- **Background**: Smart routing based on selected provider
  - `apiKey_anthropic` and `apiKey_deepseek` saved separately
  - Backwards compatible with legacy `apiKey` format

- **Internationalization**: Updated PT/EN/ES translations
  - New keys: `apiKeyHintAnthropic`, `apiKeyHintDeepseek`

### Objective
Allow users to choose between Anthropic (more expensive, ~$0.001/field) and DeepSeek (cheaper, ~$0.0001/field) without losing saved keys.

---

## 2026-06-27 - Initial Release

### Features
- Automatic job application form filling
- Support for text inputs, textareas, selects, and contentEditable
- PDF text extraction (CV)
- Customizable additional instructions
- Editable system prompt
- Application history tracking
- Keyboard shortcuts (Cmd+Shift+F / Cmd+Shift+U)
- Confirmation bar with undo and edit
- Multi-language support (PT, EN, ES)

### Objective
Automate job application form filling using AI to analyze CV and populate fields automatically.
