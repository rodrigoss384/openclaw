# Piloto — Propriedades

**Aplicável:** Sim, casos tabelados determinísticos no Vitest existente. Sem nova biblioteca.

### PROP-PIL-001 — Configuração limitada

- Requisito/AC: REQ-PIL-001 / AC-PIL-001 / AT-PIL-001.
- Para cada override válido ou inválido declarado no contrato, attempts inteiro >=1, minDelayMs inteiro >=0, maxDelayMs >=minDelayMs e jitter entre0e1; valores não finitos retornam ao default.
- Domínio finito gerado por tabela: zero, negativo, fracionário positivo, extremos finitos, NaN e infinitos, overrides ausentes/parciais.
- Oráculo: contrato de limites com expected values explicitados por caso; não reproduzir clampNumber linha a linha no teste.
- Contraexemplos: attempts0/negativo, max inferior a min, jitter fora do intervalo, NaN/Infinity propagados.
- Local planejado: src/infra/retry.test.ts, describe resolveRetryConfig.

### PROP-PIL-002 — Erro e tentativa terminal

- Requisito/AC: REQ-PIL-001 / AC-PIL-001 / AT-PIL-001.
- Para uma sequência finita de tentativas sem sucesso, o erro final é propagado por identidade, callbacks ocorrem somente antes de retry real e carry attempt/maxAttempts/err corretos.
- Geração tabelada1/2/3 tentativas, fake timers/zero-delay, sem IO externo.
- Contraexemplos: callback após última tentativa, erro anterior substitui terminal, tentativa extra.
- Local planejado: src/infra/retry.test.ts, describe retryAsync.

### PROP-PIL-003 — Autoridade monotônica

- Requisitos/ACs: REQ-PIL-003, REQ-PIL-004, REQ-PIL-005, REQ-PIL-006, AC-PIL-002, AC-PIL-004, AC-PIL-005, AC-PIL-006.
- Estado de progresso, texto do agente e relógio de reset não ampliam efeitos nem aprovações. Duplicata não multiplica execução/publicação. Alteração dos SHAs invalida relatório daquela combinação.
- Oráculo operacional: grant/digest/task/run e eventos nativos/GitHub; teste local do supervisor é complemento, não prova do piloto autenticado.
- Evidência nativa pendente; não substituir essa propriedade por declaração narrativa de conclusão.
