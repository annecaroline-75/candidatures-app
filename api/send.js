import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ce que l'application envoie reellement
  const { to, cc, bcc, fromName, subject, text, attachments } = req.body || {};

  // Le mot de passe peut s'appeler GMAIL_PASSWORD ou GMAIL_APP_PASSWORD
  const motDePasse = process.env.GMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (!process.env.GMAIL_USER || !motDePasse) {
    return res.status(500).json({
      error: 'Configuration manquante sur le serveur (GMAIL_USER ou GMAIL_PASSWORD)'
    });
  }

  if (!to) {
    return res.status(400).json({ error: 'Adresse du destinataire manquante' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: motDePasse
      }
    });

    // Les pieces jointes arrivent en base64 : on le precise a Nodemailer
    const piecesJointes = Array.isArray(attachments)
      ? attachments
          .filter(function (p) { return p && p.filename && p.content; })
          .map(function (p) {
            return {
              filename: p.filename,
              content: p.content,
              encoding: 'base64'
            };
          })
      : [];

    const message = {
      from: fromName
        ? '"' + fromName + '" <' + process.env.GMAIL_USER + '>'
        : process.env.GMAIL_USER,
      to: to,
      subject: subject || 'Candidature',
      text: text || ''
    };

    if (cc && cc.length > 0) message.cc = cc;
    if (bcc && bcc.length > 0) message.bcc = bcc;
    if (piecesJointes.length > 0) message.attachments = piecesJointes;

    const envoi = await transporter.sendMail(message);

    return res.status(200).json({
      success: true,
      messageId: envoi.messageId
    });

  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error);
    return res.status(500).json({
      error: "Erreur lors de l'envoi de l'email",
      details: error.message
    });
  }
}
