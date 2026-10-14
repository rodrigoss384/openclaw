# Inicialização até entrega

`workflow-entry.mjs` é a entrada comum dos prompts e do job consumidor. `stage-control.mjs` é o executor interno; `enforce` isolado não registra transição.

## Interface do usuário e preparação interna

O usuário preenche somente `PROJECT_ROOT` e `FEATURE_SLUG` nos prompts que os declaram. Os demais placeholders permanecem no template para o agente resolver conforme `prompts/spec-driven/CONTEXT-BOOTSTRAP.md#preenchimento-pelo-usuário` e a política do manifest. O agente identifica provider e diretórios, produz os artefatos autorizados e preenche os inputs por estágio. O comando `inputs` é um preparador/validador de parâmetros; não é um motor de inferência e não transfere esse preenchimento ao usuário. Solicitação de produto pode vir da conversa; aprovações/credenciais precisam de suas fontes reais.

## Caminho normal

1. Prompt 00: `workflow-entry.mjs init --root <projeto> --provider local|github`. Execute a partir da raiz do runtime fonte ou da cópia instalada. Instala uma cópia gerenciada quando necessário e registra `.specs/project/workflow-entry.json`. GitHub recebe `.github/workflows/sde-delivery.yml`, já com gatilhos PR/push/manual e check `sde-delivery`. Configuração divergente não é sobrescrita.
2. Prompt 01: `workflow-entry.mjs begin --root <projeto> --feature <slug>`. Exige Git root com commit inicial; registra a base antes de escrever intent. Não executa Git init/commit. Retomadas preservam `execution-start.json`. Se a feature estiver no rollout plan de uma initiative em `.specs/initiatives/`, o begin exige a initiative `ready` e `evidence-release` completo em cada dependência declarada na coluna `Depende de`; caso contrário bloqueia sem escrever, e `next` retorna `blocked-by-initiative` com os bloqueios. Feature histórica sem esse registro exige recuperar sua base real antes de migrar.
3. Prompt 02: escreva `execution-paths.json` na feature com `frontendPaths`, `backendPaths`, `testPaths` (arrays de paths relativos, incluindo caminhos planejados). Depois execute `workflow-entry.mjs freeze --root <projeto> --feature <slug>`. Congela a base do begin e o hash de applicability; código alterado entre begin/freeze bloqueia. Segunda execução idêntica retoma; mudança da base/inventário/aplicabilidade bloqueia. Não exclua o registro para escolher outra base.
4. Execute `workflow-entry.mjs inputs --root <projeto> --feature <slug>`. Prepara `enforcement-inputs.json` com mapas por estágio e `enforcement-input-requirements.json` com parâmetros/alternativas faltantes. `needs-inputs` é diagnóstico; nenhuma evidência é inventada. Reexecute após selecionar alternativas para descobrir seus parâmetros adicionais.
5. Prompts 05/07/07.1/07.2/08: complete os inputs reais do estágio e execute `workflow-entry.mjs advance --root <projeto> --feature <slug> --stage <estágio>`. Design pode preceder mudanças de implementação; representative/adversarial/evidence exigem a implementação verificada do snapshot atual. Após corrigir código, reexecute implementation e os gates posteriores aplicáveis.
6. Prompt 09: `workflow-entry.mjs select-delivery --root <projeto> --feature <slug>` seleciona explicitamente a feature em `.specs/delivery.json`; depois `workflow-entry.mjs delivery --root <projeto> --feature <slug>` refaz todos os estágios. O job consumidor executa `workflow-entry.mjs delivery --root <projeto>` e lê essa seleção. Há uma feature selecionada por entrega; trocar a seleção não troca a autoridade do host.

Todos os comandos aceitam paths com espaços. Os exemplos acima usam metavariáveis explicativas; os prompts publicam os comandos com placeholders que precisam ser resolvidos antes de executar. O `init` é reversível/local e não ativa proteção remota. Um projeto sem commit inicial fica bloqueado antes de begin até a operação Git explicitamente autorizada. A seleção da feature e o preenchimento de inputs são preparação, nunca autorização.

## Inputs por estágio

O formato é `{"stages":{"design-readiness":{},"implementation":{},"adversarial":{},"evidence-release":{}}}` para uma feature sem gates representativos. O preparador inclui os gates aplicáveis automaticamente. Dentro de cada estágio, use capability ID → objeto parâmetro/valor; cada valor é um único argumento. Exemplo de parâmetro enumerado já resolvido:

```json
{"frontend-family-consistency-control":{"manifest-or-not-applicable":"manifest","manifest-file":".specs/features/minha-feature/family.json"}}
```

