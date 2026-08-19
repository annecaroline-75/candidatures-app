export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Simple health check
    return res.status(200).json({
      success: true,
      message: 'API is working'
    });
  }

  if (req.method === 'POST') {
    // Les données sont stockées en localStorage côté client
    // Cette fonction est juste un placeholder pour la synchro éventuelle
    return res.status(200).json({
      success: true,
      message: 'Sync endpoint ready'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
