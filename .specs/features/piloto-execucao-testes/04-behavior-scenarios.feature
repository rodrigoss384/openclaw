# language: pt
Funcionalidade: Piloto governado de execução segura no fork descartável
  # Contrato proposto; Q-PIL-001 resolvida; execução exige grant. Não adota Cucumber.
  @SCN-PIL-001 @AC-PIL-001
  Cenário: Cobertura dos invariantes de retry sem mudança de produção
    Dado o utilitário de retry existente e seu contrato vigente
    Quando as duas tasks ampliarem a cobertura tabelada de limites e erro terminal
    Então os invariantes observáveis e os oito testes anteriores devem passar
    E nenhum código de produção deve ser alterado

  @SCN-PIL-002 @AC-PIL-002
  Cenário: Intervenção na mesma conversa e task seguinte limpa
    Dado a primeira task autorizada e aguardando a intervenção prevista
    Quando o operador responder à tentativa exata pelo bot
    Então a continuação deve usar a mesma sessão e conta
    E uma resposta duplicada não deve executar outra continuação
    E a task seguinte deve iniciar em uma sessão e home novos

  @SCN-PIL-003 @AC-PIL-003
  Cenário: Revisão Antigravity sem reparo do avaliado
    Dado a feature candidata e os SHAs da revisão
    Quando a revisão independente for despachada
    Então somente Antigravity Pro3.1High deve ser usado em checkout readonly
    E um achado bloqueante deve preservar evidência e esperar correção autorizada

  @SCN-PIL-004 @AC-PIL-004
  Cenário: Publicação delimitada mantém rascunho até os gates
    Dado um grant válido para o fork e a branch própria do job
    Quando o launcher publicar a feature
    Então deve existir um único PR em rascunho para main
    E somente achados comprovados devem produzir issues vinculadas
    E promoção para pronto deve exigir revisão e validação dos mesmos SHAs
    E nenhum merge ou deploy deve ocorrer

  @SCN-PIL-005 @AC-PIL-005
  Cenário: Quota e retomada não ampliam autoridade
    Dado a task atual e snapshots autenticados recentes
    Quando ocorrer espera por quota ou reinício
    Então o dispatcher deve revalidar quota e reconciliar escritores
    E não deve trocar provider por teste reprovado
    E retorno Cursor para Codex deve ocorrer apenas na próxima task
    E o guest não deve alterar o collector do host

  @SCN-PIL-006 @AC-PIL-006
  Cenário: Checks independentes preservam veredictos e bloqueios
    Dado a main atual e feature em checkouts de baseline e integração
    Quando um comando posterior falhar
    Então os comandos anteriores aprovados devem permanecer aprovados
    E comandos seguintes devem ser registrados como not-run; probe da sequência de QA
    E conflito ou mudança dos SHAs deve impedir a liberação
