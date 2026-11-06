// Vercel Serverless Function para servir o preview da página clonada
const snapshotData = require('./snapshotData');

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

  // Sempre retorna a página pré-renderizada ou a última clonada (NUNCA tela branca)
  const htmlToServe = cachedPreviewHtml || snapshotData;
  return res.status(200).send(htmlToServe);
};
