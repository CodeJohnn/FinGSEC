// Verificação somente de leitura, sem revelar chaves ou consultar dados privados.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../supabase-config.js'), 'utf8'), context);
const config = context.window.FINGSEC_CONFIG;
(async () => {
    const headers = { apikey: config.publishableKey };
    const base = config.url.replace(/\/$/, '');
    for (const [label, endpoint] of [['Auth', '/auth/v1/settings'], ['Tabela privada', '/rest/v1/fingsec_accounts?select=revision&limit=0']]) {
        const response = await fetch(base + endpoint, { headers, signal: AbortSignal.timeout(15000) });
        const data = await response.json().catch(() => ({}));
        console.log(JSON.stringify({ service: label, status: response.status, code: data?.code || null, ...(label === 'Auth' ? { emailEnabled: data?.external?.email } : {}) }));
    }
})().catch(error => { console.error('Falha na verificação de rede:', error.cause?.code || error.name); process.exitCode = 1; });
