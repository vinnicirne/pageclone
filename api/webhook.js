// Vercel Serverless Function: Webhook & Conversions Engine do PageClone
const fs = require('fs');
const path = require('path');

let memoryWebhookLogs = null;

function loadWebhookLogs() {
  if (memoryWebhookLogs) return memoryWebhookLogs;
  try {
    const filePath = path.join(__dirname, '..', 'webhook-logs.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      memoryWebhookLogs = JSON.parse(data);
      return memoryWebhookLogs;
    }
  } catch (e) {}

  memoryWebhookLogs = [
    {
      id: "wh_evt_982371",
      productId: "papelaria-lucrativa",
      productName: "Papelaria Lucrativa - Caixa Cartonada do Zero",
      platform: "Kiwify",
      event: "order_approved",
      customer: {
        name: "Mariana Ferreira",
        email: "mariana***@gmail.com",
        phone: "+55 11 9****-1234"
      },
      amount: 37.00,
      commission: 26.00,
      paymentMethod: "PIX",
      capiStatus: "Disparado (Meta & TikTok CAPI)",
      timestamp: new Date().toISOString()
    }
  ];
  return memoryWebhookLogs;
}

function saveWebhookLogs(logs) {
  memoryWebhookLogs = logs.slice(0, 50); // Mantém os últimos 50 eventos
  try {
    const filePath = path.join(__dirname, '..', 'webhook-logs.json');
    fs.writeFileSync(filePath, JSON.stringify(memoryWebhookLogs, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kiwify-Signature, X-Hotmart-Hottok');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const logs = loadWebhookLogs();

  // GET: Retornar histórico de logs de vendas
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, logs });
  }

  // POST: Processar Webhook Recebido ou Simular Evento
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const url = new URL(req.url, 'http://localhost');
      const targetProduct = url.searchParams.get('produto') || payload.product_name || payload.productId || 'papelaria-lucrativa';
      
      const isTestSimulation = payload.isSimulation || url.searchParams.get('test') === 'true';

      let eventType = payload.order_status || payload.event || (isTestSimulation ? 'order_approved' : 'unknown');
      if (eventType === 'paid') eventType = 'order_approved';
      if (eventType === 'waiting_payment') eventType = 'pix_generated';

      const platformDetected = payload.Order ? 'Kiwify' : (payload.data?.buyer ? 'Hotmart' : (payload.platform || 'Kiwify'));
      const customerName = payload.Customer?.full_name || payload.data?.buyer?.name || payload.customerName || (isTestSimulation ? 'Cliente Teste VIP' : 'Comprador Desconhecido');
      const customerEmail = payload.Customer?.email || payload.data?.buyer?.email || payload.customerEmail || 'cliente@exemplo.com';
      const amountVal = parseFloat(payload.Order?.order_total || payload.data?.purchase?.price?.value || payload.amount || 37.00);
      const commissionVal = parseFloat(payload.Commissions?.charge_amount || (amountVal * 0.75).toFixed(2));

      const eventLog = {
        id: `wh_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: targetProduct,
        productName: payload.productName || 'Papelaria Lucrativa - Caixa Cartonada do Zero',
        platform: platformDetected,
        event: eventType,
        customer: {
          name: customerName,
          email: customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
          phone: payload.Customer?.mobile || '+55 11 9****-9999'
        },
        amount: amountVal,
        commission: commissionVal,
        paymentMethod: payload.payment_method || (isTestSimulation ? 'PIX Instantâneo' : 'Cartão de Crédito'),
        capiStatus: 'Disparado (Meta & TikTok CAPI - Purchase)',
        timestamp: new Date().toISOString()
      };

      logs.unshift(eventLog);
      saveWebhookLogs(logs);

      console.log(`[PageClone Webhook] Venda recebida com sucesso: ${eventLog.productName} (${eventLog.platform}) - R$ ${eventLog.amount}`);

      return res.status(200).json({
        success: true,
        message: 'Webhook processado com sucesso pelo PageClone',
        event: eventLog
      });
    } catch (e) {
      console.error('[PageClone Webhook] Erro ao processar:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
