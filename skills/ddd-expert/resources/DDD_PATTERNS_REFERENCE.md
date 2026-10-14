# Domain-Driven Design - Catálogo de Padrões

Este documento serve como referência completa dos padrões táticos e estratégicos do DDD.

## Padrões Táticos Detalhados

### 1. Entity (Entidade)

**Definição**: Objeto com identidade única que persiste ao longo do tempo e através de diferentes estados.

**Características**:
- Possui um identificador único (ID)
- A identidade permanece constante mesmo quando atributos mudam
- Mutável em seus atributos
- Implementa lógica de negócio relacionada à sua identidade

**Implementação**:
```java
public class Pedido {
    private final PedidoId id;
    private ClienteId clienteId;
    private StatusPedido status;
    private List<ItemPedido> itens;
    private Money valorTotal;
    
    // Construtor privado - usar factory
    private Pedido(PedidoId id, ClienteId clienteId) {
        this.id = Objects.requireNonNull(id);
        this.clienteId = Objects.requireNonNull(clienteId);
        this.status = StatusPedido.RASCUNHO;
        this.itens = new ArrayList<>();
        this.valorTotal = Money.ZERO;
    }
    
    public static Pedido criar(ClienteId clienteId) {
        return new Pedido(PedidoId.gerar(), clienteId);
    }
    
    // Lógica de negócio
    public void adicionarItem(ProdutoId produtoId, int quantidade, Money precoUnitario) {
        validarPodeAdicionarItens();
        ItemPedido item = new ItemPedido(produtoId, quantidade, precoUnitario);
        this.itens.add(item);
        recalcularValorTotal();
    }
    
    public void confirmar() {
        validarPodeConfirmar();
        this.status = StatusPedido.CONFIRMADO;
        registrarEvento(new PedidoConfirmado(this.id));
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Pedido)) return false;
        Pedido pedido = (Pedido) o;
        return id.equals(pedido.id);
    }
    
    @Override
    public int hashCode() {
        return id.hashCode();
    }
}
```

**Quando usar**:
- Quando a identidade do objeto é importante
- Quando o objeto muda ao longo do tempo
- Quando você precisa rastrear o objeto através de diferentes estados

**Antipadrões**:
- Entidades com apenas getters/setters (Anemic Domain Model)
- Identidades geradas pela infraestrutura (auto-increment exposto)
- Equals/hashCode baseados em atributos mutáveis

---

### 2. Value Object

**Definição**: Objeto imutável definido apenas por seus atributos, sem identidade conceitual.

**Características**:
- Completamente imutável
- Igualdade baseada em valor, não em identidade
- Pode ser compartilhado livremente
- Sem efeitos colaterais

**Implementação**:
```java
public final class Money {
    private final BigDecimal valor;
    private final Currency moeda;
    
    public Money(BigDecimal valor, Currency moeda) {
        validarValor(valor);
        validarMoeda(moeda);
        this.valor = valor.setScale(2, RoundingMode.HALF_UP);
        this.moeda = moeda;
    }
    
    // Operações retornam novos objetos
    public Money adicionar(Money outro) {
        validarMesmaMoeda(outro);
        return new Money(
            this.valor.add(outro.valor),
            this.moeda
        );
    }
    
    public Money multiplicar(int fator) {
        return new Money(
            this.valor.multiply(BigDecimal.valueOf(fator)),
            this.moeda
        );
    }
    
    // Sem setters!
    public BigDecimal getValor() {
        return valor;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money)) return false;
        Money money = (Money) o;
        return valor.equals(money.valor) && moeda.equals(money.moeda);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(valor, moeda);
    }
}

public final class Email {
    private final String endereco;
    
    public Email(String endereco) {
        validarFormato(endereco);
        this.endereco = endereco.toLowerCase();
    }
    
    private void validarFormato(String endereco) {
        if (!endereco.matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
            throw new IllegalArgumentException("Email inválido");
        }
    }
    
    public String getEndereco() {
        return endereco;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Email)) return false;
        Email email = (Email) o;
        return endereco.equals(email.endereco);
    }
    
    @Override
    public int hashCode() {
        return endereco.hashCode();
    }
}
```

