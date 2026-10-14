# Bounded Context Canvas

O Bounded Context Canvas é uma ferramenta para documentar e comunicar os aspectos essenciais de um Bounded Context.

## Template de Bounded Context Canvas

```markdown
# [NOME DO BOUNDED CONTEXT]

## 1. Informações Básicas

**Nome**: [Nome do contexto usando linguagem ubíqua]
**Descrição**: [Breve descrição do propósito e responsabilidade]
**Domínio**: [ ] Core Domain  [ ] Supporting Subdomain  [ ] Generic Subdomain
**Tipo de Negócio**: [ ] Gerador de Receita  [ ] Diferenciador Competitivo  [ ] Suporte
**Evolução**: [ ] Gênese  [ ] Custom Built  [ ] Product  [ ] Commodity

## 2. Descrição Estratégica

### Propósito de Negócio
[Por que este contexto existe? Qual problema de negócio resolve?]

### Capacidades de Negócio
- [Capacidade 1]
- [Capacidade 2]
- [Capacidade 3]

### Fluxos de Negócio Principais
1. [Fluxo 1]: [Descrição resumida]
2. [Fluxo 2]: [Descrição resumida]
3. [Fluxo 3]: [Descrição resumida]

## 3. Linguagem Ubíqua

### Glossário de Termos

| Termo | Definição | Sinônimos/Aliases |
|-------|-----------|-------------------|
| [Termo 1] | [Definição precisa no contexto deste BC] | [Se houver] |
| [Termo 2] | [Definição precisa no contexto deste BC] | [Se houver] |
| [Termo 3] | [Definição precisa no contexto deste BC] | [Se houver] |

### Conceitos Ambíguos
[Liste termos que têm significados diferentes em outros contextos]

- **[Termo]**: 
  - Neste contexto: [significado aqui]
  - Em [outro contexto]: [significado lá]

## 4. Modelo de Domínio

### Agregados

#### [Nome do Agregado 1]
- **Raiz**: [Nome da entidade raiz]
- **Entidades**: [Lista de entidades]
- **Value Objects**: [Lista de VOs]
- **Invariantes**: 
  - [Regra de negócio 1]
  - [Regra de negócio 2]

#### [Nome do Agregado 2]
- **Raiz**: [Nome da entidade raiz]
- **Entidades**: [Lista de entidades]
- **Value Objects**: [Lista de VOs]
- **Invariantes**: 
  - [Regra de negócio 1]
  - [Regra de negócio 2]

### Serviços de Domínio
- **[Nome do Serviço]**: [Responsabilidade]

### Domain Events
- **[Nome do Evento]**: [Quando ocorre e o que significa]

### Políticas de Domínio
- **[Nome da Política]**: [Quando] → [Então]

## 5. Dependências e Integrações

### Contextos Upstream (Fornecedores)

| Contexto | Relação | Dados Consumidos | Como Integra |
|----------|---------|------------------|--------------|
| [Nome] | [Customer-Supplier/Conformist/ACL] | [O que consome] | [REST/Events/etc] |

### Contextos Downstream (Consumidores)

| Contexto | Relação | Dados Fornecidos | Como Integra |
|----------|---------|------------------|--------------|
| [Nome] | [Customer-Supplier/OHS] | [O que fornece] | [REST/Events/etc] |

### Sistemas Externos

| Sistema | Propósito | Padrão de Integração | Observações |
|---------|-----------|---------------------|-------------|
| [Nome] | [Para que integra] | [ACL/Adaptador/etc] | [Notas importantes] |

## 6. Arquitetura e Tecnologia

### Estrutura de Camadas
```
┌─────────────────────────────────┐
│   Interface (API/UI)            │
├─────────────────────────────────┤
│   Application Services          │
├─────────────────────────────────┤
│   Domain Model                  │
├─────────────────────────────────┤
│   Infrastructure               │
└─────────────────────────────────┘
```

### Stack Tecnológico
- **Linguagem**: [Java/TypeScript/C#/etc]
- **Framework**: [Spring Boot/NestJS/.NET/etc]
- **Persistência**: [PostgreSQL/MongoDB/etc]
- **Mensageria**: [RabbitMQ/Kafka/etc]
- **Observabilidade**: [Prometheus/Grafana/etc]

### Padrões Arquiteturais Aplicados
- [ ] Hexagonal Architecture
- [ ] Clean Architecture
- [ ] CQRS
- [ ] Event Sourcing
- [ ] Microservices
- [ ] Modular Monolith

## 7. Propriedade e Governança

### Time Responsável
- **Product Owner**: [Nome]
- **Tech Lead**: [Nome]
- **Desenvolvedores**: [Nomes ou tamanho do time]
- **Domain Expert**: [Nome]

### Service Level Objectives (SLOs)
- **Disponibilidade**: [ex: 99.9%]
- **Latência P95**: [ex: < 200ms]
- **Taxa de Erro**: [ex: < 0.1%]

### Ciclo de Deploy
- **Frequência**: [ex: Múltiplos deploys por dia]
- **Janela de Manutenção**: [Se houver]

## 8. Interfaces Públicas

### APIs REST

#### [Nome do Endpoint]
- **Método**: [GET/POST/PUT/DELETE]
- **Path**: [/api/v1/recurso]
- **Propósito**: [O que faz]
- **Consumidores**: [Quem usa]

### Eventos Publicados

#### [Nome do Evento]
- **Tipo**: [DomainEvent]
- **Quando**: [Quando é publicado]
- **Dados**: [O que contém]
- **Consumidores**: [Quais contextos escutam]

### Comandos Aceitos

#### [Nome do Comando]
- **Propósito**: [O que faz]
- **Input**: [Dados necessários]
- **Output**: [Resultado esperado]

## 9. Decisões de Design

### Architectural Decision Records (ADRs)

#### ADR-001: [Título da Decisão]
- **Status**: [Aceito/Proposto/Deprecated]
- **Contexto**: [Por que precisamos decidir]
- **Decisão**: [O que decidimos]
- **Consequências**: [Impactos positivos e negativos]
- **Data**: [YYYY-MM-DD]

#### ADR-002: [Título da Decisão]
- **Status**: [Aceito/Proposto/Deprecated]
- **Contexto**: [Por que precisamos decidir]
- **Decisão**: [O que decidimos]
- **Consequências**: [Impactos positivos e negativos]
- **Data**: [YYYY-MM-DD]

## 10. Qualidade e Testes

### Estratégia de Testes
- **Cobertura de Testes**: [ex: > 80%]
- **Testes de Domínio**: [Abordagem para testes unitários do domínio]
- **Testes de Integração**: [Abordagem para testes de integração]
- **Testes E2E**: [Se aplicável]

### Métricas de Qualidade
- **Debt Ratio**: [ex: < 5%]
- **Code Smells**: [Número aceitável]
- **Bugs Críticos**: [Tolerância zero]

### Observabilidade
- **Logs**: [O que é logado]
- **Métricas**: [O que é medido]
- **Traces**: [Distributed tracing ativo]
- **Alertas**: [Condições de alerta]

## 11. Evolução e Roadmap

### Melhorias Planejadas
- [ ] [Melhoria 1]
- [ ] [Melhoria 2]
- [ ] [Melhoria 3]

### Dívidas Técnicas Conhecidas
- [ ] [Dívida 1]: [Impacto e prioridade]
- [ ] [Dívida 2]: [Impacto e prioridade]

### Refatorações Futuras
- [ ] [Refatoração 1]: [Motivo]
- [ ] [Refatoração 2]: [Motivo]

## 12. Documentação Adicional

### Links Úteis
- **Repositório**: [URL do repositório de código]
- **Documentação API**: [URL do Swagger/OpenAPI]
- **Confluence/Wiki**: [URL da documentação detalhada]
- **Monitoramento**: [URL do dashboard]
- **Logs**: [URL do sistema de logs]

### Diagramas
- **Context Map**: [Link ou incluir imagem]
- **Diagrama de Classes**: [Link ou incluir imagem]
- **Fluxos de Processo**: [Link ou incluir imagem]
- **Arquitetura**: [Link ou incluir imagem]
```

