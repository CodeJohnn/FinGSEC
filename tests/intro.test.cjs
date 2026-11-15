const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('intro.js', 'utf8');
function run({ store = new Map(), search = '', reduced = false, blocked = false } = {}) {
    const classes = new Set(), timers = [], listeners = new Map();
    const preference = { matches: reduced, addEventListener() {}, removeEventListener() {} };
    const context = {
        location: { search, hash: '' }, matchMedia: () => preference,
        sessionStorage: { getItem(k) { if (blocked) throw new Error('blocked'); return store.get(k); }, setItem: (k,v) => store.set(k,v) },
        setTimeout(fn, ms) { timers.push({ fn, ms }); },
        document: { documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } }, activeElement: null,
            addEventListener: (k,v) => listeners.set(k,v), removeEventListener: k => listeners.delete(k) }
    };
    vm.runInNewContext(source, context);
    return { classes, timers, listeners, store };
}
test('abertura dura 2,5 segundos incluindo saída e limpa listeners', () => {
    const h = run(); assert.ok(h.classes.has('intro-active'));
    assert.equal(h.timers[0].ms, 2100); h.timers[0].fn();
    assert.ok(h.classes.has('intro-leaving')); assert.equal(h.timers[1].ms, 400);
    h.timers[1].fn(); assert.equal(h.classes.size, 0); assert.equal(h.listeners.size, 0);
});
test('recarregar na mesma sessão não repete a abertura', () => {
    const store = new Map(); run({ store });
    assert.equal(run({ store }).timers.length, 0);
});
test('callback de autenticação e movimento reduzido vão direto ao login', () => {
    for (const search of ['?code=abc', '?type=recovery', '?token_hash=abc']) assert.equal(run({ search }).timers.length, 0);
    assert.equal(run({ reduced: true }).timers.length, 0);
});
test('armazenamento bloqueado não impede acesso e Esc encerra a abertura', () => {
    assert.equal(run({ blocked: true }).timers.length, 0);
    const h = run(); h.listeners.get('keydown')({ key: 'Escape' });
    assert.ok(!h.classes.has('intro-active'));
    h.timers[0].fn(); assert.equal(h.timers.length, 2);
});
