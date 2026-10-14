# Template de Agregado

Use este template como guia para criar agregados bem estruturados seguindo princípios DDD.

## Checklist de Design

Antes de criar o agregado, responda:

- [ ] Qual é a raiz do agregado?
- [ ] Quais invariantes de negócio devem ser protegidas?
- [ ] Quais entidades e value objects fazem parte?
- [ ] Qual é a fronteira transacional?
- [ ] Como outros agregados irão referenciar este?
- [ ] Quais eventos de domínio serão gerados?

## Template Java

```java
package com.empresa.dominio.model.aggregates;

import com.empresa.dominio.model.entities.*;
import com.empresa.dominio.model.valueobjects.*;
import com.empresa.dominio.model.events.*;
import com.empresa.dominio.exceptions.*;

import java.util.*;
import java.time.Instant;

/**
 * [NOME_DO_AGREGADO] - Aggregate Root
 * 
 * Descrição: [Descreva o propósito do agregado]
 * 
 * Invariantes:
 * - [Liste as regras de negócio que este agregado garante]
 * - [Ex: Um pedido confirmado não pode ser modificado]
 * - [Ex: O valor total deve ser sempre a soma dos itens]
 * 
 * Eventos gerados:
 * - [Liste os eventos que este agregado pode gerar]
 */
public class NomeDoAgregado {
    
    // ========================================
    // Campos - Estado do Agregado
    // ========================================
    
    // Identificador único - sempre final
    private final NomeDoAgregadoId id;
    
    // Value Objects
    private NomeValueObject campo1;
    private OutroValueObject campo2;
    
    // Enums para estados
    private StatusDoAgregado status;
    
    // Entidades filhas - sempre em coleções imutáveis
    private final List<EntidadeFilha> entidadesFilhas;
    
    // Referências a outros agregados - SEMPRE por ID
    private OutroAgregadoId referenciaExterna;
    
    // Eventos de domínio pendentes
    private final List<DomainEvent> eventosPendentes;
    
    // Timestamp de auditoria
    private final Instant criadoEm;
    private Instant modificadoEm;
    
    // ========================================
    // Construtor - Sempre privado
    // ========================================
    
    private NomeDoAgregado(
        NomeDoAgregadoId id,
        NomeValueObject campo1,
        OutroValueObject campo2
    ) {
        // Validações iniciais
        Objects.requireNonNull(id, "ID não pode ser nulo");
        Objects.requireNonNull(campo1, "Campo1 não pode ser nulo");
        
        // Inicialização
        this.id = id;
        this.campo1 = campo1;
        this.campo2 = campo2;
        this.status = StatusDoAgregado.INICIAL;
        this.entidadesFilhas = new ArrayList<>();
        this.eventosPendentes = new ArrayList<>();
        this.criadoEm = Instant.now();
        this.modificadoEm = this.criadoEm;
    }
    
    // ========================================
    // Factory Methods - Criação do Agregado
    // ========================================
    
    /**
     * Cria um novo [NomeDoAgregado]
     */
    public static NomeDoAgregado criar(
        NomeValueObject campo1,
        OutroValueObject campo2
    ) {
        NomeDoAgregadoId id = NomeDoAgregadoId.gerar();
        NomeDoAgregado agregado = new NomeDoAgregado(id, campo1, campo2);
        
        // Registrar evento de criação
        agregado.registrarEvento(
            new NomeDoAgregadoCriado(id, campo1, campo2)
        );
        
        return agregado;
    }
    
    /**
     * Reconstrói o agregado a partir de dados persistidos
     * (usado pelo repository)
     */
    public static NomeDoAgregado reconstituir(
        NomeDoAgregadoId id,
        NomeValueObject campo1,
        OutroValueObject campo2,
        StatusDoAgregado status,
        List<EntidadeFilha> entidades,
        Instant criadoEm,
        Instant modificadoEm
    ) {
        NomeDoAgregado agregado = new NomeDoAgregado(id, campo1, campo2);
        agregado.status = status;
        agregado.entidadesFilhas.addAll(entidades);
        // Note: não registra eventos na reconstituição
        return agregado;
    }
    
    // ========================================
    // Comportamentos - Operações de Negócio
    // ========================================
    
    /**
     * [Descreva o que este método faz]
     * 
     * @param parametro descrição do parâmetro
     * @throws DomainException se [condição de erro]
     */
    public void executarOperacao(ParametroValueObject parametro) {
        // 1. Validar pré-condições
        validarPodeExecutarOperacao();
        validarParametro(parametro);
        
        // 2. Executar lógica de negócio
        // ... modificar estado do agregado
        
        // 3. Atualizar timestamp
        this.modificadoEm = Instant.now();
        
        // 4. Registrar evento de domínio
        registrarEvento(
            new OperacaoExecutada(this.id, parametro)
        );
    }
    
    /**
     * Adiciona uma entidade filha ao agregado
     */
    public void adicionarEntidadeFilha(
        ParametrosParaCriacaoValueObject parametros
    ) {
        // Validar pré-condições
        validarPodeAdicionarEntidade();
        validarParametros(parametros);
        
        // Criar entidade filha
        EntidadeFilha entidade = new EntidadeFilha(
            EntidadeFilhaId.gerar(),
            parametros
        );
        
        // Adicionar à coleção
        this.entidadesFilhas.add(entidade);
        
        // Recalcular valores derivados se necessário
        recalcularValoresDerivados();
        
        this.modificadoEm = Instant.now();
        
        registrarEvento(
            new EntidadeFilhaAdicionada(this.id, entidade.getId())
        );
    }
    
    /**
     * Remove uma entidade filha
     */
    public void removerEntidadeFilha(EntidadeFilhaId entidadeId) {
        validarPodeRemoverEntidade();
        
        boolean removida = this.entidadesFilhas.removeIf(
            e -> e.getId().equals(entidadeId)
        );
        
        if (!removida) {
            throw new EntidadeNaoEncontradaException(entidadeId);
        }
        
        recalcularValoresDerivados();
        this.modificadoEm = Instant.now();
        
        registrarEvento(
            new EntidadeFilhaRemovida(this.id, entidadeId)
        );
    }
    
    /**
     * Muda o status do agregado
     */
    public void mudarParaStatus(StatusDoAgregado novoStatus) {
        validarTransicaoDeStatus(this.status, novoStatus);
        
        StatusDoAgregado statusAnterior = this.status;
        this.status = novoStatus;
        this.modificadoEm = Instant.now();
        
        registrarEvento(
            new StatusAlterado(this.id, statusAnterior, novoStatus)
        );
    }
    
    // ========================================
    // Validações - Proteção de Invariantes
    // ========================================
    
    private void validarPodeExecutarOperacao() {
        if (this.status == StatusDoAgregado.FINALIZADO) {
            throw new DomainException(
                "Não é possível executar operação em agregado finalizado"
            );
        }
    }
    
    private void validarPodeAdicionarEntidade() {
        if (this.status != StatusDoAgregado.ATIVO) {
            throw new DomainException(
                "Entidades só podem ser adicionadas quando status é ATIVO"
            );
        }
        
        if (this.entidadesFilhas.size() >= 100) {
            throw new DomainException(
                "Limite máximo de entidades filhas atingido"
            );
        }
    }
    
    private void validarPodeRemoverEntidade() {
        if (this.entidadesFilhas.isEmpty()) {
            throw new DomainException(
                "Não há entidades para remover"
            );
        }
    }
    
    private void validarTransicaoDeStatus(
        StatusDoAgregado atual,
        StatusDoAgregado novo
    ) {
        // Implementar máquina de estados se necessário
        boolean transicaoValida = switch (atual) {
            case INICIAL -> novo == StatusDoAgregado.ATIVO;
            case ATIVO -> novo == StatusDoAgregado.FINALIZADO || 
                         novo == StatusDoAgregado.CANCELADO;
            case FINALIZADO, CANCELADO -> false;
        };
        
        if (!transicaoValida) {
            throw new TransicaoDeStatusInvalidaException(atual, novo);
        }
    }
    
    private void validarParametro(ParametroValueObject parametro) {
        Objects.requireNonNull(parametro, "Parâmetro não pode ser nulo");
        // Validações específicas do negócio
    }
    
    // ========================================
    // Métodos Auxiliares Privados
    // ========================================
    
    private void recalcularValoresDerivados() {
        // Recalcular valores que dependem de entidades filhas
        // Ex: totais, médias, etc.
    }
    
    // ========================================
    // Eventos de Domínio
    // ========================================
    
    private void registrarEvento(DomainEvent evento) {
        this.eventosPendentes.add(evento);
    }
    
    public List<DomainEvent> getEventosPendentes() {
        return Collections.unmodifiableList(eventosPendentes);
    }
    
    public void limparEventos() {
        eventosPendentes.clear();
    }
    
    // ========================================
    // Getters - Acesso Controlado ao Estado
    // ========================================
    
    public NomeDoAgregadoId getId() {
        return id;
    }
    
    public NomeValueObject getCampo1() {
        return campo1;
    }
    
    public OutroValueObject getCampo2() {
        return campo2;
    }
    
    public StatusDoAgregado getStatus() {
        return status;
    }
    
    /**
     * Retorna cópia defensiva da coleção
     */
    public List<EntidadeFilha> getEntidadesFilhas() {
        return Collections.unmodifiableList(entidadesFilhas);
    }
    
    public Instant getCriadoEm() {
        return criadoEm;
    }
    
    public Instant getModificadoEm() {
        return modificadoEm;
    }
    
    // ========================================
    // Sem Setters! Mudanças via comportamentos
    // ========================================
    
    // ========================================
    // Equals e HashCode - Baseados na Identidade
    // ========================================
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NomeDoAgregado)) return false;
        NomeDoAgregado that = (NomeDoAgregado) o;
        return id.equals(that.id);
    }
    
    @Override
    public int hashCode() {
        return id.hashCode();
    }
    
    @Override
    public String toString() {
        return "NomeDoAgregado{" +
               "id=" + id +
               ", status=" + status +
               ", modificadoEm=" + modificadoEm +
               '}';
    }
}
```

