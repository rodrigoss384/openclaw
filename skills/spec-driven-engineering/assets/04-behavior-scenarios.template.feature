Feature: <FEATURE_NAME>

  @SCN-<PREFIX>-001 @AC-<PREFIX>-001
  Scenario: <CENÁRIO POSITIVO>
    Given <estado inicial>
    When <ação>
    Then <resultado observável>

  @SCN-<PREFIX>-002 @AC-<PREFIX>-001
  Scenario: <CENÁRIO NEGATIVO>
    Given <estado inicial>
    When <ação inválida ou falha>
    Then <erro ou estado esperado>
