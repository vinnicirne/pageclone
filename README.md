# Sistema Reproduzido: Ferramentas Low Ticket + Suíte de Rastreamento Avançada

Esta é a reprodução do ecossistema de vendas da plataforma **Sócios 10K** (`socio10k.paidolowticket.com`), equipada com o **Clonador de Alta Precisão** e a **Suíte Completa de Rastreamento Multi-Plataforma**.

---

## 🎯 Suíte de Rastreamento e Pixels Integrada

1. **Meta (Facebook) Ads**:
   * Injeção do script do Pixel (`PageView`).
   * Suporte a **Meta Conversions API (CAPI)** via token de acesso de servidor.
   * Suporte a Código de Evento de Teste (`test_event_code`).
   * Fallback com tag `<noscript>`.

2. **TikTok Ads**:
   * Script oficial do TikTok Pixel (`ttq.load`).
   * Disparo automático de evento `ttq.page()`.

3. **Google Tag Manager (GTM)**:
   * Injeção do contêiner GTM no `<head>`.
   * Injeção da tag `<noscript><iframe...>` no topo do `<body>`.

4. **Google Analytics 4 (GA4)**:
   * Script `gtag.js` com inicialização e disparo para o ID `G-XXXXXXXXXX`.

5. **Google Ads (Conversões & Remarketing)**:
   * Configuração de tag `AW-XXXXXXXXX`.
   * Suporte a Rótulo de Conversão (*Conversion Label*).

6. **UTMFY & Repassador Dinâmico de Parâmetros UTM**:
   * Script oficial do UTMFY (`https://cdn.utmify.com.br/scripts/utms/latest.js`).
   * **Motor de Preservação de UTMs**: Varre a URL da página e repassa automaticamente todos os parâmetros (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `src`, `sck`) para os botões de checkout (Kiwify, Hotmart, Eduzz, etc.), garantindo atribuição 100% precisa nas plataformas de vendas e no dashboard do UTMFY.

7. **Isolamento de Segurança**:
   * Remoção automática de rastreadores e pixels concorrentes da página clonada.

---

## 🚀 Como Acessar

O servidor já está ativo na porta 3000:
* Acesse no navegador: [http://localhost:3000](http://localhost:3000)
* Visualize a página com todos os pixels ativos em: [http://localhost:3000/preview-clonada](http://localhost:3000/preview-clonada)
