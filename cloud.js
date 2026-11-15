/* Persistência autenticada. Nunca utiliza uma chave secreta no navegador. */
(() => {
    'use strict';
    const empty = () => ({ transactions: [], categories: [], budgets: {}, bills: [], goals: [], settings: {} });
    let client, user, state = empty(), revision = 0, busy = false, accountChanged = false;
    const fields = { controle_financeiro_transacoes: 'transactions', fingsec_categorias: 'categories', fingsec_orcamentos: 'budgets', fingsec_contas: 'bills', fingsec_metas: 'goals', fingsec_configuracoes: 'settings' };
    function connection() {
        if (client) return client;
        const config = window.FINGSEC_CONFIG;
        if (!config?.url || !config?.publishableKey || !window.supabase) throw new Error('Configure a conexão pública do Supabase em supabase-config.js.');
        let publicKey = config.publishableKey.startsWith('sb_publishable_');
        try { publicKey ||= JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch {}
        if (!publicKey) throw new Error('Use somente a chave publishable/anon do Supabase no site.');
        const storage = {
            getItem(key) { return (localStorage.getItem('fingsec_remember') === 'true' ? localStorage : sessionStorage).getItem(key); },
            setItem(key, value) {
                const remember = localStorage.getItem('fingsec_remember') === 'true';
                (remember ? localStorage : sessionStorage).setItem(key, value);
                (remember ? sessionStorage : localStorage).removeItem(key);
            },
            removeItem(key) { localStorage.removeItem(key); sessionStorage.removeItem(key); }
        };
        client = window.supabase.createClient(config.url, config.publishableKey, { auth: { storage } });
        return client;
    }
    function message(error) {
        if (error?.code === '40001') return 'Os dados foram alterados em outra aba ou dispositivo. Recarregue antes de continuar.';
        if (['42P01', 'PGRST202', 'PGRST205'].includes(error?.code)) return 'O banco ainda precisa da migração supabase/migrations/001_finance.sql.';
        return 'Não foi possível salvar no servidor. Confira sua conexão e tente novamente.';
    }
    async function load() {
        const api = connection();
        const auth = await api.auth.getUser();
        if (auth.error || !auth.data.user) { window.location.replace('../../index.html'); return false; }
        user = auth.data.user;
        const result = await api.from('fingsec_accounts').select('state,revision').eq('user_id', user.id).maybeSingle();
        if (result.error) throw new Error(message(result.error));
        state = result.data?.state || empty(); revision = result.data?.revision || 0;
        if (!state.settings.name && user.user_metadata?.nome) state.settings.name = user.user_metadata.nome;
        api.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== user.id)) {
                accountChanged = true;
                document.querySelector('.app-shell')?.setAttribute('inert', '');
                window.location.replace('../../index.html');
            }
        });
        return true;
    }
    async function save(next) {
        if (busy) throw new Error('Aguarde o salvamento em andamento.');
        if (!user) throw new Error('Entre na sua conta antes de salvar.');
        busy = true;
        const status = document.getElementById('cloudStatus');
        if (status) status.textContent = 'Salvando…';
        try {
            const auth = await connection().auth.getUser();
            if (accountChanged || auth.error || auth.data.user?.id !== user.id) throw new Error('Sua sessão mudou ou expirou. Entre novamente antes de salvar.');
            const result = await connection().rpc('save_fingsec_state', { expected_revision: revision, next_state: next }).single();
            if (result.error) throw new Error(message(result.error));
            state = result.data.state; revision = result.data.revision;
            if (status) status.textContent = 'Salvo no servidor';
            return true;
        } catch (error) { if (status) status.textContent = 'Alteração não salva'; throw error; }
        finally { busy = false; }
    }
    window.FinCloud = {
        connection, load,
        read(key, fallback) { return structuredClone(state[fields[key]] ?? fallback); },
        async write(key, value) { if (!fields[key]) throw new Error('Campo desconhecido.'); return save({ ...state, [fields[key]]: value }); },
        async writeFields(changes) { return save({ ...state, ...changes }); },
        async importLegacy() {
            if (revision !== 0) throw new Error('A importação inicial só pode ser feita em uma conta ainda sem dados salvos.');
            const next = empty();
            for (const [key, field] of Object.entries(fields)) {
                const raw = localStorage.getItem(key);
                if (raw !== null) next[field] = JSON.parse(raw);
            }
            if (!Object.values(next).some(value => Array.isArray(value) ? value.length : Object.keys(value).length)) throw new Error('Não há dados locais para importar neste navegador.');
            if (!confirm('Importar os dados antigos deste navegador para a conta conectada? A cópia local será preservada.')) return false;
            return save(next);
        },
        async signOut() { if (busy) throw new Error('Aguarde o salvamento.'); const { error } = await connection().auth.signOut(); if (error) throw new Error('Não foi possível sair.'); },
        get busy() { return busy; }
    };
})();
