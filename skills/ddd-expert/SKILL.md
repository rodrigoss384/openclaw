---
name: domain-driven-design
description: Especialista em Domain-Driven Design (DDD). Use quando precisar modelar domínios complexos, definir bounded contexts, criar agregados, entidades, value objects, aplicar padrões táticos e estratégicos do DDD, ou estruturar arquitetura orientada a domínio.
---

# Domain-Driven Design Skill

Esta habilidade fornece expertise em Domain-Driven Design para modelagem e arquitetura de software orientada a domínio.

## Quando usar esta habilidade

- Modelagem de domínios complexos de negócio
- Definição de Bounded Contexts e Context Maps
- Criação de Agregados, Entidades e Value Objects
- Implementação de padrões táticos do DDD
- Aplicação de padrões estratégicos do DDD
- Revisão de arquitetura sob perspectiva DDD
- Refatoração para arquitetura orientada a domínio

## Princípios Fundamentais

### 1. Linguagem Ubíqua (Ubiquitous Language)
- Estabeleça uma linguagem comum entre técnicos e especialistas de domínio
- Use os mesmos termos no código, documentação e conversas
- Evite traduções ou sinônimos que causem ambiguidade
- A linguagem deve evoluir com o entendimento do domínio

### 2. Bounded Context (Contexto Delimitado)
- Defina limites explícitos onde um modelo de domínio é válido
- Cada contexto tem sua própria linguagem ubíqua
- Contextos diferentes podem ter modelos diferentes para o mesmo conceito
- Use Context Maps para mapear relacionamentos entre contextos

### 3. Core Domain (Domínio Núcleo)
- Identifique o que traz vantagem competitiva ao negócio
- Concentre os melhores recursos no Core Domain
- Diferencie entre Core Domain, Supporting Subdomain e Generic Subdomain

## Padrões Táticos

### Building Blocks do DDD

**Entidades (Entities)**
- Objetos com identidade única que persiste ao longo do tempo
- A identidade é mais importante que os atributos
- Implementam lógica de negócio relacionada à sua identidade
```
Exemplo: Cliente, Pedido, Produto
```

**Value Objects**
- Objetos imutáveis definidos apenas por seus atributos
- Não possuem identidade conceitual
- Devem ser tratados como valores, não referências
```
Exemplo: Endereço, Dinheiro, Email, CPF
```

**Agregados (Aggregates)**
- Cluster de objetos tratados como uma unidade
- Possui uma raiz (Aggregate Root) que controla acesso
- Garante invariantes e consistência do negócio
- Define fronteiras transacionais
```
Regras:
- Referências externas só para a raiz
- Modificações só através da raiz
- Um agregado = uma transação
```

**Repositórios (Repositories)**
- Abstração para acesso a agregados
- Simula uma coleção em memória
- Esconde detalhes de persistência
- Opera apenas com raízes de agregados

**Serviços de Domínio (Domain Services)**
- Lógica que não pertence naturalmente a entidades ou value objects
- Operações que envolvem múltiplos agregados
- Mantém o domínio livre de infraestrutura
```
Exemplo: CalculadoraDeFreteService, ValidadorDeCreditoService
```

**Domain Events**
- Representam fatos importantes que ocorreram no domínio
- Imutáveis e nomeados no passado
- Facilitam comunicação entre bounded contexts
```
Exemplo: PedidoFoiCriado, PagamentoFoiConfirmado
```

**Factories**
- Encapsulam a complexidade de criação de objetos
- Garantem que objetos sejam criados em estado válido
- Podem ser métodos estáticos ou classes dedicadas

**Specifications**
- Encapsulam regras de negócio em objetos reutilizáveis
- Permitem composição de regras complexas
- Úteis para validação e consultas

## Padrões Estratégicos

### Context Mapping Patterns

**Shared Kernel**
- Código compartilhado entre dois contextos
- Requer coordenação próxima entre equipes
- Use com moderação

**Customer-Supplier**
- Relacionamento upstream/downstream
- Supplier atende necessidades do Customer
- Contratos claros entre equipes

