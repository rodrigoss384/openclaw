# <FEATURE_NAME> — Outcome Evidence (LEARN)

Ver `skills/spec-driven-engineering/references/outcome-evidence.md` para a
distinção Delivery vs Outcome, vocabulário HEART/Metric Class e o Product
Learning loop. Este artefato nunca edita `11-evidence.md` nem o
`outcome-plan.md` que o precede — a hipótese, métrica, guardrails e limiar
já estão congelados lá; este arquivo só registra o que foi observado contra
eles.

- `outcomePlanSha`: <copie exatamente `frozenSha256` de `outcome-plan.md` —
  prova mecânica de qual versão pré-registrada da hipótese foi observada.
  Se o hash recomputado de `outcome-plan.md` não corresponder a este valor,
  pare: alguém editou o plano sem seguir a reabertura, e a observação abaixo
  não pode ser atribuída com confiança a essa hipótese.>

## Observação (preenchido só após a janela de observação fechar)

| Métrica | Metric Class | Baseline | Observado | Delta | Limiar atendido? |
|---|---|---|---|---|---|
| `primaryMetric` | | | | | |
| guardrail 1 | | | | | |

**Qualidade da evidência observada:**

- `sourceEvidenceGrade`: `A | B | C | D | not-applicable` — força da literatura
  comportamental por trás da hipótese (do Behavioral UX Contract relacionado,
  quando houver). Não confundir com o item abaixo.
- `outcome.method`: `randomized-experiment | quasi-experiment | moderated-usability-study | direct-user-feedback | support-signal-analysis`
- `outcome.quality`: `strong | moderate | qualitative-supported | inconclusive` —
  qualidade da evidência *produzida por este experimento/observação*, não a
  força da literatura prévia.

## Resultado (LEARN)

- Hipótese: `confirmada | refutada | inconclusiva`
- Guardrail regrediu enquanto `primaryMetric` melhorou? `sim | não` — se sim, descreva sem reinterpretar como vitória parcial.
- Decisão: `codificar como precedente | atualizar hipótese e reabrir DISCOVER/HYPOTHESIZE | manter em observação`

## Próxima ação do Product Learning loop