## Template TypeScript

```typescript
/**
 * [NOME_DO_AGREGADO] - Aggregate Root
 * 
 * Invariantes:
 * - [Liste as regras de negócio]
 */
export class NomeDoAgregado {
    // Campos privados
    private readonly _id: NomeDoAgregadoId;
    private _campo1: NomeValueObject;
    private _campo2: OutroValueObject;
    private _status: StatusDoAgregado;
    private readonly _entidadesFilhas: EntidadeFilha[];
    private readonly _eventosPendentes: DomainEvent[];
    private readonly _criadoEm: Date;
    private _modificadoEm: Date;
    
    // Construtor privado
    private constructor(
        id: NomeDoAgregadoId,
        campo1: NomeValueObject,
        campo2: OutroValueObject
    ) {
        this._id = id;
        this._campo1 = campo1;
        this._campo2 = campo2;
        this._status = StatusDoAgregado.INICIAL;
        this._entidadesFilhas = [];
        this._eventosPendentes = [];
        this._criadoEm = new Date();
        this._modificadoEm = this._criadoEm;
    }
    
    // Factory method
    public static criar(
        campo1: NomeValueObject,
        campo2: OutroValueObject
    ): NomeDoAgregado {
        const id = NomeDoAgregadoId.gerar();
        const agregado = new NomeDoAgregado(id, campo1, campo2);
        
        agregado.registrarEvento(
            new NomeDoAgregadoCriado(id, campo1, campo2)
        );
        
        return agregado;
    }
    
    // Comportamentos
    public executarOperacao(parametro: ParametroValueObject): void {
        this.validarPodeExecutarOperacao();
        this.validarParametro(parametro);
        
        // Lógica de negócio
        
        this._modificadoEm = new Date();
        this.registrarEvento(new OperacaoExecutada(this._id, parametro));
    }
    
    // Validações
    private validarPodeExecutarOperacao(): void {
        if (this._status === StatusDoAgregado.FINALIZADO) {
            throw new DomainException(
                'Não é possível executar operação em agregado finalizado'
            );
        }
    }
    
    private validarParametro(parametro: ParametroValueObject): void {
        if (!parametro) {
            throw new DomainException('Parâmetro não pode ser nulo');
        }
    }
    
    // Eventos
    private registrarEvento(evento: DomainEvent): void {
        this._eventosPendentes.push(evento);
    }
    
    // Getters
    public get id(): NomeDoAgregadoId {
        return this._id;
    }
    
    public get campo1(): NomeValueObject {
        return this._campo1;
    }
    
    public get status(): StatusDoAgregado {
        return this._status;
    }
    
    public get entidadesFilhas(): readonly EntidadeFilha[] {
        return Object.freeze([...this._entidadesFilhas]);
    }
    
    public get eventosPendentes(): readonly DomainEvent[] {
        return Object.freeze([...this._eventosPendentes]);
    }
    
    public limparEventos(): void {
        this._eventosPendentes.length = 0;
    }
}
```

## Checklist Final

Ao terminar a implementação, verifique:

- [ ] Construtor é privado
- [ ] Criação via factory methods
- [ ] ID é final/readonly
- [ ] Sem setters públicos
- [ ] Mudanças via comportamentos com nomes de negócio
- [ ] Invariantes validadas antes de mudanças
- [ ] Coleções retornam cópias defensivas
- [ ] Eventos registrados para mudanças importantes
- [ ] Equals/hashCode baseados no ID
- [ ] Referências a outros agregados são por ID
- [ ] Entidades filhas não são acessíveis diretamente
- [ ] Linguagem ubíqua presente nos nomes
- [ ] Comentários explicam o "porquê", não o "como"
