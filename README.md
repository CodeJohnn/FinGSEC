# FinGSEC

Gerenciador financeiro pessoal em HTML, CSS e JavaScript, com tema escuro e detalhes dourados.

## Executar localmente

Com Node.js instalado, execute `node scripts/preview.cjs` na raiz e abra http://127.0.0.1:5173. Use sempre a mesma origem: o armazenamento do navegador é separado por endereço e porta.

## Recursos

- Visão geral com saldo realizado até hoje, resultado do período e comparação com o período anterior.
- Gráficos semanais, mensais e anuais com navegação pelo histórico. Os resultados do período incluem os lançamentos futuros cadastrados; o saldo total considera somente datas até hoje.
- Transações com edição, exclusão, pesquisa e filtros por categoria, tipo, data e valor.
- Parcelamento do valor total em centavos, distribuindo o resto entre as primeiras parcelas e respeitando o último dia de cada mês.
- Recorrências mensais com confirmação de cada vencimento no painel, sem criar despesas automaticamente.
- Categorias, orçamento mensal, classificação de despesas fixas e variáveis, contas a pagar/receber e metas com aportes manuais.
- Ao confirmar uma conta como paga/recebida, uma movimentação é registrada na data atual. Repetir a ação não duplica essa movimentação.
- Exportação JSON em Configurações e opção de ocultar valores.

## Persistência e acesso

Os registros existentes usam a chave `controle_financeiro_transacoes`, preservada nesta implementação. Nenhum dado é migrado ou regravado ao abrir a página. Novos recursos utilizam chaves próprias com prefixo `fingsec_`. Se houver dados ilegíveis, a escrita é bloqueada para evitar sobrescrita.

Os dados financeiros ficam no navegador, sem sincronização ou separação por usuário. A tela de entrada preserva o fluxo local demonstrativo e não autentica credenciais. A integração de autenticação do backend ainda precisa ser concluída antes de utilizar o sistema como aplicação com contas reais. A exportação não inclui senhas; não há importação automática nesta versão.

Fontes, ícones e Chart.js utilizam CDNs. Os gráficos precisam de conexão para carregar a biblioteca.

## Verificação

Execute `node --test tests/finance.test.cjs`. Os testes cobrem valores monetários, fim de mês, preservação de registros, saldo realizado, referências do HTML, proteção contra sobrescrita, quitação sem duplicidade e recorrências.

A resposta HTTP da prévia foi verificada. A conferência visual no navegador e em dispositivos reais permanece pendente por indisponibilidade de navegador conectado no ambiente de execução.
