import { createSupabase } from '../database/supabase.js';
function valid(body, register = false) {
    return body && typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        && typeof body.senha === 'string' && body.senha.length >= 6 && body.senha.length <= 128
        && (!register || (typeof body.nome === 'string' && body.nome.trim().length >= 3 && body.nome.trim().length <= 80));
}
export async function register(req, res) {
    if (!valid(req.body, true)) return res.status(400).json({ erro: 'Confira nome, e-mail e senha (6 a 128 caracteres).' });
    const { nome, email, senha } = req.body;
    const { data, error } = await createSupabase().auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
    if (error) return res.status(400).json({ erro: 'Não foi possível cadastrar. Confira os dados e tente novamente.' });
    return res.status(201).json({ user: data.user ? { id: data.user.id, email: data.user.email } : null, session: data.session, mensagem: data.session ? 'Conta criada.' : 'Confira seu e-mail para confirmar o cadastro.' });
}
export async function login(req, res) {
    if (!valid(req.body)) return res.status(400).json({ erro: 'Informe e-mail e senha válidos.' });
    const { data, error } = await createSupabase().auth.signInWithPassword({ email: req.body.email.trim(), password: req.body.senha });
    if (error) return res.status(401).json({ erro: 'E-mail ou senha inválidos, ou e-mail ainda não confirmado.' });
    return res.json({ user: { id: data.user.id, email: data.user.email }, session: data.session });
}
