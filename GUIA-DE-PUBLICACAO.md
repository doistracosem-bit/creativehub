# Creative Hub · Dois Traços: guia de publicação

O que mudou nesta versão:

- **Visual novo** com a identidade da Dois Traços (azul-marinho `#0b3974`, azul-gelo `#e8f1fd`, logo e mascote).
- **Pop-up do post:** toque em qualquer post (no quadro, no mês ou no painel) para ver tudo sobre ele. Dá para editar, excluir, copiar a legenda, mudar a etapa e marcar como publicado.
- **Calendário em duas visões:** **Quadro** (etapas, com arrastar e soltar) e **Mês**.
- **Login e equipe:** só quem está na equipe entra. O admin adiciona e remove pessoas pelo app.
- **Responsável e lembrete em cada post**, com **notificação no celular** mesmo com o app fechado.
- **Segurança:** antes o banco estava aberto para qualquer pessoa. Agora só a equipe lê e altera os dados.

Tudo roda em planos gratuitos: **Supabase** (banco, login e o robô de lembretes) e **Vercel** (hospedagem). Nova também a aba **Clientes**: lista, ficha com projetos e posts, editar e excluir.

---

## Supabase: já configurado ✅

Projeto **app-lembrete** (`epeuikrywfsgpdvepdrx`), configurado pelo Claude via conector:

- Tabelas (projetos, posts, clientes, referências, equipe e aparelhos) com segurança: só quem está na equipe acessa.
- Robô **lembretes** publicado e agendado a cada 5 minutos (pg_cron). As chaves das notificações foram geradas pelo próprio Supabase e ficam no cofre (Vault). Ninguém precisa copiar nem colar chave.
- O app busca sozinho a chave pública das notificações. Não precisa de `VITE_VAPID_PUBLIC_KEY`.

Falta só você fazer, no painel do Supabase, em **Authentication → URL Configuration**:

- **Site URL:** o endereço do app na Vercel (depois do passo 7).
- **Redirect URLs:** o mesmo endereço e `http://localhost:5173`.
- Se não quiser exigir confirmação de e-mail no primeiro acesso: **Authentication → Providers → Email → desligar "Confirm email"**.

### Ativar login com Google

No Google Auth Platform, configure um cliente OAuth do tipo **Aplicativo da Web**. Use `https://creativehub-pied.vercel.app` como origem JavaScript e `https://epeuikrywfsgpdvepdrx.supabase.co/auth/v1/callback` como URI de redirecionamento. Cadastre o ID e o segredo somente em **Supabase → Authentication → Sign In / Providers → Google** e ative o provedor. A equipe deve usar o mesmo e-mail cadastrado no Creative Hub.