**Quando usar**:
- Para representar conceitos de negócio sem identidade
- Quando imutabilidade é importante
- Para evitar primitive obsession
- Para encapsular validações e lógica de valor

**Exemplos comuns**:
- Money, Currency
- Email, CPF, CNPJ
- Address (Endereço)
- DateRange (Período)
- Quantity (Quantidade)
- Percentage (Percentual)

---

### 3. Aggregate (Agregado)

**Definição**: Cluster de objetos relacionados tratados como uma unidade para garantir consistência de dados.

**Características**:
- Possui uma raiz (Aggregate Root) que é uma entidade
- Define fronteira transacional
- Mantém invariantes de negócio
- Referências externas só para a raiz
- Modificações só através da raiz

**Implementação**:
```java
// Aggregate Root
public class Pedido {
    private final PedidoId id;
    private ClienteId clienteId;
    private StatusPedido status;
    
    // Entidades filhas - não acessíveis externamente
    private final List<ItemPedido> itens;
    private Endereco enderecoEntrega;
    
    // Value objects
    private Money valorTotal;
    
    // Eventos de domínio
    private final List<DomainEvent> eventos = new ArrayList<>();
    
    // Construtor privado
    private Pedido(PedidoId id, ClienteId clienteId) {
        this.id = id;
        this.clienteId = clienteId;
        this.status = StatusPedido.RASCUNHO;
        this.itens = new ArrayList<>();
        this.valorTotal = Money.ZERO;
    }
    
    // Factory method
    public static Pedido criar(ClienteId clienteId) {
        Pedido pedido = new Pedido(PedidoId.gerar(), clienteId);
        pedido.registrarEvento(new PedidoCriado(pedido.id, clienteId));
        return pedido;
    }
    
    // Operações que mantêm invariantes
    public void adicionarItem(ProdutoId produtoId, int quantidade, Money precoUnitario) {
        validarPodeModificar();
        validarQuantidade(quantidade);
        
        ItemPedido item = new ItemPedido(produtoId, quantidade, precoUnitario);
        this.itens.add(item);
        this.valorTotal = calcularValorTotal();
        
        registrarEvento(new ItemAdicionadoAoPedido(this.id, produtoId, quantidade));
    }
    
    public void confirmar() {
        validarPodeConfirmar();
        
        if (itens.isEmpty()) {
            throw new DomainException("Pedido deve ter pelo menos um item");
        }
        
        this.status = StatusPedido.CONFIRMADO;
        registrarEvento(new PedidoConfirmado(this.id));
    }
    
    // Invariantes protegidas
    private void validarPodeModificar() {
        if (this.status != StatusPedido.RASCUNHO) {
            throw new DomainException("Pedido só pode ser modificado em rascunho");
        }
    }
    
    private void validarPodeConfirmar() {
        if (this.status != StatusPedido.RASCUNHO) {
            throw new DomainException("Apenas pedidos em rascunho podem ser confirmados");
        }
        if (enderecoEntrega == null) {
            throw new DomainException("Endereço de entrega é obrigatório");
        }
    }
    
    private Money calcularValorTotal() {
        return itens.stream()
            .map(ItemPedido::getValorTotal)
            .reduce(Money.ZERO, Money::adicionar);
    }
    
    // Acesso controlado - sem setters
    public PedidoId getId() { return id; }
    public StatusPedido getStatus() { return status; }
    public Money getValorTotal() { return valorTotal; }
    
    // Retorna cópia defensiva
    public List<ItemPedido> getItens() {
        return Collections.unmodifiableList(itens);
    }
    
    // Eventos de domínio
    public List<DomainEvent> getEventos() {
        return Collections.unmodifiableList(eventos);
    }
    
    public void limparEventos() {
        eventos.clear();
    }
    
    private void registrarEvento(DomainEvent evento) {
        eventos.add(evento);
    }
}

// Entidade filha - só acessível via raiz
class ItemPedido {
    private final ProdutoId produtoId;
    private int quantidade;
    private final Money precoUnitario;
    
    ItemPedido(ProdutoId produtoId, int quantidade, Money precoUnitario) {
        this.produtoId = produtoId;
        this.quantidade = quantidade;
        this.precoUnitario = precoUnitario;
    }
    
    Money getValorTotal() {
        return precoUnitario.multiplicar(quantidade);
    }
    
    // Package-private - só Pedido pode modificar
    void alterarQuantidade(int novaQuantidade) {
        if (novaQuantidade <= 0) {
            throw new IllegalArgumentException("Quantidade deve ser positiva");
        }
        this.quantidade = novaQuantidade;
    }
}
```

