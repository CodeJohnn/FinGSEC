/**
 * Sistema de Controle Financeiro Mobile
 * Gerencia transações (receitas e despesas) com armazenamento local.
 * Mobile First, JavaScript ES6+ puro.
 */

// ====== Módulo de Dados (localStorage) ======
const Storage = {
    // Chave usada no localStorage
    chave: 'controle_financeiro_transacoes',

    // Carrega todas as transações salvas
    carregar() {
        try {
            const dados = localStorage.getItem(this.chave);
            return dados ? JSON.parse(dados) : [];
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            return [];
        }
    },

    // Salva a lista de transações
    salvar(transacoes) {
        try {
            localStorage.setItem(this.chave, JSON.stringify(transacoes));
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
        }
    }
};

// ====== Gerenciador de Transações ======
const GerenciadorTransacoes = {
    // Lista interna de transações
    transacoes: [],

    // Inicializa carregando do storage
    init() {
        this.transacoes = Storage.carregar();
    },

    // Retorna todas as transações (cópia)
    listar() {
        return [...this.transacoes];
    },

    // Adiciona nova transação e persiste
    adicionar(tipo, descricao, valor, data) {
        const novaTransacao = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            tipo,           // 'receita' ou 'despesa'
            descricao,
            valor: parseFloat(valor),
            data
        };
        this.transacoes.push(novaTransacao);
        Storage.salvar(this.transacoes);
        return novaTransacao;
    },

    // Remove transação pelo ID e persiste
    remover(id) {
        this.transacoes = this.transacoes.filter(t => t.id !== id);
        Storage.salvar(this.transacoes);
    },

    // Calcula totais
    calcularTotais() {
        let receitas = 0;
        let despesas = 0;
        this.transacoes.forEach(t => {
            if (t.tipo === 'receita') receitas += t.valor;
            else despesas += t.valor;
        });
        const saldo = receitas - despesas;
        return { receitas, despesas, saldo };
    }
};

// ====== Módulo de Interface ======
const UI = {
    // Elementos do DOM
    elementos: {},

    // Inicializa referências aos elementos
    init() {
        this.elementos = {
            saldoTotal: document.getElementById('saldoTotal'),
            totalReceitas: document.getElementById('totalReceitas'),
            totalDespesas: document.getElementById('totalDespesas'),
            listaTransacoes: document.getElementById('listaTransacoes'),
            mensagemVazia: document.getElementById('mensagemVazia'),
            form: document.getElementById('formTransacao'),
            tipo: document.getElementById('tipo'),
            descricao: document.getElementById('descricao'),
            valor: document.getElementById('valor'),
            data: document.getElementById('data')
        };
    },

    // Formata valor numérico para moeda BRL
    formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    // Formata data ISO para dd/mm/aaaa
    formatarData(dataISO) {
        if (!dataISO) return '';
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    },

    // Atualiza os cartões de resumo
    atualizarResumo() {
        const totais = GerenciadorTransacoes.calcularTotais();
        this.elementos.saldoTotal.textContent = this.formatarMoeda(totais.saldo);
        this.elementos.totalReceitas.textContent = this.formatarMoeda(totais.receitas);
        this.elementos.totalDespesas.textContent = this.formatarMoeda(totais.despesas);

        // Muda cor do saldo dependendo do valor
        const saldoEl = this.elementos.saldoTotal;
        if (totais.saldo >= 0) {
            saldoEl.style.color = '#fff';
        } else {
            saldoEl.style.color = '#ff6b6b';
        }
    },

    // Renderiza a lista de transações
    renderizarLista() {
        const transacoes = GerenciadorTransacoes.listar();
        const lista = this.elementos.listaTransacoes;
        const vazio = this.elementos.mensagemVazia;

        // Limpa lista atual
        lista.innerHTML = '';

        if (transacoes.length === 0) {
            vazio.style.display = 'block';
            return;
        }

        vazio.style.display = 'none';

        // Ordena por data decrescente (mais recente primeiro)
        transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

        // Cria os itens
        transacoes.forEach(t => {
            const li = document.createElement('li');
            li.className = 'item-transacao';
            li.dataset.id = t.id;

            // Classe para tipo (receita/despesa) usada no CSS
            const tipoClass = t.tipo === 'receita' ? 'receita' : 'despesa';
            const sinal = t.tipo === 'receita' ? '+' : '-';

            li.innerHTML = `
                <div class="info-transacao">
                    <span class="descricao-transacao">${this.escapeHTML(t.descricao)}</span>
                    <span class="data-transacao">${this.formatarData(t.data)}</span>
                </div>
                <span class="valor-transacao ${tipoClass}">${sinal} ${this.formatarMoeda(t.valor)}</span>
                <button class="btn-excluir" aria-label="Excluir transação" data-id="${t.id}">&times;</button>
            `;
            lista.appendChild(li);
        });

        // Adiciona eventos de exclusão aos botões (delegação não funciona com clique nos botões recém-criados? Abaixo usamos delegação no evento da lista)
    },

    // Remove transação da interface e dos dados
    async excluirTransacao(id) {
        // Confirmação simples (opcional)
        // if (!confirm('Excluir esta transação?')) return;

        GerenciadorTransacoes.remover(id);
        this.renderizarLista();
        this.atualizarResumo();
    },

    // Adiciona nova transação via formulário
    adicionarTransacao(event) {
        event.preventDefault();

        const tipo = this.elementos.tipo.value;
        const descricao = this.elementos.descricao.value.trim();
        const valor = this.elementos.valor.value;
        const data = this.elementos.data.value;

        // Validações básicas
        if (!descricao) {
            alert('Por favor, insira uma descrição.');
            return;
        }
        if (!valor || parseFloat(valor) <= 0) {
            alert('Por favor, insira um valor válido maior que zero.');
            return;
        }
        if (!data) {
            alert('Por favor, selecione uma data.');
            return;
        }

        // Adiciona transação
        GerenciadorTransacoes.adicionar(tipo, descricao, valor, data);

        // Atualiza interface
        this.renderizarLista();
        this.atualizarResumo();

        // Limpa formulário (mantém tipo e data atual)
        this.elementos.descricao.value = '';
        this.elementos.valor.value = '';
        // Data pode ser resetada para hoje? Melhor manter a data selecionada
        // Opcional: definir data para hoje
        this.elementos.data.value = new Date().toISOString().split('T')[0];
        this.elementos.descricao.focus();
    },

    // Função auxiliar para escapar HTML (evita XSS simples)
    escapeHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    },

    // Configura ouvintes de eventos
    configurarEventos() {
        // Submissão do formulário
        this.elementos.form.addEventListener('submit', (e) => this.adicionarTransacao(e));

        // Delegação de eventos para botões de excluir (na lista)
        this.elementos.listaTransacoes.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-excluir');
            if (btn) {
                const id = btn.dataset.id;
                this.excluirTransacao(id);
            }
        });

        // Define data atual como padrão no campo data
        const hoje = new Date().toISOString().split('T')[0];
        this.elementos.data.value = hoje;
    },

    // Inicialização completa
    iniciar() {
        this.init();
        GerenciadorTransacoes.init();
        this.configurarEventos();
        this.renderizarLista();
        this.atualizarResumo();
    }
};

// ====== Ponto de entrada quando o DOM estiver pronto ======
document.addEventListener('DOMContentLoaded', () => {
    UI.iniciar();
});