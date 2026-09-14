# 🛒 MTA Shop - Site Estático

Site estático puro para plataforma de vendas de MTA SA, otimizado para GitHub Pages.

## ⚠️ AVISO IMPORTANTE

**Este projeto está temporariamente em manutenção.** O desenvolvedor responsável está hospitalizado e não consegue fazer atualizações no momento. 

Esperamos retomar as atividades em breve. Obrigado pela compreensão e paciência! 💙

---

## 🚀 Características

- ✨ **Site Estático Puro** - Apenas frontend, sem servidor
- ⚡ **Vite + React** - Build rápido e otimizado
- 🎨 **TailwindCSS** - Design moderno e responsivo
- 📱 **Mobile First** - Totalmente responsivo
- 🔍 **SEO Friendly** - Meta tags e estrutura semântica
- 📦 **Code Splitting** - Carregamento eficiente

## 📋 Estrutura

```
.
├── client/
│   ├── src/
│   │   ├── pages/        # Páginas estáticas
│   │   ├── App.tsx       # Componente principal
│   │   ├── main.tsx      # Entry point
│   │   └── index.css     # Estilos globais
│   └── index.html        # Template HTML
├── public/               # Assets estáticos
├── vite.config.ts        # Configuração Vite
├── tailwind.config.js    # Configuração Tailwind
├── .env.example          # Exemplo de variáveis (SEM VALORES SECRETOS)
└── package.json
```

## 🛠️ Setup Local

### Pré-requisitos
- Node.js >= 20.0.0
- npm ou yarn

### Instalação

```bash
# Clonar repositório
git clone https://github.com/edrielton/mta-shop.git
cd mta-shop

# Mudar para a branch de site estático
git checkout feat/static-site

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Abrir http://localhost:5173
```

## 🏗️ Build e Deploy

### Build para produção
```bash
npm run build
# Gera pasta 'dist/' pronta para deploy
```

### Deploy local (preview)
```bash
npm run preview
```

### Deploy para GitHub Pages

O site é automaticamente deployado ao fazer push para `feat/static-site`:

1. Cada commit dispara o workflow `.github/workflows/deploy-pages.yml`
2. Site é buildado e deployado para GitHub Pages
3. URL final: `https://edrielton.github.io/mta-shop`

**Configurar GitHub Pages:**
1. Vá para Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` (criada automaticamente)
4. Folder: `/ (root)`

## 📄 Páginas Disponíveis

- **Home** (`/`) - Página inicial com features e preços
- **Documentação** (`/docs`) - Guia de instalação e configuração

## 🎨 Personalizando

### Cores
Edite `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      // suas cores aqui
    },
  },
},
```

### Conteúdo
- Home: `client/src/pages/Home.tsx`
- Docs: `client/src/pages/Docs.tsx`
- Nav/Footer: `client/src/App.tsx`

### Fonts
Adicione no `client/src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=...');
```

## 📊 Performance

Otimizações implementadas:
- ✅ Code splitting automático
- ✅ CSS purging (apenas classes usadas)
- ✅ Minificação com Terser
- ✅ Lazy loading de rotas
- ✅ Gzip compression no GitHub Pages

## 🔐 Segurança

Este é um site **100% estático**:
- ✅ Sem backend
- ✅ Sem variáveis de ambiente sensíveis
- ✅ Sem banco de dados
- ✅ Nenhuma chamada a API privada

> Para funcionalidade de vendas real, integre com um backend separado (Heroku, Railway, etc)

**IMPORTANTE:** Nunca commita arquivos `.env` com valores secretos! Use `.env.example` como template.

## 📱 Responsividade

Testado em:
- Desktop (1920px+)
- Tablet (768px+)
- Mobile (320px+)

## 🔄 Branches Disponíveis

| Branch | Descrição |
|--------|-----------|
| `main` | Código original (NÃO SERÁ ATUALIZADO) |
| `feat/static-site` | Site estático em desenvolvimento |
| `backup/full-stack-original` | Backup completo do projeto full-stack |

## 🔗 Voltar ao Full-Stack

Se precisar voltar para o código full-stack original:
```bash
# Ver todas as branches
git branch -a

# Voltar para main
git checkout main

# Ou para o backup completo
git checkout backup/full-stack-original
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:
1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

MIT - veja LICENSE.md para detalhes

## 📞 Suporte

- 🐛 Issues: https://github.com/edrielton/mta-shop/issues
- 📧 Para dúvidas, abra uma discussion no repositório

---

**Construído com ❤️ para a comunidade MTA SA**

*Voltaremos em breve! 💪*
