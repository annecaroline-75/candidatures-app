import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email,
    entreprise,
    poste,
    dateCandidat,
    nomContact,
    lien,
    statut,
    notes
  } = req.body;

  try {
    // Vérifier que les variables d'environnement existent
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD || !process.env.RECIPIENT_EMAIL) {
      return res.status(500).json({
        error: 'Configuration manquante sur le serveur'
      });
    }

    // Créer le transporter Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
      }
    });

    // Construire le contenu de l'email
    const emailContent = `
Nouvelle candidature enregistrée

Entreprise: ${entreprise}
Poste: ${poste}
Date de candidature: ${dateCandidat}
Email de contact: ${email}
Nom du contact: ${nomContact || 'Non spécifié'}
Lien: ${lien || 'Non fourni'}
Statut: ${statut}

Notes:
${notes || 'Aucune note'}
    `.trim();

    // Envoyer l'email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.RECIPIENT_EMAIL,
      subject: `Candidature - ${poste} chez ${entreprise}`,
      text: emailContent
    });

    return res.status(200).json({
      success: true,
      message: 'Email envoyé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    });
  }
}
