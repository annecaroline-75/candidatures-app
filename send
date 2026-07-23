const nodemailer = require("nodemailer");

module.exports = async function (req, res) {
  // Autorise l'app a appeler ce serveur
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Methode non autorisee" });
  }

  try {
    const { to, fromName, subject, text, attachments } = req.body || {};

    if (!to || !subject || !text) {
      return res.status(400).json({ error: "Champs manquants (to, subject, text)" });
    }

    const utilisateur = process.env.GMAIL_USER;
    const motDePasse = process.env.GMAIL_APP_PASSWORD;

    if (!utilisateur || !motDePasse) {
      return res.status(500).json({
        error: "Variables d'environnement absentes. Verifie GMAIL_USER et GMAIL_APP_PASSWORD dans Vercel."
      });
    }

    const transporteur = nodemailer.createTransport({
      service: "gmail",
      auth: { user: utilisateur, pass: motDePasse }
    });

    const piecesJointes = (attachments || []).map(function (p) {
      return {
        filename: p.filename,
        content: p.content,
        encoding: "base64"
      };
    });

    await transporteur.sendMail({
      from: '"' + (fromName || utilisateur) + '" <' + utilisateur + '>',
      to: to,
      replyTo: utilisateur,
      subject: subject,
      text: text,
      attachments: piecesJointes
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
