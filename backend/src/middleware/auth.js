import { createSupabase } from '../database/supabase.js';
export default async function auth(req, res, next) {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ erro: 'Autenticação necessária.' });
    try {
        req.db = createSupabase(match[1]);
        const { data, error } = await req.db.auth.getUser(match[1]);
        if (error || !data.user) return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
        req.user = data.user;
        return next();
    } catch (error) { return next(error); }
}