Para a alternativa de não aplicabilidade, use `manifest-or-not-applicable: "not-applicable"` e `not-applicable-reason` separado. Navegação segue o mesmo padrão com `contract-or-not-applicable` e `contract-file`. Não coloque `--manifest`, `--receipt`, `--report-only` ou outros fragmentos de comando nos valores. Overrides de root/feature/base, estágios/capabilities desconhecidos e valores ausentes bloqueiam. Todos os mapas de estágio são exigidos para delivery; advance valida somente o estágio em curso. `--inputs <path relativo>` permite arquivo alternativo explícito.

## Base e autoridade do executor

O executor de entrega exige `SDE_BASE_COMMIT` e `SDE_CONTEXT_SHA256` iguais à base e ao SHA-256 dos bytes de `execution-context.json` devolvidos no freeze. Registre-os no host protegido naquele momento. Calculá-los novamente a partir do checkout candidato durante a entrega anula a independência pretendida. Ausência ou divergência bloqueia. O freeze local detecta sobrescrita acidental, mas não cria uma fronteira de segurança contra quem controla o mesmo usuário/sistema de arquivos.

## UI e aprovação humana

O gate exige `--execution` apontando para JSON com `profileInput`, `bundle`, `sourceRequest` e `collectRequest`, todos paths relativos ao produto. `sourceRequest.files` deve cobrir o código dos diretórios frontend congelados; arquivos de evidência não podem substituir código do produto. Os outputs da cadeia ficam em `.specs/`. `collectRequest.url` deve apontar para o runtime construído a partir do snapshot em avaliação; o produto deve iniciá-lo antes do check. A cadeia executa novamente profile, compile, lint, browser e analyze. Receipts e findings previamente apresentados não substituem execução. A integridade do serviço servido pela URL permanece responsabilidade do executor do produto.

`verify-authorization` recebe decisão, assinatura e gate atual. No runner, o gate fica em `.specs/features/<slug>/ui-release/ui-quality-gate.json`; a verificação humana ocorre depois do gate fresco e consome obrigatoriamente esse arquivo. Aprovação deve ser emitida sobre essa cadeia e snapshot, e a reexecução deve preservar os mesmos resultados para que o vínculo continue válido. `SDE_HUMAN_AUTHORITY` aponta para JSON absoluto fora do checkout, contendo a identidade `project`, `principal` e `allowedSignersPath` absoluto também fora do checkout. O executor deve proteger esses arquivos e o código do verificador. Nenhuma chave humana é criada ou assinatura operacional gerada pelo workflow. Assinatura válida de rejeição, outro gate, outra finalidade ou risco expirado bloqueia.

## Check de entrega nos consumidores

`init --provider github` instala o template distribuído; nenhuma cópia manual é necessária. O job executa em PR, push e execução manual sem filtro de paths. Instala os validadores e Chromium; se `.specs/project/delivery-prepare.mjs` existir, executa esse script antes do gate. O owner do produto deve escrever nele seus comandos reais de instalação/build/start e aguardar readiness, usando o checkout atual. Se a UI precisar de runtime e ele estiver ausente, o gate falha. Nenhum comando genérico cria um runtime de demonstração em substituição ao produto.

O environment `sde-delivery` deve ser protegido e fornecer `SDE_BASE_COMMIT`, `SDE_CONTEXT_SHA256` e, quando UI exigir autorização, `SDE_PROJECT`, `SDE_APPROVER`, `SDE_ALLOWED_SIGNERS`. Uma proteção de merge/deploy deve exigir o check `sde-delivery`; o runner, o workflow e seus inputs de autoridade precisam de custódia compatível. Instalar YAML no checkout não configura essas proteções. Registre evidência do workflow executado e da configuração do provedor para cada consumidor antes de afirmar entrega protegida. Nenhum passo deste programa acessa produção.

Em provider local ou outro CI, invoque a mesma CLI no executor autorizado, com variáveis de contexto fornecidas pelo host. Ausência de configuração, histórico da base, inputs ou gate válido bloqueia. Não use `continue-on-error`, `--dry-run`, relatório antigo ou atualização automática da base como substituto.

## Migração

Receipts sem evidência ligada devem ser regenerados; aprovações incompletas precisam de nova decisão. Antes de migrar feature em andamento, recuperar a base aprovada e os diretórios reais. Não escolher HEAD depois da implementação nem sintetizar decisões de autonomia passadas. Ledger ausente bloqueia enquanto não houver inventário esperado do executor; inventário vazio só é criado no freeze de uma feature nova.
