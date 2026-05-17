# MTA Store — Guia Completo de Deploy + Cloudflare

## O que é este site?

Uma **loja online integrada ao seu servidor MTA (Multi Theft Auto)**.
O jogador acessa o site, compra um item com cartão, e o item é ativado
automaticamente no servidor MTA — sem precisar de admin humano.

---

## O que o site possui

### Para os jogadores

| Seção | O que faz |
|---|---|
| **Home** | Apresentação do servidor, produtos em destaque |
| **Produtos** | Catálogo com busca, filtros por categoria e ordenação por preço |
| **Carrinho / Checkout** | Pagamento seguro via Stripe (cartão de crédito/débito) |
| **Dashboard — Compras** | Histórico de todas as compras e status de ativação no MTA |
| **Dashboard — Conta** | Vincula o serial MTA ou conta MTA para receber os itens |
| **Dashboard — Segurança** | Troca de senha, lista de dispositivos conectados, encerrar sessões remotas |

### Para o admin

| Seção | O que faz |
|---|---|
| **Painel Admin — Produtos** | Criar, editar, ativar/desativar e excluir produtos |
| **Painel Admin — Transações** | Ver todas as compras, status de pagamento e ativação MTA |
| **Painel Admin — Usuários** | Ver usuários, dar/remover VIP, suspender contas |
| **Painel Admin — Configuração MTA** | Conectar ao servidor MTA (URL, porta, token) |
| **Painel Admin — Logs** | Auditoria completa de logins, compras e erros |
| **Painel Admin — Retry** | Reativar manualmente itens que falharam |

### Segurança implementada

- Bloqueio automático após 5 tentativas de login erradas (30 min)
- Proteção contra timing attack (bcrypt sempre computa)
- Sessões por dispositivo com IP e navegador registrados
- Encerramento remoto de sessão (troca de senha expulsa outros dispositivos)
- Detecção de compra suspeita (IP diferente, conta nova, valor alto)
- Rate limiting em login, registro e checkout
- Headers de segurança em todas as respostas
- Webhook do Stripe para confirmar pagamentos de forma confiável
- Assinatura HMAC-SHA256 nas requisições ao servidor MTA

### Produtos suportados (ativação automática no MTA)

| Comando MTA | O que faz | Parâmetros |
|---|---|---|
| `giveVip` | Ativa VIP | `{"days": 30, "tier": "gold"}` |
| `giveCoins` | Dá moedas | `{"amount": 5000}` |
| `giveVehicle` | Spawna veículo | `{"vehicleId": 411}` |
| `giveWeaponKit` | Kit de armas | `{"kit": "premium"}` |
| `giveSkin` | Muda skin | `{"skinId": 100}` |
| `giveProperty` | Atribui propriedade | `{"propertyId": 5}` |

---

## Como colocar no ar — Passo a Passo

### Etapa 1 — Banco de dados (Neon — gratuito)

1. Acesse **https://neon.tech** e crie uma conta gratuita
2. Clique em **"New Project"** → dê um nome (ex: `mta-store`)
3. Após criar, clique em **"Connect"** e copie a **Connection string**
   - Formato: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb`
4. Abra o **SQL Editor** no Neon e cole o conteúdo do arquivo `database_setup.sql`
5. Clique em **Run** — as tabelas serão criadas

### Etapa 2 — Stripe (pagamentos)

1. Acesse **https://dashboard.stripe.com** e crie uma conta
2. No menu lateral vá em **Developers → API Keys**
3. Copie:
   - **Publishable key** (começa com `pk_live_...`)
   - **Secret key** (começa com `sk_live_...`)
4. Para o webhook: vá em **Developers → Webhooks → Add endpoint**
   - URL: `https://seudominio.com/api/checkout/webhook`
   - Eventos: selecione `checkout.session.completed` e `payment_intent.payment_failed`
   - Copie o **Signing secret** (começa com `whsec_...`)

> **Teste antes de ir ao ar:** Use as chaves `pk_test_` e `sk_test_` para testar sem cobrar ninguém.

### Etapa 3 — Deploy no Railway

1. Acesse **https://railway.app** e crie uma conta (pode logar com GitHub)
2. Clique em **"New Project" → "Deploy from GitHub repo"**
3. Conecte seu repositório GitHub com o código do projeto
   - Se ainda não subiu o código: crie um repo no GitHub, faça upload dos arquivos
   - Nunca suba o arquivo `.env` — o `.gitignore` já bloqueia isso
4. Clique no serviço criado → aba **"Variables"**
5. Adicione estas variáveis (uma por vez):

```
DATABASE_URL     = postgresql://... (copiado do Neon)
SESSION_SECRET   = (gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
STRIPE_SECRET_KEY      = sk_live_...
STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_WEBHOOK_SECRET  = whsec_...
NODE_ENV         = production
PORT             = 5000
```