[Configuração oficial do Google no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

## Passo 1. Publicar o app na Vercel

1. Suba a pasta `creative-hub` para um repositório no GitHub (o arquivo `.env` **não** vai junto, e é assim mesmo).
2. Em **vercel.com**, clique em **Add New → Project** e importe o repositório. A Vercel detecta o Vite sozinha.
3. Em **Environment Variables**, cadastre:
   - `VITE_SUPABASE_URL` = `https://epeuikrywfsgpdvepdrx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_1rOg6ZlG_LfT1qUZ_KPJgg_lCMYMOZn` (chave pública, pode ficar no app)
4. Clique em **Deploy**. Depois, coloque o endereço da Vercel no Supabase (Authentication → URL Configuration).

Se quiser um domínio próprio (ex.: `app.doistracos.com.br`), adicione em **Vercel → Settings → Domains** e também no Supabase (Authentication → URL Configuration).

## Passo 2. Ativar o Copilot IA

1. Em **Supabase → Edge Functions → Secrets**, cadastre a chave do Google AI Studio como `GEMINI_API_KEY`. O modelo padrão é `gemini-3.5-flash-lite`. Use o segredo opcional `GEMINI_MODEL` para selecionar outro modelo Gemini que aceite imagens e saída estruturada.
2. Autentique a CLI do Supabase e execute estes comandos na pasta do projeto. Substitua `<ref-do-projeto>` pela referência do seu projeto Supabase.

   ```powershell
   supabase login
   supabase functions deploy copilot-v2 --project-ref <ref-do-projeto> --no-verify-jwt
   ```

   A opção desativa a verificação legada do gateway para esta função. O próprio `copilot-v2` valida o token no Supabase Auth e consulta a tabela `team_members` antes de chamar o Gemini. Use a CLI para incluir a pasta compartilhada `supabase/functions/_shared`.
3. Publique o frontend atualizado com as mesmas variáveis públicas do Supabase. Entre com uma conta da equipe e gere um briefing em **Copilot IA**. O resultado deve mostrar **Gerado com Gemini**. Sem Supabase, o botão **Ver exemplo** abre uma campanha fictícia.

Se uma versão anterior do site foi publicada com `VITE_AI_API_KEY` ou `VITE_GEMINI_API_KEY`, revogue a chave usada naquela versão, remova essas variáveis da hospedagem e use uma nova chave somente no Supabase.

A geração envia o briefing, a referência selecionada e a imagem anexada ao Gemini. O botão **Baixar briefing JSON** exporta texto e estrutura de camadas para scripts. A prévia é uma simulação de composição.

Documentação oficial do [modelo Gemini](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite), dos [segredos do Supabase](https://supabase.com/docs/guides/functions/secrets) e da [verificação de tokens](https://supabase.com/docs/guides/functions/auth-headers).

## Ativar Traffic Intelligence AI

1. Aplique a migração `supabase/migrations/20261119222542_traffic_intelligence.sql` no Supabase do Creative Hub.
2. Publique a função com `supabase functions deploy traffic-intelligence --project-ref <ref-do-projeto> --no-verify-jwt`. A própria função valida a sessão no Supabase Auth e confere o acesso ao cliente antes de ler ou gravar. Ela usa o mesmo segredo `GEMINI_API_KEY` do Copilot.
3. Publique o frontend atualizado. Abra **Traffic Intelligence** pela barra lateral ou pelo menu **Mais** no celular.

Os relatórios ficam no Supabase. O botão **Gerar recomendações** envia ao Gemini os indicadores, o período, a versão do playbook e as restrições da análise. Nomes de clientes e criativos e dados de contato ficam no Creative Hub. O módulo usa as permissões da equipe para clientes já cadastrados.

## Central de Clientes

A Central usa uma sessão verificada do Google. Em **Central de Clientes → Acessos**, um administrador cadastra o e-mail e a permissão. Os aprovadores também têm WhatsApp e a confirmação de que autorizaram o recebimento de avisos. Cada pessoa entra com o próprio e-mail usando **Continuar com Google**. Use **Avisos → Ativar avisos neste aparelho** para habilitar alertas com o app fechado.

Use **Trazer post do calendário**, anexe a arte ou vídeo e monte um envio com prazo de resposta. Para posts antigos, use **Compartilhar no histórico** após anexar a versão final. A revisão final atualiza o post no calendário interno. **Marcar como publicado** registra a publicação feita pela equipe.

Para instalar em outro ambiente, aplique as migrações `client_portal` e `client_portal_delivery` depois do esquema do Creative Hub e da configuração de lembretes. Publique a função `portal-avisos` com `--no-verify-jwt`. Ela valida o segredo do cron que já existe no cofre. O cron separado reutiliza as chaves VAPID do app.

O WhatsApp precisa de um número remetente e modelos aprovados na conta WhatsApp Business da Dois Traços. Configure apenas nos segredos do Supabase `PORTAL_WHATSAPP_TOKEN`, `PORTAL_WHATSAPP_NUMBER_ID`, `PORTAL_WHATSAPP_GRAPH_VERSION`, `PORTAL_WHATSAPP_APPROVAL_TEMPLATE`, `PORTAL_WHATSAPP_REMINDER_TEMPLATE` e `PORTAL_WHATSAPP_REVISION_TEMPLATE`. Use modelos em português do Brasil com um parâmetro de texto no corpo e um botão de URL dinâmica com o domínio oficial seguido de `/?{{1}}`. A equipe registra seu número em **Meu WhatsApp**. Mensagens com mais de dois dias expiram na fila.

## Passo 3. Equipe usando

1. Entre no app com o seu e-mail. A primeira vez é por **"Primeiro acesso"**, onde você cria a senha.
2. Em **Equipe e avisos**, adicione cada pessoa (nome e e-mail).
3. Cada pessoa precisa:
   - **No Android ou no computador:** abrir o endereço no Chrome, tocar no menu ⋮ e em **Instalar app**, entrar e, em **Equipe e avisos**, tocar em **Ativar lembretes**.
   - **No iPhone (iOS 16.4 ou mais novo):** abrir no **Safari**, tocar em **Compartilhar → Adicionar à Tela de Início**, abrir o app **pelo ícone**, entrar e tocar em **Ativar lembretes**.
4. Ao ativar, chega uma notificação de teste na hora.

---

## Como os lembretes funcionam

- Cada post tem um **responsável** e um **lembrete**: só na hora, 15 min antes, 1 h antes, 3 h antes ou 1 dia antes.
- Com lembrete antecipado, a pessoa recebe **dois avisos**: o antecipado e o **"Hora de postar"**.
- Post **sem responsável** avisa a **equipe toda**.
- Post marcado como **Publicado** não avisa mais.
- Se a data ou a hora mudar, os avisos são reprogramados sozinhos.
- O robô confere a cada 5 minutos, então o aviso pode chegar até ~5 min depois do horário.
- Tocar na notificação abre o app direto no post.

## Se algo não funcionar

| Problema | O que fazer |
|---|---|
| "Acesso ainda não liberado" | O e-mail não está na equipe ou foi digitado diferente. Confira em **Equipe e avisos** (ou na tabela `team_members`). |
| Notificação não chega | Confira se a pessoa ativou os lembretes **naquele aparelho**. No iPhone, o app precisa ter sido aberto pelo ícone da Tela de Início. |
| Quer ver se o robô está rodando | No SQL Editor: `select * from cron.job_run_details order by start_time desc limit 10;` |
| Ver os registros do robô | Supabase → **Edge Functions → lembretes → Logs**. |
| Dados não aparecem | Veja o aviso vermelho no topo do app. Normalmente é o `schema.sql` que não rodou inteiro. |

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências (só na primeira vez) |
| `npm run dev` | Abre o app no seu computador (sem `.env` abre em modo demonstração) |
| `npm run dev:host` | Igual ao anterior, mas acessível pelo celular na mesma rede Wi-Fi |
| `npm run build` | Gera a versão de produção (a Vercel faz isso sozinha) |
| `npm run test:copilot` | Valida o contrato do briefing e o tratamento das respostas do Gemini com chamadas simuladas (Node.js 24) |

## Personalizar

- **Cores:** `tailwind.config.js` (`marinho`, `gelo`, `accent-glow`…).
- **Logo, mascote e ícones:** pasta `public/` e `public/brand/`.
- **Formatos de post e opções de lembrete:** `src/components/modals/PostModal.tsx` e `src/lib/datas.ts`.
