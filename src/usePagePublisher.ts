import { useState, useCallback } from 'react';
import { ConfiguracaoPublicacao } from './types';

/**
 * Hook que gerencia a injeção dinâmica de parâmetros na página de vendas:
 * 1. Substituição de links nos botões de CTA pelo checkout do afiliado/sócio.
 * 2. Injeção de snippets de rastreamento (Meta Pixel, CAPI, TikTok, GA4).
 * 3. Validação pré-publicação.
 */
export function usePagePublisher(produtoId: string, initialConfig?: Partial<ConfiguracaoPublicacao>) {
  const [config, setConfig] = useState<ConfiguracaoPublicacao>({
    produtoId,
    checkoutUrl: initialConfig?.checkoutUrl || '',
    pixelMeta: initialConfig?.pixelMeta || '',
    capiToken: initialConfig?.capiToken || '',
    testCode: initialConfig?.testCode || '',
    tiktokPixel: initialConfig?.tiktokPixel || '',
    ga4Id: initialConfig?.ga4Id || '',
    customDomain: initialConfig?.customDomain || '',
    statusDns: initialConfig?.statusDns || 'pendente',
    publicado: initialConfig?.publicado || false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Atualizar campo específico
  const updateField = useCallback((field: keyof ConfiguracaoPublicacao, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // Simular verificação de DNS
  const verifyDns = useCallback(async (domain: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulação de chamada CNAME na bridge
      await new Promise(r => setTimeout(r, 800));
      setConfig(prev => ({ ...prev, customDomain: domain, statusDns: 'conectado' }));
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Falha ao verificar DNS');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Publicar página no ar
  const publishPage = useCallback(async () => {
    if (!config.checkoutUrl || !config.checkoutUrl.startsWith('http')) {
      throw new Error('Link de checkout inválido ou vazio. Preencha antes de publicar.');
    }

    setIsLoading(true);
    try {
      // Simulação do payload enviado para a Edge Function 'fabrica-ponte'
      const payload = {
        acao: 'salvar_e_publicar',
        produto_id: produtoId,
        checkout_url: config.checkoutUrl.trim(),
        pixels: {
          meta: config.pixelMeta,
          capi_token: config.capiToken,
          test_event_code: config.testCode,
          tiktok: config.tiktokPixel,
          ga4: config.ga4Id
        },
        domain: config.customDomain
      };

      console.log('Publicando payload na infraestrutura:', payload);
      await new Promise(r => setTimeout(r, 1000));
      setConfig(prev => ({ ...prev, publicado: true }));
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [config, produtoId]);

  /**
   * Gera o script de injeção injetado dinamicamente no iframe / template headless
   */
  const generateInjectedHtml = useCallback((rawHtml: string) => {
    let output = rawHtml;

    // 1. Substituição dos CTAs com o link do checkout do sócio
    if (config.checkoutUrl) {
      output = output.replace(/href=["']https?:\/\/pay\.[^"']+["']/gi, `href="${config.checkoutUrl}"`);
    }

    // 2. Injeção do Pixel do Facebook se presente
    if (config.pixelMeta) {
      const metaSnippet = `
        <script>
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${config.pixelMeta}'${config.testCode ? `, { test_event_code: '${config.testCode}' }` : ''});
          fbq('track', 'PageView');
        </script>
      `;
      output = output.replace('</head>', `${metaSnippet}</head>`);
    }

    return output;
  }, [config]);

  return {
    config,
    isLoading,
    error,
    updateField,
    verifyDns,
    publishPage,
    generateInjectedHtml
  };
}
