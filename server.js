const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 3000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = __dirname;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

let lastClonedHtml = null;
let lastTargetBaseUrl = null;

// Padrões de gateways de pagamento para substituição
const CHECKOUT_PATTERNS = [
  /href=["'](https?:\/\/[^"']*(?:kiwify|hotmart|eduzz|monetizze|perfectpay|braip|kirvano|yampi|cakto|greenn|ticto|doppus)[^"']*)["']/gi,
  /href=["'](https?:\/\/pay\.[^"']+)["']/gi,
  /href=["'](https?:\/\/checkout\.[^"']+)["']/gi,
  /href=["'](https?:\/\/kiwify\.app\/[^"']+)["']/gi
];

// Motor de Renderização com Chrome Headless + Virtual Time Budget
function fetchWithHeadlessChrome(url) {
  return new Promise((resolve, reject) => {
    console.log(`[Chrome Headless] Renderizando DOM para: ${url}`);
    execFile(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-web-security',
      '--virtual-time-budget=10000',
      '--run-all-compositor-stages-before-draw',
      '--dump-dom',
      url
    ], { maxBuffer: 30 * 1024 * 1024, timeout: 25000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout || '');
    });
  });
}

// Disparador de Conversions API (CAPI) para Meta
async function dispatchMetaCapi(pixelId, capiToken, testCode) {
  if (!pixelId || !capiToken) return;
  try {
    const eventData = {
      data: [{
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: 'http://localhost:3000/preview-clonada',
        user_data: {
          client_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0'
        }
      }],
      ...(testCode ? { test_event_code: testCode.trim() } : {})
    };

    console.log(`[Meta CAPI] Disparando evento PageView via servidor para Pixel ${pixelId}...`);
    const resp = await fetch(`https://graph.facebook.com/v19.0/${pixelId.trim()}/events?access_token=${capiToken.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    const resJson = await resp.json();
    console.log('[Meta CAPI] Resposta da Graph API:', resJson);
  } catch (e) {
    console.warn('[Meta CAPI] Falha ao enviar evento de servidor:', e.message);
  }
}

function processClonedHtml(rawHtml, targetUrl, options = {}) {
  const { 
    newCheckout, 
    originalCheckout, 
    // Rastreamento Completo
    pixelMeta, 
    metaCapiToken,
    testCode, 
    tiktokPixel,
    tiktokApiToken,
    googleAdsId,
    googleAdsLabel,
    ga4Id,
    gtmId,
    utmfyScript,
    enableUtmForwarder,
    whatsappNumber, 
    backRedirectUrl, 
    removeOriginalPixels 
  } = options;

  let html = rawHtml;

  // 1. Extrair domínio base da URL alvo
  let baseUrl = '';
  try {
    const parsed = new URL(targetUrl);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    baseUrl = targetUrl.replace(/\/+$/, '');
  }

  // 2. REESCRITA DE RECURSOS RELATIVOS PARA ABSOLUTOS
  if (baseUrl) {
    html = html.replace(/(href=["'])\/(?!\/)/gi, `$1${baseUrl}/`);
    html = html.replace(/(src=["'])\/(?!\/)/gi, `$1${baseUrl}/`);
    html = html.replace(/(action=["'])\/(?!\/)/gi, `$1${baseUrl}/`);
    html = html.replace(/(srcset=["'])\/(?!\/)/gi, `$1${baseUrl}/`);
    html = html.replace(/url\(\s*["']?\/(?!\/)/gi, `url("${baseUrl}/`);

    if (!html.includes('<base ') && !html.includes('<base>')) {
      html = html.replace(/<head[^>]*>/i, `$&<base href="${baseUrl}/">`);
    }
  }

  // 3. REMOVER SCRIPTS DE BOOTSTRAP DE SPA
  html = html.replace(/<script[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, '<!-- [Script SPA desativado para preservar o HTML renderizado] -->');
  html = html.replace(/<link[^>]*rel=["']modulepreload["'][^>]*>/gi, '');

  // 4. GUARDA ANTI-CRASH & FRAME-BUSTER
  const antiCrashGuard = `
    <!-- Guarda Anti-Crash & Preservação de DOM -->
    <script>
      window.onerror = function() { return true; };
      try {
        Object.defineProperty(window, 'top', { get: function() { return window; } });
        Object.defineProperty(window, 'parent', { get: function() { return window; } });
      } catch(e){}
    </script>
  `;
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${antiCrashGuard}`);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head[^>]*>/i, `$&${antiCrashGuard}`);
  } else {
    html = antiCrashGuard + html;
  }

  // 5. DETECTAR CHECKOUTS ORIGINAIS
  const detectedCheckouts = new Set();
  CHECKOUT_PATTERNS.forEach(regex => {
    let match;
    const regexClone = new RegExp(regex.source, regex.flags);
    while ((match = regexClone.exec(rawHtml)) !== null) {
      if (match[1] && !match[1].includes('whatsapp') && !match[1].includes('facebook')) {
        detectedCheckouts.add(match[1]);
      }
    }
  });

  // 6. SUBSTITUIÇÃO DOS LINKS DE CHECKOUT
  if (newCheckout && newCheckout.trim()) {
    const cleanNewCheckout = newCheckout.trim();

    if (originalCheckout && originalCheckout.trim()) {
      const origRegex = new RegExp(originalCheckout.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      html = html.replace(origRegex, cleanNewCheckout);
    } else {
      detectedCheckouts.forEach(orig => {
        const origRegex = new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        html = html.replace(origRegex, cleanNewCheckout);
      });
      html = html.replace(/href=["']https?:\/\/(?:pay|checkout)\.[^"']+["']/gi, `href="${cleanNewCheckout}"`);
      html = html.replace(/href=["']https?:\/\/kiwify\.app\/[^"']+["']/gi, `href="${cleanNewCheckout}"`);
    }
  }

  // 7. REMOÇÃO DE RASTREADORES DO PRODUTOR ORIGINAL
  if (removeOriginalPixels !== false) {
    html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?(?:connect\.facebook\.net|fbevents\.js|fbq\(|googletagmanager|google-analytics|clarity\.ms|hotjar|analytics\.tiktok\.com|ttq)[\s\S]*?<\/script>/gi, '<!-- [Tracker original removido pelo Clonador] -->');
    html = html.replace(/<noscript[^>]*>(?:(?!<\/noscript>)[\s\S])*?(?:facebook\.com\/tr|googletagmanager)[\s\S]*?<\/noscript>/gi, '');
  }

  // 8. LIMPEZA DE RESÍDUOS DO EDITOR DE PÁGINAS (CMS)
  html = html.replace(/<input[^>]*type=["']file["'][^>]*>/gi, '');

  // 9. AJUSTE E OTIMIZAÇÃO DE VÍDEOS (AUTOPLAY, MUTED, CONTROLS E POSTER)
  html = html.replace(/<video([^>]*)>/gi, (match, attrs) => {
    let updated = match;
    if (!updated.includes('muted')) {
      updated = updated.replace('<video', '<video muted');
    }
    if (!updated.includes('playsinline')) {
      updated = updated.replace('<video', '<video playsinline webkit-playsinline');
    }
    if (!updated.includes('poster=')) {
      updated = updated.replace('<video', '<video poster="/video-poster.jpg"');
    }
    return updated;
  });

  // =========================================================================
  // SUÍTE DE RASTREAMENTO PROFISSIONAL: INJEÇÃO DOS NOVOS PIXELS E SCRIPTS
  // =========================================================================
  let headInjections = '';
  let bodyInjections = '';

  // A. GOOGLE TAG MANAGER (GTM)
  if (gtmId && gtmId.trim()) {
    const cleanGtm = gtmId.trim();
    headInjections += `
      <!-- Google Tag Manager -->
      <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${cleanGtm}');</script>
      <!-- End Google Tag Manager -->
    `;
    bodyInjections += `
      <!-- Google Tag Manager (noscript) -->
      <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${cleanGtm}"
      height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
      <!-- End Google Tag Manager (noscript) -->
    `;
  }

  // B. GOOGLE ANALYTICS 4 (GA4) & GOOGLE ADS (GTAG.JS)
  const hasGtag = (ga4Id && ga4Id.trim()) || (googleAdsId && googleAdsId.trim());
  if (hasGtag) {
    const primaryId = (ga4Id && ga4Id.trim()) || (googleAdsId && googleAdsId.trim());
    headInjections += `
      <!-- Google tag (gtag.js) GA4 / Google Ads -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=${primaryId}"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        ${ga4Id && ga4Id.trim() ? `gtag('config', '${ga4Id.trim()}');` : ''}
        ${googleAdsId && googleAdsId.trim() ? `gtag('config', '${googleAdsId.trim()}');` : ''}
        ${googleAdsLabel && googleAdsLabel.trim() && googleAdsId ? `
          // Evento de Conversão Google Ads
          window.trackGoogleAdsConversion = function() {
            gtag('event', 'conversion', {'send_to': '${googleAdsId.trim()}/${googleAdsLabel.trim()}'});
          };
        ` : ''}
      </script>
    `;
  }

  // C. META (FACEBOOK) PIXEL & CAPI
  if (pixelMeta && pixelMeta.trim()) {
    const cleanPixel = pixelMeta.trim();
    headInjections += `
      <!-- Meta Pixel Code -->
      <script>
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${cleanPixel}'${testCode ? `, { test_event_code: '${testCode.trim()}' }` : ''});
        fbq('track', 'PageView');
        ${metaCapiToken ? `console.log('[Meta CAPI] Token configurado para envio server-side.');` : ''}
      </script>
      <noscript><img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${cleanPixel}&ev=PageView&noscript=1"/></noscript>
      <!-- End Meta Pixel Code -->
    `;

    // Disparo em background da API de Conversões do Meta se token estiver presente
    if (metaCapiToken && metaCapiToken.trim()) {
      dispatchMetaCapi(cleanPixel, metaCapiToken.trim(), testCode);
    }
  }

  // D. TIKTOK PIXEL & EVENTS API
  if (tiktokPixel && tiktokPixel.trim()) {
    const cleanTt = tiktokPixel.trim();
    headInjections += `
      <!-- TikTok Pixel Code -->
      <script>
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?type=module&pkg="+o;o=document.getElementsByTagName("script")[0];o.parentNode.insertBefore(n,o)};
          ttq.load('${cleanTt}');
          ttq.page();
        }(window, document, 'ttq');
      </script>
      <!-- End TikTok Pixel Code -->
    `;
  }

  // E. UTMFY & MOTOR DE PRESERVAÇÃO DE PARÂMETROS UTM (CRUCIAL PARA AFILIADOS)
  if (enableUtmForwarder !== false) {
    headInjections += `
      <!-- UTMFY & Repassador Dinâmico de Parâmetros UTM nos Checkouts -->
      <script>
        (function() {
          function repassarUtms() {
            var search = window.location.search;
            if (!search || search.length < 2) return;
            var currentParams = new URLSearchParams(search);
            
            // Procura todos os botões de checkout (Kiwify, Hotmart, Eduzz, etc)
            var links = document.querySelectorAll('a[href*="kiwify"], a[href*="hotmart"], a[href*="eduzz"], a[href*="monetizze"], a[href*="perfectpay"], a[href*="braip"], a[href*="pay."], a[href*="checkout."]');
            links.forEach(function(link) {
              try {
                var url = new URL(link.href, window.location.href);
                currentParams.forEach(function(value, key) {
                  url.searchParams.set(key, value);
                });
                link.href = url.toString();
              } catch(e){}
            });
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', repassarUtms);
          } else {
            repassarUtms();
          }
          // Garante repasse mesmo após hidratação de componentes dinâmicos
          setTimeout(repassarUtms, 1000);
          setTimeout(repassarUtms, 2500);
        })();
      </script>
    `;
  }

  // Script customizado do UTMFY se o usuário colou o snippet ou URL
  if (utmfyScript && utmfyScript.trim()) {
    let cleanUtm = utmfyScript.trim();
    if (!cleanUtm.startsWith('<script')) {
      cleanUtm = `<script src="${cleanUtm}" async defer></script>`;
    }
    headInjections += `\n<!-- UTMFY Script Oficial -->\n${cleanUtm}\n`;
  }

  // F. BOTÃO FLUTUANTE DE WHATSAPP
  if (whatsappNumber && whatsappNumber.trim()) {
    const cleanPhone = whatsappNumber.replace(/\D/g, '');
    bodyInjections += `
      <!-- Botão WhatsApp Flutuante -->
      <div id="wa-floating-btn" style="position:fixed;bottom:24px;right:24px;z-index:9999999;">
        <a href="https://wa.me/${cleanPhone}?text=Ol%C3%A1,%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20produto" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background-color:#25d366;border-radius:50%;box-shadow:0 6px 20px rgba(0,0,0,0.3);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
          <svg style="width:34px;height:34px;fill:#fff;" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824z"/></svg>
        </a>
      </div>
    `;
  }

  // G. SCRIPT ANTI-FUGA (BACK-REDIRECT)
  if (backRedirectUrl && backRedirectUrl.trim()) {
    bodyInjections += `
      <!-- Script Anti-Fuga (Back Redirect) -->
      <script>
        (function() {
          var redirectUrl = '${backRedirectUrl.trim()}';
          history.pushState(null, document.title, location.href);
          window.addEventListener('popstate', function() {
            location.replace(redirectUrl);
          });
        })();
      </script>
    `;
  }

  // H. ESTILOS DE LAYOUT RESPONSIVO, VÍDEO VERTICAL E PREVENÇÃO DE OVERFLOW
  headInjections += `
    <!-- Fix de Layout Responsivo & Player de Vídeo Vertical -->
    <style id="cloner-responsive-video-fix">
      /* 1. Previne scrollbar horizontal e distorção em smartphones e monitores */
      html, body {
        overflow-x: hidden !important;
        max-width: 100vw !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      *, *::before, *::after {
        box-sizing: border-box !important;
      }

      /* 2. Oculta quaisquer inputs residuais de CMS */
      input[type="file"], .hidden {
        display: none !important;
      }

      /* 3. Título antes do vídeo: alinhamento central com respiro */
      #blk-5cwn7tvw {
        width: 100% !important;
        max-width: 860px !important;
        margin: 0 auto !important;
        padding: 32px 20px 12px !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }

      /* 4. Container de Vídeo: centralizado e sem esticar a página */
      #blk-hf7eu834,
      div[id^="blk-"]:has(video),
      .video-block-container {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        padding: 10px 16px 40px !important;
        box-sizing: border-box !important;
        background: #000 !important;
      }

      /* 5. Player de Vídeo Vertical (9:16 / Reels / TikTok) perfeitamente enquadrado */
      #blk-hf7eu834 video,
      div[id^="blk-"] video,
      video.w-full {
        width: 100% !important;
        max-width: 440px !important;
        aspect-ratio: 9/16 !important;
        height: auto !important;
        max-height: 82vh !important;
        object-fit: cover !important;
        border-radius: 24px !important;
        margin: 0 auto !important;
        display: block !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(226, 127, 255, 0.25) !important;
        border: 2px solid rgba(255, 255, 255, 0.1) !important;
        background-color: #000 !important;
      }

      /* Responsividade mobile para smartphones */
      @media (max-width: 640px) {
        #blk-hf7eu834,
        div[id^="blk-"]:has(video) {
          padding: 8px 12px 30px !important;
        }
        #blk-hf7eu834 video,
        div[id^="blk-"] video,
        video.w-full {
          max-width: 100% !important;
          border-radius: 18px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(226, 127, 255, 0.2) !important;
        }
      }
    </style>
    <script>
      (function() {
        function setupVideos() {
          var vids = document.querySelectorAll('video');
          vids.forEach(function(v) {
            v.muted = true;
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.autoplay = true;
            var p = v.play();
            if (p !== undefined) {
              p.catch(function() {
                var playOnUserGesture = function() {
                  v.play();
                  document.removeEventListener('click', playOnUserGesture);
                  document.removeEventListener('touchstart', playOnUserGesture);
                };
                document.addEventListener('click', playOnUserGesture, { once: true });
                document.addEventListener('touchstart', playOnUserGesture, { once: true });
              });
            }
          });
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', setupVideos);
        } else {
          setupVideos();
        }
      })();
    </script>
  `;

  // APLICAR AS INJEÇÕES NO HTML
  if (headInjections) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${headInjections}</head>`);
    } else {
      html = headInjections + html;
    }
  }

  if (bodyInjections) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${bodyInjections}</body>`);
    } else {
      html += bodyInjections;
    }
  }

  return {
    processedHtml: html,
    detectedCheckouts: Array.from(detectedCheckouts)
  };
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const reqPath = reqUrl.pathname;

  // 1. ENDPOINT DE PREVIEW DIRETO
  if (reqPath === '/preview-clonada') {
    if (!lastClonedHtml) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#090b0e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><p style="color:#ff8a00;font-weight:bold;">Nenhuma página clonada ativa no momento.</p><p style="color:#888;font-size:13px;">Volte ao Clonador e clique em "Clonar e Substituir Links Agora".</p></div></body></html>`);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(lastClonedHtml);
    return;
  }

  // 2. API DE CLONAGEM: POST /api/clonar
  if (req.method === 'POST' && reqPath === '/api/clonar') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { targetUrl, rawHtml } = payload;

        let contentToProcess = rawHtml;

        if (!contentToProcess && targetUrl) {
          console.log(`[Clonador] Processando URL: ${targetUrl}`);
          let fetchSuccess = false;

          const isKnownSpa = targetUrl.includes('preview-socios') || targetUrl.includes('fabricadelowtickets') || targetUrl.includes('socio10k');

          if (!isKnownSpa) {
            try {
              const response = await fetch(targetUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
                }
              });

              if (response.ok) {
                const text = await response.text();
                if (text && text.length > 5000 && !text.includes('<div id="root"></div>') && !text.includes('<div id="app"></div>')) {
                  contentToProcess = text;
                  fetchSuccess = true;
                  console.log(`[Clonador] Fetch HTTP estático bem-sucedido (${text.length} bytes)`);
                }
              }
            } catch (e) {
              console.warn('[Clonador] Fetch HTTP padrão falhou, usando Chrome Headless...');
            }
          }

          if (!fetchSuccess) {
            console.log(`[Clonador] Executando Chrome Headless com espera assíncrona...`);
            try {
              contentToProcess = await fetchWithHeadlessChrome(targetUrl);
              console.log(`[Clonador] Chrome Headless obteve DOM completo (${contentToProcess.length} bytes)`);
            } catch (chromeErr) {
              console.error('[Clonador] Erro no Chrome Headless:', chromeErr.message);
              if (!contentToProcess) {
                throw new Error(`Não foi possível renderizar a URL: ${chromeErr.message}`);
              }
            }
          }
        }

        if (!contentToProcess) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Nenhum conteúdo recebido da página alvo.' }));
          return;
        }

        const result = processClonedHtml(contentToProcess, targetUrl || 'https://exemplo.com', payload);

        lastClonedHtml = result.processedHtml;
        try {
          const parsed = new URL(targetUrl);
          lastTargetBaseUrl = `${parsed.protocol}//${parsed.host}`;
        } catch (e) {
          lastTargetBaseUrl = null;
        }

        res.writeHead(200, { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: true,
          processedHtml: result.processedHtml,
          detectedCheckouts: result.detectedCheckouts,
          previewUrl: `/preview-clonada?t=${Date.now()}`
        }));

      } catch (err) {
        console.error('[Clonador] Erro fatal:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message || 'Erro ao clonar' }));
      }
    });
    return;
  }

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // 3. ARQUIVOS ESTÁTICOS
  let sanitizedPath = reqPath;
  if (sanitizedPath === '/' || sanitizedPath === '') {
    sanitizedPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, sanitizedPath);

  fs.stat(filePath, async (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 4. REVERSE PROXY DE ASSETS REMOTOS
    if (lastTargetBaseUrl) {
      try {
        const remoteAssetUrl = `${lastTargetBaseUrl}${reqPath}`;
        const proxyResp = await fetch(remoteAssetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': lastTargetBaseUrl
          }
        });

        if (proxyResp.ok) {
          const contentType = proxyResp.headers.get('content-type') || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          const arrayBuffer = await proxyResp.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
          return;
        }
      } catch (proxyErr) {}
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Não Encontrado');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor com Suíte de Rastreamento (Meta, TikTok, GA4, GTM, Ads, UTMFY) ativo!`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`👉 http://127.0.0.1:${PORT}`);
  console.log(`==================================================\n`);
});
