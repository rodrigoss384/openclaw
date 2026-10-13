# OpenClaw: fork descartável para piloto do supervisor

**Visão:** Usar o fork autorizado como ambiente de teste do fluxo de execução automática, validação independente e publicação em PR rascunho.
**Para:** Operador da control plane e supervisor determinístico.
**Problema:** A implementação local do supervisor ainda precisa de prova com CLIs autenticadas, reinícios, intervenção humana e GitHub real.

## Governança

- `workflow.rulesFile`: `rules.md`.
- Instruções de produto: `AGENTS.md`, preservado.
- Provider de delivery: `local`, registrado em `workflow-entry.json`; publicação do supervisor é independente desse provider.
- Repositório autorizado: `rodrigoss384/openclaw`; destino de PR: `main`.
- GitHub Actions desabilitado somente neste fork. Não há proteção remota de merge comprovada.

## Objetivos

- Provar uma task por sessão, autorização idempotente, espera por quota, retomada e parada em gate humano com evidências reais.
- Provar revisão exclusiva pelo Antigravity, checks isolados e PR rascunho até validação passar.
- Preservar os working trees e bots manuais existentes.

## Stack observada

- TypeScript/ESM; Node do produto `>=22.12.0`; supervisor/worker qualificado em Node 24.
- Package manager registrado: `pnpm@10.23.0`.
- Test runner existente: Vitest; comandos reais em `package.json` e configurações `vitest*.config.ts`.
- Runtime de governança instalado: workflow 2.4.0, consumer runtime 1.2.0, 688 arquivos gerenciados.

## Escopo

O fork foi autorizado para teste. A feature piloto ainda será especificada; nenhum comportamento de produto foi aprovado ou implementado nesta inicialização. A main remota permanece intacta. Execução e publicação exigem o grant específico do supervisor.

Ficam fora do piloto: merge, deploy, escrita em serviços reais, integração com contas pessoais do OpenClaw e comprovação de prontidão do produto inteiro a partir de testes limitados.

## Restrições e lacunas

- Projetos desabilitados; serviço em `observe`.
- Perfil piloto atual: 2 GiB/1 CPU, sujeito ao orçamento do daemon e reserva do host.
- Baseline de preparação local: `36194198b60d2e3a398d9413fa8eb66228e76f63`; main preservada em `7ecfc1d93c7947988e75fae1e7747158f32597fd`.
- Integridade do runtime comprovada em clone novo; build/lint/testes/stack completos do OpenClaw ainda não comprovados.
- Inventário de arquitetura, contratos de produto e ambientes de produção não realizado nesta etapa; não inferir autorização de acesso.

## Fontes

Pedido e decisões humanas do piloto; `AGENTS.md`, `package.json`, `workflow-runtime-install.json`, `workflow-entry.json`; probes locais preservados no pacote de evidências do supervisor. Esta inicialização registra o contexto limitado de teste, sem replanejar o produto OpenClaw.
