# Estado do piloto

**Atualização:** 2026-10-12.
**Feature atual:** piloto-execucao-testes, preparada para convite específico pelo supervisor. Nenhuma task/inferência/publicação executada nesta preparação.

## Decisões humanas vigentes

- AD-PIL-001: fork descartável rodrigoss384/openclaw; main remota intacta, sem merge/deploy. Cada projeto real publicará no próprio origin cadastrado.
- AD-PIL-002: bootstrap local autorizado; commits3342d2c e3619419. Runtime688 arquivos íntegro.
- AD-PIL-004: escopo confirmado somente em src/infra/retry.test.ts: primeira task amplia normalização dos overrides, segunda amplia erro terminal/callback. Intervenção deliberada na primeira, segunda conversa limpa. Sem produção/dependências/lockfile alterados.
- AD-PIL-005: correção local somente do symlink root CLAUDE.md → AGENTS.md autorizada e commitada em25b38b845de35a3aecfd8ef48600cc594adea33c. Novo piloto iniciado e congelado depois desse commit. Piloto anterior bloqueado, registros congelados intactos; não reescrever seu baseline.
- AD-PIL-003: autorização de preparação não é execute/publicação; somente grant específico vinculado pelo bot permite iniciar. Gates humanos canônicos e merge/deploy ficam com o operador.

## Fatos verificados

Design-readiness canônico complete, package validation sem erros/warnings. Baseline25b38b8/contextSHA7b7e9c7; testPaths somente retry.test.ts. Preflight final de clone novo passou: isolamento e seis checks cadastrados, incluindo instalação frozen/ignore-scripts, oito testes retry existentes, formatação/lint e typecheck completo. Perfil3GiB/2CPUs e reserva host4GiB. Build/migrations/stack não aplicáveis à alteração exclusiva de testes; isso não comprova prontidão completa OpenClaw.

Homes de conversa separados do coletor; somente credencial necessária readonly, sem configurações/hooks/histórico/MCP importados. Codex1/2 e Claude auth status passed em guest; Cursor status reconheceu login sem detalhes GetMe. Dados atuais de quota precisam de nova coleta antes de dispatch.

## Modelos e roteamento aprovados

Codex1→Codex2→Cursor→Antigravity executor por quota, nunca por teste reprovado. Codex ocupado espera. Codex gpt-6-luna high; Cursor cursor-grok-4.6-high. Reviewer exclusivamente Antigravity gemini-3.1-pro-high; último executor reserva gemini-3.8-flash-high. Teto five-hour90%, weekly95%, Cursor90%; retomada humana na mesma conta/modelo/sessão. Nenhuma cobrança adicional habilitada.

## Provas operacionais ainda pendentes

Grant, inferência real/model entitlement, intervenção same-session, segunda task limpa, revisão readonly Agy, QA feature/main e publicação rascunho/achados reais. Probe: executar o job específico pelo supervisor após autorização. OAuth refresh/rotação e Cursor GetMe ainda sem prova nativa; preservar indisponibilidade como blocker de autenticação, sem adotar sessão pessoal ou ampliar acesso. Cenários reais de quotas/restart/cancel/gates devem ser comprovados antes de certificar piloto/rollout.

## Lições e próximos passos

Seis arquivos CRLF do runtime usam overrides estreitos -text para manter integridade. Ferramenta pnpm temporária em/tmp noexec é invocada pelo Node; lifecycle scripts desabilitados. Typecheck2GiB recebeu SIGKILL, 3GiB com GOMAXPROCS2/GOMEMLIMIT1800MiB passou. Download403 histórico preservado; concorrência4 acompanhou sucesso, sem prova definitiva de causa. Não repetir logins/tokens/billing ou bootstrap. Ao receber TASK_ID autorizado, seguir contratos00–09 e a fronteira do grant; texto de agente não aprova gate.
