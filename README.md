# FinGSEC

Gerenciador financeiro com frontend estático, Supabase Auth e armazenamento privado por usuário no PostgreSQL.

## Ativar o Supabase

1. No projeto Supabase, abra **SQL Editor** e execute `supabase/migrations/001_finance.sql`. O script cria uma tabela própria e uma função de salvamento; não apaga tabelas nem registros existentes.
2. Em **Settings > API Keys**, obtenha a chave **publishable** (ou a chave legada `anon`). Configure a Project URL e essa chave em `supabase-config.js`. Esse arquivo é público: nunca utilize `secret` ou `service_role` nele.
3. Em **Authentication > URL Configuration**, configure a Site URL `https://codejohnn.github.io/FinGSEC/` e permita o redirect `https://codejohnn.github.io/FinGSEC/index.html`. Para desenvolvimento, permita também `http://127.0.0.1:5173/index.html`.
4. Mantenha o provedor e-mail/senha habilitado. Se a confirmação de e-mail estiver habilitada, confirme o e-mail antes do primeiro login. Configure o envio de e-mails do projeto conforme necessário para cadastro e recuperação.
5. Publique os arquivos do frontend no GitHub Pages. O site acessa o Supabase diretamente; o Express é uma API alternativa e não é executado pelo GitHub Pages.

**Configuração ainda necessária:** a URL do projeto já foi preenchida em supabase-config.js, mas a chave pública continua vazia, pois a configuração local existente utiliza uma chave secreta. Nenhuma chave secreta foi copiada para o frontend. A migração SQL precisa ser aplicada no Supabase antes da ativação. Os testes locais não substituem a verificação das políticas no banco real.

## Executar localmente

Execute `node scripts/preview.cjs` na raiz e abra http://127.0.0.1:5173. A prévia serve somente arquivos estáticos; não expõe a pasta backend ou arquivos ocultos.

## Dados, usuários e migração

- E-mail e senha são gerenciados pelo **Supabase Auth**. Senhas não são armazenadas em tabelas públicas pelo aplicativo.
- Transações, categorias, orçamento, contas, metas e configurações ficam em `public.fingsec_accounts`, em um documento JSON por usuário, com versão e data da última atualização.
- As políticas RLS restringem leitura e escrita ao `auth.uid()` da conta conectada. A função de salvamento é `security invoker`, sem privilégios administrativos.
- O documento é salvo atomicamente, inclusive ao quitar uma conta e registrar sua transação. A versão evita sobrescrita silenciosa entre abas e dispositivos. Em conflito, recarregue antes de repetir a alteração.
- O site só confirma um salvamento após a resposta do servidor. Se a rede falhar, não anuncia sucesso nem substitui o estado em memória por uma alteração não confirmada. Se a resposta se perder após a gravação, recarregue para verificar antes de repetir.
- O armazenamento é destinado a uso pessoal, com limite de aproximadamente 2 MB por conta nesta versão. O estado completo é enviado em cada alteração; volumes maiores exigirão separar as entidades em tabelas.
- Registros locais antigos **não são importados automaticamente**. Em uma conta ainda sem gravações, use **Configurações > Importar dados locais**, no mesmo navegador e endereço onde os dados antigos foram cadastrados. A importação preserva a cópia local e não pode sobrescrever uma conta já salva. Exporte um backup antes de migrar.
- Contas do protótipo antigo em uma tabela `users` não são convertidas automaticamente em usuários do Supabase Auth. Essa tabela não é consultada nem alterada por esta implementação. Para usar o novo acesso, cadastre e confirme uma conta no Supabase Auth. Revise os acessos da tabela legada no painel se ela contiver dados reais.
- “Lembrar-me” armazena a sessão no navegador; sem essa opção, a sessão fica no armazenamento da aba. O botão **Sair da conta** encerra a sessão.

## Backend Express opcional

Na pasta `backend`, execute `npm ci`, configure o `.env` seguindo `.env.example` e execute `npm start`. O backend exige uma chave pública `SUPABASE_PUBLISHABLE_KEY` ou `SUPABASE_ANON_KEY`; a antiga chave secreta `SUPABASE_KEY` não é usada.

Rotas:

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/health` | Verificação de disponibilidade do processo |
| POST | `/api/auth/register` | `{ nome, email, senha }` |
| POST | `/api/auth/login` | `{ email, senha }` |
| GET | `/api/me` | Conta autenticada |
| GET | `/api/state` | Estado e versão da conta autenticada |
| PUT | `/api/state` | `{ state, revision }`, com controle de concorrência |

Rotas privadas exigem `Authorization: Bearer <access_token>` emitido pelo Supabase Auth. O servidor valida o token e usa esse mesmo token no banco, respeitando RLS. As respostas não incluem senhas nem listagens de usuários. CORS aceita somente as origens configuradas em `ALLOWED_ORIGINS`; há limite básico de tentativas nas rotas de autenticação por instância. Uma implantação com múltiplas instâncias deve usar limite compartilhado e HTTPS no proxy.

## Verificar

Na raiz:

```
node --test tests/*.test.cjs
node --test backend/test/*.test.js
```

Os testes usam um transporte simulado para a nuvem, sem criar usuários ou alterar dados reais. Cobrem regras financeiras, referências HTML, isolamento das consultas, rejeição de acesso sem token, validação, conflitos e importação sem sobrescrita.

Depois de configurar o Supabase, teste duas contas reais: a conta B não deve consultar ou editar os registros da conta A. Confirme também cadastro, confirmação do e-mail, recuperação de senha, recarga em outro navegador e conflito entre duas abas antes de considerar a integração validada em produção.

Fontes locais do sistema; ícones, Chart.js e o SDK Supabase são carregados por CDN com versões fixadas.
