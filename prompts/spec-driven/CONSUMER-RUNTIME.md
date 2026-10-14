# Instalar o workflow em um projeto consumidor

O repositório `agents` é a fonte de verdade. Cada projeto recebe uma cópia física versionada do runtime para continuar funcional quando sua pasta for aberta isoladamente no VS Code.

## Entrada integrada

Para um projeto novo, use a partir do runtime fonte `node integrations/governance/workflow-entry.mjs init --root <projeto> --provider local` ou `--provider github` quando esse for o provedor autorizado. Isso compõe a instalação abaixo e registra a entrada de entrega; GitHub também recebe `.github/workflows/sde-delivery.yml` executável em PR/push/manual. Não há Git init/commit, instalação de secrets ou configuração remota implícitos. `integrations/governance/DELIVERY.md` descreve a sequência completa e os pré-requisitos.

## Instalação

Exemplo para A²I:

```bash
cd /home/rodrigo/Documentos/agents
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs install \
  --target /home/rodrigo/Documentos/projetos/a2i
```

O comando exige um Git root, faz preflight integral e não sobrescreve arquivo divergente. Conflito retorna exit `2` antes da primeira escrita.

Se o projeto já contém uma cópia antiga, a primeira instalação continuará bloqueada por segurança. Revise os conflitos e faça a migração explícita:

```bash
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs install \
  --target /home/rodrigo/Documentos/projetos/a2i \
  --adopt-existing
```

`--adopt-existing` aceita somente arquivos regulares de um runtime legado comprovado por `workflow.lock.json` válido ou pela presença do mesmo conteúdo na mesma path do histórico Git da fonte. Ele preserva os originais em `.specs/workflow-runtime-backups/` e faz o uninstall restaurá-los.

A mesma flag permite manter symlinks preexistentes quando eles são relativos, não estão quebrados e resolvem para um arquivo ou diretório dentro do próprio Git root. O instalador registra essa topologia, grava e restaura o conteúdo no destino interno e nunca substitui o link. `check`, `update` e `uninstall` bloqueiam se o link, seu destino ou seu tipo mudarem. Symlinks absolutos, externos, quebrados, direcionados a roots protegidos ou não registrados continuam proibidos.

## Sincronizar todos os projetos

A partir da fonte central, uma única invocação sincroniza os ambientes globais de agente, instala projetos novos, atualiza os já gerenciados e executa `check --source` em todos:

```bash
cd /home/rodrigo/Documentos/agents
node skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs sync
```

Sem argumentos, o batch usa `../projetos`, portanto resolve `/home/rodrigo/Documentos/projetos` a partir desta fonte. Para outro layout:

```bash
node skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs sync \
  --projects-root /caminho/para/projetos
```

O runner considera somente filhos diretos, em ordem lexical, e não atravessa repositórios aninhados. Diretórios sem `.git` mas com marcadores como `package.json`, `pyproject.toml`, `Cargo.toml` ou `go.mod` são reportados como `git-root-required` e bloqueiam o status completo sem receber escrita. Apenas infraestrutura sem Git e sem marcador de projeto é listada como `SKIPPED`. O resumo retorna exit `0` somente quando todos os projetos passam; qualquer falha produz exit `2`, identifica o projeto e não impede a inspeção dos projetos seguintes.

Para uma primeira migração que já possua runtime legacy comprovável ou symlinks internos seguros, a adoção continua explícita:

```bash
node skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs sync --adopt-existing
```

Também estão disponíveis `install`, `update` e `check` em lote. `sync` é o comando recomendado para manter toda a pasta alinhada.

`sync` e `check` também cobrem os ambientes globais (`~/.agents`, `~/.claude`, `~/.gemini`, `~/.codex`, `~/.opencode`, `~/.cursor`): cada skill de `workflow.lock.json` em todo ambiente que já tem `skills/` e o `rules.md` em todo ambiente que já o possui. `sync` instala com backup em `~/.agents/skill-release-backups/` e depois verifica; `check` só verifica. Uma skill cuja fonte divergiu do lock não é propagada (`source-differs-from-lock`): regenere o lock conscientemente antes. `evals` e `node_modules` nunca são copiados, e destinos em symlink nunca são substituídos. O resultado aparece em linhas `[AGENTS]` e em `agentHomes=` no `[SUMMARY]`; falha nesses ambientes torna o exit `2`, sem impedir o processamento dos projetos.

Depois da instalação, abra somente a pasta do projeto e execute o check local:

```bash
cd /home/rodrigo/Documentos/projetos/a2i
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs check --target .
```

## Dependências locais

O instalador não copia `node_modules` nem executa rede. Quando os validators do frontend forem necessários:

```bash
npm ci --prefix skills/frontend-product-builder
```

O provider Impeccable continua pinado pelo workflow e pode ser verificado com:

```bash
npx --yes impeccable@3.5.0 --version
```

As skills também permanecem sincronizadas uma vez por ambiente de agente (`~/.agents`, `~/.codex`, `~/.claude`, `~/.gemini`, `~/.opencode`, `~/.cursor`). A cópia no projeto fornece os scripts e contratos locais; a instalação global fornece descoberta por nome para cada CLI.

## Executar os prompts

1. Abra somente o Git root do produto no VS Code.
2. Para a primeira execução, envie `prompts/spec-driven/00-project-init.prompt.md` ao agente e informe o root real do projeto.
3. Em brownfield, execute depois `00.5-brownfield-map.prompt.md`.
4. Siga a ordem de `prompts/spec-driven/manifest.json`.
5. Um chat novo pode retomar pelo `.specs/HANDOFF.md` e pelos artefatos do projeto.

O agente deve resolver todos os placeholders com evidência; tokens literais não podem permanecer nos artefatos finais.

## Verificar contra a fonte atual

Execute a partir da fonte central:

```bash
cd /home/rodrigo/Documentos/agents
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs check \
  --target /home/rodrigo/Documentos/projetos/a2i \
  --source .
```

`SOURCE_DISTRIBUTION_MISMATCH` significa que a cópia está íntegra, mas existe uma distribuição mais nova na fonte.

## Atualizar

```bash
cd /home/rodrigo/Documentos/agents
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs update \
  --target /home/rodrigo/Documentos/projetos/a2i
```

Update substitui somente arquivos cujo hash ainda corresponde à instalação anterior. Versões substituídas são preservadas em `.specs/workflow-runtime-backups/`.

## Remover

Dentro do projeto consumidor:

```bash
node skills/spec-driven-engineering/scripts/consumer-runtime.mjs uninstall --target .
```

Uninstall remove somente arquivos gerenciados e inalterados. Qualquer modificação local bloqueia toda a operação. Backups recuperáveis permanecem preservados.

## Arquivos que o instalador não gerencia

- `AGENTS.md` e `CLAUDE.md` do produto;
- `.github/workflows/` do produto;
- `.specs/features/`, `.specs/project/`, `.specs/codebase/` e HANDOFF do produto;
- código, testes, documentação e configuração próprios do produto;
- `node_modules`, `evals`, `.gitnexus` e índices locais.