**Conformist**
- Downstream conforma-se ao modelo upstream
- Usado quando não há influência no upstream

**Anticorruption Layer (ACL)**
- Camada de tradução que protege seu modelo
- Previne que conceitos externos corrompam seu domínio
- Essencial ao integrar com sistemas legados

**Open Host Service**
- Protocolo público para acesso ao contexto
- Define API clara e documentada
- Versionamento explícito

**Published Language**
- Linguagem comum e bem documentada
- Usada para integração entre contextos
- Exemplos: JSON Schema, XML Schema

**Separate Ways**
- Contextos completamente independentes
- Sem integração direta
- Duplicação aceita em prol de autonomia

## Checklist de Implementação

### Ao modelar um novo domínio:

1. **Descoberta do Domínio**
   - Realize Event Storming ou Domain Storytelling
   - Identifique eventos, comandos e agregados
   - Mapeie atores e processos de negócio
   - Documente a linguagem ubíqua

2. **Definição de Bounded Contexts**
   - Identifique limites naturais do negócio
   - Verifique consistência da linguagem ubíqua
   - Defina responsabilidades claras de cada contexto
   - Crie Context Map mostrando relacionamentos

3. **Modelagem Tática**
   - Identifique agregados e suas raízes
   - Defina entidades e value objects
   - Estabeleça invariantes de negócio
   - Crie repositórios para agregados
   - Implemente serviços de domínio quando necessário

4. **Validação**
   - O modelo expressa regras de negócio claramente?
   - A linguagem ubíqua está presente no código?
   - Os agregados mantêm consistência?
   - As fronteiras transacionais estão corretas?
   - O código é compreensível para especialistas de domínio?

## Boas Práticas

### O que FAZER:
- ✅ Mantenha agregados pequenos
- ✅ Modele pensando no negócio, não na persistência
- ✅ Use value objects extensivamente
- ✅ Proteja invariantes dentro dos agregados
- ✅ Prefira comunicação assíncrona entre agregados
- ✅ Mantenha lógica de negócio no domínio
- ✅ Evolua o modelo continuamente com feedback
- ✅ Documente decisões de design

### O que NÃO fazer:
- ❌ Não crie agregados muito grandes
- ❌ Não misture conceitos de diferentes bounded contexts
- ❌ Não exponha estrutura interna dos agregados
- ❌ Não permita modificação direta de entidades filhas
- ❌ Não coloque lógica de negócio em serviços de aplicação
- ❌ Não use anemic domain model
- ❌ Não ignore a linguagem ubíqua
- ❌ Não modele baseado apenas em CRUDs

## Estrutura de Pastas Recomendada

```
src/
├── domain/
│   ├── model/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── domain-events/
│   ├── services/
│   ├── repositories/
│   └── specifications/
├── application/
│   ├── use-cases/
│   ├── commands/
│   └── queries/
└── infrastructure/
    ├── persistence/
    └── messaging/
```

## Recursos Adicionais

Para referências detalhadas, templates e exemplos práticos, consulte os arquivos em `resources/`:
- `DDD_PATTERNS_REFERENCE.md` - Catálogo completo de padrões
- `AGGREGATE_TEMPLATE.md` - Template para criação de agregados
- `BOUNDED_CONTEXT_CANVAS.md` - Canvas para documentar contextos
- `UBIQUITOUS_LANGUAGE_GLOSSARY.md` - Template de glossário

## Antipadrões Comuns

- **Anemic Domain Model**: Entidades sem comportamento, apenas getters/setters
- **Smart UI**: Lógica de negócio na camada de apresentação
- **God Aggregate**: Agregado que faz tudo
- **Leaky Abstractions**: Detalhes de infraestrutura no domínio
- **CRUD Thinking**: Modelar apenas operações de banco de dados

## Quando reavaliar o modelo

- Mudanças frequentes em múltiplos agregados juntos
- Dificuldade em manter invariantes
- Código complexo e difícil de entender
- Conflitos frequentes na linguagem ubíqua
- Performance problems relacionados a agregados grandes
