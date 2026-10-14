# Glossário de Linguagem Ubíqua

Este documento mantém o vocabulário compartilhado entre especialistas de domínio e desenvolvedores. A linguagem ubíqua deve ser refletida no código, documentação e conversas.

## Como Usar Este Glossário

1. **Mantenha atualizado**: Adicione termos conforme são descobertos
2. **Use consistentemente**: Sempre use os termos definidos aqui
3. **Revise regularmente**: Em sessões de refinamento e retrospectivas
4. **Resolva ambiguidades**: Documente quando termos têm significados diferentes em contextos diferentes
5. **Compartilhe**: Todos do time devem ter acesso fácil a este documento

## Template de Glossário

```markdown
# Glossário - [Nome do Bounded Context]

**Última atualização**: [Data]
**Responsável**: [Nome do Domain Expert]

---

## A

### [Termo A1]
**Definição**: [Definição clara e precisa no contexto deste bounded context]

**Sinônimos**: [Se houver sinônimos aceitáveis]

**Não confundir com**: [Termos similares mas com significado diferente]

**Contexto de uso**: [Quando e onde este termo é usado]

**Exemplos**:
- [Exemplo de uso em frase]
- [Outro exemplo]

**Relacionado com**: [Termos relacionados]

**Notas técnicas**: [Como é representado no código, se relevante]

---

### [Termo A2]
[Seguir mesmo formato]

---

## B

[Continuar alfabeticamente]

---

## Termos Ambíguos

Lista de termos que têm significados diferentes em outros bounded contexts:

| Termo | Neste Contexto | Em [Outro Contexto] |
|-------|----------------|---------------------|
| [Termo] | [Significado aqui] | [Significado lá] |

---

## Evolução da Linguagem

Histórico de mudanças importantes na linguagem:

| Data | Mudança | Motivo |
|------|---------|--------|
| [YYYY-MM-DD] | [O que mudou] | [Por que mudou] |

---

## Termos Deprecados

Termos que não devem mais ser usados:

| Termo Antigo | Usar ao invés | Motivo da Mudança |
|--------------|---------------|-------------------|
| [Termo] | [Novo termo] | [Explicação] |
```

## Exemplo Completo: E-commerce

