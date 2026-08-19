// =========================================================
//  SYNCHRONISATION ENTRE APPAREILS
//  Stocke le paquet de donnees de l'app dans une table Supabase,
//  identifie par le code personnel choisi dans les Reglages.
//
//  Variables d'environnement attendues sur Vercel :
//    SUPABASE_URL  -> https://xxxxxxxx.supabase.co
//    SUPABASE_KEY  -> la cle "service_role" du projet Supabase
// =========================================================

// On accepte plusieurs noms possibles pour eviter les mauvaises surprises
function lireConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    "";

  const cle =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  return { url: url.replace(/\/+$/, ""), cle };
}

const TABLE = "sync";

export default async function handler(req, res) {
  const { url, cle } = lireConfig();

  // --- Verification de la configuration ---------------------------------
  if (!url || !cle) {
    return res.status(500).json({
      erreur:
        "Configuration manquante sur Vercel. Ajoute les variables " +
        "SUPABASE_URL et SUPABASE_KEY, puis redeploie."
    });
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return res.status(500).json({
      erreur:
        "SUPABASE_URL ne ressemble pas a une adresse Supabase. " +
        "Attendu : https://xxxxxxxx.supabase.co"
    });
  }
  const verdict = examinerCle(cle);
  if (verdict.bloquant) {
    return res.status(500).json({ erreur: verdict.message });
  }

  const enTetes = {
    apikey: cle,
    Authorization: "Bearer " + cle,
    "Content-Type": "application/json"
  };

  // --- Mode diagnostic : /api/sync?diag=1 -------------------------------
  // Affiche un bilan en clair, sans jamais devoiler la cle.
  if (req.method === "GET" && req.query && req.query.diag) {
    const bilan = {
      adresse_supabase: url,
      type_de_cle: verdict.type,
      cle_verdict: verdict.message
    };
    try {
      const test = await fetch(
        url + "/rest/v1/" + TABLE + "?select=code&limit=1",
        { headers: enTetes }
      );
      if (test.ok) {
        bilan.table_sync = "OK, la table existe et la cle fonctionne";
        bilan.resultat = "TOUT EST BON";
      } else {
        const detail = await test.text();
        bilan.table_sync = messageSupabase(test.status, detail);
        bilan.resultat = "A CORRIGER";
      }
    } catch (err) {
      bilan.table_sync = "Impossible de joindre Supabase : " +
        (err && err.message ? err.message : String(err));
      bilan.resultat = "A CORRIGER";
    }
    return res.status(200).json(bilan);
  }

  try {
    // --- LECTURE : l'appareil demande la derniere version en ligne ------
    if (req.method === "GET") {
      const code = (req.query.code || "").toString().trim();
      if (!code) return res.status(400).json({ erreur: "Code manquant." });

      const reponse = await fetch(
        url + "/rest/v1/" + TABLE +
          "?code=eq." + encodeURIComponent(code) +
          "&select=contenu,maj",
        { headers: enTetes }
      );

      if (!reponse.ok) {
        const detail = await reponse.text();
        return res.status(500).json({
          erreur: messageSupabase(reponse.status, detail)
        });
      }

      const lignes = await reponse.json();
      if (!Array.isArray(lignes) || lignes.length === 0) {
        // Aucun enregistrement pour ce code : c'est le premier appareil
        return res.status(200).json({ vide: true });
      }

      return res.status(200).json({
        contenu: lignes[0].contenu || {},
        maj: lignes[0].maj || null
      });
    }

    // --- ECRITURE : l'appareil envoie ses donnees -----------------------
    if (req.method === "POST") {
      const corps = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const code = (corps.code || "").toString().trim();
      const contenu = corps.contenu;

      if (!code) return res.status(400).json({ erreur: "Code manquant." });
      if (!contenu || typeof contenu !== "object") {
        return res.status(400).json({ erreur: "Contenu invalide." });
      }

      const reponse = await fetch(url + "/rest/v1/" + TABLE, {
        method: "POST",
        headers: Object.assign({}, enTetes, {
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify({
          code: code,
          contenu: contenu,
          maj: new Date().toISOString()
        })
      });

      if (!reponse.ok) {
        const detail = await reponse.text();
        return res.status(500).json({
          erreur: messageSupabase(reponse.status, detail)
        });
      }

      return res.status(200).json({ enregistre: true });
    }

    return res.status(405).json({ erreur: "Methode non autorisee." });
  } catch (err) {
    return res.status(500).json({
      erreur: "Erreur serveur : " + (err && err.message ? err.message : String(err))
    });
  }
}

// Identifie le type de cle fournie et dit si elle convient.
// Aucune partie secrete n'est renvoyee.
function examinerCle(cle) {
  if (cle.startsWith("sk_") || cle.startsWith("pk_")) {
    return {
      type: "cle Stripe",
      bloquant: true,
      message: "C'est une cle Stripe, pas une cle Supabase. " +
        "Va dans Supabase > Settings > API Keys."
    };
  }
  if (cle.startsWith("sb_secret_")) {
    return { type: "cle secrete Supabase (sb_secret_)", bloquant: false,
      message: "Bonne cle : cle secrete, utilisable cote serveur." };
  }
  if (cle.startsWith("sb_publishable_")) {
    return {
      type: "cle publiable Supabase (sb_publishable_)",
      bloquant: true,
      message: "C'est la cle publiable, elle ne peut pas ecrire. " +
        "Prends la cle du bloc 'Secret keys' (sb_secret_...)."
    };
  }
  // Cles heritees : ce sont des JWT, on peut lire le role a l'interieur
  if (cle.split(".").length === 3) {
    try {
      const charge = JSON.parse(
        Buffer.from(cle.split(".")[1], "base64").toString("utf8")
      );
      if (charge.role === "service_role") {
        return { type: "cle service_role (heritee)", bloquant: false,
          message: "Bonne cle : service_role, utilisable cote serveur." };
      }
      if (charge.role === "anon") {
        return {
          type: "cle anon (heritee)",
          bloquant: true,
          message: "C'est la cle anon, elle ne peut pas ecrire. " +
            "Prends la cle service_role dans l'onglet 'Legacy API Keys'."
        };
      }
      return { type: "cle heritee, role " + (charge.role || "inconnu"),
        bloquant: false, message: "Role inhabituel, a verifier si ca ne marche pas." };
    } catch (e) {
      return { type: "cle illisible", bloquant: false,
        message: "Format non reconnu, on tente quand meme." };
    }
  }
  return { type: "cle non reconnue", bloquant: false,
    message: "Format non reconnu, on tente quand meme." };
}

// Traduit les erreurs Supabase les plus frequentes en langage clair
function messageSupabase(statut, detail) {
  const t = (detail || "").toLowerCase();

  if (statut === 401 || statut === 403) {
    return "Cle Supabase refusee. Verifie que tu utilises bien la cle service_role.";
  }
  if (t.includes("does not exist") || t.includes("could not find the table")) {
    return "La table 'sync' n'existe pas dans Supabase. Cree-la avec le script SQL fourni.";
  }
  if (t.includes("row-level security") || t.includes("violates row-level")) {
    return "Acces bloque par la securite Supabase. Utilise la cle service_role.";
  }
  if (statut === 413) {
    return "Donnees trop volumineuses. Supprime un fichier importe (CV ou lettre) et reessaie.";
  }
  return "Supabase a repondu " + statut + " : " + (detail || "").slice(0, 200);
}
