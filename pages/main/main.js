(() => {
    'use strict';

    const TRANSACTION_KEY = 'controle_financeiro_transacoes';
    const KEYS = {
        categories: 'fingsec_categorias',
        budgets: 'fingsec_orcamentos',
        bills: 'fingsec_contas',
        goals: 'fingsec_metas',
        settings: 'fingsec_configuracoes'
    };

    const DEFAULT_CATEGORIES = {
        receita: ['Salário', 'Renda extra', 'Investimentos', 'Outros'],
        despesa: ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas', 'Outros']
    };

    const CATEGORY_ICONS = {
        'Alimentação': 'fa-utensils',
        'Transporte': 'fa-car-side',
        'Moradia': 'fa-house',
        'Lazer': 'fa-ticket',
        'Saúde': 'fa-heart-pulse',
        'Educação': 'fa-book-open',
        'Contas': 'fa-file-invoice-dollar',
        'Salário': 'fa-briefcase',
        'Renda extra': 'fa-coins',
        'Investimentos': 'fa-arrow-trend-up',
        'Outros': 'fa-ellipsis'
    };

    const Storage = {
        blocked: false,

        read(key, fallback) {
            try {
                if (window.FinCloud) return window.FinCloud.read(key, fallback);
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (error) {
                console.error(`Não foi possível ler ${key}:`, error);
                this.blocked = true;
                return fallback;
            }
        },

        async write(key, value) {
            if (this.blocked) return false;
            try {
                if (window.FinCloud) await window.FinCloud.write(key, value);
                else localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error(`Não foi possível salvar ${key}:`, error);
                toast(window.FinCloud ? error.message : 'Falha ao salvar no navegador.', true);
                return false;
            }
        }
    };

    const Data = {
        transactions: [],
        customCategories: [],
        budgets: {},
        bills: [],
        goals: [],
        settings: {},

        init() {
            const transactions = Storage.read(TRANSACTION_KEY, []);
            if (!Array.isArray(transactions)) {
                this.transactions = [];
                Storage.blocked = true;
            } else {
                this.transactions = transactions;
            }
            this.customCategories = this.readArray(KEYS.categories);
            this.budgets = this.readObject(KEYS.budgets);
            this.bills = this.readArray(KEYS.bills);
            this.goals = this.readArray(KEYS.goals);
            this.settings = this.readObject(KEYS.settings);
        },

        readArray(key) {
            const value = Storage.read(key, []);
            if (Array.isArray(value)) return value;
            Storage.blocked = true;
            return [];
        },

        readObject(key) {
            const value = Storage.read(key, {});
            if (value && typeof value === 'object' && !Array.isArray(value)) return value;
            Storage.blocked = true;
            return {};
        },

        async saveTransactions(next) {
            if (!await Storage.write(TRANSACTION_KEY, next)) return false;
            this.transactions = next;
            return true;
        },

        async saveCollection(property, key, next) {
            if (!await Storage.write(key, next)) return false;
            this[property] = next;
            return true;
        },

        categories(type) {
            const source = type ? DEFAULT_CATEGORIES[type] : [...DEFAULT_CATEGORIES.receita, ...DEFAULT_CATEGORIES.despesa];
            const transactionCategories = this.transactions.map(transaction => transaction.categoria || inferCategory(transaction));
            return [...new Set([...source, ...this.customCategories, ...transactionCategories])];
        },

        categoryFor(transaction) {
            return transaction.categoria || inferCategory(transaction);
        }
    };

    const elements = {};
    let barChart = null;
    let lineChart = null;
    let editingId = null;
    let toastTimer = null;
    let periodAnchor = today();
    let modalTrigger = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function today() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function localDate(year, month, day) {
        return new Date(year, month, day);
    }

    function dateFromISO(value) {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return localDate(year, month - 1, day);
    }

    function dateToISO(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function addMonths(date, amount) {
        const day = date.getDate();
        const result = localDate(date.getFullYear(), date.getMonth() + amount, 1);
        const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        result.setDate(Math.min(day, lastDay));
        return result;
    }

    function dayDifference(first, second) {
        return Math.round((localDate(second.getFullYear(), second.getMonth(), second.getDate()) -
            localDate(first.getFullYear(), first.getMonth(), first.getDate())) / 86400000);
    }

    function moneyToCents(value) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : 0;
    }

    function formatMoney(value) {
        return (moneyToCents(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(value) {
        const date = dateFromISO(value);
        return date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '—';
    }

    function formatMonth(date) {
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function transactionLabel(transaction) {
        const label = transaction.descricao || 'Transação';
        return transaction.parcela && transaction.parcelas
            ? `${label} (${transaction.parcela}/${transaction.parcelas})`
            : label;
    }

    function inferCategory(transaction) {
        const description = String(transaction.descricao || '').toLocaleLowerCase('pt-BR');
        if (transaction.tipo === 'receita') {
            if (/sal[aá]rio|pagamento|ordenado/.test(description)) return 'Salário';
            if (/invest|dividend|juros/.test(description)) return 'Investimentos';
            if (/freela|extra|venda/.test(description)) return 'Renda extra';
            return 'Outros';
        }
        if (/mercado|supermercado|restaurante|alimenta|lanche|feira/.test(description)) return 'Alimentação';
        if (/uber|combust[ií]vel|transporte|ônibus|onibus|gasolina|estacionamento/.test(description)) return 'Transporte';
        if (/aluguel|condom[ií]nio|moradia|im[oó]vel/.test(description)) return 'Moradia';
        if (/cinema|lazer|viagem|streaming|show/.test(description)) return 'Lazer';
        if (/sa[uú]de|farm[aá]cia|m[eé]dico|consulta/.test(description)) return 'Saúde';
        if (/escola|curso|livro|educa[cç][aã]o/.test(description)) return 'Educação';
        if (/conta|luz|[aá]gua|internet|telefone|energia/.test(description)) return 'Contas';
        return 'Outros';
    }

    function newId() {
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    function toast(message, error = false) {
        const region = byId('toastRegion');
        if (!region) return;
        if (toastTimer) clearTimeout(toastTimer);
        region.innerHTML = `<div class="toast${error ? ' error' : ''}"><i class="fa-solid ${error ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${escapeHTML(message)}</span></div>`;
        toastTimer = setTimeout(() => { region.innerHTML = ''; }, 3200);
    }

    function monthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function sumTransactions(transactions, type) {
        return transactions.reduce((sum, item) => {
            if (type && item.tipo !== type) return sum;
            return sum + moneyToCents(item.valor);
        }, 0) / 100;
    }

    function getMonthlyTransactions(offset = 0) {
        const date = localDate(today().getFullYear(), today().getMonth() + offset, 1);
        const key = monthKey(date);
        return Data.transactions.filter(transaction => transaction.data && transaction.data.slice(0, 7) === key);
    }

    function updateSummary() {
        const mode = byId('chartPeriod').value;
        const range = transactionDateRange(mode);
        const monthly = Data.transactions.filter(range.match);
        const anchor = periodAnchor;
        periodAnchor = mode === 'week' ? localDate(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 7) : addMonths(anchor, mode === 'year' ? -12 : -1);
        const previous = Data.transactions.filter(transactionDateRange(mode).match);
        periodAnchor = anchor;
        byId('selectedPeriodLabel').textContent = `${formatDate(dateToISO(range.dates[0]))} — ${formatDate(dateToISO(mode === 'year' ? localDate(anchor.getFullYear(), 12, 0) : range.dates.at(-1)))} · inclui lançamentos agendados`;
        const realized = Data.transactions.filter(t => t.data <= dateToISO(today()));
        const allIncome = sumTransactions(realized, 'receita');
        const allExpense = sumTransactions(realized, 'despesa');
        const income = sumTransactions(monthly, 'receita');
        const expense = sumTransactions(monthly, 'despesa');
        const previousIncome = sumTransactions(previous, 'receita');
        const previousExpense = sumTransactions(previous, 'despesa');
        const balance = Math.round((allIncome - allExpense) * 100) / 100;

        byId('saldoTotal').textContent = formatMoney(balance);
        byId('totalReceitas').textContent = formatMoney(income);
        byId('totalDespesas').textContent = formatMoney(expense);
        byId('monthlyBalance').textContent = formatMoney(Math.round((income - expense) * 100) / 100);
        byId('transactionCount').textContent = String(Data.transactions.length);
        byId('monthProgress').style.width = `${income > 0 ? Math.max(0, Math.min(100, ((income - expense) / income) * 100)) : 0}%`;

        const balanceTrend = byId('balanceTrend');
        if (!Data.transactions.length) {
            setTrend(balanceTrend, 'neutral', 'fa-minus', 'Sem movimentações');
        } else {
            setTrend(balanceTrend, balance >= 0 ? 'positive' : 'negative', balance >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
                balance >= 0 ? 'Saldo positivo' : 'Saldo negativo');
        }
        setComparisonTrend(byId('incomeTrend'), income, previousIncome, 'vs. período anterior');
        setComparisonTrend(byId('expenseTrend'), expense, previousExpense, 'vs. período anterior', true);
    }

    function setTrend(element, mood, icon, text) {
        element.className = `trend-pill ${mood}`;
        element.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHTML(text)}`;
    }

    function setComparisonTrend(element, current, previous, suffix, inverse = false) {
        if (previous === 0 && current === 0) {
            setTrend(element, 'neutral', 'fa-minus', `0% ${suffix}`);
            return;
        }
        if (previous === 0) {
            setTrend(element, inverse ? 'negative' : 'positive', 'fa-arrow-trend-up', `Novo período ${suffix}`);
            return;
        }
        const percentage = Math.round(((current - previous) / previous) * 100);
        const improved = inverse ? percentage <= 0 : percentage >= 0;
        setTrend(element, improved ? 'positive' : 'negative',
            percentage >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
            `${percentage > 0 ? '+' : ''}${percentage}% ${suffix}`);
    }

    function iconForCategory(category) {
        return CATEGORY_ICONS[category] || 'fa-tag';
    }

    function transactionSymbol(transaction) {
        const income = transaction.tipo === 'receita';
        return `<span class="transaction-symbol ${income ? 'receita' : 'despesa'}"><i class="fa-solid ${income ? 'fa-arrow-down' : iconForCategory(Data.categoryFor(transaction))}"></i></span>`;
    }

    function renderRecentTransactions() {
        const list = byId('recentTransactions');
        const transactions = [...Data.transactions].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5);
        byId('recentEmpty').classList.toggle('visible', transactions.length === 0);
        list.innerHTML = transactions.map(transaction => {
            const category = Data.categoryFor(transaction);
            const type = transaction.tipo;
            return `<li class="transaction-row"><div class="transaction-main">${transactionSymbol(transaction)}<div class="transaction-copy"><strong>${escapeHTML(transactionLabel(transaction))}</strong><span>${escapeHTML(category)} · ${escapeHTML(formatDate(transaction.data))}</span></div></div><span class="transaction-amount ${type}">${type === 'receita' ? '+' : '−'} ${formatMoney(transaction.valor)}</span></li>`;
        }).join('');
    }

    function categoriesForType(type) {
        return Data.categories(type);
    }

    function renderCategoryOptions(type, selected = '') {
        const select = byId('categorySelect');
        const categories = categoriesForType(type);
        if (selected && !categories.includes(selected)) categories.push(selected);
        select.innerHTML = categories.map(category =>
            `<option value="${escapeHTML(category)}"${category === selected ? ' selected' : ''}>${escapeHTML(category)}</option>`
        ).join('');
    }

    function renderFilterCategories() {
        const select = byId('filterCategory');
        const current = select.value;
        const categories = Data.categories();
        select.innerHTML = '<option value="">Todas as categorias</option>' +
            categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
        if (categories.includes(current)) select.value = current;
    }

    function filteredTransactions() {
        const query = byId('searchTransactions').value.trim().toLocaleLowerCase('pt-BR');
        const type = byId('filterType').value;
        const category = byId('filterCategory').value;
        const from = byId('filterFrom').value;
        const to = byId('filterTo').value;
        const minimum = byId('filterMin').value === '' ? null : moneyToCents(byId('filterMin').value);
        const maximum = byId('filterMax').value === '' ? null : moneyToCents(byId('filterMax').value);

        return [...Data.transactions].filter(transaction => {
            const description = String(transaction.descricao || '').toLocaleLowerCase('pt-BR');
            const transactionCategory = Data.categoryFor(transaction);
            const value = moneyToCents(transaction.valor);
            return (!query || description.includes(query) || transactionCategory.toLocaleLowerCase('pt-BR').includes(query)) &&
                (!type || transaction.tipo === type) &&
                (!category || transactionCategory === category) &&
                (!from || transaction.data >= from) &&
                (!to || transaction.data <= to) &&
                (minimum === null || value >= minimum) &&
                (maximum === null || value <= maximum);
        }).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    }

    function renderTransactions() {
        const transactions = filteredTransactions();
        const body = byId('listaTransacoes');
        body.innerHTML = transactions.map(transaction => {
            const income = transaction.tipo === 'receita';
            const category = Data.categoryFor(transaction);
            const note = transaction.observacao ? ` · ${escapeHTML(transaction.observacao)}` : '';
            const recurring = transaction.recorrente ? '<i class="fa-solid fa-repeat" title="Recorrente"></i> ' : '';
            return `<tr>
                <td><div class="table-transaction">${transactionSymbol(transaction)}<span class="table-description"><strong>${recurring}${escapeHTML(transactionLabel(transaction))}</strong><small>${escapeHTML(category)}${note}</small></span></div></td>
                <td><span class="category-chip"><i class="fa-solid ${iconForCategory(category)}"></i>${escapeHTML(category)}</span></td>
                <td>${escapeHTML(formatDate(transaction.data))}</td>
                <td><span class="type-chip ${income ? 'receita' : 'despesa'}"><i class="fa-solid ${income ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>${income ? 'Receita' : 'Despesa'}</span></td>
                <td class="amount-cell"><span class="transaction-amount ${transaction.tipo}">${income ? '+' : '−'} ${formatMoney(transaction.valor)}</span></td>
                <td><div class="row-actions"><button class="row-action" type="button" data-action="edit-transaction" data-id="${escapeHTML(transaction.id)}" aria-label="Editar ${escapeHTML(transaction.descricao)}"><i class="fa-solid fa-pen"></i></button><button class="row-action delete" type="button" data-action="delete-transaction" data-id="${escapeHTML(transaction.id)}" aria-label="Excluir ${escapeHTML(transaction.descricao)}"><i class="fa-regular fa-trash-can"></i></button></div></td>
            </tr>`;
        }).join('');
        byId('transactionEmpty').classList.toggle('visible', transactions.length === 0);
        byId('transactionResults').textContent = `${transactions.length} ${transactions.length === 1 ? 'transação' : 'transações'}`;
    }

    function renderCategories() {
        const allCategories = Data.categories();
        byId('categoryList').innerHTML = allCategories.map(category => {
            const removable = Data.customCategories.includes(category);
            return `<div class="category-item"><i class="fa-solid ${iconForCategory(category)}"></i><span>${escapeHTML(category)}</span>${removable ? `<button class="category-delete" type="button" data-action="delete-category" data-category="${escapeHTML(category)}" aria-label="Excluir categoria ${escapeHTML(category)}"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`;
        }).join('');

        const monthlyExpenses = getMonthlyTransactions().filter(transaction => transaction.tipo === 'despesa');
        const totals = new Map();
        monthlyExpenses.forEach(transaction => {
            const category = Data.categoryFor(transaction);
            totals.set(category, (totals.get(category) || 0) + moneyToCents(transaction.valor));
        });
        const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((sum, entry) => sum + entry[1], 0);
        byId('categoryEmpty').classList.toggle('visible', entries.length === 0);
        byId('categoryBreakdown').innerHTML = entries.map(([category, amount]) => {
            const percentage = total ? (amount / total) * 100 : 0;
            return `<div class="breakdown-row"><div class="breakdown-top"><span><i class="fa-solid ${iconForCategory(category)}"></i> ${escapeHTML(category)}</span><strong>${formatMoney(amount / 100)}</strong></div><div class="breakdown-rail"><i style="width:${percentage.toFixed(2)}%"></i></div></div>`;
        }).join('');
        renderCategoryOptions(byId('tipo').value);
        renderFilterCategories();
    }

    function expenseCategories() {
        return [...new Set([...DEFAULT_CATEGORIES.despesa, ...Data.customCategories])];
    }

    function renderBudgets() {
        const key = monthKey(today());
        const monthBudgets = Data.budgets[key] || {};
        const expenses = getMonthlyTransactions().filter(transaction => transaction.tipo === 'despesa');
        const spent = new Map();
        expenses.forEach(transaction => {
            const category = Data.categoryFor(transaction);
            spent.set(category, (spent.get(category) || 0) + moneyToCents(transaction.valor));
        });
        const categories = [...new Set([...expenseCategories(), ...Object.keys(monthBudgets)])];
        const fixed = expenses.filter(t => t.natureza === 'fixa' || (!t.natureza && t.recorrente));
        byId('expenseComposition').textContent = `Fixas: ${formatMoney(sumTransactions(fixed))} · Variáveis: ${formatMoney((moneyToCents(sumTransactions(expenses)) - moneyToCents(sumTransactions(fixed))) / 100)}`;
        byId('budgetMonth').textContent = formatMonth(today());
        byId('budgetEmpty').classList.toggle('visible', false);
        byId('budgetList').innerHTML = categories.map(category => {
            const amount = spent.get(category) || 0;
            const limit = moneyToCents(monthBudgets[category] || 0);
            const percentage = limit > 0 ? Math.min((amount / limit) * 100, 100) : 0;
            const over = limit > 0 && amount > limit;
            return `<div class="budget-row${over ? ' budget-over' : ''}">
                <div class="budget-row-top"><span class="budget-name"><i class="fa-solid ${iconForCategory(category)}"></i>${escapeHTML(category)}</span><span class="budget-amounts"><strong>${formatMoney(amount / 100)}</strong>${limit > 0 ? ` de ${formatMoney(limit / 100)}` : ' gastos'}</span></div>
                <div class="budget-row-top"><div class="progress-rail" style="flex:1"><i style="width:${percentage.toFixed(2)}%"></i></div><div class="budget-input-row"><input type="number" min="0.01" step="0.01" value="${limit > 0 ? (limit / 100).toFixed(2) : ''}" placeholder="Limite R$" aria-label="Limite mensal para ${escapeHTML(category)}"><button type="button" data-action="save-budget" data-category="${escapeHTML(category)}" aria-label="Salvar orçamento de ${escapeHTML(category)}"><i class="fa-solid fa-check"></i></button></div></div>
            </div>`;
        }).join('');
    }

    function renderBills() {
        const bills = [...Data.bills].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
        byId('billEmpty').classList.toggle('visible', bills.length === 0);
        byId('billList').innerHTML = bills.map(bill => {
            const due = dateFromISO(bill.vencimento);
            const difference = due ? dayDifference(today(), due) : 1000;
            const overdue = !bill.paga && difference < 0;
            const dueSoon = !bill.paga && difference >= 0 && difference <= 7;
            const dueLabel = bill.paga ? 'Pago' : overdue ? `Venceu há ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'dia' : 'dias'}` :
                difference === 0 ? 'Vence hoje' : difference === 1 ? 'Vence amanhã' : `Vence em ${formatDate(bill.vencimento)}`;
            return `<div class="bill-row"><span class="bill-status${overdue ? ' overdue' : dueSoon ? ' due-soon' : ''}" title="${escapeHTML(dueLabel)}"></span><span class="bill-row-copy"><strong>${escapeHTML(bill.descricao)}</strong><span>${bill.tipo === 'receita' ? 'A receber' : 'A pagar'} · ${escapeHTML(dueLabel)}</span></span><strong class="bill-row-amount ${bill.tipo}">${formatMoney(bill.valor)}</strong><span class="bill-actions">${bill.paga ? '' : `<button class="row-action" type="button" data-action="pay-bill" data-id="${escapeHTML(bill.id)}" aria-label="Marcar ${escapeHTML(bill.descricao)} como pago/recebido"><i class="fa-solid fa-check"></i></button>`}<button class="row-action delete" type="button" data-action="delete-bill" data-id="${escapeHTML(bill.id)}" aria-label="Excluir conta ${escapeHTML(bill.descricao)}"><i class="fa-regular fa-trash-can"></i></button></span></div>`;
        }).join('');
    }

    function getUpcomingItems() {
        const items = Data.bills.filter(bill => !bill.paga).map(bill => ({
            id: bill.id,
            descricao: bill.descricao,
            data: bill.vencimento,
            valor: bill.valor,
            tipo: bill.tipo,
            origem: 'bill'
        }));
        Data.transactions.filter(transaction => transaction.recorrente).forEach(transaction => {
            const startDate = dateFromISO(transaction.data);
            if (!startDate) return;
            let offset = 1;
            let nextDate = addMonths(startDate, offset);
            while (Data.transactions.some(t => t.recorrenciaId === transaction.id && t.data === dateToISO(nextDate))) nextDate = addMonths(startDate, ++offset);
            items.push({
                id: transaction.id,
                descricao: transaction.descricao,
                data: dateToISO(nextDate),
                valor: transaction.valor,
                tipo: transaction.tipo,
                origem: 'recurring'
            });
        });
        return items.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5);
    }

    function renderUpcoming() {
        const items = getUpcomingItems();
        byId('upcomingEmpty').classList.toggle('visible', items.length === 0);
        byId('upcomingList').innerHTML = items.map(item => {
            const date = dateFromISO(item.data);
            const difference = date ? dayDifference(today(), date) : 1000;
            const month = date ? date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '';
            return `<div class="upcoming-item${difference < 0 ? ' overdue' : ''}"><span class="due-date"><span>${escapeHTML(month)}</span><strong>${date ? date.getDate() : '—'}</strong></span><span class="upcoming-copy"><strong>${escapeHTML(item.descricao)}</strong><span>${difference < 0 ? `Vencida há ${Math.abs(difference)} dias` : difference === 0 ? 'Vence hoje' : difference <= 7 ? `Vence em ${difference} dias` : item.origem === 'recurring' ? 'Recorrência mensal' : 'Conta agendada'}</span></span><strong class="upcoming-amount ${item.tipo}">${formatMoney(item.valor)}</strong>${item.origem === 'recurring' ? `<button class="row-action" type="button" data-action="confirm-recurring" data-id="${escapeHTML(item.id)}" data-date="${escapeHTML(item.data)}" aria-label="Registrar recorrência de ${escapeHTML(item.descricao)}"><i class="fa-solid fa-check"></i></button>` : ''}</div>`;
        }).join('');
    }

    function renderGoals() {
        byId('goalEmpty').classList.toggle('visible', Data.goals.length === 0);
        byId('goalList').innerHTML = Data.goals.map(goal => {
            const target = moneyToCents(goal.alvo);
            const saved = moneyToCents(goal.guardado);
            const percentage = target > 0 ? Math.min(saved / target * 100, 100) : 0;
            return `<article class="goal-card"><div class="goal-card-top"><div><strong>${escapeHTML(goal.nome)}</strong><span>Meta de ${formatMoney(target / 100)}</span></div><span class="goal-percent">${Math.floor(percentage)}%</span></div><div class="progress-rail"><i style="width:${percentage.toFixed(2)}%"></i></div><div class="goal-card-bottom"><span>Economizado</span><strong>${formatMoney(saved / 100)}</strong></div><div class="goal-actions"><input type="number" min="0.01" step="0.01" placeholder="Valor R$" aria-label="Valor para adicionar à meta ${escapeHTML(goal.nome)}"><button type="button" data-action="contribute-goal" data-id="${escapeHTML(goal.id)}">Adicionar valor</button><button class="row-action delete" type="button" data-action="delete-goal" data-id="${escapeHTML(goal.id)}" aria-label="Excluir meta ${escapeHTML(goal.nome)}"><i class="fa-regular fa-trash-can"></i></button></div></article>`;
        }).join('');
    }

    function transactionDateRange(period) {
        const now = periodAnchor;
        if (period === 'week') {
            const start = new Date(now);
            const weekday = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - weekday);
            const dates = Array.from({ length: 7 }, (_, index) => {
                const date = new Date(start);
                date.setDate(start.getDate() + index);
                return date;
            });
            return {
                dates,
                labels: dates.map(date => date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')),
                match: transaction => transaction.data >= dateToISO(dates[0]) && transaction.data <= dateToISO(dates[6]),
                label: 'Esta semana'
            };
        }
        if (period === 'year') {
            const year = now.getFullYear();
            const dates = Array.from({ length: 12 }, (_, index) => localDate(year, index, 1));
            return {
                dates,
                labels: dates.map(date => date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')),
                match: transaction => transaction.data && Number(transaction.data.slice(0, 4)) === year,
                label: 'Este ano'
            };
        }
        const year = now.getFullYear();
        const month = now.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const dates = Array.from({ length: days }, (_, index) => localDate(year, month, index + 1));
        const currentMonth = monthKey(now);
        return {
            dates,
            labels: dates.map(date => String(date.getDate())),
            match: transaction => transaction.data && transaction.data.slice(0, 7) === currentMonth,
            label: formatMonth(now)
        };
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') {
            toast('Os gráficos não carregaram. Verifique sua conexão e atualize a página.', true);
            return;
        }
        const period = transactionDateRange(byId('chartPeriod').value);
        const currentTransactions = Data.transactions.filter(period.match);
        const income = Array(period.dates.length).fill(0);
        const expense = Array(period.dates.length).fill(0);
        const dateIndexes = new Map(period.dates.map((date, index) => [dateToISO(date), index]));
        if (byId('chartPeriod').value === 'year') {
            currentTransactions.forEach(transaction => {
                const date = dateFromISO(transaction.data);
                const index = date ? date.getMonth() : -1;
                if (index >= 0) {
                    if (transaction.tipo === 'receita') income[index] += moneyToCents(transaction.valor) / 100;
                    else expense[index] += moneyToCents(transaction.valor) / 100;
                }
            });
        } else {
            currentTransactions.forEach(transaction => {
                const index = dateIndexes.get(transaction.data);
                if (index === undefined) return;
                if (transaction.tipo === 'receita') income[index] += moneyToCents(transaction.valor) / 100;
                else expense[index] += moneyToCents(transaction.valor) / 100;
            });
        }

        const start = period.dates[0];
        const startingBalance = Data.transactions.reduce((total, transaction) => {
            const date = dateFromISO(transaction.data);
            if (date && date < start) return total + (transaction.tipo === 'receita' ? moneyToCents(transaction.valor) : -moneyToCents(transaction.valor));
            return total;
        }, 0) / 100;
        let runningBalance = startingBalance;
        const balances = period.dates.map((_, index) => {
            runningBalance += income[index] - expense[index];
            return Math.round(runningBalance * 100) / 100;
        });

        Chart.defaults.color = '#85877e';
        Chart.defaults.font.family = '"DM Sans", sans-serif';
        Chart.defaults.font.size = 10;
        const compactCurrency = value => {
            const absolute = Math.abs(value);
            if (absolute >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
            if (absolute >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
            return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
        };

        const sharedScale = {
            x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: byId('chartPeriod').value === 'month' ? 8 : 7, maxRotation: 0, autoSkip: true } },
            y: { grid: { color: 'rgba(255,255,255,.055)' }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: compactCurrency } }
        };
        const barConfig = {
            type: 'bar',
            data: {
                labels: period.labels,
                datasets: [
                    { label: 'Receitas', data: income, backgroundColor: 'rgba(131,185,154,.8)', borderRadius: 3, borderSkipped: false, maxBarThickness: 15 },
                    { label: 'Despesas', data: expense, backgroundColor: 'rgba(217,139,125,.78)', borderRadius: 3, borderSkipped: false, maxBarThickness: 15 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 450 },
                interaction: { intersect: false, mode: 'index' },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#292a24', borderColor: '#424238', borderWidth: 1, padding: 10, callbacks: { label: context => `${context.dataset.label}: ${formatMoney(context.raw)}` } } },
                scales: sharedScale
            }
        };
        const lineConfig = {
            type: 'line',
            data: {
                labels: period.labels,
                datasets: [{
                    label: 'Saldo acumulado', data: balances, borderColor: '#d7ad62',
                    backgroundColor: context => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return 'rgba(215,173,98,.1)';
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(215,173,98,.19)');
                        gradient.addColorStop(1, 'rgba(215,173,98,0)');
                        return gradient;
                    },
                    fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: '#edc982', borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 450 },
                interaction: { intersect: false, mode: 'index' },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#292a24', borderColor: '#424238', borderWidth: 1, padding: 10, callbacks: { label: context => `Saldo: ${formatMoney(context.raw)}` } } },
                scales: sharedScale
            }
        };
        if (!barChart) barChart = new Chart(byId('graficoBarras'), barConfig);
        else {
            barChart.data = barConfig.data;
            barChart.options = barConfig.options;
            barChart.update();
        }
        if (!lineChart) lineChart = new Chart(byId('graficoLinha'), lineConfig);
        else {
            lineChart.data = lineConfig.data;
            lineChart.options = lineConfig.options;
            lineChart.update();
        }
    }

    function renderAll() {
        updateSummary();
        renderRecentTransactions();
        renderTransactions();
        renderCategories();
        renderBudgets();
        renderBills();
        renderUpcoming();
        renderGoals();
        renderCharts();
    }

    function openTransactionModal(transaction = null) {
        modalTrigger = document.activeElement;
        editingId = transaction ? transaction.id : null;
        const form = byId('formTransacao');
        form.reset();
        byId('formTitle').textContent = transaction ? 'Editar transação' : 'Nova transação';
        byId('submitTransaction').innerHTML = `<i class="fa-solid fa-check"></i> ${transaction ? 'Salvar alterações' : 'Salvar transação'}`;
        const type = transaction ? transaction.tipo : 'despesa';
        setTransactionType(type, transaction ? Data.categoryFor(transaction) : '');
        byId('data').value = transaction?.data || dateToISO(today());
        byId('descricao').value = transaction?.descricao || '';
        byId('valor').value = transaction ? Number(transaction.valor).toFixed(2) : '';
        byId('transactionNote').value = transaction?.observacao || '';
        byId('expenseNature').value = transaction?.natureza || (transaction?.recorrente ? 'fixa' : 'variavel');
        const scheduleOptions = byId('scheduleOptions');
        scheduleOptions.hidden = Boolean(transaction);
        byId('installmentInput').checked = false;
        byId('recurringInput').checked = false;
        byId('installmentCountWrap').hidden = true;
        byId('transactionModal').classList.add('open');
        byId('transactionModal').setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        setTimeout(() => byId('descricao').focus(), 0);
    }

    function closeTransactionModal() {
        byId('transactionModal').classList.remove('open');
        byId('transactionModal').setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        editingId = null;
        modalTrigger?.focus();
    }

    function setTransactionType(type, selected = '') {
        byId('tipo').value = type;
        document.querySelectorAll('.type-option').forEach(button => {
            button.classList.toggle('active', button.dataset.type === type);
        });
        renderCategoryOptions(type, selected);
    }

    async function addTransaction(event) {
        event.preventDefault();
        if (!byId('formTransacao').reportValidity()) return;

        const type = byId('tipo').value;
        const description = byId('descricao').value.trim();
        const amount = Number(byId('valor').value);
        const date = byId('data').value;
        const category = byId('categorySelect').value;
        const note = byId('transactionNote').value.trim();
        const natureza = byId('expenseNature').value;
        if (!description || !Number.isFinite(amount) || amount <= 0 || !date || !category) {
            toast('Confira a descrição, o valor, a data e a categoria.', true);
            return;
        }

        if (editingId !== null) {
            const next = Data.transactions.map(transaction => transaction.id === editingId
                ? { ...transaction, tipo: type, descricao: description, valor: moneyToCents(amount) / 100, data: date, categoria: category, natureza, observacao: note }
                : transaction);
            if (!await Data.saveTransactions(next)) return;
            closeTransactionModal();
            renderAll();
            toast('Transação atualizada.');
            return;
        }

        const recurring = byId('recurringInput').checked;
        const installments = byId('installmentInput').checked ? Number(byId('installmentCount').value) : 1;
        if (!Number.isInteger(installments) || installments < 1 || installments > 60 || moneyToCents(amount) < installments) {
            toast('Escolha de 2 a 60 parcelas.', true);
            return;
        }
        const totalCents = moneyToCents(amount);
        const next = [...Data.transactions];
        if (installments > 1) {
            const base = Math.floor(totalCents / installments);
            const remainder = totalCents - (base * installments);
            const startDate = dateFromISO(date);
            for (let index = 0; index < installments; index++) {
                const installmentDate = addMonths(startDate, index);
                next.push({
                    id: newId(), tipo: type, descricao: description, valor: (base + (index < remainder ? 1 : 0)) / 100,
                    data: dateToISO(installmentDate), categoria: category, natureza, observacao: note,
                    parcela: index + 1, parcelas: installments
                });
            }
        } else {
            next.push({
                id: newId(), tipo: type, descricao: description, valor: totalCents / 100, data: date,
                categoria: category, natureza, observacao: note, ...(recurring ? { recorrente: true } : {})
            });
        }
        if (!await Data.saveTransactions(next)) return;
        closeTransactionModal();
        renderAll();
        toast(installments > 1 ? `${installments} parcelas adicionadas ao histórico.` : 'Transação adicionada.');
    }

    async function deleteTransaction(id) {
        const transaction = Data.transactions.find(item => item.id === id);
        if (!transaction || !window.confirm(`Excluir a transação "${transactionLabel(transaction)}"?`)) return;
        const next = Data.transactions.filter(item => item.id !== id);
        if (!await Data.saveTransactions(next)) return;
        renderAll();
        toast('Transação excluída.');
    }

    async function createCategory(event) {
        event.preventDefault();
        const input = byId('newCategoryName');
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (!name) return;
        if (Data.categories().some(category => category.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
            toast('Essa categoria já existe.', true);
            return;
        }
        const next = [...Data.customCategories, name];
        if (!await Data.saveCollection('customCategories', KEYS.categories, next)) return;
        input.value = '';
        renderAll();
        toast('Categoria criada.');
    }

    async function deleteCategory(name) {
        const used = Data.transactions.some(transaction => Data.categoryFor(transaction) === name);
        if (used) {
            toast('Esta categoria está em uso por uma transação e não pode ser removida.', true);
            return;
        }
        if (!window.confirm(`Excluir a categoria "${name}"?`)) return;
        const next = Data.customCategories.filter(category => category !== name);
        if (!await Data.saveCollection('customCategories', KEYS.categories, next)) return;
        renderAll();
        toast('Categoria excluída.');
    }

    async function saveBudget(button) {
        const row = button.closest('.budget-row');
        const amount = Number(row.querySelector('input').value);
        const category = button.dataset.category;
        if (!Number.isFinite(amount) || amount <= 0) {
            toast('Informe um limite maior que zero.', true);
            return;
        }
        const key = monthKey(today());
        const next = { ...Data.budgets, [key]: { ...(Data.budgets[key] || {}), [category]: Math.round(amount * 100) / 100 } };
        if (!await Data.saveCollection('budgets', KEYS.budgets, next)) return;
        renderBudgets();
        toast(`Orçamento de ${category} atualizado.`);
    }

    async function createBill(event) {
        event.preventDefault();
        if (!byId('billForm').reportValidity()) return;
        const amount = Number(byId('billAmount').value);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast('Informe um valor válido para a conta.', true);
            return;
        }
        const bill = {
            id: newId(),
            descricao: byId('billDescription').value.trim(),
            tipo: byId('billType').value,
            valor: Math.round(amount * 100) / 100,
            vencimento: byId('billDueDate').value,
            paga: false
        };
        const next = [...Data.bills, bill];
        if (!await Data.saveCollection('bills', KEYS.bills, next)) return;
        byId('billForm').reset();
        byId('billDueDate').value = dateToISO(today());
        renderBills();
        renderUpcoming();
        toast('Conta adicionada ao planejamento.');
    }

    async function updateBill(id, property, value) {
        if (window.FinCloud && property === 'paga') {
            const bill = Data.bills.find(item => item.id === id);
            if (!bill || bill.paga) return;
            const bills = Data.bills.map(item => item.id === id ? { ...item, paga: true } : item);
            const transactions = Data.transactions.some(t => t.contaId === id) ? Data.transactions : [...Data.transactions, {
                id: newId(), contaId: id, descricao: bill.descricao, tipo: bill.tipo, valor: bill.valor,
                data: dateToISO(today()), categoria: 'Contas'
            }];
            try {
                await window.FinCloud.writeFields({ bills, transactions });
                Data.bills = bills; Data.transactions = transactions;
                renderAll(); toast('Conta atualizada.');
            } catch (error) { toast(error.message, true); }
            return;
        }
        if (property === 'paga') {
            const bill = Data.bills.find(item => item.id === id);
            if (!bill || bill.paga) return;
            if (!Data.transactions.some(t => t.contaId === id)) {
                const transaction = { id: newId(), contaId: id, descricao: bill.descricao, tipo: bill.tipo, valor: bill.valor, data: dateToISO(today()), categoria: 'Contas' };
                if (!await Data.saveTransactions([...Data.transactions, transaction])) return;
            }
        }
        const next = property === 'delete'
            ? Data.bills.filter(bill => bill.id !== id)
            : Data.bills.map(bill => bill.id === id ? { ...bill, [property]: value } : bill);
        if (!await Data.saveCollection('bills', KEYS.bills, next)) return;
        renderBills();
        renderUpcoming();
        if (property === 'paga') renderAll();
        toast(property === 'paga' ? 'Conta atualizada.' : 'Conta excluída.');
    }

    async function createGoal(event) {
        event.preventDefault();
        if (!byId('goalForm').reportValidity()) return;
        const target = Number(byId('goalTarget').value);
        const saved = Number(byId('goalSaved').value || 0);
        if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0) {
            toast('Confira os valores da sua meta.', true);
            return;
        }
        const next = [...Data.goals, {
            id: newId(), nome: byId('goalName').value.trim(),
            alvo: Math.round(target * 100) / 100, guardado: Math.round(saved * 100) / 100
        }];
        if (!await Data.saveCollection('goals', KEYS.goals, next)) return;
        byId('goalForm').reset();
        byId('goalSaved').value = '0';
        renderGoals();
        toast('Meta criada. Um passo de cada vez!');
    }

    async function contributeToGoal(button) {
        const input = button.parentElement.querySelector('input');
        const contribution = Number(input.value);
        if (!Number.isFinite(contribution) || contribution <= 0) {
            toast('Informe um valor maior que zero.', true);
            return;
        }
        const next = Data.goals.map(goal => goal.id === button.dataset.id
            ? { ...goal, guardado: Math.round((moneyToCents(goal.guardado) + moneyToCents(contribution)) / 100 * 100) / 100 }
            : goal);
        if (!await Data.saveCollection('goals', KEYS.goals, next)) return;
        renderGoals();
        toast('Progresso da meta atualizado.');
    }

    async function deleteGoal(id) {
        if (!window.confirm('Excluir esta meta financeira?')) return;
        const next = Data.goals.filter(goal => goal.id !== id);
        if (!await Data.saveCollection('goals', KEYS.goals, next)) return;
        renderGoals();
        toast('Meta excluída.');
    }

    function setActiveView(view) {
        const names = {
            dashboard: 'Visão geral', transactions: 'Transações', categories: 'Categorias',
            planning: 'Planejamento', goals: 'Metas financeiras', settings: 'Configurações'
        };
        if (!names[view]) return;
        document.querySelectorAll('.view-panel').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
        document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
        document.querySelectorAll('.main-nav [data-view]').forEach(button => {
            if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        byId('breadcrumbCurrent').textContent = names[view];
        if (view === 'transactions') renderTransactions();
        if (view === 'dashboard') renderCharts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleAction(event) {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;
        switch (actionButton.dataset.action) {
            case 'confirm-recurring': {
                const source = Data.transactions.find(t => String(t.id) === actionButton.dataset.id);
                const date = actionButton.dataset.date;
                if (!source || Data.transactions.some(t => t.recorrenciaId === source.id && t.data === date)) break;
                if (!window.confirm(`Registrar ${source.descricao} em ${formatDate(date)}?`)) break;
                const next = { ...source, id: newId(), data: date, recorrente: false, recorrenciaId: source.id };
                if (await Data.saveTransactions([...Data.transactions, next])) { renderAll(); toast('Recorrência registrada.'); }
                break;
            }
            case 'new-transaction':
                openTransactionModal();
                break;
            case 'edit-transaction': {
                const transaction = Data.transactions.find(item => String(item.id) === actionButton.dataset.id);
                if (transaction) openTransactionModal(transaction);
                break;
            }
            case 'delete-transaction':
                deleteTransaction(Data.transactions.find(item => String(item.id) === actionButton.dataset.id)?.id);
                break;
            case 'delete-category':
                deleteCategory(actionButton.dataset.category);
                break;
            case 'save-budget':
                saveBudget(actionButton);
                break;
            case 'pay-bill':
                updateBill(actionButton.dataset.id, 'paga', true);
                break;
            case 'delete-bill':
                if (window.confirm('Excluir esta conta do planejamento?')) {
                    updateBill(actionButton.dataset.id, 'delete', true);
                }
                break;
            case 'contribute-goal':
                contributeToGoal(actionButton);
                break;
            case 'delete-goal':
                deleteGoal(actionButton.dataset.id);
                break;
        }
    }

    function bindEvents() {
        document.addEventListener('click', event => {
            const viewButton = event.target.closest('[data-view]');
            if (viewButton) {
                event.preventDefault();
                setActiveView(viewButton.dataset.view);
            }
            handleAction(event);
        });
        byId('formTransacao').addEventListener('submit', addTransaction);
        byId('categoryForm').addEventListener('submit', createCategory);
        byId('billForm').addEventListener('submit', createBill);
        byId('goalForm').addEventListener('submit', createGoal);
        byId('closeTransactionModal').addEventListener('click', closeTransactionModal);
        byId('cancelTransaction').addEventListener('click', closeTransactionModal);
        byId('transactionModal').addEventListener('click', event => {
            if (event.target === byId('transactionModal')) closeTransactionModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Tab' && byId('transactionModal').classList.contains('open')) {
                const focusable = [...byId('transactionModal').querySelectorAll('button, input, select')].filter(el => el.type !== 'hidden' && el.getClientRects().length && !el.disabled);
                const first = focusable[0], last = focusable.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
            if (event.key === 'Escape' && byId('transactionModal').classList.contains('open')) closeTransactionModal();
        });
        document.querySelectorAll('.type-option').forEach(button => {
            button.addEventListener('click', () => setTransactionType(button.dataset.type, ''));
        });
        byId('installmentInput').addEventListener('change', event => {
            byId('installmentCountWrap').hidden = !event.target.checked;
            if (event.target.checked) byId('recurringInput').checked = false;
        });
        byId('recurringInput').addEventListener('change', event => {
            if (event.target.checked) {
                byId('installmentInput').checked = false;
                byId('installmentCountWrap').hidden = true;
            }
        });
        ['searchTransactions', 'filterType', 'filterCategory', 'filterFrom', 'filterTo', 'filterMin', 'filterMax'].forEach(id => {
            byId(id).addEventListener(id === 'searchTransactions' || id.startsWith('filter') ? 'input' : 'change', renderTransactions);
            if (id !== 'searchTransactions') byId(id).addEventListener('change', renderTransactions);
        });
        byId('clearFilters').addEventListener('click', () => {
            ['searchTransactions', 'filterType', 'filterCategory', 'filterFrom', 'filterTo', 'filterMin', 'filterMax'].forEach(id => { byId(id).value = ''; });
            renderTransactions();
        });
        const refreshPeriod = () => { updateSummary(); renderCharts(); };
        byId('chartPeriod').addEventListener('change', refreshPeriod);
        ['previousPeriod', 'nextPeriod'].forEach(id => byId(id).addEventListener('click', () => {
            const direction = id === 'previousPeriod' ? -1 : 1;
            const mode = byId('chartPeriod').value;
            periodAnchor = mode === 'week' ? localDate(periodAnchor.getFullYear(), periodAnchor.getMonth(), periodAnchor.getDate() + 7 * direction) : addMonths(periodAnchor, direction * (mode === 'year' ? 12 : 1));
            refreshPeriod();
        }));
        byId('resetPeriod').addEventListener('click', () => { periodAnchor = today(); refreshPeriod(); });
        byId('exportData').addEventListener('click', () => {
            const snapshot = { version: 1, exportedAt: new Date().toISOString(), transactions: Data.transactions, categories: Data.customCategories, budgets: Data.budgets, bills: Data.bills, goals: Data.goals, settings: Data.settings };
            const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url; link.download = `fingsec-${dateToISO(today())}.json`; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        byId('privacyToggle').addEventListener('change', async event => {
            const next = { ...Data.settings, privacy: event.target.checked };
            if (await Storage.write(KEYS.settings, next)) {
                Data.settings = next;
                document.body.classList.toggle('privacy-mode', next.privacy);
            } else event.target.checked = Boolean(Data.settings.privacy);
        });
        byId('signOut').addEventListener('click', async () => {
            try { await window.FinCloud.signOut(); } catch (error) { toast(error.message, true); }
        });
        byId('importLegacy').addEventListener('click', async () => {
            try { if (await window.FinCloud.importLegacy()) window.location.reload(); }
            catch (error) { toast(error.message, true); }
        });
        byId('nameForm').addEventListener('submit', async event => {
            event.preventDefault();
            const name = byId('nameInput').value.trim();
            const next = { ...Data.settings, name };
            if (!await Storage.write(KEYS.settings, next)) return;
            Data.settings = next;
            renderUserName();
            toast('Nome atualizado.');
        });
    }

    function renderUserName() {
        let legacyName = '';
        try {
            legacyName = window.FinCloud ? '' : localStorage.getItem('usuarioNome') || '';
        } catch (error) {
            console.error('Não foi possível ler o nome salvo:', error);
        }
        const name = Data.settings.name || legacyName;
        byId('userName').textContent = name || 'Meu espaço';
        byId('userAvatar').textContent = name ? name.trim().charAt(0).toLocaleUpperCase('pt-BR') : 'F';
        byId('greetingName').textContent = name ? `${name.split(/\s+/)[0]}!` : 'tudo bem?';
        byId('nameInput').value = Data.settings.name || '';
    }

    async function initializePage() {
        Object.assign(elements, {
            transactionForm: byId('formTransacao'),
            transactionList: byId('listaTransacoes')
        });
        if (!window.FinCloud) {
            byId('cloudStatus').textContent = 'Não foi possível carregar a conexão com o servidor. Atualize a página.';
            document.querySelectorAll('button, input, select').forEach(el => { el.disabled = true; });
            return;
        }
        if (window.FinCloud) {
            try { if (!await window.FinCloud.load()) return; }
            catch (error) {
                byId('cloudStatus').textContent = error.message;
                document.querySelectorAll('button, input, select').forEach(el => { el.disabled = true; });
                toast(error.message, true); return;
            }
        }
        Data.init();
        if (window.FinCloud) byId('cloudStatus').textContent = 'Conectado ao servidor';
        const now = today();
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
        byId('pageTitle').firstChild.textContent = `${greeting}, `;
        byId('todayLabel').textContent = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }).replace('.', '');
        byId('footerYear').textContent = String(now.getFullYear());
        byId('billDueDate').value = dateToISO(now);
        renderUserName();
        if (Data.settings.privacy) {
            byId('privacyToggle').checked = true;
            document.body.classList.add('privacy-mode');
        }
        bindEvents();
        window.addEventListener('beforeunload', event => {
            if (window.FinCloud.busy) { event.preventDefault(); event.returnValue = ''; }
        });
        renderAll();
        if (Storage.blocked) toast('Alguns dados não puderam ser lidos. Eles não serão sobrescritos.', true);
    }

    document.addEventListener('DOMContentLoaded', initializePage);
})();