```markdown
# Glossário - Contexto de Vendas Online

**Última atualização**: 02/02/2026
**Responsável**: Carlos Mendes (Gerente de E-commerce)

---

## C

### Carrinho de Compras
**Definição**: Coleção temporária de produtos que o cliente pretende comprar, mas ainda não confirmou. O carrinho pode ser modificado livremente até o momento do checkout.

**Sinônimos**: Carrinho, Cesta de Compras, Shopping Cart

**Não confundir com**: 
- **Lista de Desejos**: Produtos salvos para compra futura, sem intenção imediata
- **Pedido**: Carrinho confirmado que entrou no processo de fulfillment

**Contexto de uso**: Durante a navegação e seleção de produtos no site

**Exemplos**:
- "Cliente adicionou 3 itens ao carrinho"
- "Carrinho abandonado há mais de 24 horas"
- "Valor total do carrinho é R$ 459,90"

**Relacionado com**: Item do Carrinho, Checkout, Sessão

**Notas técnicas**: 
- Classe: `ShoppingCart` (aggregate root)
- Persistência: Redis para carrinhos ativos, PostgreSQL para histórico
- TTL: 7 dias de inatividade

---

### Checkout
**Definição**: Processo de finalização da compra onde o cliente confirma os itens, informa endereço de entrega, seleciona forma de pagamento e confirma o pedido.

**Sinônimos**: Finalização de Compra, Fechamento

**Não confundir com**: 
- **Pagamento**: É apenas uma etapa do checkout
- **Confirmação**: Resultado final após checkout bem-sucedido

**Contexto de uso**: Quando cliente decide concluir a compra

**Exemplos**:
- "Cliente iniciou o checkout"
- "Processo de checkout tem 4 etapas"
- "Taxa de abandono no checkout está em 35%"

**Relacionado com**: Carrinho, Pedido, Pagamento, Endereço de Entrega

**Notas técnicas**: 
- Service: `CheckoutService`
- Etapas: Login → Endereço → Pagamento → Revisão → Confirmação
- Eventos: `CheckoutIniciado`, `CheckoutConcluido`, `CheckoutAbandonado`

---

### Cupom de Desconto
**Definição**: Código alfanumérico que concede desconto percentual ou valor fixo na compra. Pode ter restrições de uso como valor mínimo, categorias específicas, validade e limite de uso.

**Sinônimos**: Código Promocional, Voucher, Cupom

**Não confundir com**: 
- **Desconto Automático**: Redução de preço aplicada sem necessidade de cupom
- **Cashback**: Devolução de valor após conclusão da compra

**Contexto de uso**: Durante o checkout, antes da confirmação do pagamento

**Exemplos**:
- "Cupom PRIMEIRACOMPRA dá 10% de desconto"
- "Cupom expirou em 31/01/2026"
- "Cupom válido apenas para produtos da categoria Eletrônicos"

**Relacionado com**: Promoção, Desconto, Regra de Negócio

**Notas técnicas**: 
- Value Object: `CouponCode`
- Entity: `Coupon` (com regras de validação)
- Validações: validade, limite de uso, valor mínimo, categorias permitidas

---

## E

### Estoque Disponível
**Definição**: Quantidade de um produto que está fisicamente disponível no centro de distribuição e pode ser vendida imediatamente. Não inclui estoque reservado ou em trânsito.

**Sinônimos**: Estoque Livre, Available Stock

**Não confundir com**: 
- **Estoque Reservado**: Já comprometido com pedidos confirmados
- **Estoque Total**: Soma de disponível + reservado + em trânsito
- **Estoque Virtual**: Previsão incluindo entradas futuras

**Contexto de uso**: Ao verificar se produto pode ser vendido

**Exemplos**:
- "Produto tem 15 unidades em estoque disponível"
- "Estoque disponível esgotado, produto indisponível"
- "Reservar 3 unidades do estoque disponível"

**Relacionado com**: SKU, Reserva de Estoque, Produto

**Notas técnicas**: 
- Gerenciado pelo contexto de Inventário
- Atualizado por eventos: `EstoqueAtualizado`, `ReservaRealizada`
- Cache de leitura em Redis para performance

---

## F

### Frete
**Definição**: Valor cobrado pelo transporte do pedido do centro de distribuição até o endereço de entrega do cliente. Calculado com base em peso, dimensões, distância e prazo.

**Sinônimos**: Custo de Envio, Shipping

**Não confundir com**: 
- **Taxa de Entrega**: Pode incluir adicionais além do frete básico
- **Prazo de Entrega**: Tempo estimado, não o custo

**Contexto de uso**: Durante cálculo de custo total do pedido no checkout

**Exemplos**:
- "Frete grátis para compras acima de R$ 199"
- "Calcular frete para CEP 01310-100"
- "Frete expresso custa R$ 29,90"

**Relacionado com**: Transportadora, Prazo de Entrega, Endereço de Entrega

**Notas técnicas**: 
- Service: `ShippingCalculatorService`
- Integração com APIs de transportadoras
- Tabelas de preço por região e peso

---

## I

### Item do Pedido
**Definição**: Registro individual de um produto dentro de um pedido, incluindo quantidade comprada, preço unitário praticado e desconto aplicado naquele momento.

**Sinônimos**: Linha do Pedido, Order Line Item

**Não confundir com**: 
- **Produto**: Entidade do catálogo, não a instância comprada
- **SKU**: Código de identificação do produto

**Contexto de uso**: Composição interna do pedido

**Exemplos**:
- "Pedido tem 5 itens diferentes"
- "Item: Notebook XYZ, quantidade 1, preço R$ 3.499,00"
- "Cada item registra o preço praticado no momento da compra"

**Relacionado com**: Pedido, Produto, SKU

**Notas técnicas**: 
- Entity (parte do agregado Pedido)
- Imutável após confirmação do pedido
- Armazena snapshot do preço (não referência ao preço atual)

---

## P

### Pedido
**Definição**: Solicitação confirmada de compra feita pelo cliente, contendo itens, quantidades, preços, endereço de entrega, forma de pagamento e status de processamento.

**Sinônimos**: Order, Venda

**Não confundir com**: 
- **Carrinho**: Ainda não confirmado, pode ser modificado
- **Cotação**: No contexto B2B, ainda em negociação
- **Nota Fiscal**: Documento fiscal gerado após pedido

**Contexto de uso**: Após conclusão do checkout

**Exemplos**:
- "Pedido #12345 foi criado"
- "Pedido está em separação"
- "Cliente tem 3 pedidos em andamento"

**Relacionado com**: Item do Pedido, Status do Pedido, Cliente, Pagamento

**Notas técnicas**: 
- Aggregate Root: `Order`
- Estados: Criado → Pago → Em Separação → Enviado → Entregue
- Eventos: `PedidoCriado`, `PedidoPago`, `PedidoEnviado`, `PedidoEntregue`

---

### Produto
**Definição**: Item comercializável disponível no catálogo, com informações como nome, descrição, imagens, preço, categoria e atributos específicos.

**Sinônimos**: Item, Mercadoria

**Não confundir com**: 
- **SKU**: Código único de identificação do produto
- **Variante**: Versão específica do produto (ex: cor, tamanho)
- **Item do Pedido**: Instância comprada do produto

**Contexto de uso**: Navegação no catálogo, busca, exibição de detalhes

**Exemplos**:
- "Produto: Notebook Dell Inspiron 15"
- "Produto tem 3 variantes de cor"
- "Produto esgotado temporariamente"

**Relacionado com**: Categoria, Marca, SKU, Variante, Preço

**Notas técnicas**: 
- Gerenciado pelo contexto de Catálogo
- Sincronizado para contexto de Vendas via eventos
- Read model otimizado para busca em Elasticsearch

---

## S

### Status do Pedido
**Definição**: Estado atual do pedido no fluxo de processamento, indicando em que etapa ele se encontra desde a criação até a entrega final.

**Sinônimos**: Estado do Pedido, Order Status

**Não confundir com**: 
- **Status do Pagamento**: Específico da transação financeira
- **Status de Entrega**: Específico do rastreamento logístico

**Contexto de uso**: Acompanhamento do pedido pelo cliente e operações internas

**Exemplos**:
- "Pedido mudou de status: Pago → Em Separação"
- "Status do pedido é 'Enviado'"
- "Cliente consultou status do pedido #12345"

**Relacionado com**: Pedido, Fluxo de Processamento

**Notas técnicas**: 
- Enum: `OrderStatus`
- Possíveis valores: 
  - `CRIADO`: Pedido criado, aguardando pagamento
  - `PAGO`: Pagamento confirmado
  - `EM_SEPARACAO`: Produtos sendo separados no CD
  - `ENVIADO`: Pacote despachado para transportadora
  - `EM_TRANSITO`: Em rota de entrega
  - `ENTREGUE`: Entregue ao cliente
  - `CANCELADO`: Pedido cancelado
  - `DEVOLVIDO`: Cliente devolveu o produto
- Transições validadas por máquina de estados

---

## Termos Ambíguos

| Termo | No Contexto de Vendas | No Contexto de Estoque | No Contexto Financeiro |
|-------|----------------------|------------------------|------------------------|
| Pedido | Solicitação de compra do cliente | Requisição de reposição | Pedido a ser faturado |
| Reserva | Separar produto para cliente | Bloquear estoque | Provisão financeira |
| Devolução | Cliente retorna produto | Fornecedor aceita retorno | Estorno de pagamento |

---

## Evolução da Linguagem

| Data | Mudança | Motivo |
|------|---------|--------|
| 2025-12-10 | "Cesta" renomeado para "Carrinho de Compras" | Alinhamento com linguagem do mercado e UX |
| 2026-01-15 | Adicionado termo "Estoque Disponível" vs "Estoque Total" | Confusão em conversas entre times |
| 2026-02-01 | "Finalização" renomeado para "Checkout" | Termo internacional mais claro |

---

## Termos Deprecados

| Termo Antigo | Usar ao invés | Motivo da Mudança | Data |
|--------------|---------------|-------------------|------|
| Cesta | Carrinho de Compras | Padronização de linguagem | 2025-12-10 |
| Finalização | Checkout | Termo internacional mais comum | 2026-02-01 |
| Sacola | Carrinho de Compras | Unificação de vocabulário | 2025-12-10 |
| Compra | Pedido | Evitar ambiguidade com ato de comprar | 2025-11-20 |
```

