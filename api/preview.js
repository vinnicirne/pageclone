// Vercel Serverless Function para servir o preview da página clonada
const fs = require('fs');
const path = require('path');

let cachedPreviewHtml = null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = JSON.parse(body || '{}');
        cachedPreviewHtml = json.html;
        return res.status(200).json({ success: true });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    });
    return;
  }

  if (!cachedPreviewHtml) {
    try {
      const snapPath = path.join(__dirname, '..', 'snapshot-fabrica.html');
      if (fs.existsSync(snapPath)) {
        cachedPreviewHtml = fs.readFileSync(snapPath, 'utf8');
      }
    } catch(e) {}
  }

  if (!cachedPreviewHtml) {
    return res.status(200).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#090b0e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><p style="color:#ff8a00;font-weight:bold;">Nenhuma prévia ativa no momento.</p><p style="color:#888;font-size:13px;">Volte ao Clonador e processe a página desejada.</p></div></body></html>`);
  }

  return res.status(200).send(cachedPreviewHtml);
};
