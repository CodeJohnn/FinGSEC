/**
 * Sistema de Controle Financeiro Mobile
 * Gerencia transações (receitas e despesas) com armazenamento local e gráficos dinâmicos.
 * Mobile First, JavaScript ES6+ puro.
 */

// ====== Módulo de Dados (localStorage) ======
const Storage = {
    chave: 'controle_financeiro_transacoes',

    carregar() {
        try {
            const dados = localStorage.getItem(this.chave);
            return dados ? JSON.parse(dados) : [];
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            return [];
        }
    },

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
    transacoes: [],

    init() {
        this.transacoes = Storage.carregar();
    },

    listar() {
        return [...this.transacoes];
    },

    adicionar(tipo, descricao, valor, data) {
        const novaTransacao = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            tipo, // 'receita' ou 'despesa'
            descricao,
            valor: parseFloat(valor),
            data
        };
        this.transacoes.push(novaTransacao);
        Storage.salvar(this.transacoes);
        return novaTransacao;
    },

    remover(id) {
        this.transacoes = this.transacoes.filter(t => t.id !== id);
        Storage.salvar(this.transacoes);
    },

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

// ====== Módulo de Interface (UI) ======
const UI = {
    elementos: {},
    graficoBarras: null,
    graficoLinha: null,

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
        
        this.inicializarGraficos();
    },

    formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    formatarData(dataISO) {
        if (!dataISO) return '';
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    },

    atualizarResumo() {
        const totais = GerenciadorTransacoes.calcularTotais();
        this.elementos.saldoTotal.textContent = this.formatarMoeda(totais.saldo);
        this.elementos.totalReceitas.textContent = this.formatarMoeda(totais.receitas);
        this.elementos.totalDespesas.textContent = this.formatarMoeda(totais.despesas);

        const saldoEl = this.elementos.saldoTotal;
        if (totais.saldo >= 0) {
            saldoEl.style.color = '#fff';
        } else {
            saldoEl.style.color = '#e74c3c'; // Mantém o padrão vermelho suave da foto
        }
    },

    renderizarLista() {
        const transacoes = GerenciadorTransacoes.listar();
        const lista = this.elementos.listaTransacoes;
        const vazio = this.elementos.mensagemVazia;

        lista.innerHTML = '';

        if (transacoes.length === 0) {
            vazio.style.display = 'block';
            return;
        }

        vazio.style.display = 'none';

        // Ordena por data decrescente (mais recente primeiro)
        transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

        transacoes.forEach(t => {
            const li = document.createElement('li');
            li.className = 'item-transacao';
            li.dataset.id = t.id;

            const tipoClass = t.tipo === 'receita' ? 'receita' : 'despesa';
            const sinal = t.tipo === 'receita' ? '+' : '-';
            const iconeSeta = t.tipo === 'receita' ? 'fa-arrow-up' : 'fa-arrow-down';
            const bgIcone = t.tipo === 'receita' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
            const corIcone = t.tipo === 'receita' ? '#2ecc71' : '#e74c3c';

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="background: ${bgIcone}; color: ${corIcone}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid ${iconeSeta}" style="font-size: 0.85rem;"></i>
                    </div>
                    <div class="info-transacao">
                        <span class="descricao-transacao">${this.escapeHTML(t.descricao)}</span>
                        <span class="data-transacao">${this.formatarData(t.data)}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="valor-transacao ${tipoClass}">${sinal} ${this.formatarMoeda(t.valor)}</span>
                    <button class="btn-excluir" aria-label="Excluir transação" data-id="${t.id}">
                        <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            `;
            lista.appendChild(li);
        });
    },

    excluirTransacao(id) {
        GerenciadorTransacoes.remover(id);
        this.renderizarLista();
        this.atualizarResumo();
        this.atualizarGraficos();
    },

    adicionarTransacao(event) {
        event.preventDefault();

        const tipo = this.elementos.tipo.value;
        const descricao = this.elementos.descricao.value.trim();
        const valor = this.elementos.valor.value;
        const data = this.elementos.data.value;

        if (!descricao) return alert('Por favor, insira uma descrição.');
        if (!valor || parseFloat(valor) <= 0) return alert('Por favor, insira um valor válido maior que zero.');
        if (!data) return alert('Por favor, selecione uma data.');

        GerenciadorTransacoes.adicionar(tipo, descricao, valor, data);

        this.renderizarLista();
        this.atualizarResumo();
        this.atualizarGraficos();

        this.elementos.descricao.value = '';
        this.elementos.valor.value = '';
        this.elementos.descricao.focus();
    },

    escapeHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    },

    inicializarGraficos() {
        Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
        Chart.defaults.font.family = "'Inter', sans-serif";

        // 1. Gráfico de Barras
        const ctxBarras = document.getElementById('graficoBarras').getContext('2d');
        this.graficoBarras = new Chart(ctxBarras, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Receitas', data: [], backgroundColor: '#2ecc71', borderRadius: 4, barPercentage: 0.6 },
                    { label: 'Despesas', data: [], backgroundColor: '#e74c3c', borderRadius: 4, barPercentage: 0.6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } } },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { callback: value => value >= 1000 || value <= -1000 ? (value / 1000) + 'k' : value }
                    }
                }
            }
        });

        // 2. Gráfico de Linha
        const ctxLinha = document.getElementById('graficoLinha').getContext('2d');
        this.graficoLinha = new Chart(ctxLinha, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Saldo',
                    data: [],
                    borderColor: '#e5a93c',
                    backgroundColor: 'rgba(229, 169, 60, 0.05)',
                    fill: true,
                    tension: 0.2,
                    pointBackgroundColor: '#e5a93c',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } } },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { callback: value => value >= 1000 || value <= -1000 ? (value / 1000) + 'k' : value }
                    }
                }
            }
        });
    },

    atualizarGraficos() {
        const transacoes = GerenciadorTransacoes.listar();
        const dadosPorMes = {};

        // Agrupa de forma dinâmica com base nas transações inseridas
        transacoes.forEach(t => {
            const dataObj = new Date(t.data + 'T00:00:00');
            const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            
            if (!dadosPorMes[mesAno]) {
                dadosPorMes[mesAno] = { receita: 0, despesa: 0, timestamp: dataObj.getTime() };
            }

            if (t.tipo === 'receita') dadosPorMes[mesAno].receita += t.valor;
            else dadosPorMes[mesAno].despesa += t.valor;
        });

        // Ordena cronologicamente os meses do objeto no eixo horizontal
        const mesesOrdenados = Object.keys(dadosPorMes).sort((a, b) => dadosPorMes[a].timestamp - dadosPorMes[b].timestamp);

        const receitas = mesesOrdenados.map(m => dadosPorMes[m].receita);
        const despesas = mesesOrdenados.map(m => dadosPorMes[m].despesa);

        let acumulado = 0;
        const historicoSaldos = mesesOrdenados.map(m => {
            acumulado += (dadosPorMes[m].receita - dadosPorMes[m].despesa);
            return acumulado;
        });

        // Aplica e renderiza os novos dados no Gráfico de Barras
        this.graficoBarras.data.labels = mesesOrdenados;
        this.graficoBarras.data.datasets[0].data = receitas;
        this.graficoBarras.data.datasets[1].data = despesas;
        this.graficoBarras.update();

        // Aplica e renderiza os novos dados no Gráfico de Linha
        this.graficoLinha.data.labels = mesesOrdenados.length ? ['0', ...mesesOrdenados] : [];
        this.graficoLinha.data.datasets[0].data = mesesOrdenados.length ? [0, ...historicoSaldos] : [];
        this.graficoLinha.update();
    },

    configurarEventos() {
        this.elementos.form.addEventListener('submit', (e) => this.adicionarTransacao(e));

        this.elementos.listaTransacoes.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-excluir');
            if (btn) {
                const id = btn.dataset.id;
                this.excluirTransacao(id);
            }
        });

        const hoje = new Date().toISOString().split('T')[0];
        this.elementos.data.value = hoje;
    },

    iniciar() {
        this.init();
        GerenciadorTransacoes.init();
        this.configurarEventos();
        this.renderizarLista();
        this.atualizarResumo();
        this.atualizarGraficos(); // Atualização automática na carga inicial
    }
};

// ====== Inicialização ======
document.addEventListener('DOMContentLoaded', () => {
    UI.iniciar();
});