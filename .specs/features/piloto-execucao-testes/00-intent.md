# Piloto de execução segura — Intenção

**Feature:** `piloto-execucao-testes`
**Prefixo:** `PIL`
**Status:** `in-progress`
**Complexidade:** `small`
**Criticidade:** `standard`

## Problema e consumidores

O supervisor tem testes locais, mas ainda precisa demonstrar execução task a task com CLIs autenticadas e revisão/publicação no fork autorizado. O consumidor é o operador da control plane. O usuário autorizou usar este fork descartável para testar; não solicitou uma evolução funcional do OpenClaw.

O perímetro proposto é ampliar a cobertura de regressão dos utilitários de retry existentes, preservando o comportamento de produção. O contrato concreto e seu grant ainda serão apresentados antes de executar; a seleção desta atividade de teste é uma proposta de piloto, não aprovação de mudança de produto.

## Objetivos e sinais de sucesso

- Duas tasks delimitadas que começam em sessões novas e conseguem registrar alterações/commits locais.
- Intervenção humana explícita na primeira task, encaminhada somente à mesma conversa/run/conta; a task seguinte começa limpa.
- Regressões reproduzíveis na suite Vitest existente e checks em Docker, comparados com a main/integração.
- Revisão somente pelo Antigravity em sessão limpa e checkout readonly.
- Branch e PR rascunho no próprio fork, issues somente de achados comprovados; promoção depende de checks, revisão e gates. Merge humano.
- Evidências separadas para cada cenário operacional: duplicata, restart, cancelamento, quota/retorno, gate e publicação. Não atribuir ao piloto cenários apenas simulados ou ainda não observados.

## Não objetivos

Alterar produção, retryAsync/resolveRetryConfig, interfaces públicas, dependências, lockfiles ou contas do OpenClaw; substituir o runner; executar testes live com tokens reais; merge, deploy ou cobranças adicionais. A suite limitada não comprova prontidão do OpenClaw inteiro. Stack descartável/build/lint aplicáveis ainda precisam de perfil qualificado; não declarar QA final aprovado apenas pelo unit test selecionado.

## Classificação e risco

Small: duas tasks de cobertura em um arquivo de teste existente, sem código de produção previsto. Standard: inferência e publicação reais exigem autorização persistida e evidência; nenhuma autoridade de merge ou produção. Frontend/backend de produto, persistência/migration, auth/tenancy, concorrência de produto e contrato público permanecem inalterados. Representative gates de produto não são preliminarmente necessários; o gate humano de autorização do supervisor e evidence/release permanece. Perfil de stack e recursos ainda em qualificação.

## Dependências e restrições

Baseline inicial registrado canonicamente por `begin`: `36194198b60d2e3a398d9413fa8eb66228e76f63`. Runtime instalado/integridade validada em clone novo. Modelos/catalogos e quotas não provam inferência/retomada nativas. Serviço observe, projetos desabilitados. Nenhum gate/design/execute já concluído.

Vitest 4.0.18 no lockfile; pnpm 10.23.0; Node 24 qualificado. Unit retry existente passou em Docker com um worker; instalação frozen/ignore-scripts passou em checkout descartável. Memória perfil2GiB/CPU1, sem privilégio/socket/home amplo. Necessário preservar collector auth/config separados dos homes de task.

## Restrições explícitas do pedido

| Restrição | Vínculo |
|---|---|
| Fork autorizado `rodrigoss384/openclaw`, PR para main, produção usa repo de cada projeto | REQ-PIL-003 |
| Codex `gpt-6-luna` high nas duas contas; Cursor Grok4.6High só após quotas Codex indisponíveis; retorno entre tasks | REQ-PIL-001 / REQ-PIL-004 |
| Task nova em janela limpa, respostas humanas na mesma sessão | REQ-PIL-001 |
| Revisão independente sempre Antigravity Pro3.1High; executor fallback Flash3.8High | REQ-PIL-002 |
| PR rascunho até QA/revisão/gates; issues só comprovadas; merge humano | REQ-PIL-003 |
| Quotas incluídas, sem cobrança adicional; cincohoras90/semana95/Cursor90 | REQ-PIL-004 |
| Containers descartáveis; isolamento, limites e preservação dos bots/WIP | REQ-PIL-005 |
| Branch/commits do bootstrap local explicitamente aprovados; execução com grant distinto | REQ-PIL-006 |
| Supervisor determinístico sem Hermes no v1 | REQ-PIL-004 |

## Requisitos iniciais

| ID | Requisito | Prioridade | Fonte |
|---|---|---|---|
| REQ-PIL-001 | Provar duas tasks/sessões e uma intervenção na mesma sessão, com escopo limitado a testes de retry | P0 | Pedido de task/janela e piloto sandbox |
| REQ-PIL-002 | Revisão independente exclusiva Antigravity, sem reparo do avaliado | P0 | Decisão humana de reviewer |
| REQ-PIL-003 | Publicação no fork em PR rascunho, issues comprovadas, sem merge | P0 | Decisão GitHub aprovada |
| REQ-PIL-004 | Preservar quotas, roteamento e espera; registrar cenários reais separadamente | P0 | Regras aprovadas do supervisor |
| REQ-PIL-005 | Validar baseline/integração em isolamento e preservar arquivos/credenciais fora do checkout | P0 | Plano aprovado de segurança/QA |
| REQ-PIL-006 | Não executar nem publicar sem convite/grant específico e gates canônicos | P0 | Autorização inicial e limites aprovados |

## Perguntas em aberto

Q-PIL-001 resolvida em 02 por D-PIL-004: usuário confirmou o piloto somente de testes. Execução permanece bloqueada até perfil e grant específico. A escolha do fork e bootstrap já está resolvida por AD-PIL-001/002.

## Ideias adiadas

DEF-PIL-001: validação completa de prontidão do produto OpenClaw e alterações funcionais; o piloto comprova o fluxo e um escopo de testes delimitado, sem ampliar a promessa de QA.