**Regras de Design**:
1. **Tamanho pequeno**: Prefira agregados menores
2. **Uma transação**: Um agregado = uma transação
3. **Consistência eventual**: Entre agregados, use consistência eventual
4. **Referências por ID**: Agregados referenciam outros por ID, não por objeto

**Identificando Fronteiras**:
- Quais dados precisam ser consistentes juntos?
- Quais invariantes de negócio existem?
- Qual é a unidade natural de mudança?

---

### 4. Repository (Repositório)

**Definição**: Abstração que simula uma coleção em memória para agregados.

**Características**:
- Opera apenas com raízes de agregados
- Esconde detalhes de persistência
- Fornece interface orientada a coleções
- Pode incluir queries específicas do domínio

**Implementação**:
```java
// Interface no domínio
public interface PedidoRepository {
    void salvar(Pedido pedido);
    Optional<Pedido> buscarPorId(PedidoId id);
    List<Pedido> buscarPorCliente(ClienteId clienteId);
    List<Pedido> buscarPendentes();
    void remover(PedidoId id);
}

// Implementação na infraestrutura
public class PedidoRepositoryJpa implements PedidoRepository {
    @PersistenceContext
    private EntityManager em;
    
    @Override
    public void salvar(Pedido pedido) {
        PedidoJpaEntity entity = mapper.toEntity(pedido);
        
        if (entity.getId() == null) {
            em.persist(entity);
        } else {
            em.merge(entity);
        }
        
        // Publicar eventos de domínio
        pedido.getEventos().forEach(eventPublisher::publish);
        pedido.limparEventos();
    }
    
    @Override
    public Optional<Pedido> buscarPorId(PedidoId id) {
        PedidoJpaEntity entity = em.find(PedidoJpaEntity.class, id.getValue());
        return Optional.ofNullable(entity)
            .map(mapper::toDomain);
    }
    
    @Override
    public List<Pedido> buscarPorCliente(ClienteId clienteId) {
        return em.createQuery(
            "SELECT p FROM PedidoJpaEntity p WHERE p.clienteId = :clienteId",
            PedidoJpaEntity.class)
            .setParameter("clienteId", clienteId.getValue())
            .getResultStream()
            .map(mapper::toDomain)
            .collect(Collectors.toList());
    }
}
```

**Padrões de Query**:
- **Specification Pattern**: Para queries complexas
- **Query Objects**: Para separar lógica de query
- **CQRS**: Separar modelos de leitura e escrita

---

### 5. Domain Service (Serviço de Domínio)

**Definição**: Operação de negócio que não pertence naturalmente a uma entidade ou value object.

**Quando usar**:
- Operação envolve múltiplos agregados
- Lógica não pertence a nenhum objeto específico
- Operação sem estado (stateless)

**Implementação**:
```java
// Serviço de domínio
public class TransferenciaService {
    
    public void transferir(
        Conta contaOrigem,
        Conta contaDestino,
        Money valor
    ) {
        // Validações de domínio
        if (valor.menorOuIgualQue(Money.ZERO)) {
            throw new DomainException("Valor deve ser positivo");
        }
        
        // Coordena operação entre agregados
        contaOrigem.debitar(valor);
        contaDestino.creditar(valor);
        
        // Eventos serão disparados por cada agregado
    }
}

public class CalculadoraDeFreteService {
    
    public Money calcular(
        Endereco origem,
        Endereco destino,
        Peso peso,
        TipoFrete tipo
    ) {
        // Lógica complexa de cálculo
        Distance distancia = calcularDistancia(origem, destino);
        Money valorBase = tabelaPrecos.consultarValorBase(tipo);
        Money adicionalPeso = calcularAdicionalPeso(peso);
        Money adicionalDistancia = calcularAdicionalDistancia(distancia);
        
        return valorBase
            .adicionar(adicionalPeso)
            .adicionar(adicionalDistancia);
    }
}
```

