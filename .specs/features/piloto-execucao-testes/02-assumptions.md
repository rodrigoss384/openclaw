# Piloto — fatos, decisões e lacunas

## Fatos

- Fork/main escolhido pelo usuário, bootstrap local autorizado e versionado. Base inicial em `execution-start.json`, sem alteração remota da main.
- Runtime instalado e consumer check passou em clone novo, inclusive bytes dos 688 arquivos.
- Dependências frozen/ignore-scripts passaram em Docker; oito testes existentes de retry passaram com Vitest4.0.18 e maxWorkers1.
- Bot privado vinculado ao owner dos bots existentes; execução/projetos permanecem desabilitados.
- Perfis isolados e regressão QA local passaram em Docker; inferência/retomada nativas ainda not-run; probe: execução autenticada governada com grant específico no bot e registro em ledger/runs.

## Inferências e suposições

S-PIL-001: extensão de cobertura de utilitário estável é um escopo proporcional para provar o fluxo em fork descartável, sem evolução de produto. Essa seleção é proposta ao operador no grant, não aprovação retrospectiva.

S-PIL-002: tests-only não requer representative gates de produto; alteração de produção ou descoberta de efeito em interface/persistência/auth reabre applicability e contrato antes de editar.

## Decisões

D-PIL-001: preservar modelos, quotas, autorização e reviewer aprovados para o supervisor; não perguntar novamente esses valores.

D-PIL-002: nenhum receipt/gate artificial para tornar a feature elegível. Freeze usa a base registrada; readiness/delivery somente pelos validadores reais.

D-PIL-003: retomar intervenção na própria conversa, sem entregar controle de quota, GitHub ou daemon ao worker.

## Perguntas

| ID | Pergunta | Status | Autoridade / efeito |
|---|---|---|---|
| Q-PIL-001 | Confirmar o escopo test-only e intervenção controlada, preservando publicação delimitada já aprovada? | resolvida — D-PIL-004 | Rodrigo confirmou o piloto somente de testes; execução/publicação ainda dependem do grant no bot |

D-PIL-004: em 2026-10-12, Rodrigo confirmou explicitamente duas tasks que ampliam testes dos utilitários de retry, sem código de produção; intervenção deliberada na primeira e janela nova na segunda, review Antigravity e PR rascunho. Resposta: Confirmar piloto somente de testes (recomendado). Essa decisão resolve os contratos propostos e não é autorização para executar/publicar antes do convite.

## Bloqueios

B-PIL-001 resolvido no preflight anterior de seis checks; qualificação do HEAD novo precisa de confirmação pelo launcher. Execução aguarda grant específico no bot.

B-PIL-002: Cursor em guest reconhece credencial mas não consegue obter detalhes do usuário. CLI status não comprova identidade nativa; fallback Cursor precisa de probe autenticado antes do piloto aplicável.

B-PIL-003: OAuth refresh/rotação entre cópia guest e coletor não provados; preservar erro/autenticação indisponível como bloqueio, nunca adotar sessão pessoal ou ampliar acessos.

## Adiados

DEF-PIL-001: prontidão completa e evolução funcional do OpenClaw, sem requisito de produto neste pedido. O piloto registra seus checks limitados honestamente.

D-PIL-007: Rodrigo autorizou em 2026-10-12 a correção local somente do symlink root CLAUDE.md no bootstrap. Commit 25b38b845de35a3aecfd8ef48600cc594adea33c. Feature nova começou após esse commit, preservando baseline/context do piloto anterior. Não concede execute/publicação.
