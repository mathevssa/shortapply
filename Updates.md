# Updates

## 2026-07-01 - Melhorias em Dropdowns e Segurança

### Mudanças
- **Dropdowns**: Melhorada a lógica de matching para seleção de opções em dropdowns
  - Matching flexível: tenta número → match exato → match parcial → match reverso
  - Remove aspas e caracteres especiais antes de comparar
  - Funciona mesmo quando a IA retorna o texto da opção em vez do número

- **Prompts**: Otimizados os prompts para campos dropdown
  - Instruções mais explícitas para responder APENAS com o número
  - Reduz erros quando usando DeepSeek

- **Segurança**: Adicionadas múltiplas camadas de sanitização
  - Validação de `sender.tab` para rejeitar mensagens não-autorizadas
  - Sanitização de inputs (remove caracteres de controle, RTL overrides)
  - Limite de tamanho em labels (200 chars) e contexto (150 chars)
  - Sanitização de respostas antes de inserir no DOM
  - Validação de estrutura em respostas da API

- **UI**: Badge na barra de confirmação
  - Mostra qual API foi usada (Anthropic ou DeepSeek)
  - Aparece tanto em preenchimento individual quanto em bulk

### Objetivo
Corrigir problema onde dropdowns não eram preenchidos corretamente com DeepSeek, além de fortalecer a segurança contra prompt injection e XSS.

---

## 2026-07-01 - Suporte a Múltiplos Provedores de API

### Mudanças
- **Dropdown de Provedor**: Adicionado seletor Anthropic/DeepSeek no popup
  - Salva API keys separadas para cada provedor
  - Troca automática ao selecionar provedor diferente
  - Placeholder e link atualizados dinamicamente

- **Background**: Roteamento inteligente baseado no provedor selecionado
  - `apiKey_anthropic` e `apiKey_deepseek` salvos separadamente
  - Compatibilidade com formato legado `apiKey`

- **Internacionalização**: Atualizadas traduções PT/EN/ES
  - Novas keys: `apiKeyHintAnthropic`, `apiKeyHintDeepseek`

### Objetivo
Permitir que o usuário escolha entre Anthropic (mais caro, ~$0.001/campo) e DeepSeek (mais barato, ~$0.0001/campo) sem perder as keys salvas.

---

## 2026-06-27 - Versão Inicial

### Funcionalidades
- Preenchimento automático de formulários de emprego
- Suporte a campos de texto, textarea, select e contentEditable
- Extração de texto de PDF (CV)
- Instruções adicionais personalizáveis
- System prompt editável
- Histórico de candidaturas
- Atalhos de teclado (Cmd+Shift+F / Cmd+Shift+U)
- Barra de confirmação com undo e edição
- Suporte a 3 idiomas (PT, EN, ES)

### Objetivo
Automatizar o preenchimento de candidaturas de emprego usando IA para analisar o CV e preencher campos automaticamente.
