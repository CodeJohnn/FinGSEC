const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const source = readFileSync('pages/main/main.js', 'utf8');
function harness() {
    const store = new Map();
    const elements = new Map();
    const document = { addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, { value: '', textContent: '', style: {}, classList: { toggle() {} } }); return elements.get(id); } };
    const context = vm.createContext({ console, document, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) }, setTimeout() {}, clearTimeout() {}, window: { confirm: () => true } });
    vm.runInContext(source.replace("document.addEventListener('DOMContentLoaded', initializePage);", 'globalThis.api = { Data, Storage, moneyToCents, sumTransactions, addMonths, dateToISO, today, updateSummary, transactionDateRange, updateBill, getUpcomingItems };'), context);
    return { ...context.api, elements, store };
}
test('soma em centavos e arredonda corretamente valores monetários', () => {
    const h = harness();
    assert.equal(h.moneyToCents(1.005), 101);
    assert.equal(h.sumTransactions([{valor: 0.1}, {valor: 0.2}]), 0.3);
});
test('parcelas em fim de mês respeitam fevereiro e o mês original', () => {
    const h = harness(), date = new Date(2024,0,31);
    assert.equal(h.dateToISO(h.addMonths(date,1)), '2024-02-29');
    assert.equal(h.dateToISO(h.addMonths(date,2)), '2024-03-31');
});
test('carregar transações existentes não modifica nem grava dados', () => {
    const h = harness(), raw = '[{"id":12,"valor":123.45,"tipo":"receita","data":"2026-01-01","extra":"preservar"}]';
    h.store.set('controle_financeiro_transacoes', raw);
    h.Data.init();
    assert.equal(h.store.get('controle_financeiro_transacoes'), raw);
    assert.equal(h.Data.transactions[0].extra, 'preservar');
});
test('saldo realizado não inclui parcelas futuras', () => {
    const h = harness(); h.Data.init();
    h.elements.set('chartPeriod', { value:'month' });
    h.Data.transactions = [{tipo:'receita',valor:100,data:h.dateToISO(h.today())},{tipo:'despesa',valor:40,data:'2099-12-01'}];
    h.updateSummary();
    assert.match(h.elements.get('saldoTotal').textContent, /100,00/);
});
test('todos os elementos referenciados existem no HTML', () => {
    const html = readFileSync('pages/main/main.html','utf8');
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
    for (const [,id] of source.matchAll(/byId\('([^']+)'\)/g)) assert.ok(ids.has(id), `Elemento ausente: ${id}`);
    assert.equal([...html.matchAll(/id="([^"]+)"/g)].length, ids.size, 'IDs duplicados');
});
test('dados inválidos são protegidos contra sobrescrita', () => {
    const h = harness(); h.store.set('fingsec_metas', '{"invalido":true}');
    h.Data.init();
    assert.equal(h.Storage.blocked, true);
    assert.equal(h.Storage.write('fingsec_metas', []), false);
    assert.equal(h.store.get('fingsec_metas'), '{"invalido":true}');
});
test('quitar uma conta registra uma única movimentação', () => {
    const h = harness(); h.Data.init();
    h.Data.bills = [{id:'conta1',descricao:'Internet',valor:99.9,tipo:'despesa',vencimento:h.dateToISO(h.today()),paga:false}];
    h.updateBill('conta1','paga',true);
    h.updateBill('conta1','paga',true);
    assert.equal(h.Data.transactions.length,1);
    assert.equal(h.Data.transactions[0].valor,99.9);
    assert.equal(h.Data.bills[0].paga,true);
});
test('recorrências preservam vencimentos não confirmados', () => {
    const h = harness(); h.Data.init();
    h.Data.transactions = [{id:1,tipo:'despesa',valor:50,descricao:'Aluguel',data:'2024-01-31',recorrente:true}];
    assert.equal(h.getUpcomingItems()[0].data,'2024-02-29');
    h.Data.transactions.push({id:2,recorrenciaId:1,tipo:'despesa',valor:50,data:'2024-02-29'});
    assert.equal(h.getUpcomingItems()[0].data,'2024-03-31');
});
