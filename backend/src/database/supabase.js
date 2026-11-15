import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
export function createSupabase(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no backend/.env.');
    let publicKey = key.startsWith('sb_publishable_');
    try { publicKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
    if (!publicKey) throw new Error('Este servidor utiliza somente a chave publishable/anon com o token do usuário.');
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {})
    });
}
