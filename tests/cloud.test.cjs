const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
    const data = new Map([['controle_financeiro_transacoes', '[{"id":1,"tipo":"receita","valor":10}]']]);
    const storage = { getItem: key => data.get(key) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
    const requests = [];
    let failure = false, account = 'user-a', callback;
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: account, user_metadata: {} } } }), onAuthStateChange(handler) { callback = handler; } },
        from() { return { select() { return { eq(field, id) { requests.push({ field, id }); return { maybeSingle: async () => ({ data: null }) }; } }; } }; },
        rpc(name, payload) { requests.push(payload); return { single: async () => failure ? { error: { code: '40001' } } : { data: { state: structuredClone(payload.next_state), revision: payload.expected_revision + 1 } } }; }
    };
    const window = { FINGSEC_CONFIG: { url:'https://example.supabase.co', publishableKey:'sb_publishable_test' }, supabase: { createClient: () => client } };
    const context = vm.createContext({ window, localStorage: storage, sessionStorage: storage, structuredClone, confirm: () => true, document: { getElementById: () => ({ textContent: '' }) } });
    vm.runInContext(fs.readFileSync('cloud.js','utf8'), context);
    return { cloud: window.FinCloud, requests, data, window, fail() { failure = true; }, changeAccount() { account = 'user-b'; } };
}
test('carregamento usa apenas conta autenticada e não importa dados antigos automaticamente', async () => {
    const h = harness(); await h.cloud.load();
    assert.equal(h.requests[0].id, 'user-a');
    assert.equal(h.cloud.read('controle_financeiro_transacoes', []).length, 0);
    assert.ok(h.data.has('controle_financeiro_transacoes'));
});
test('salvamento só é confirmado depois da resposta e inclui versão', async () => {
    const h = harness(); await h.cloud.load();
    await h.cloud.write('fingsec_configuracoes', { name:'Teste' });
    assert.equal(h.cloud.read('fingsec_configuracoes', {}).name, 'Teste');
    assert.equal(h.requests.at(-1).expected_revision, 0);
});
test('falha não altera estado nem sobrescreve dados locais', async () => {
    const h = harness(); await h.cloud.load(); h.fail();
    await assert.rejects(h.cloud.write('fingsec_configuracoes', { name:'Perdido' }), /outra aba/);
    assert.equal(h.cloud.read('fingsec_configuracoes', {}).name, undefined);
    assert.equal(h.cloud.busy, false);
});
test('importação preserva dados locais e não pode ser repetida sobre conta salva', async () => {
    const h = harness(); await h.cloud.load();
    assert.equal(await h.cloud.importLegacy(), true);
    assert.equal(h.cloud.read('controle_financeiro_transacoes', []).length, 1);
    assert.ok(h.data.has('controle_financeiro_transacoes'));
    await assert.rejects(h.cloud.importLegacy(), /sem dados salvos/);
});
test('não grava dados de uma conta quando a sessão muda para outra', async () => {
    const h = harness(); await h.cloud.load(); h.changeAccount();
    await assert.rejects(h.cloud.write('fingsec_configuracoes', { name:'Conta A' }), /sessão mudou/);
    assert.equal(h.requests.filter(r => 'next_state' in r).length, 0);
});
test('recusa chave secreta no navegador', async () => {
    const h = harness(); h.window.FINGSEC_CONFIG.publishableKey = 'sb_secret_test';
    await assert.rejects(h.cloud.load(), /somente a chave/);
});
