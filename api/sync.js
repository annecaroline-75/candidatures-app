// api/sync.js
// Pont entre l'app et la base de donnees Supabase.
// Les cles restent cote serveur : elles ne passent jamais par le navigateur.

const URL_BASE = process.env.SUPABASE_URL;
const CLE = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!URL_BASE || !CLE) {
    return res.status(500).json({
      erreur: "Base de donnees non configuree. Verifie SUPABASE_URL et SUPABASE_SECRET_KEY dans Vercel."
    });
  }

  const enTetes = {
    "apikey": CLE,
    "Authorization": "Bearer " + CLE,
    "Content-Type": "application/json"
  };

  try {
    // ---------- LECTURE ----------
    if (req.method === "GET") {
      const code = String(req.query.code || "").trim();
      if (!code) return res.status(400).json({ erreur: "Code manquant." });

      const r = await fetch(
        URL_BASE + "/rest/v1/donnees?cle=eq." + encodeURIComponent(code) + "&select=contenu,maj",
        { headers: enTetes }
      );

      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ erreur: "Lecture impossible : " + t });
      }

      const lignes = await r.json();
      if (!lignes.length) return res.status(200).json({ vide: true });

      return res.status(200).json({
        vide: false,
        contenu: lignes[0].contenu,
        maj: lignes[0].maj
      });
    }

    // ---------- ECRITURE ----------
    if (req.method === "POST") {
      const corps = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const code = String(corps.code || "").trim();
      const contenu = corps.contenu;

      if (!code) return res.status(400).json({ erreur: "Code manquant." });
      if (!contenu || typeof contenu !== "object") {
        return res.status(400).json({ erreur: "Contenu invalide." });
      }

      const r = await fetch(URL_BASE + "/rest/v1/donnees", {
        method: "POST",
        headers: Object.assign({}, enTetes, {
          "Prefer": "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify([{
          cle: code,
          contenu: contenu,
          maj: new Date().toISOString()
        }])
      });

      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ erreur: "Sauvegarde impossible : " + t });
      }

      const lignes = await r.json();
      return res.status(200).json({
        ok: true,
        maj: (lignes[0] && lignes[0].maj) || new Date().toISOString()
      });
    }

    return res.status(405).json({ erreur: "Methode non autorisee." });

  } catch (err) {
    return res.status(500).json({ erreur: String(err && err.message ? err.message : err) });
  }
};