6. Railway vai fazer o build e deploy automaticamente
7. Na aba **"Settings"** do serviço → **"Networking"** → copie o domínio gerado
   - Ex: `mta-store-production.up.railway.app`

### Etapa 4 — Cloudflare (domínio + proteção)

**Pré-requisito:** ter um domínio registrado (ex: Registro.br, GoDaddy, Namecheap)

1. Acesse **https://cloudflare.com** e crie uma conta
2. Clique em **"Add a Site"** → insira seu domínio → selecione o plano **gratuito**
3. O Cloudflare vai listar seus DNS atuais — clique em **"Continue"**
4. Aponte o domínio para o Railway: clique em **"Add record"**

```
Tipo:    CNAME
Nome:    @          (ou www)
Target:  mta-store-production.up.railway.app
Proxy:   Ativado (nuvem laranja ☁️)
TTL:     Auto
```

5. Se quiser `www` também, adicione outro registro:
```
Tipo:    CNAME
Nome:    www
Target:  mta-store-production.up.railway.app
Proxy:   Ativado ☁️
```

6. Clique em **"Continue"** → o Cloudflare mostrará 2 nameservers
   - Ex: `noah.ns.cloudflare.com` e `sasha.ns.cloudflare.com`
7. No painel do seu registrador de domínio, troque os nameservers pelos do Cloudflare
8. Aguarde até 24h para propagar (geralmente menos de 1h)

**Configurações recomendadas no Cloudflare:**

- **SSL/TLS → Overview:** selecione **"Full"** (não "Flexible")
- **SSL/TLS → Edge Certificates:** ative **"Always Use HTTPS"**
- **Speed → Optimization:** ative **"Auto Minify"** (JS, CSS, HTML)
- **Security → Settings:** coloque **Security Level** em **"Medium"**
- **Caching → Configuration:** **Browser Cache TTL** → "4 hours"

### Etapa 5 — Conectar o servidor MTA

1. Copie a pasta `mta_resource/` para dentro do seu servidor MTA como `mta_store`
2. Edite o arquivo `mta_resource/config.lua`:

```lua
MTA_STORE_TOKEN = "coloque_um_token_secreto_aqui"
MTA_STORE_DEBUG = false  -- true para ver logs de debug
MTA_STORE_REQUIRE_HMAC = true
```

3. Inicie o resource no MTA: `start mta_store`
4. No site, acesse o **Painel Admin → Configuração MTA** e preencha:
   - **URL do servidor:** `http://IP_DO_SEU_VPS`
   - **Porta:** `22005` (porta HTTP do MTA)
   - **Token:** o mesmo que você colocou no `config.lua`
5. Clique em **"Verificar conexão"** — deve aparecer **"Online"**

### Etapa 6 — Atualizar o Webhook URL no Stripe

Agora que você tem o domínio final, atualize a URL do webhook no Stripe:
- **Developers → Webhooks → edite o endpoint**
- Troque para: `https://seudominio.com/api/checkout/webhook`

---

## Primeiro acesso

1. Acesse `https://seudominio.com`
2. Clique em **Login** → use `admin` / `admin123`
3. **IMEDIATAMENTE** vá em Dashboard → Segurança → Alterar Senha
4. Configure os produtos no Painel Admin conforme seu servidor MTA
5. Teste uma compra com cartão de teste do Stripe (`4242 4242 4242 4242`, qualquer data futura, qualquer CVV)

---

## Estrutura de arquivos

```
mta-store/
├── client/          → Frontend React (o que o usuário vê)
├── server/          → Backend Express (API, pagamentos, segurança)
├── shared/          → Schema do banco (compartilhado entre front e back)
├── mta_resource/    → Resource Lua para instalar no servidor MTA
├── .env.example     → Modelo de variáveis de ambiente
├── database_setup.sql → SQL manual (alternativa ao db:push)
├── railway.toml     → Configuração de deploy no Railway
├── Dockerfile       → Para deploy em VPS/Docker
└── DEPLOY.md        → Este arquivo
```

---

## Problemas comuns

| Erro | Solução |
|---|---|
| `DATABASE_URL must be set` | Variável não configurada no Railway |
| `STRIPE_SECRET_KEY não definida` | Chave Stripe não adicionada nas vars |
| Stripe: `webhook signature invalid` | Configure `STRIPE_WEBHOOK_SECRET` |
| Site abre mas API dá 500 | Verifique os logs no Railway → aba "Logs" |
| MTA não recebe ativação | Verifique se a porta 22005 está aberta no firewall do VPS |
| Cloudflare erro 521 | Railway ainda está fazendo o build, aguarde alguns minutos |
