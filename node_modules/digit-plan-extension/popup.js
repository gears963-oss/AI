(function(){
  console.log('[PIQ/popup] Script chargé');
  const ICP_KEY = 'ICP_ACTIVE';
  const BACKEND_KEY = 'PIQ_BACKEND_URL';
  const PROFILES_KEY = 'PIQ_PROFILES';
  const ACTIVE_PROFILE_KEY = 'PIQ_ACTIVE_PROFILE_ID';
  
  function EL(id){return document.getElementById(id)}
  function log(msg){ 
    const s=EL('status'); 
    if(s) s.textContent=String(msg); 
    console.log('[PIQ/popup]',msg);
  }
  function parseCSV(str){return (str||'').split(',').map(s=>s.trim()).filter(Boolean)}
  function toCSV(arr){return Array.isArray(arr)?arr.join(', '):''}
  
  // Tabs
  function initTabs(){
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab=>{
      tab.addEventListener('click',()=>{
        const tabName = tab.dataset.tab;
        tabs.forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
        tab.classList.add('active');
        EL(`tab-${tabName}`).classList.add('active');
        if(tabName==='profiles') renderProfilesList();
        if(tabName==='scoring') renderActiveProfileSelect();
      });
    });
  }
  
  // Profiles
  async function loadProfiles(){
    try{
      const data = await chrome.storage.sync.get(PROFILES_KEY);
      return data?.[PROFILES_KEY] || [];
    }catch(e){
      console.error('[PIQ/popup] Erreur chargement profils:', e);
      return [];
    }
  }
  async function saveProfiles(profiles){
    try{
      await chrome.storage.sync.set({[PROFILES_KEY]:profiles});
      console.log('[PIQ/popup] Profils sauvegardés:', profiles.length);
    }catch(e){
      console.error('[PIQ/popup] Erreur sauvegarde profils:', e);
    }
  }
  async function getActiveProfile(){
    try{
      const {[ACTIVE_PROFILE_KEY]:activeId} = await chrome.storage.sync.get(ACTIVE_PROFILE_KEY);
      if(!activeId) return null;
      const profiles = await loadProfiles();
      return profiles.find(p=>p.id===activeId) || null;
    }catch(e){
      console.error('[PIQ/popup] Erreur lecture profil actif:', e);
      return null;
    }
  }
  async function setActiveProfile(id){
    try{
      await chrome.storage.sync.set({[ACTIVE_PROFILE_KEY]:id});
      console.log('[PIQ/popup] Profil actif défini:', id);
      renderActiveProfileSelect();
      renderProfilesList();
      log('Profil activé ✅');
    }catch(e){
      console.error('[PIQ/popup] Erreur activation profil:', e);
      log('Erreur activation: '+e);
    }
  }
  async function renderActiveProfileSelect(){
    const select = EL('active_profile_select');
    if(!select) return;
    const profiles = await loadProfiles();
    const {[ACTIVE_PROFILE_KEY]:activeId} = await chrome.storage.sync.get(ACTIVE_PROFILE_KEY);
    select.innerHTML = '<option value="">Aucun profil (utiliser ICP manuel)</option>';
    profiles.forEach(p=>{
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.isFavorite?'★ ':'')+p.name;
      if(p.id===activeId) opt.selected = true;
      select.appendChild(opt);
    });
  }
  async function renderProfilesList(){
    const list = EL('profiles_list');
    if(!list) return;
    const profiles = await loadProfiles();
    const {[ACTIVE_PROFILE_KEY]:activeId} = await chrome.storage.sync.get(ACTIVE_PROFILE_KEY);
    if(profiles.length===0){
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;font-size:12px">Aucun profil. Créez-en un via "Chat IA".</div>';
      return;
    }
    list.innerHTML = '';
    profiles.sort((a,b)=>{
      if(a.isFavorite && !b.isFavorite) return -1;
      if(!a.isFavorite && b.isFavorite) return 1;
      return (b.createdAt||0) - (a.createdAt||0);
    });
    profiles.forEach(p=>{
      const item = document.createElement('div');
      item.className = 'profile-item'+(p.id===activeId?' active':'');
      item.innerHTML = `
        <span class="profile-name">${p.isFavorite?'★ ':''}${p.name}</span>
        <div class="profile-actions">
          <button class="btn-small btn-secondary activate-btn" data-id="${p.id}">Activer</button>
          <span class="star ${p.isFavorite?'favorite':''}" data-id="${p.id}" title="Favoris">⭐</span>
          <span class="star" data-id="${p.id}" data-action="delete" title="Supprimer">🗑️</span>
        </div>
      `;
      list.appendChild(item);
    });
    list.querySelectorAll('.activate-btn').forEach(btn=>{
      btn.addEventListener('click',()=>setActiveProfile(btn.dataset.id));
    });
    list.querySelectorAll('.star').forEach(star=>{
      star.addEventListener('click',async()=>{
        const id = star.dataset.id;
        if(star.dataset.action==='delete'){
          if(!confirm('Supprimer ce profil ?')) return;
          const profiles = await loadProfiles();
          const filtered = profiles.filter(p=>p.id!==id);
          await saveProfiles(filtered);
          if(id===activeId) await chrome.storage.sync.remove(ACTIVE_PROFILE_KEY);
          renderProfilesList();
          renderActiveProfileSelect();
          log('Profil supprimé');
        }else{
          const profiles = await loadProfiles();
          const p = profiles.find(pr=>pr.id===id);
          if(p){
            p.isFavorite = !p.isFavorite;
            await saveProfiles(profiles);
            renderProfilesList();
            renderActiveProfileSelect();
          }
        }
      });
    });
  }
  
  // Chat IA
  async function compileProfile(){
    const result = EL('chat_result');
    try{
      const input = EL('chat_input');
      const nlPrompt = input.value.trim();
      if(!nlPrompt){
        log('Saisissez une description');
        result.style.display = 'block';
        result.innerHTML = '<div style="color:#f59e0b">⚠️ Saisissez une description de profil</div>';
        return;
      }
      const {[BACKEND_KEY]:backendUrl} = await chrome.storage.sync.get(BACKEND_KEY);
      if(!backendUrl){
        log('Configurez d\'abord le Backend URL dans l\'onglet Scoring');
        result.style.display = 'block';
        result.innerHTML = '<div style="color:#f59e0b">⚠️ Configurez d\'abord le Backend URL</div>';
        return;
      }
      log('Compilation en cours...');
      result.style.display = 'block';
      result.innerHTML = '<div style="color:#64748b">⏳ Compilation en cours...</div>';
      
      const base = backendUrl.replace(/\/$/,'');
      let resp;
      try {
        resp = await fetch(`${base}/api/compile_profile`,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({nl_prompt:nlPrompt})
        });
      } catch (fetchErr) {
        // Network error (CORS, timeout, etc.)
        throw new Error(`Erreur réseau: ${fetchErr.message || 'Impossible de contacter le backend'}`);
      }
      
      let errorData = null;
      if(!resp.ok) {
        try {
          errorData = await resp.json();
        } catch {
          errorData = { error: `HTTP ${resp.status}`, detail: await resp.text().catch(() => '') };
        }
        const errorMsg = errorData?.error || `HTTP ${resp.status}`;
        const errorDetail = errorData?.detail || '';
        throw new Error(`${errorMsg}${errorDetail ? ': ' + errorDetail : ''}`);
      }
      
      const data = await resp.json();
      const {name, compiled, summary} = data;
      if(!name || !compiled){
        throw new Error('Réponse invalide du backend: ' + JSON.stringify(data).slice(0, 100));
      }
      const profile = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        nl_prompt: nlPrompt,
        compiled,
        isFavorite: false
      };
      const profiles = await loadProfiles();
      profiles.push(profile);
      await saveProfiles(profiles);
      await setActiveProfile(profile.id);
      result.style.display = 'block';
      result.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;color:#22c55e">✅ Profil créé: ${name}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">${compiled.notes || summary || 'Profil compilé avec succès'}</div>
      `;
      input.value = '';
      log('Profil compilé et activé ✅');
      renderProfilesList();
      renderActiveProfileSelect();
    }catch(e){
      console.error('[PIQ/popup] Erreur compilation:', e);
      const errorMsg = e.message || String(e);
      log('Erreur compilation: '+errorMsg);
      result.style.display = 'block';
      result.innerHTML = `
        <div style="color:#ef4444;font-weight:600;margin-bottom:4px">❌ Erreur</div>
        <div style="color:#ef4444;font-size:12px">${errorMsg}</div>
        <div style="color:#94a3b8;font-size:11px;margin-top:6px">Vérifiez l'URL backend et réessayez.</div>
      `;
    }
  }
  
  // ICP legacy
  async function loadICP(){
    try{
      const data = await chrome.storage.sync.get(ICP_KEY);
      const icp = data?.[ICP_KEY] || {};
      if(icp.pays) EL('pays').value = icp.pays;
      if(icp.secteurs) EL('secteurs').value = toCSV(icp.secteurs);
      if(icp.taille_min != null) EL('taille_min').value = icp.taille_min;
      if(icp.taille_max != null) EL('taille_max').value = icp.taille_max;
      if(icp.roles) EL('roles').value = toCSV(icp.roles);
      if(icp.note_google_max != null) EL('note_google_max').value = icp.note_google_max;
      if(icp.techno_inclues) EL('techno_inclues').value = toCSV(icp.techno_inclues);
      if(icp.exclusions_mots) EL('exclusions_mots').value = toCSV(icp.exclusions_mots);
    }catch(e){
      console.error('[PIQ/popup] Erreur chargement ICP:', e);
    }
  }
  async function saveICP(){
    try{
      const icp = {
        pays: EL('pays').value.trim() || undefined,
        secteurs: parseCSV(EL('secteurs').value),
        taille_min: EL('taille_min').value ? Number(EL('taille_min').value) : undefined,
        taille_max: EL('taille_max').value ? Number(EL('taille_max').value) : undefined,
        roles: parseCSV(EL('roles').value),
        note_google_max: EL('note_google_max').value ? Number(EL('note_google_max').value) : undefined,
        techno_inclues: parseCSV(EL('techno_inclues').value),
        exclusions_mots: parseCSV(EL('exclusions_mots').value)
      };
      Object.keys(icp).forEach(k=>{if(icp[k]===undefined||(Array.isArray(icp[k])&&!icp[k].length))delete icp[k]});
      await chrome.storage.sync.set({[ICP_KEY]:icp});
      log('ICP enregistré ✅');
      alert('ICP enregistré ✅');
    }catch(e){
      console.error('[PIQ/popup] Erreur sauvegarde ICP:', e);
      log('Erreur sauvegarde ICP: '+e);
    }
  }
  async function loadBackend(){
    try{
      const result = await chrome.storage.sync.get(BACKEND_KEY);
      const url = result?.[BACKEND_KEY];
      if(url) EL('backend_url').value = url;
    }catch(e){
      console.error('[PIQ/popup] Erreur chargement backend:', e);
    }
  }
  async function saveBackend(){
    try{
      const url = EL('backend_url').value.trim();
      if(!url){ log('URL vide'); return; }
      await chrome.storage.sync.set({[BACKEND_KEY]:url});
      log('Backend enregistré ✅: '+url);
      alert('Backend enregistré ✅');
    }catch(e){
      console.error('[PIQ/popup] Erreur sauvegarde backend:', e);
      log('Erreur sauvegarde backend: '+e);
    }
  }
  async function testBackend(){
    try{
      const {[BACKEND_KEY]:url} = await chrome.storage.sync.get(BACKEND_KEY);
      const base = (url||'').replace(/\/$/,'');
      if(!base){ log('Définis d\'abord le Backend URL.'); return; }
      log('Test → '+base+'/api/score');
      const r = await fetch(base+'/api/score',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({icp:{},features:{},pageText:'ping'})
      });
      const j = await r.json().catch(()=>({error:'invalid json'}));
      log('HTTP '+r.status+'\n'+JSON.stringify(j,null,2));
    }catch(e){
      console.error('[PIQ/popup] Erreur test:', e);
      log('Erreur test: '+e);
    }
  }
  
  function init(){
    console.log('[PIQ/popup] Initialisation');
    initTabs();
    EL('save_icp')?.addEventListener('click',saveICP);
    EL('load_icp')?.addEventListener('click',loadICP);
    EL('save_backend')?.addEventListener('click',saveBackend);
    EL('test_backend')?.addEventListener('click',testBackend);
    EL('chat_compile')?.addEventListener('click',compileProfile);
    EL('activate_profile')?.addEventListener('click',()=>{
      const select = EL('active_profile_select');
      setActiveProfile(select.value);
    });
    EL('new_profile')?.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      document.querySelector('[data-tab="chat"]').classList.add('active');
      EL('tab-chat').classList.add('active');
    });
    loadICP();
    loadBackend();
    renderActiveProfileSelect();
    renderProfilesList();
    log('Popup prêt');
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
