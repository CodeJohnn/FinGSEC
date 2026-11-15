import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { validState } from '../src/validation.js';

let server, base;
const originalFetch = globalThis.fetch;
const calls = [];
before(async () => {
    process.env.SUPABASE_URL = 'https://fingsec-test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    globalThis.fetch = async (url, options) => {
        const address = String(url);
        if (!address.startsWith(process.env.SUPABASE_URL)) return originalFetch(url, options);
        calls.push({ address, options });
        if (address.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a', aud: 'authenticated', email: 'test@example.com', user_metadata: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (address.includes('/rest/v1/fingsec_accounts')) return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (address.includes('/rpc/save_fingsec_state')) return new Response(JSON.stringify({ code: '40001', message: 'revision_conflict' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        throw new Error('Unexpected external request');
    };
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = originalFetch; await new Promise(resolve => server.close(resolve)); });
const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
const state = { transactions: [], categories: [], budgets: {}, bills: [], goals: [], settings: {} };
test('raiz não lista usuários e respostas não são armazenadas em cache', async () => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).service, 'FinGSEC API');
});
test('rotas privadas exigem autenticação', async () => {
    for (const path of ['/api/me', '/api/state']) assert.equal((await fetch(base + path)).status, 401);
});
test('cadastro e login estão registrados e validam os campos', async () => {
    for (const route of ['register', 'login']) {
        const response = await fetch(base + '/api/auth/' + route, { method: 'POST', headers, body: '{}' });
        assert.equal(response.status, 400);
    }
});
test('consulta ignora usuário fornecido pelo cliente e filtra pelo token', async () => {
    const response = await fetch(base + '/api/state?user_id=user-b', { headers });
    assert.equal(response.status, 200);
    const query = calls.find(call => call.address.includes('/rest/v1/fingsec_accounts'));
    assert.equal(new URL(query.address).searchParams.get('user_id'), 'eq.user-a');
    assert.equal((await response.json()).revision, 0);
});
test('estado inválido é rejeitado antes da escrita', async () => {
    const response = await fetch(base + '/api/state', { method: 'PUT', headers, body: JSON.stringify({ state: { transactions: 'invalid' }, revision: 0 }) });
    assert.equal(response.status, 400);
    assert.equal(validState({ ...state, transactions: [{ tipo: 'despesa', valor: -1 }] }), false);
});
test('conflito de versão retorna 409 sem sobrescrever silenciosamente', async () => {
    const response = await fetch(base + '/api/state', { method: 'PUT', headers, body: JSON.stringify({ state, revision: 1, user_id: 'user-b' }) });
    assert.equal(response.status, 409);
    const rpc = calls.find(call => call.address.includes('/rpc/save_fingsec_state'));
    const payload = JSON.parse(rpc.options.body);
    assert.equal(payload.expected_revision, 1);
    assert.equal('user_id' in payload, false);
});
test('JSON inválido retorna erro controlado', async () => {
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers, body: '{' });
    assert.equal(response.status, 400);
});