## Exemplo Preenchido: Contexto de Vendas

```markdown
# Bounded Context: Vendas

## 1. Informações Básicas

**Nome**: Vendas
**Descrição**: Gerencia o processo completo de vendas, desde a cotação até o fechamento do pedido
**Domínio**: [X] Core Domain  [ ] Supporting Subdomain  [ ] Generic Subdomain
**Tipo de Negócio**: [X] Gerador de Receita  [X] Diferenciador Competitivo  [ ] Suporte
**Evolução**: [ ] Gênese  [X] Custom Built  [ ] Product  [ ] Commodity

## 2. Descrição Estratégica

### Propósito de Negócio
Facilitar e otimizar o processo de vendas B2B, permitindo que vendedores criem cotações, negociem condições e fechem pedidos de forma eficiente.

### Capacidades de Negócio
- Criação e gerenciamento de cotações
- Aplicação de descontos e condições comerciais
- Aprovação de vendas especiais
- Conversão de cotações em pedidos
- Integração com estoque e precificação

### Fluxos de Negócio Principais
1. **Cotação**: Vendedor cria cotação → Aplica descontos → Envia para cliente
2. **Negociação**: Cliente solicita ajustes → Vendedor revisa → Aprova/Rejeita
3. **Fechamento**: Cliente aceita → Converte em pedido → Reserva estoque

## 3. Linguagem Ubíqua

### Glossário de Termos

| Termo | Definição | Sinônimos/Aliases |
|-------|-----------|-------------------|
| Cotação | Proposta comercial com itens, preços e condições | Proposta, Orçamento |
| Linha de Cotação | Item individual dentro de uma cotação | Item da Cotação |
| Desconto Comercial | Redução de preço aprovada pelo gerente | Discount |
| Pedido | Cotação aceita e confirmada pelo cliente | Order, Venda |
| Conversão | Transformação de cotação em pedido | Fechamento |

### Conceitos Ambíguos

- **Pedido**: 
  - Neste contexto: Cotação aceita pronta para processamento
  - Em Logística: Pedido em separação/expedição
  - Em Financeiro: Pedido faturado

## 4. Modelo de Domínio

### Agregados

#### Cotação
- **Raiz**: Cotacao
- **Entidades**: LinhaCotacao
- **Value Objects**: PrecoCotado, Desconto, ValidadeCotacao
- **Invariantes**: 
  - Uma cotação deve ter pelo menos uma linha
  - Desconto total não pode exceder 30%
  - Cotação vencida não pode ser convertida

#### Pedido
- **Raiz**: Pedido
- **Entidades**: ItemPedido
- **Value Objects**: DataEntrega, CondicaoPagamento
- **Invariantes**: 
  - Pedido confirmado não pode ser cancelado após 1 hora
  - Valor total deve corresponder à soma dos itens

### Serviços de Domínio
- **CalculadoraDeDescontos**: Aplica regras de desconto progressivo
- **ValidadorDeCredito**: Verifica limite de crédito do cliente

### Domain Events
- **CotacaoCriada**: Quando vendedor cria nova cotação
- **CotacaoEnviada**: Quando cotação é enviada ao cliente
- **DescontoAplicado**: Quando desconto é aprovado
- **CotacaoConvertida**: Quando cotação vira pedido
- **PedidoConfirmado**: Quando pedido é confirmado

### Políticas de Domínio
- **Notificação Automática**: [Cotação criada] → [Enviar email para gerente]
- **Reserva de Estoque**: [Pedido confirmado] → [Reservar itens no estoque]

## 5. Dependências e Integrações

### Contextos Upstream (Fornecedores)

| Contexto | Relação | Dados Consumidos | Como Integra |
|----------|---------|------------------|--------------|
| Catálogo | Customer-Supplier | Produtos e preços | REST API |
| Clientes | Customer-Supplier | Dados cadastrais | REST API |
| Estoque | Conformist | Disponibilidade | REST API |

### Contextos Downstream (Consumidores)

| Contexto | Relação | Dados Fornecidos | Como Integra |
|----------|---------|------------------|--------------|
| Logística | Customer-Supplier | Pedidos confirmados | Domain Events |
| Financeiro | Customer-Supplier | Dados de faturamento | Domain Events |

### Sistemas Externos

| Sistema | Propósito | Padrão de Integração | Observações |
|---------|-----------|---------------------|-------------|
| SAP ERP | Criação de pedidos | ACL | Sistema legado |
| Salesforce | Sincronização de oportunidades | Adaptador | Integração bidirecional |

## 6. Arquitetura e Tecnologia

### Estrutura de Camadas
```
┌─────────────────────────────────┐
│   REST API (Controllers)        │
├─────────────────────────────────┤
│   Application Services          │
├─────────────────────────────────┤
│   Domain Model                  │
├─────────────────────────────────┤
│   Repositories (PostgreSQL)     │
└─────────────────────────────────┘
```

### Stack Tecnológico
- **Linguagem**: Java 17
- **Framework**: Spring Boot 3.1
- **Persistência**: PostgreSQL 15
- **Mensageria**: RabbitMQ
- **Cache**: Redis
- **Observabilidade**: Prometheus + Grafana

### Padrões Arquiteturais Aplicados
- [X] Hexagonal Architecture
- [ ] Clean Architecture
- [X] CQRS (read models separados)
- [ ] Event Sourcing
- [X] Microservices
- [ ] Modular Monolith

## 7. Propriedade e Governança

### Time Responsável
- **Product Owner**: Maria Silva
- **Tech Lead**: João Santos
- **Desenvolvedores**: Time de 5 pessoas
- **Domain Expert**: Carlos Mendes (Diretor Comercial)

### Service Level Objectives (SLOs)
- **Disponibilidade**: 99.5%
- **Latência P95**: < 500ms
- **Taxa de Erro**: < 1%

### Ciclo de Deploy
- **Frequência**: 2-3 deploys por semana
- **Janela de Manutenção**: Não requerida

## 8. Interfaces Públicas

### APIs REST

#### Criar Cotação
- **Método**: POST
- **Path**: /api/v1/cotacoes
- **Propósito**: Criar nova cotação
- **Consumidores**: Frontend Web, App Mobile

#### Aplicar Desconto
- **Método**: PUT
- **Path**: /api/v1/cotacoes/{id}/descontos
- **Propósito**: Aplicar desconto a uma cotação
- **Consumidores**: Frontend Web

### Eventos Publicados

#### CotacaoConvertida
- **Tipo**: DomainEvent
- **Quando**: Cotação é convertida em pedido
- **Dados**: ID cotação, ID pedido, cliente, valor
- **Consumidores**: Logística, Financeiro, Estoque

### Comandos Aceitos

#### CriarCotacaoCommand
- **Propósito**: Iniciar novo processo de cotação
- **Input**: ClienteId, Lista de produtos
- **Output**: CotacaoId

## 9. Decisões de Design

### ADR-001: Agregados Pequenos para Cotação
- **Status**: Aceito
- **Contexto**: Cotações podem ter centenas de linhas
- **Decisão**: Manter agregado Cotacao pequeno, carregar linhas sob demanda
- **Consequências**: Melhor performance, eventual consistency em alguns casos
- **Data**: 2025-01-15

## 10. Qualidade e Testes

### Estratégia de Testes
- **Cobertura de Testes**: > 85% no domínio
- **Testes de Domínio**: Testes unitários para agregados e serviços
- **Testes de Integração**: API tests com TestContainers
- **Testes E2E**: Smoke tests em produção

## 11. Evolução e Roadmap

### Melhorias Planejadas
- [ ] Implementar aprovação multi-nível para descontos
- [ ] Adicionar cotações recorrentes
- [ ] Integração com sistema de comissões

## 12. Documentação Adicional

### Links Úteis
- **Repositório**: https://github.com/empresa/vendas-service
- **Documentação API**: https://api.empresa.com/vendas/swagger
- **Monitoramento**: https://grafana.empresa.com/d/vendas
```

## Como Usar Este Canvas

1. **Preencha colaborativamente**: Inclua desenvolvedores, PO e domain experts
2. **Mantenha atualizado**: Revise a cada sprint ou quando mudanças significativas ocorrerem
3. **Use como onboarding**: Novo membro do time? Comece pelo canvas
4. **Facilite discussões**: Use como base para arquitetura e refinamento
5. **Documente decisões**: Registre ADRs conforme decisões são tomadas

## Quando Criar um Novo Canvas

- Identificou um novo bounded context
- Decidiu dividir um contexto existente
- Precisa documentar um contexto legado
- Iniciando um novo projeto ou módulo
