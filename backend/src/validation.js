export function validState(state) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!object(state)) return false;
    if (!['transactions', 'categories', 'bills', 'goals'].every(key => Array.isArray(state[key]))) return false;
    if (!object(state.budgets) || !object(state.settings)) return false;
    if (state.categories.some(c => typeof c !== 'string' || c.length > 80)) return false;
    for (const item of [...state.transactions, ...state.bills]) {
        if (!object(item) || !['receita', 'despesa'].includes(item.tipo) || !Number.isFinite(Number(item.valor)) || Number(item.valor) <= 0) return false;
    }
    return Buffer.byteLength(JSON.stringify(state)) <= 1900000;
}
