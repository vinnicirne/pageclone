// Vercel Serverless Function: Marketplace de Produtos do PageClone
const fs = require('fs');
const path = require('path');

let memoryMarketplace = null;

function loadMarketplace() {
  if (memoryMarketplace) return memoryMarketplace;
  try {
    const filePath = path.join(__dirname, '..', 'marketplace.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      memoryMarketplace = JSON.parse(data);
      return memoryMarketplace;
    }
  } catch (e) {}

  // Fallback padrão se arquivo não existir
  memoryMarketplace = [
    {
      id: "papelaria-lucrativa",
      name: "Papelaria Lucrativa - Caixa Cartonada do Zero",
      category: "Artesanato & DIY",
      price: 37.00,
      commission: 26.00,
      commissionPercentage: 80,
      image: "/video-poster.jpg",
      salesPageUrl: "/preview-clonada",
      originalTargetUrl: "https://fabricadelowtickets.com/preview-socios/44549046-fbd7-470a-8b63-9235b2abd21f",
      creativeDriveUrl: "https://drive.google.com/drive/folders/papelaria-lucrativa-criativos-alta-conversao",
      creatives: [
        {
          type: "video",
          title: "Vídeo Vertical (9:16) - Rotina de Produção da Caixa",
          format: "MOV 1080x1920 (Reels / TikTok)",
          duration: "0:45",
          url: "https://pub-c6ca488ff00c4ec18c028473dea48196.r2.dev/page-media/1790034751024-c713d5ed.mov"
        },
        {
          type: "image",
          title: "Mockup 3D do Mini App & Kit de Ferramentas",
          format: "PNG Transparente 1200x1200",
          url: "/video-poster.jpg"
        },
        {
          type: "copy",
          title: "Copies Validadas para Feed & Stories",
          format: "Texto / PDF com 12 Ângulos de Anúncios",
          url: "https://drive.google.com"
        }
      ],
      webhook: {
        endpoint: "/api/webhook?produto=papelaria-lucrativa",
        platforms: ["Kiwify", "Hotmart", "Eduzz", "Braip", "Monetizze", "PerfectPay"],
        token: "pc_sec_papelaria_872391",
        events: ["order_approved", "pix_generated", "billet_printed", "refund"]
      },
      checkoutUrl: "https://pay.kiwify.com.br/meu-checkout-afiliado-10k",
      description: "Aprenda a montar sua papelaria em casa e fature até R$ 3.000,00 sem sair de casa com produção rápida de caixas cartonadas.",
      publishedAt: new Date().toISOString()
    }
  ];
  return memoryMarketplace;
}

function saveMarketplace(list) {
  memoryMarketplace = list;
  try {
    const filePath = path.join(__dirname, '..', 'marketplace.json');
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const items = loadMarketplace();

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, products: items });
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!payload.name) {
        return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
      }

      const id = payload.id || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prod-${Date.now()}`;
      
      const newProduct = {
        id,
        name: payload.name,
        category: payload.category || 'Geral',
        price: parseFloat(payload.price) || 0,
        commission: parseFloat(payload.commission) || 0,
        commissionPercentage: payload.commissionPercentage || 70,
        image: payload.image || '/video-poster.jpg',
        salesPageUrl: payload.salesPageUrl || '/preview-clonada',
        originalTargetUrl: payload.originalTargetUrl || '',
        creativeDriveUrl: payload.creativeDriveUrl || 'https://drive.google.com',
        creatives: payload.creatives || [
          {
            type: "video",
            title: "Criativo Principal (Reels / TikTok 9:16)",
            format: "Vídeo Vertical HD",
            url: "/video-poster.jpg"
          },
          {
            type: "copy",
            title: "Copies Prontas de Alta Conversão",
            format: "Texto / Roteiro",
            url: payload.creativeDriveUrl || "https://drive.google.com"
          }
        ],
        webhook: {
          endpoint: `/api/webhook?produto=${id}`,
          platforms: payload.webhookPlatforms || ["Kiwify", "Hotmart", "Eduzz", "Braip"],
          token: `pc_sec_${Math.random().toString(36).substring(2, 10)}`,
          events: ["order_approved", "pix_generated", "refund"]
        },
        checkoutUrl: payload.checkoutUrl || '',
        description: payload.description || 'Página de vendas clonada e otimizada pronta para rodar tráfego com Webhook e Pixels ativos.',
        publishedAt: new Date().toISOString()
      };

      // Substitui se já existir ou adiciona no início
      const existingIdx = items.findIndex(p => p.id === id);
      if (existingIdx !== -1) {
        items[existingIdx] = { ...items[existingIdx], ...newProduct };
      } else {
        items.unshift(newProduct);
      }

      saveMarketplace(items);
      return res.status(200).json({ success: true, product: newProduct });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const id = url.searchParams.get('id');
      if (!id) return res.status(400).json({ error: 'ID não informado.' });
      const updated = items.filter(p => p.id !== id);
      saveMarketplace(updated);
      return res.status(200).json({ success: true, remaining: updated.length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
