/* =========================================================================
   packManager.js — Gestion des packs de contenu achetables (StoreKit)
   À charger AVANT le script principal de index.html.
   Fournit : window.PackManager.getUnlockedChallenges()
             window.PackManager.isPurchased(packId)
             window.PackManager.markPurchased(packId)   <- appelé par le pont natif après achat validé
   ========================================================================= */
(function(){
  const BUNDLE_ID = "com.tonstudio.jeudecouple"; // <- adapter à ton App ID réel

  // Catalogue des packs : id -> fichier JSON + statut gratuit
  const CATALOG = {
    niveau_1:        { free: true,  file: "Packs/niveau_1.json" },
    niveau_2:        { free: true,  file: "Packs/niveau_2.json" },
    base_aftercare:  { free: true,  file: "Packs/base_aftercare.json" },
    niveau_3:        { free: false, file: "Packs/niveau_3.json" },
    niveau_4:        { free: false, file: "Packs/niveau_4.json" },
    niveau_5:        { free: false, file: "Packs/niveau_5.json" },
    theme_sensoriel:    { free: false, file: "Packs/theme_sensoriel.json" },
    theme_ambiance:     { free: false, file: "Packs/theme_ambiance.json" },
    theme_jeux_legers:  { free: false, file: "Packs/theme_jeux_legers.json" },
    theme_bdsm_avance:  { free: false, file: "Packs/theme_bdsm_avance.json" },
    theme_photo_video:  { free: false, file: "Packs/theme_photo_video.json" },
    theme_qacte:        { free: false, file: "Packs/theme_qacte.json" },
    theme_exterieur:    { free: false, file: "Packs/theme_exterieur.json" },
  };

  // Product ID StoreKit = BUNDLE_ID + "." + packId (doit matcher le .storekit / App Store Connect)
  function productId(packId){ return `${BUNDLE_ID}.${packId}`; }

  // --- Persistance locale des achats (à remplacer/compléter par la vérification de reçu côté natif) ---
  const STORAGE_KEY = "jdc_purchased_packs";
  function loadPurchased(){
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
    catch(e){ return new Set(); }
  }
  function savePurchased(set){
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  }
  let purchased = loadPurchased();

  function isPurchased(packId){
    const meta = CATALOG[packId];
    if (!meta) return false;
    return meta.free || purchased.has(packId);
  }

  // Appelé par le pont natif iOS (Capacitor/StoreKit) une fois l'achat validé côté serveur/Apple.
  // ex. window.PackManager.markPurchased("niveau_3")
  function markPurchased(packId){
    if (!CATALOG[packId]) { console.warn("Pack inconnu:", packId); return; }
    purchased.add(packId);
    savePurchased(purchased);
  }

  function restorePurchases(packIds){
    packIds.forEach(id => purchased.add(id));
    savePurchased(purchased);
  }

  // --- Chargement des JSON et fusion dans le pool de défis ---
  const cache = {};
  async function loadPack(packId){
    if (cache[packId]) return cache[packId];
    const meta = CATALOG[packId];
    try{
      const res = await fetch(meta.file);
      if(!res.ok) throw new Error(`HTTP ${res.status} sur ${meta.file}`);
      const data = await res.json();
      cache[packId] = data;
      return data;
    }catch(e){
      console.error(`[PackManager] échec de chargement du pack "${packId}" (${meta.file}):`, e.message);
      return []; // ce pack sera juste vide, le reste continue de charger
    }
  }

  // Retourne la liste complète des défis débloqués (gratuits + achetés),
  // au même format que l'ancien levelsData mais avec un champ .level et .packId
  async function getUnlockedChallenges(){
    const ids = Object.keys(CATALOG).filter(isPurchased);
    const chunks = await Promise.all(ids.map(async id => {
      const items = await loadPack(id);
      return items.map(it => ({...it, packId: id}));
    }));
    return chunks.flat();
  }

  // Reconstruit un objet {1:[...],2:[...],...} compatible avec l'ancien moteur (levelsData)
  async function getUnlockedLevelsData(){
    const all = await getUnlockedChallenges();
    const out = {1:[],2:[],3:[],4:[],5:[]};
    all.forEach(c => { if (out[c.level]) out[c.level].push(c); });
    return out;
  }

  window.PackManager = {
    CATALOG, productId, isPurchased, markPurchased, restorePurchases,
    getUnlockedChallenges, getUnlockedLevelsData,
  };
})();
