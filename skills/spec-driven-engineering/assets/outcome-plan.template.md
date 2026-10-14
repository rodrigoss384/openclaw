# <FEATURE_NAME> — Outcome Plan (preregistration)

Ver `skills/spec-driven-engineering/references/outcome-evidence.md` para a
distinção Delivery vs Outcome, vocabulário HEART/Metric Class e o Product
Learning loop. This file is produced by `02-spec-assumptions` and frozen
immediately — see "## Freeze" below. Editing the Preregistration block after
`status: frozen` without following the reopening procedure in that reference
is HARKing (Hypothesizing After the Results are Known) and is mechanically
detectable by `validate-outcome-plan.mjs`.

## Preregistration

- Hipótese: <falsificável, ex: "reduzir passos do onboarding de 5 para 3 aumenta activation em usuários novos">
- Behavioral UX Contract relacionado (se houver): `BUX-<SURFACE>-NNN` ou `Nenhum`
- Metric Class do `primaryMetric`: `user-outcome | business-outcome | safety-ethics-guardrail | technical-reliability-guardrail`
- Dimensão HEART (obrigatória somente quando Metric Class é `user-outcome`): `Happiness | Engagement | Adoption | Retention | Task success | not-applicable`
- `primaryMetric`:
- `guardrails`: lista de métricas que não podem degradar silenciosamente, cada uma com sua própria Metric Class
- Tamanho/duração mínima da amostra:
- Limiar de confirmação vs refutação (fixado agora, nunca ajustado depois de ver dados):
- Método de análise (regra fixa; não escolhida depois de observar os dados):
- Data planejada de início da janela de observação:
- Data planejada de fechamento da janela de observação:

## Freeze

- status: `frozen`
- frozenAt: <ISO date>
- frozenSha256: <sha256 do texto exato do bloco "## Preregistration" acima, calculado no momento do freeze>

`node scripts/validate-outcome-plan.mjs outcome-plan.md` recomputa o sha256 do
bloco Preregistration e falha se `status: frozen` e o hash não corresponder —
qualquer edição do bloco depois do freeze é detectada mecanicamente, sem
depender de disciplina do agente.

## Changelog (reabertura explícita, nunca edição silenciosa)

| Data | Campo alterado | De | Para | Motivo |
|---|---|---|---|---|