**Diferença entre Domain Service e Application Service**:
- **Domain Service**: Lógica de negócio pura
- **Application Service**: Coordena use cases, lida com transações e infraestrutura

---

### 6. Domain Event (Evento de Domínio)

**Definição**: Algo significativo que aconteceu no domínio.

**Características**:
- Imutável
- Nomeado no passado
- Contém dados relevantes do momento do evento
- Timestamp incluído

**Implementação**:
```java
public interface DomainEvent {
    UUID getEventId();
    Instant getOcorridoEm();
}

public class PedidoConfirmado implements DomainEvent {
    private final UUID eventId;
    private final Instant ocorridoEm;
    private final PedidoId pedidoId;
    private final ClienteId clienteId;
    private final Money valorTotal;
    
    public PedidoConfirmado(PedidoId pedidoId, ClienteId clienteId, Money valorTotal) {
        this.eventId = UUID.randomUUID();
        this.ocorridoEm = Instant.now();
        this.pedidoId = pedidoId;
        this.clienteId = clienteId;
        this.valorTotal = valorTotal;
    }
    
    // Getters apenas
}

// Handler de evento
@Component
public class PedidoConfirmadoHandler {
    
    @EventListener
    public void handle(PedidoConfirmado evento) {
        // Lógica que reage ao evento
        enviarEmailConfirmacao(evento.getClienteId());
        atualizarEstoque(evento.getPedidoId());
        notificarLogistica(evento.getPedidoId());
    }
}
```

---

## Padrões Estratégicos Detalhados

### Context Map Patterns

#### 1. Shared Kernel
**Uso**: Código compartilhado entre contextos
**Prós**: Reduz duplicação
**Contras**: Acoplamento entre equipes
**Quando**: Equipes próximas, domínio pequeno

#### 2. Customer-Supplier
**Uso**: Relação upstream/downstream
**Prós**: Responsabilidades claras
**Contras**: Requer coordenação
**Quando**: Equipes diferentes, dependência clara

#### 3. Anticorruption Layer (ACL)
**Uso**: Protege modelo de influências externas
**Prós**: Isolamento, modelo limpo
**Contras**: Código de tradução adicional
**Quando**: Integração com sistemas legados

```java
// ACL - Adaptador para sistema legado
public class ClienteLegadoAdapter implements ClienteRepository {
    private final LegacySystemClient legacyClient;
    
    @Override
    public Optional<Cliente> buscarPorId(ClienteId id) {
        LegacyCustomer legacyCustomer = legacyClient.getCustomer(id.getValue());
        return Optional.ofNullable(legacyCustomer)
            .map(this::toDomainModel);
    }
    
    private Cliente toDomainModel(LegacyCustomer legacy) {
        // Traduz do modelo legado para nosso modelo de domínio
        return new Cliente(
            new ClienteId(legacy.getCustNo()),
            new Nome(legacy.getFirstName(), legacy.getLastName()),
            new Email(legacy.getEmailAddr())
        );
    }
}
```

---

## Métricas de Qualidade DDD

### Código
- [ ] Linguagem ubíqua presente no código
- [ ] Agregados pequenos (<10 entidades)
- [ ] Value objects usados extensivamente
- [ ] Sem anemic domain model
- [ ] Invariantes protegidas
- [ ] Lógica de negócio no domínio

### Arquitetura
- [ ] Bounded contexts bem definidos
- [ ] Dependências corretas (domínio não depende de infraestrutura)
- [ ] Separação clara de camadas
- [ ] Repositories apenas para agregados
- [ ] Events representam fatos do negócio

### Processo
- [ ] Event Storming realizado
- [ ] Context Map documentado
- [ ] Glossário de linguagem ubíqua mantido
- [ ] Colaboração contínua com experts de domínio