## Dicas para Manter o Glossário

### Durante Event Storming
- Capture todos os termos de negócio mencionados
- Questione significados quando houver dúvida
- Documente termos que têm significados diferentes em contextos diferentes

### Durante Refinamento
- Revise glossário ao discutir user stories
- Adicione novos termos descobertos
- Atualize definições quando necessário

### Durante Code Review
- Verifique se código usa termos do glossário
- Questione quando aparecerem termos diferentes
- Sugira renomeações quando código divergir do glossário

### Sinais de Problemas
- ❌ Desenvolvedores e PO usam termos diferentes para mesma coisa
- ❌ Código usa nomes técnicos não presentes no glossário
- ❌ Discussões sobre "o que isso significa"
- ❌ Tradução constante entre linguagem técnica e negócio

### Boas Práticas
- ✅ Um termo = um significado no contexto
- ✅ Mesmo termo no código e na conversa
- ✅ Definições validadas com domain experts
- ✅ Exemplos concretos de uso
- ✅ Atualização contínua
- ✅ Fácil acesso para todo o time

## Ferramentas Sugeridas

- **Wiki/Confluence**: Para glossários compartilhados
- **Living Documentation**: Gerar glossário do código
- **Markdown no repositório**: Versionado com o código
- **Plantuml/Mermaid**: Para diagramas de conceitos

## Exercício: Auditoria de Linguagem

Use este checklist para auditar seu projeto:

- [ ] Glossário existe e está atualizado?
- [ ] Todos os agregados têm nomes do glossário?
- [ ] Entidades e VOs refletem linguagem ubíqua?
- [ ] Métodos têm nomes baseados em ações de negócio?
- [ ] Eventos usam linguagem do domínio?
- [ ] Testes usam vocabulário de negócio?
- [ ] Documentação de API usa termos do glossário?
- [ ] Domain experts reconhecem termos no código?
