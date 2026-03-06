/* ═══════════════════════════════════════════════════
   LOCALSTORAGE — CLAVE ÚNICA PARA TODO EL PROYECTO
═══════════════════════════════════════════════════ */
const LS_KEY = 'giftdrop_v3';

// Lee TODO el estado desde localStorage (no RAM)
function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw);
  } catch { return defaultState(); }
}

// Guarda TODO el estado en localStorage
function lsSave(st) {
  localStorage.setItem(LS_KEY, JSON.stringify(st));
}

// Borra el estado de localStorage
function lsClear() {
  localStorage.removeItem(LS_KEY);
}

function defaultState() {
  return {
    organizer: { name:'', email:'', participates:'yes' },
    participants: [],   // [{id,name}]
    exclusions: [],     // [[nameA,nameB], ...]
    hasExclusions: false,
    eventType: 'Navidad',
    eventDate: '',
    budget: '250',
    assignments: {}     // {giverId: receiverId}
  };
}

/* ═══════════════════════════════════════════════════
   NAVEGACIÓN
═══════════════════════════════════════════════════ */
const SCREENS = ['screen-splash','screen-step1','screen-step2','screen-step3',
                 'screen-step4','screen-step5','screen-step6','screen-step7','screen-sorteo'];
const TOTAL_STEPS = 7;

