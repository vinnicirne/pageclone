# PageClone 🚀
### Clonador Profissional de Páginas de Venda, Marketplace de Afiliados & Webhook Engine

O **PageClone** é um sistema completo e autônomo para afiliados e produtores de marketing digital, integrando:

1. ⚡ **Clonador de Páginas de Alta Conversão**:
   - Renderização profunda via Chrome Headless com espera assíncrona para SPAs React / Next.js / Vite.
   - Enquadramento responsivo automático de vídeos verticais (9:16 - Reels / Stories / TikTok) com `aspect-ratio: 9/16`, `object-fit: cover` e `muted autoplay`.
   - Limpeza automática de artefatos de CMS e travas globais contra quebra de layout horizontal.
   - Substituição instantânea de checkouts (Kiwify, Hotmart, Eduzz, Braip, Monetizze, PerfectPay).

2. 🛒 **Marketplace do PageClone**:
   - Publicação de produtos com 1 clique diretamente do Clonador.
   - Disponibilização dos 3 pilares essenciais para afiliados:
     - 🌐 **Página de Vendas**: Visualização imediata e clonagem personalizada.
     - 🎨 **Materiais Criativos**: Pack de vídeos 9:16 em alta resolução, carrosséis, copies validadas e link direto do Google Drive.
     - 🔌 **Webhook**: URL exclusiva gerada pelo PageClone para Kiwify/Hotmart, com disparo automático para a API de Conversões do Meta (CAPI) e simulador de teste em tempo real.

3. 🛡️ **Suíte de Rastreamento (6 Plataformas)**:
   - Meta Pixel & Conversions API (CAPI server-side)
   - TikTok Pixel & Events API
   - Google Tag Manager (GTM)
   - Google Analytics 4 (GA4)
   - Google Ads (gtag.js) com tracking de conversão
   - UTMFY com Repassador Dinâmico de UTMs (`utm_source`, `utm_campaign`, `utm_content`, `src`, `sck`)

---

## 🛠️ Como Executar Localmente

```bash
# Iniciar o servidor PageClone
npm start
# ou
node server.js
```

Acesse no navegador:
- **Painel PageClone**: [http://localhost:3000](http://localhost:3000)
- **Prévia da Página Clonada**: [http://localhost:3000/preview-clonada](http://localhost:3000/preview-clonada)
- **API do Marketplace**: [http://localhost:3000/api/marketplace](http://localhost:3000/api/marketplace)
- **API de Webhook**: [http://localhost:3000/api/webhook](http://localhost:3000/api/webhook)

---

## ☁️ Deploy na Vercel

O projeto está pronto para a Vercel com Serverless Functions em `/api`:
- `api/clonar.js`: Processador de HTML e injeção de pixels
- `api/preview.js`: Servidor de pré-visualização
- `api/marketplace.js`: Gerenciador de produtos do marketplace
- `api/webhook.js`: Receptor de notificações de vendas Kiwify/Hotmart

```bash
vercel --prod
```
