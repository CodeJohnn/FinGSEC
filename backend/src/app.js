import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import auth from './middleware/auth.js';
import { validState } from './validation.js';
const app = express();
app.disable('x-powered-by');
const origins = (process.env.ALLOWED_ORIGINS || 'https://fingsec.guedessec.online,https://codejohnn.github.io,http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
app.use(cors({ origin(origin, cb) { cb(null, !origin || origins.includes(origin)); } }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.get('/', (req, res) => res.json({ service: 'FinGSEC API', status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
const attempts = new Map();
app.use('/api/auth', (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const record = attempts.get(req.ip) || { count: 0, until: now + 60000 };
    record.count++; attempts.set(req.ip, record);
    if (record.count > 20) return res.status(429).json({ erro: 'Aguarde um minuto antes de tentar novamente.' });
    next();
}, authRoutes);
app.get('/api/me', auth, (req, res) => res.json({ id: req.user.id, email: req.user.email, nome: req.user.user_metadata?.nome || '' }));
app.get('/api/state', auth, async (req, res) => {
    const { data, error } = await req.db.from('fingsec_accounts').select('state,revision,updated_at').eq('user_id', req.user.id).maybeSingle();
    if (error) return res.status(503).json({ erro: 'Não foi possível consultar os dados. Confira a migração do banco.' });
    res.json(data || { state: null, revision: 0 });
});
app.put('/api/state', auth, async (req, res) => {
    if (!validState(req.body?.state) || !Number.isSafeInteger(req.body?.revision) || req.body.revision < 0) return res.status(400).json({ erro: 'Estado ou versão inválidos.' });
    const { data, error } = await req.db.rpc('save_fingsec_state', { expected_revision: req.body.revision, next_state: req.body.state }).single();
    if (error) return res.status(error.code === '40001' ? 409 : 503).json({ erro: error.code === '40001' ? 'Dados alterados em outra sessão. Recarregue antes de salvar.' : 'Não foi possível salvar os dados.' });
    res.json({ state: data.state, revision: data.revision, updated_at: data.updated_at });
});
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ erro: 'Dados excedem o tamanho permitido.' });
    res.status(503).json({ erro: 'Serviço indisponível. Confira a configuração do servidor.' });
});
export default app;