function goTo(id) {
  SCREENS.forEach(s => document.getElementById(s).classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  // render step bars for wizard screens
  const stepMatch = id.match(/screen-step(\d)/);
  if (stepMatch) renderStepBar(+stepMatch[1]);
  // special renders
  if (id === 'screen-step2') renderParticipants();
  if (id === 'screen-step3') renderExclusionSelects();
  if (id === 'screen-step5') renderSuggestedDates();
  if (id === 'screen-step7') renderSummary();
  if (id === 'screen-sorteo') initSorteo();
}

function renderStepBar(active) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById('sb'+i);
    if (!el) continue;
    let html = '<div class="step-bar">';
    for (let j = 1; j <= TOTAL_STEPS; j++) {
      const cls = j < active ? 'done' : j === active ? 'active' : '';
      html += `<div class="step-dot ${cls}">${j < active ? '✓' : j}</div>`;
      if (j < TOTAL_STEPS) html += `<div class="step-line ${j < active ? 'done' : ''}"></div>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }
}

/* ═══════════════════════════════════════════════════
   PASO 1: ORGANIZADOR
═══════════════════════════════════════════════════ */
let orgParticipate = 'yes';

function setOrgParticipate(val) {
  orgParticipate = val;
  document.getElementById('rc-yes').classList.toggle('sel', val==='yes');
  document.getElementById('rc-no').classList.toggle('sel', val==='no');
}

function saveStep1() {
  const name = document.getElementById('org-name').value.trim();
  if (!name) { toast('⚠️ Ingresa el nombre del organizador'); return; }
  const st = lsLoad();
  st.organizer = { name, email: document.getElementById('org-email').value.trim(), participates: orgParticipate };
  // Si participa y no está en la lista, añadir automáticamente
  if (orgParticipate === 'yes') {
    if (!st.participants.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      st.participants.unshift({ id: 'org_' + Date.now(), name });
    }
  } else {
    // Si cambió a "no participa", quitarlo de la lista si estaba
    st.participants = st.participants.filter(p => p.name.toLowerCase() !== name.toLowerCase());
  }
  lsSave(st);
  goTo('screen-step2');
}

/* ═══════════════════════════════════════════════════
   PASO 2: PARTICIPANTES
   Se agregan a localStorage en tiempo real
═══════════════════════════════════════════════════ */
function addParticipant() {
  const inp = document.getElementById('p-input');
  const name = inp.value.trim();
  if (!name) { toast('⚠️ Ingresa un nombre'); return; }

  const st = lsLoad();   // leer de localStorage
  if (st.participants.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    toast('⚠️ Ya existe ese participante'); return;
  }
  // Agregar y guardar en localStorage inmediatamente
  st.participants.push({ id: 'p_' + Date.now(), name });
  lsSave(st);            // guardar en localStorage
  inp.value = '';
  renderParticipants();
  toast(`✅ ${name} agregado`);
}

function removeParticipant(id) {
  const st = lsLoad();
  const removed = st.participants.find(p => p.id === id);
  st.participants = st.participants.filter(p => p.id !== id);
  // Limpiar exclusiones que lo involucren
  if (removed) {
    st.exclusions = st.exclusions.filter(([a,b]) => a !== removed.name && b !== removed.name);
  }
  lsSave(st);
  renderParticipants();
}

function renderParticipants() {
  const st = lsLoad();   // leer siempre de localStorage
  const orgName = st.organizer.name;
  const list = document.getElementById('p-list');
  const empty = document.getElementById('p-empty');
  const countEl = document.getElementById('p-count');
  if (!st.participants.length) {
    empty && (empty.style.display = '');
    countEl && (countEl.textContent = 'Mínimo 2 participantes.');
    return;
  }
  empty && (empty.style.display = 'none');
  countEl && (countEl.textContent = `${st.participants.length} participante(s) registrado(s).`);
  list.innerHTML = st.participants.map(p => `
    <div class="p-chip">
      <div class="p-avatar">${p.name[0].toUpperCase()}</div>
      <div class="p-name">${esc(p.name)}</div>
      ${p.name === orgName ? '<span class="p-org-tag">Organizador</span>' : ''}
      <button class="gd-btn gd-btn-danger gd-btn-sm" onclick="removeParticipant('${p.id}')">
        <i class="bi bi-x"></i>
      </button>
    </div>`).join('');
}

function saveStep2() {
  const st = lsLoad();
  if (st.participants.length < 2) { toast('⚠️ Necesitas al menos 2 participantes'); return; }
  goTo('screen-step3');
}

/* ═══════════════════════════════════════════════════
   PASO 3: EXCLUSIONES
   Se controlan en el estado y se guardan en localStorage
═══════════════════════════════════════════════════ */
let excMode = 'no';

function setExcMode(val) {
  excMode = val;
  document.getElementById('exc-no-card').classList.toggle('sel', val==='no');
  document.getElementById('exc-yes-card').classList.toggle('sel', val==='yes');
  document.getElementById('exc-builder').style.display = val==='yes' ? '' : 'none';
}

function renderExclusionSelects() {
  const st = lsLoad();
  // Iniciar excMode según lo guardado
  excMode = st.hasExclusions ? 'yes' : 'no';
  setExcMode(excMode);
  const opts = st.participants.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  document.getElementById('exc-a').innerHTML = '<option value="">— selecciona —</option>' + opts;
  document.getElementById('exc-b').innerHTML = '<option value="">— selecciona —</option>' + opts;
  renderExcList(st.exclusions);
}

function addExclusion() {
  const a = document.getElementById('exc-a').value;
  const b = document.getElementById('exc-b').value;
  if (!a || !b) { toast('⚠️ Selecciona ambas personas'); return; }
  if (a === b) { toast('⚠️ Selecciona personas distintas'); return; }
  const st = lsLoad();
  // Verificar que no exista ya este par
  const exists = st.exclusions.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a));
  if (exists) { toast('⚠️ Esta exclusión ya existe'); return; }
  st.exclusions.push([a, b]);  // guardar par de exclusión
  st.hasExclusions = true;
  lsSave(st);                  // persistir en localStorage
  renderExcList(st.exclusions);
  toast(`🚫 ${a} ↔ ${b} excluidos`);
}

function removeExclusion(idx) {
  const st = lsLoad();
  st.exclusions.splice(idx, 1);
  if (!st.exclusions.length) st.hasExclusions = false;
  lsSave(st);
  renderExcList(st.exclusions);
}

function renderExcList(exclusions) {
  const el = document.getElementById('exc-list');
  if (!el) return;
  el.innerHTML = exclusions.map(([ a, b ], i) => `
    <span class="ex-badge">
      🚫 ${esc(a)} ↔ ${esc(b)}
      <button onclick="removeExclusion(${i})"><i class="bi bi-x"></i></button>
    </span>`).join('');
}

function saveStep3() {
  const st = lsLoad();
  st.hasExclusions = excMode === 'yes' && st.exclusions.length > 0;
  lsSave(st);
  goTo('screen-step4');
}

/* ═══════════════════════════════════════════════════
   PASO 4: TIPO DE EVENTO
═══════════════════════════════════════════════════ */
function selEvent(el) {
  document.querySelectorAll('.event-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  const isCustom = el.dataset.type === '__custom__';
  document.getElementById('custom-event-wrap').style.display = isCustom ? '' : 'none';
}

function saveStep4() {
  const sel = document.querySelector('.event-btn.sel');
  let type = sel ? sel.dataset.type : 'Navidad';
  if (type === '__custom__') {
    type = document.getElementById('custom-event').value.trim();
    if (!type) { toast('⚠️ Escribe el nombre de la celebración'); return; }
  }
  const st = lsLoad();
  st.eventType = type;
  lsSave(st);
  goTo('screen-step5');
}

/* ═══════════════════════════════════════════════════
   PASO 5: FECHA
═══════════════════════════════════════════════════ */
let selectedDate = '';

function renderSuggestedDates() {
  const st = lsLoad();
  const today = new Date();
  const suggestions = [
    { label:'En 1 semana',    d: addDays(today,7) },
    { label:'En 2 semanas',   d: addDays(today,14) },
    { label:'En 1 mes',       d: addDays(today,30) },
    { label:'En 3 meses',     d: addDays(today,90) },
  ];
  selectedDate = st.eventDate || '';
  const dp = document.getElementById('date-picker');
  if (selectedDate) dp.value = selectedDate;

  document.getElementById('suggested-dates').innerHTML = suggestions.map(s => {
    const iso = toISO(s.d);
    const sel = iso === selectedDate ? 'sel' : '';
    return `<div class="col-6 col-sm-3">
      <div class="date-chip ${sel}" onclick="selectSugDate('${iso}',this)">
        <div class="dc-lbl">${s.label}</div>
        <div class="dc-val">${fmt(s.d)}</div>
      </div>
    </div>`;
  }).join('');
}

function selectSugDate(iso, el) {
  selectedDate = iso;
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('date-picker').value = iso;
}

function onDatePicker() {
  selectedDate = document.getElementById('date-picker').value;
  document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('sel'));
}

function saveStep5() {
  if (!selectedDate) { toast('⚠️ Selecciona una fecha'); return; }
  const st = lsLoad();
  st.eventDate = selectedDate;
  lsSave(st);
  goTo('screen-step6');
}

/* ═══════════════════════════════════════════════════
   PASO 6: PRESUPUESTO
═══════════════════════════════════════════════════ */
function selBudget(el) {
  document.querySelectorAll('.budget-opt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  const isCustom = el.dataset.val === '__custom__';
  document.getElementById('custom-budget-wrap').style.display = isCustom ? '' : 'none';
}

function saveStep6() {
  const sel = document.querySelector('.budget-opt.sel');
  let budget = sel ? sel.dataset.val : '250';
  if (budget === '__custom__') {
    budget = document.getElementById('custom-budget').value.trim();
    if (!budget || isNaN(budget) || +budget < 1) { toast('⚠️ Ingresa una cantidad válida'); return; }
  }
  const st = lsLoad();
  st.budget = budget;
  lsSave(st);
  goTo('screen-step7');
}

/* ═══════════════════════════════════════════════════
   PASO 7: RESUMEN — LEE TODO DE LOCALSTORAGE
═══════════════════════════════════════════════════ */
function renderSummary() {
  // ⚠️ Lee DIRECTAMENTE de localStorage, no de variables en memoria
  const st = lsLoad();
  const { organizer, participants, exclusions, eventType, eventDate, budget } = st;

  const dateStr = eventDate ? new Date(eventDate+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  const budgetStr = budget ? `$${Number(budget).toLocaleString('es-MX')} MXN` : '—';
  const excStr = exclusions.length
    ? exclusions.map(([a,b])=>`<span class="tag tag-red">🚫 ${esc(a)} ↔ ${esc(b)}</span>`).join(' ')
    : '<span class="tag">Sin exclusiones</span>';
  const partStr = participants.map(p=>`<span class="tag">${esc(p.name)}</span>`).join(' ');

  document.getElementById('summary-content').innerHTML = `
    <div class="sum-row"><div class="sum-icon">👤</div><div><div class="sum-lbl">Organizador(a)</div><div class="sum-val">${esc(organizer.name)} ${organizer.participates==='yes'?'<span class="tag" style="color:var(--gold)">Participa</span>':''}</div></div></div>
    <div class="sum-row"><div class="sum-icon">🎊</div><div><div class="sum-lbl">Celebración</div><div class="sum-val">${esc(eventType)}</div></div></div>
    <div class="sum-row"><div class="sum-icon">📅</div><div><div class="sum-lbl">Fecha</div><div class="sum-val">${dateStr}</div></div></div>
    <div class="sum-row"><div class="sum-icon">💰</div><div><div class="sum-lbl">Presupuesto</div><div class="sum-val">${budgetStr}</div></div></div>
    <div class="sum-row"><div class="sum-icon">🧑‍🤝‍🧑</div><div><div class="sum-lbl">Participantes (${participants.length})</div><div class="sum-val"><div class="d-flex flex-wrap gap-1 mt-1">${partStr}</div></div></div></div>
    <div class="sum-row"><div class="sum-icon">🚫</div><div><div class="sum-lbl">Exclusiones</div><div class="sum-val"><div class="d-flex flex-wrap gap-1 mt-1">${excStr}</div></div></div></div>
  `;
}

function resetAll() {
  if (!confirm('¿Seguro que deseas reiniciar todo el intercambio?')) return;
  lsClear();
  goTo('screen-splash');
}

/* ═══════════════════════════════════════════════════
   SORTEO — DRAG & DROP + ALGORITMO CON EXCLUSIONES
═══════════════════════════════════════════════════ */
let draggedName = null;   // nombre del pill que se arrastra
let dragSource  = null;   // 'pool' | giverId (zona de origen)

function goToSorteo() {
  const st = lsLoad();
  st.assignments = {};
  lsSave(st);
  goTo('screen-sorteo');
}

function initSorteo() {
  const st = lsLoad();
  renderPool(st);
  renderDropTable(st);
  document.getElementById('results-panel').style.display = 'none';
}

/* ── Render del pool de pills ── */
function renderPool(st) {
  const assigned = Object.values(st.assignments); // ids ya asignados como receptores
  const available = st.participants.filter(p => !assigned.includes(p.id));
  const pool = document.getElementById('drag-pool');
  pool.innerHTML = available.length
    ? available.map(p => pillHTML(p)).join('')
    : '<span style="color:var(--muted);font-size:.8rem">Todos asignados ✓</span>';
}

function pillHTML(p) {
  return `<div class="drag-pill" draggable="true" data-id="${p.id}" data-name="${esc(p.name)}"
    ondragstart="pillDragStart(event,'${p.id}','${esc(p.name)}','pool')"
    ondragend="pillDragEnd(event)">
    <div class="pill-av">${p.name[0].toUpperCase()}</div>${esc(p.name)}
  </div>`;
}

/* ── Render de la tabla de zonas ── */
function renderDropTable(st) {
  const tbl = document.getElementById('drop-tbl');
  tbl.innerHTML = st.participants.map(giver => {
    const recv = st.assignments[giver.id]
      ? st.participants.find(p=>p.id===st.assignments[giver.id]) : null;
    return `
      <div class="drop-row">
        <div class="dr-giver">
          <div class="pill-av" style="width:24px;height:24px;font-size:.7rem">${giver.name[0].toUpperCase()}</div>
          ${esc(giver.name)}
        </div>
        <div class="dr-arrow"><i class="bi bi-arrow-right"></i></div>
        <div class="dr-zone ${recv?'zone-filled':''}" id="zone-${giver.id}"
          ondragover="zoneDragOver(event,'${giver.id}')"
          ondragleave="zoneDragLeave(event,'${giver.id}')"
          ondrop="zoneDrop(event,'${giver.id}')">
          ${recv
            ? `<div class="dr-filled">
                 <div class="pill-av" style="width:20px;height:20px;font-size:.65rem">${recv.name[0].toUpperCase()}</div>
                 ${esc(recv.name)}
                 <button class="dr-rm" onclick="unassign('${giver.id}')"><i class="bi bi-x"></i></button>
               </div>`
            : '<span class="dr-hint">Arrastra aquí</span>'}
        </div>
        <div style="text-align:center">
          ${recv ? '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>' : '<i class="bi bi-circle" style="color:var(--muted)"></i>'}
        </div>
      </div>`;
  }).join('');
}

/* ── Drag eventos ── */
function pillDragStart(e, id, name, source) {
  draggedName = name;
  draggedId   = id;
  dragSource  = source;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
function pillDragEnd(e) {
  e.currentTarget && e.currentTarget.classList.remove('dragging');
  draggedName = null; draggedId = null; dragSource = null;
}

/* ── Zona de drop: giver recibe un receiver ── */
function zoneDragOver(e, giverId) {
  e.preventDefault();
  const zone = document.getElementById('zone-'+giverId);
  if (zone) zone.classList.add('zone-over');
}
function zoneDragLeave(e, giverId) {
  const zone = document.getElementById('zone-'+giverId);
  if (zone) zone.classList.remove('zone-over');
}
function zoneDrop(e, giverId) {
  e.preventDefault();
  const zone = document.getElementById('zone-'+giverId);
  if (zone) zone.classList.remove('zone-over');
  if (!draggedId) return;

  const st = lsLoad();

  // Validación 1: no puede regalarse a sí mismo
  if (draggedId === giverId) { toast('⚠️ Una persona no puede regalarse a sí misma'); return; }

  // Validación 2: verificar exclusiones
  const giverName   = st.participants.find(p=>p.id===giverId)?.name || '';
  const receiverName = draggedName;
  const isExcluded = st.exclusions.some(([a,b]) =>
    (a===giverName && b===receiverName) || (a===receiverName && b===giverName)
  );
  if (isExcluded) {
    zone && zone.classList.add('zone-err');
    setTimeout(()=> zone && zone.classList.remove('zone-err'), 900);
    toast(`🚫 Exclusión: ${giverName} y ${receiverName} no pueden sortearse`);
    return;
  }

  // Validación 3: el receiver ya está asignado a alguien más
  const alreadyAssigned = Object.values(st.assignments).includes(draggedId);
  if (alreadyAssigned) {
    toast(`⚠️ ${draggedName} ya está asignado a alguien`); return;
  }

  // Si la zona ya tenía alguien, devolver al pool
  if (st.assignments[giverId]) {
    // la función unassign lo devuelve automáticamente
  }

  st.assignments[giverId] = draggedId;  // guardar en localStorage
  lsSave(st);
  renderPool(st);
  renderDropTable(st);
  checkAllAssigned(st);
}

/* ── Pool: permite devolver pills ── */
function poolDragOver(e) {
  e.preventDefault();
  document.getElementById('drag-pool').classList.add('pool-over');
}
function poolDragLeave(e) {
  document.getElementById('drag-pool').classList.remove('pool-over');
}
function poolDrop(e) {
  e.preventDefault();
  document.getElementById('drag-pool').classList.remove('pool-over');
  if (!draggedId || dragSource === 'pool') return;
  // devolver al pool borrando la asignación
  const st = lsLoad();
  Object.keys(st.assignments).forEach(k => {
    if (st.assignments[k] === draggedId) delete st.assignments[k];
  });
  lsSave(st);
  renderPool(st);
  renderDropTable(st);
  document.getElementById('results-panel').style.display = 'none';
}

function unassign(giverId) {
  const st = lsLoad();
  delete st.assignments[giverId];
  lsSave(st);
  renderPool(st);
  renderDropTable(st);
  document.getElementById('results-panel').style.display = 'none';
}

/* ═══════════════════════════════════════════════════
   SORTEO AUTOMÁTICO — respeta exclusiones
   Algoritmo: Fisher-Yates + validación derangement
═══════════════════════════════════════════════════ */
function autoSort() {
  const st = lsLoad();
  const participants = st.participants;
  if (participants.length < 2) { toast('⚠️ Necesitas al menos 2 participantes'); return; }

  const ids   = participants.map(p => p.id);
  const names = participants.map(p => p.name);

  // Construir mapa de exclusiones por índice
  // excludeMap[i] = set de índices que i NO puede recibir (ni ser recibido por)
  const excludeMap = {};
  ids.forEach((_,i) => excludeMap[i] = new Set([i])); // no a sí mismo

  st.exclusions.forEach(([nameA, nameB]) => {
    const ia = names.indexOf(nameA);
    const ib = names.indexOf(nameB);
    if (ia >= 0 && ib >= 0) {
      excludeMap[ia].add(ib);  // A no le regala a B
      excludeMap[ib].add(ia);  // B no le regala a A (bidireccional)
    }
  });

  // Intentar generar un derangement válido (máx 500 intentos)
  let result = null;
  for (let attempt = 0; attempt < 500; attempt++) {
    const shuffled = [...ids].sort(() => Math.random() - .5);
    const valid = ids.every((giverId, i) => {
      const receiverId = shuffled[i];
      const ri = ids.indexOf(receiverId);
      return !excludeMap[i].has(ri);
    });
    if (valid) { result = shuffled; break; }
  }

  if (!result) {
    toast('❌ No se encontró una asignación válida con estas exclusiones');
    return;
  }

  // Guardar en localStorage
  st.assignments = {};
  ids.forEach((id, i) => { st.assignments[id] = result[i]; });
  lsSave(st);

  renderPool(st);
  renderDropTable(st);
  checkAllAssigned(st);
  toast('⚡ ¡Sorteo automático completo!');
}

function clearSort() {
  const st = lsLoad();
  st.assignments = {};
  lsSave(st);
  renderPool(st);
  renderDropTable(st);
  document.getElementById('results-panel').style.display = 'none';
}

/* ── Mostrar resultados cuando todo está asignado ── */
function checkAllAssigned(st) {
  const n = st.participants.length;
  const assigned = Object.keys(st.assignments).length;
  if (assigned < n) return;
  showResults(st);
}

function showResults(st) {
  const panel = document.getElementById('results-panel');
  const grid  = document.getElementById('result-grid');
  panel.style.display = '';
  grid.innerHTML = st.participants.map(giver => {
    const recv = st.participants.find(p => p.id === st.assignments[giver.id]);
    if (!recv) return '';
    return `<div class="result-card" style="animation-delay:${Math.random()*.3}s">
      <div class="rc-giver">Le regala a…</div>
      <div class="rc-name">${esc(giver.name)}</div>
      <div class="rc-arrow">🎁</div>
      <div class="rc-recv">${esc(recv.name)}</div>
    </div>`;
  }).join('');
  panel.scrollIntoView({ behavior:'smooth', block:'start' });
  launchConfetti();
}

/* ═══════════════════════════════════════════════════
   CONFETTI
═══════════════════════════════════════════════════ */
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const cols = ['#e8454a','#f5c842','#4ade80','#fff','#f97316','#60a5fa'];
  const pieces = Array.from({length:130}, () => ({
    x: Math.random()*canvas.width, y:-10-Math.random()*200,
    r: 4+Math.random()*6,
    color: cols[Math.floor(Math.random()*cols.length)],
    dx:(Math.random()-.5)*3, dy:2+Math.random()*4,
    rot:Math.random()*Math.PI*2, drot:(Math.random()-.5)*.15,
    shape:Math.random()>.5?'rect':'circle'
  }));
  let frame;
  (function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive=false;
    pieces.forEach(p=>{
      p.x+=p.dx; p.y+=p.dy; p.rot+=p.drot;
      if(p.y<canvas.height+20) alive=true;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color;
      if(p.shape==='rect') ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);
      else { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    if(alive) frame=requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  })();
}

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('gd-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2800);
}

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function toISO(d){ return d.toISOString().split('T')[0]; }
function fmt(d){ return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}); }

// Reanudar desde localStorage si ya hay datos
(function init(){
  const st = lsLoad();
  if (st.organizer.name) {
    // ya hay progreso — ir al paso correspondiente
    if (st.eventDate && st.budget) { goTo('screen-step7'); return; }
    if (st.eventDate) { goTo('screen-step6'); return; }
    if (st.eventType) { goTo('screen-step5'); return; }
    if (st.participants.length) { goTo('screen-step4'); return; }
    goTo('screen-step2');
  }
})();
