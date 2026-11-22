/* =========================================================
   PORTAFOLIO PROFESIONAL — script.js
   ========================================================= */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const uid = () => 'id-' + Math.random().toString(36).slice(2, 9);
  const DRAFT_KEY = 'portfolio_draft_v1';
  const BASE_KEY  = 'portfolio_draft_base_v1';   // versión publicada sobre la que se hizo el borrador
  const THEME_KEY = 'portfolio_theme';

  // ⚠️ CAMBIA AQUÍ tus datos de GitHub (se usan para prellenar el modal)
  const GH_DEFAULTS = {
    owner:  'TU-USUARIO',   // ej: 'juanperez'
    repo:   'TU-REPO',      // ej: 'portafolio'
    branch: 'main',
    path:   'projects.json'
  };
  const DEFAULT_TITLE = document.title;

  /* ---------- Acceso de administrador (solo hash, nunca la contraseña) ---------- */
  const AUTH = { user: 'javier.c', salt: '952b89db6657110046fdfc2a124e5926', iter: 150000, hash: 'b230dbdf020354674f09fd324b6d6fb40c0249215d971b292da61bb83df5ac5b' };
  const SECS = [['proyectos','Proyectos'],['galeria','Galería'],['aplicaciones','Aplicaciones'],['habilidades','Habilidades'],['experiencia','Experiencia'],['contacto','Contacto']];
  const enc = new TextEncoder();
  const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const showAll = () => state.admin && !state.preview;                       // el admin ve todo, salvo en "vista pública"
  const vis = arr => (arr || []).filter(x => showAll() || !x.hidden);       // oculta elementos marcados
  const ph = (o, k) => !showAll() && !!(o && o.hide && o.hide[k]);          // campo oculto de perfil/contacto
  const secHidden = k => !!((state.data && state.data.site) || {})[k + '_hide'];
  const badge = x => (x && x.hidden && showAll()) ? ' <span class="badge-hidden">Oculto</span>' : '';

  /* ---------- Movimiento y capas (modales, lightbox) ---------- */
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CLOSE_MS = 160;
  const isOpen = el => el.classList.contains('open') && !el.classList.contains('closing');
  // El scroll del fondo se bloquea mientras haya CUALQUIER capa abierta (modal, PDF, lightbox)
  const syncScrollLock = () => { document.body.style.overflow = $$('.modal.open:not(.closing), .lightbox.open:not(.closing)').length ? 'hidden' : ''; };
  function showLayer(el) {
    clearTimeout(el._t);
    if (!el.classList.contains('open')) el._from = document.activeElement;
    el.classList.remove('closing');
    el.classList.add('open');
    syncScrollLock();
    const f = el.querySelector('.modal-dialog') || el.querySelector('.lb-close');
    if (f) { if (f.classList.contains('modal-dialog')) f.tabIndex = -1; f.focus({ preventScroll: true }); }
  }
  function hideLayer(el) {
    if (!isOpen(el)) return;
    const end = () => {
      el.classList.remove('open', 'closing'); syncScrollLock();
      const f = el._from; el._from = null;
      if (f && f.isConnected && f.focus && !$$('.modal.open, .lightbox.open').length) f.focus({ preventScroll: true });
    };
    if (reduceMotion()) return end();
    el.classList.add('closing'); syncScrollLock();
    el._t = setTimeout(end, CLOSE_MS);
  }
  const PUBLIC_SECS = ['inicio', ...SECS.map(x => x[0])];
  const ANIM_GROUPS = '.grid-cards > *, .gallery-grid > *, .skills-grid > *, .timeline > *, .contact-grid > *, .grid-2 > *';
  // Entrada escalonada y ligera del contenido de una sección (se omite con movimiento reducido)
  function playEnter(el) {
    if (!el || reduceMotion()) return;
    $$(ANIM_GROUPS, el).forEach((n, i) => n.style.setProperty('--i', Math.min(i, 8)));
    el.classList.remove('entering'); void el.offsetWidth; el.classList.add('entering');
    clearTimeout(el._e); el._e = setTimeout(() => el.classList.remove('entering'), 1000);
  }
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('is-loading', on); };

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
  }

  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="#1e3a5f" width="400" height="300"/><text x="200" y="155" fill="#7d9bc0" font-family="sans-serif" font-size="14" text-anchor="middle">Imagen</text></svg>`
  );
  const PLACEHOLDER_SQ = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#1e3a5f" width="200" height="200"/><text x="100" y="105" fill="#7d9bc0" font-family="sans-serif" font-size="12" text-anchor="middle">Foto</text></svg>`
  );

  const FALLBACK = {
    profile: {
      name: 'Tu Nombre Completo',
      role: 'Ingeniero en Diseño Industrial',
      specialty: 'CAD/CAM · Modelado 3D · Tecnología de la Madera',
      description: 'Especialista en diseño de producto, ingeniería de fabricación y desarrollo de soluciones técnicas con enfoque en eficiencia y precisión.',
      photo: 'assets/profile.jpg',
      status: 'Disponible para proyectos',
      cv: 'documents/cv.pdf',
      experienceYears: 8,
      specialties: ['Diseño CAD/CAM', 'Modelado 3D', 'Planos técnicos', 'Tecnología de la madera', 'Manufactura', 'Desarrollo web']
    },
    categories: ['Todos', 'Diseño CAD', 'Diseño CAM', 'Modelado 3D', 'Tecnología de la madera', 'Desarrollo web', 'Ingeniería'],
    projects: [
      {
        id: 'p1', name: 'Mesa de ensamble modular',
        category: 'Diseño CAD',
        description: 'Diseño paramétrico de mesa modular con ensambles sin herrajes, orientada a producción en serie.',
        date: '2024-08', software: ['SolidWorks', 'AutoCAD', 'KeyShot'],
        images: ['assets/p1-1.jpg', 'assets/p1-2.jpg'],
        documents: [{ label: 'Plano de despiece', url: 'documents/p1-planos.pdf' }, { label: 'Memoria técnica', url: 'documents/p1-memoria.pdf' }],
        links: [{ label: 'Ver en Behance', url: 'https://www.behance.net/' }],
        notes: 'Optimizado para corte CNC. Tolerancias ±0.5 mm.', featured: true
      },
      {
        id: 'p2', name: 'Prototipo de silla ergonómica',
        category: 'Modelado 3D',
        description: 'Modelado y render fotorrealista de silla ergonómica. Estudio antropométrico y superficies clase A.',
        date: '2023-11', software: ['Rhino', 'Blender', 'KeyShot'],
        images: ['assets/p2-1.jpg'],
        documents: [{ label: 'Ficha técnica', url: 'documents/p2-ficha.pdf' }],
        links: [], notes: 'Render final a 4K para catálogo comercial.', featured: true
      },
      {
        id: 'p3', name: 'Mecanizado de pieza estructural',
        category: 'Diseño CAM',
        description: 'Programación CAM y simulación de mecanizado 3 ejes para pieza estructural.',
        date: '2023-05', software: ['Mastercam', 'Fusion 360'],
        images: ['assets/p3-1.jpg'],
        documents: [{ label: 'Programa CAM (PDF)', url: 'documents/p3-cam.pdf' }],
        links: [], notes: 'Reducción de tiempo de ciclo del 18%.', featured: false
      },
      {
        id: 'p4', name: 'Despiece y armado de mobiliario',
        category: 'Tecnología de la madera',
        description: 'Proyecto de mobiliario en madera maciza con ensamble a cola de milano.',
        date: '2022-10', software: ['AutoCAD', 'SketchUp'],
        images: ['assets/p4-1.jpg', 'assets/p4-2.jpg'],
        documents: [], links: [], notes: 'Acabado natural con aceite.', featured: false
      },
      {
        id: 'p5', name: 'Calculadora de despiece',
        category: 'Desarrollo web',
        description: 'Herramienta web para cálculo de despiece y optimización de corte.',
        date: '2024-02', software: ['HTML5', 'CSS3', 'JavaScript'],
        images: ['assets/p5-1.jpg'],
        documents: [], links: [{ label: 'Abrir demo', url: 'https://github.com/' }],
        notes: 'Sin dependencias externas.', featured: true
      }
    ],
    gallery: [
      { id: 'g1', title: 'Ensamble a cola de milano', description: 'Proceso artesanal en madera maciza.', category: 'Tecnología de la madera', image: 'assets/g1.jpg' },
      { id: 'g2', title: 'Render final de silla', description: 'Render fotorrealista en KeyShot.', category: 'Modelado 3D', image: 'assets/g2.jpg' },
      { id: 'g3', title: 'Taller de mecanizado', description: 'Centro de mecanizado CNC de 3 ejes.', category: 'Maquinaria', image: 'assets/g3.jpg' },
      { id: 'g4', title: 'Pieza terminada', description: 'Componente estructural finalizado.', category: 'Productos terminados', image: 'assets/g4.jpg' },
      { id: 'g5', title: 'Plano de explosión', description: 'Vista explosionada del ensamble.', category: 'Diseño CAD', image: 'assets/g5.jpg' },
      { id: 'g6', title: 'Proceso de lijado', description: 'Acabado manual de superficie.', category: 'Procesos de fabricación', image: 'assets/g6.jpg' }
    ],
    apps: [
      {
        id: 'a1', name: 'Calculadora de despiece',
        description: 'Herramienta para optimizar el corte de tableros y calcular materiales.',
        image: 'assets/app1.jpg',
        technologies: ['HTML5', 'CSS3', 'JavaScript'],
        functionality: 'Calcula cantidad de piezas, área total y desperdicio estimado.',
        url: 'https://github.com/', repo: 'https://github.com/'
      }
    ],
    skills: [
      { id: 's1', name: 'SolidWorks', category: 'Diseño CAD', level: 90, description: 'Modelado paramétrico, ensambles y planos.' },
      { id: 's2', name: 'AutoCAD', category: 'Diseño CAD', level: 88, description: 'Planos técnicos 2D y documentación.' },
      { id: 's3', name: 'Mastercam', category: 'Diseño CAM', level: 80, description: 'Programación y simulación de mecanizado.' },
      { id: 's4', name: 'Blender', category: 'Modelado 3D', level: 85, description: 'Modelado, renderizado y animación.' },
      { id: 's5', name: 'Tecnología de la madera', category: 'Tecnología de la madera', level: 92, description: 'Ensamble, corte y acabado profesional.' },
      { id: 's6', name: 'Desarrollo web', category: 'Desarrollo de aplicaciones', level: 78, description: 'HTML5, CSS3, JavaScript y Git.' }
    ],
    experience: [
      {
        id: 'e1', company: 'Empresa Ejemplo S.A.', position: 'Diseñador Industrial',
        period: '2021 — Actualidad',
        activities: ['Diseño de producto y planos técnicos.', 'Coordinación con producción.'],
        achievements: ['Reducción de costos del 12%.', 'Implementación de biblioteca CAD.']
      },
      {
        id: 'e2', company: 'Taller Técnico Ejemplo', position: 'Técnico en CAD/CAM',
        period: '2018 — 2021',
        activities: ['Programación CAM.', 'Verificación de piezas.'],
        achievements: ['Optimización de tiempos de ciclo en 15%.']
      }
    ],
    contact: {
      email: 'tucorreo@ejemplo.com',
      linkedin: 'https://www.linkedin.com/',
      github: 'https://github.com/',
      phone: '+00 000 000 000',
      cv: 'documents/cv.pdf'
    }
  };

  const state = {
    data: null,
    section: 'inicio',
    isDraft: false,
    adminTab: 'profile',
    projectFilter: 'Todos',
    projectQuery: '',
    galleryFilter: 'Todas',
    lightbox: { items: [], index: 0 },
    ghBusy: false,
    admin: false,
    preview: false,
    pw: null
  };

  async function loadData() {
    let pub;
    state.usedFallback = false;
    try {
      const res = await fetch('projects.json?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      pub = await res.json();
    } catch (e) { pub = JSON.parse(JSON.stringify(FALLBACK)); state.usedFallback = true; }
    state.data = pub; state.isDraft = false;
    state.baseJson = JSON.stringify(pub);
    if (state.admin) {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          const d = JSON.parse(draft);
          if (JSON.stringify(d) === JSON.stringify(pub)) { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(BASE_KEY); }
          else { state.data = d; state.isDraft = true; state.baseJson = localStorage.getItem(BASE_KEY) || state.baseJson; }
        } catch (e) { /* ignora */ }
      }
    }
  }

  function saveDraft() {
    try {
      if (!localStorage.getItem(DRAFT_KEY) && state.baseJson) localStorage.setItem(BASE_KEY, state.baseJson);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.data)); state.isDraft = true; $('#draftBanner').hidden = false;
    }
    catch (e) { toast('No se pudo guardar el borrador local.', 'error'); }
  }

  function clearDraft() {
    if (!window.confirm('¿Descartar los cambios que aún no has subido a GitHub? Se perderán.')) return;
    localStorage.removeItem(BASE_KEY);
    localStorage.removeItem(DRAFT_KEY);
    state.isDraft = false;
    $('#draftBanner').hidden = true;
    toast('Borrador local descartado.', 'success');
    loadData().then(() => { renderAll(); });
  }

  function navigate(section, fromHistory = false) {
    if (section === 'admin' && !state.admin) { openLogin(); return; }
    if (section !== 'inicio' && section !== 'admin' && secHidden(section) && !showAll()) section = 'inicio';
    const first = !state.started, changed = section !== state.section;
    state.started = true; state.section = section;
    $$('.section').forEach(el => el.classList.remove('active'));
    const target = $('#section-' + section);
    if (target) target.classList.add('active');
    $$('.nav-item').forEach(b => {
      const on = b.dataset.nav === section;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    closeSidebar();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    if (changed || first) playEnter(target);
    // Historial: el botón «Atrás» del navegador/móvil vuelve a la sección anterior (el panel admin no se registra)
    if (!fromHistory && changed && section !== 'admin') history.pushState({ s: section }, '', section === 'inicio' ? location.pathname + location.search : '#' + section);
    if (section === 'admin') renderAdmin();
  }

  function openSidebar() { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); $('#menuBtn').setAttribute('aria-expanded', 'false'); }

  function renderHome() {
    const p = state.data.profile || {};
    const img = $('#profilePhoto');
    img.src = p.photo || PLACEHOLDER_SQ;
    img.onerror = () => { img.src = PLACEHOLDER_SQ; };
    $('#profileName').textContent = p.name || 'Sin nombre';
    $('#profileRole').textContent = p.role || '';
    $('#profileSpecialty').textContent = p.specialty || '';
    $('#profileDesc').textContent = p.description || '';
    $('#profileStatus').textContent = p.status || 'Disponible';
    $('#brandName').textContent = (p.name || 'Portafolio').split(' ')[0] || 'Portafolio';
    $('#brandRole').textContent = p.role || '';
    $('#brandLogo').textContent = (p.name || 'PN').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const cvUrl = p.cv || 'documents/cv.pdf';
    $('#btnCv').href = cvUrl;
    [['photo','.hero-media'],['status','#profileStatus'],['role','#profileRole'],['specialty','#profileSpecialty'],['description','#profileDesc'],['experienceYears','#profileStats'],['specialties','#profileSpecialties'],['cv','#btnCv']]
      .forEach(([k, sel]) => { $(sel).style.display = ph(p, k) ? 'none' : ''; });
    $('.hero').classList.toggle('no-photo', ph(p, 'photo'));
    const hs = $('#homeSpecialties').closest('.card'); if (hs) hs.style.display = (ph(p, 'specialties') || (!(p.specialties || []).length && !showAll())) ? 'none' : '';

    const stats = [
      { n: p.experienceYears || 0, l: 'Años de experiencia' },
      { n: (vis(state.data.projects)).length, l: 'Proyectos' },
      { n: (vis(state.data.apps)).length, l: 'Aplicaciones' },
      { n: (vis(state.data.skills)).length, l: 'Habilidades' }
    ];
    $('#profileStats').innerHTML = stats.map(s => `<div class="stat"><strong>${esc(s.n)}</strong><span>${esc(s.l)}</span></div>`).join('');
    $('#profileSpecialties').innerHTML = (p.specialties || []).map(s => `<span class="chip">${esc(s)}</span>`).join('');
    $('#homeSpecialties').innerHTML = (p.specialties || []).slice(0, 6).map(s => `
      <div class="mini-item"><span class="dot"></span><span>${esc(s)}</span></div>`).join('') || '<p class="muted small">Sin especialidades configuradas.</p>';

    const featured = (vis(state.data.projects)).filter(pr => pr.featured).slice(0, 5);
    $('#homeFeatured').innerHTML = featured.length
      ? featured.map(pr => `<div class="mini-item"><span class="dot"></span><span>${esc(pr.name)}</span><span class="meta">${esc(pr.category || '')}</span></div>`).join('')
      : (showAll() ? '<p class="muted small">Marca proyectos como "destacado" desde el panel.</p>' : '');
    const hf = $('#homeFeatured').closest('.card'); if (hf) hf.style.display = (!featured.length && !showAll()) ? 'none' : '';
  }

  function renderProjectFilters() {
    const cats = ['Todos', ...new Set((vis(state.data.projects)).map(p => p.category).filter(Boolean))];
    if (!cats.includes(state.projectFilter)) state.projectFilter = 'Todos';
    $('#projectFilters').innerHTML = cats.map(c =>
      `<button class="filter-chip ${state.projectFilter === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
    $$('#projectFilters .filter-chip').forEach(b => b.addEventListener('click', () => {
      state.projectFilter = b.dataset.cat; renderProjectFilters(); renderProjects(); playEnter($('#section-proyectos'));
    }));
  }

  function filteredProjects() {
    const q = state.projectQuery.trim().toLowerCase();
    return (vis(state.data.projects)).filter(p => {
      const catOK = state.projectFilter === 'Todos' || p.category === state.projectFilter;
      if (!catOK) return false;
      if (!q) return true;
      const hay = [p.name, p.description, p.category, p.notes, ...(p.software || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function renderProjects() {
    const grid = $('#projectGrid');
    const items = filteredProjects();
    $('#projectsCount').textContent = items.length + ' proyecto' + (items.length === 1 ? '' : 's');
    $('#projectsEmpty').hidden = items.length !== 0;

    grid.innerHTML = items.map(p => `
      <article class="project-card" data-id="${esc(p.id)}" role="button" tabindex="0" aria-label="Abrir proyecto: ${esc(p.name)}">
        <div class="project-thumb">
          <img src="${esc(p.images?.[0] || PLACEHOLDER)}" alt="${esc(p.name)}" loading="lazy"
               onerror="this.src='${PLACEHOLDER}'">
        </div>
        <div class="project-body">
          <span class="project-cat">${esc(p.category || 'Sin categoría')}${badge(p)}</span>
          <h3 class="project-title">${esc(p.name)}</h3>
          <p class="project-desc">${esc(p.description || '')}</p>
          <div class="project-tags">${(p.software || []).slice(0, 4).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
          <div class="project-foot">
            <span>${esc(p.date || '')}</span>
            <span>${(p.documents || []).length} doc · ${(p.images || []).length} foto</span>
          </div>
        </div>
      </article>
    `).join('');

    $$('#projectGrid .project-card').forEach(card => {
      card.addEventListener('click', () => openProjectModal(card.dataset.id));
    });
  }

  function openProjectModal(id) {
    const p = (vis(state.data.projects)).find(x => x.id === id);
    if (!p) return;
    $('#pmTitle').textContent = p.name;
    const images = (p.images || []).map((src, i) => `
      <img src="${esc(src)}" alt="${esc(p.name)} ${i + 1}" loading="lazy"
           style="width:100%;border-radius:10px;cursor:zoom-in;margin-bottom:8px;"
           data-lightbox-src="${esc(src)}" data-lightbox-title="${esc(p.name)}"
           onerror="this.src='${PLACEHOLDER}'">`).join('');

    const docs = (p.documents || []).map(d => `
      <div class="admin-item" style="margin-bottom:6px;">
        <div><strong>${esc(d.label || 'Documento')}</strong></div>
        <div class="row-actions">
          <button class="btn btn-sm btn-outline" data-pdf="${esc(d.url)}" data-pdf-name="${esc(d.label || 'Documento')}">Ver PDF</button>
          <a class="btn btn-sm btn-ghost" href="${esc(d.url)}" download>⬇</a>
        </div>
      </div>`).join('');

    const models = (p.models || []).map(m => `
      <div style="margin-bottom:16px;">
        <strong>${esc(m.label || 'Modelo 3D')}</strong>
        <model-viewer src="${esc(m.url)}" alt="${esc(m.label || 'Modelo 3D')}" camera-controls touch-action="pan-y" auto-rotate
          shadow-intensity="1" exposure="1" loading="eager" reveal="auto" ${(p.images || [])[0] ? `poster="${esc(p.images[0])}"` : ''} ar ar-modes="webxr scene-viewer quick-look"
          style="display:block;width:100%;height:360px;margin-top:6px;border-radius:10px;background:var(--surface-2);"></model-viewer>
        <p class="muted small" style="margin:6px 0 0;">Arrastra para girar · rueda o pellizco para acercar · en celular puedes verlo en realidad aumentada.</p>
      </div>`).join('');

    const links = (p.links || []).map(l => `
      <a class="btn btn-sm btn-outline" href="${esc(l.url)}" target="_blank" rel="noopener">↗ ${esc(l.label || l.url)}</a>`).join(' ');

    $('#pmBody').innerHTML = `
      <p><strong>Categoría:</strong> ${esc(p.category || '—')} &nbsp;·&nbsp; <strong>Fecha:</strong> ${esc(p.date || '—')}</p>
      <h3>Descripción</h3>
      <p>${esc(p.description || '—')}</p>
      ${(p.software || []).length ? `<h3>Software utilizado</h3><div class="project-tags">${p.software.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : ''}
      ${images ? `<h3>Fotografías</h3>${images}` : ''}
      ${models ? `<h3>Modelos 3D</h3>${models}` : ''}
      ${docs ? `<h3>Documentos PDF</h3>${docs}` : ''}
      ${links ? `<h3>Enlaces</h3><div class="row-actions">${links}</div>` : ''}
      ${p.notes ? `<h3>Observaciones técnicas</h3><p>${esc(p.notes)}</p>` : ''}
    `;

    $$('#pmBody [data-pdf]').forEach(b => b.addEventListener('click', () => openPdf(b.dataset.pdf, b.dataset.pdfName)));
    $$('#pmBody [data-lightbox-src]').forEach(img => img.addEventListener('click', () => {
      const items = (p.images || []).map(s => ({ image: s, title: p.name, description: p.category || '' }));
      openLightbox(items, (p.images || []).indexOf(img.dataset.lightboxSrc));
    }));

    openModal('projectModal');
  }

  let pdfTask = 0;
  function openPdf(url, name = 'Documento') {
    $('#pdfTitle').textContent = name;
    $('#pdfOpen').href = url;
    $('#pdfDownload').href = url;
    state.pdfUrl = url; state.pdfZoom = 1;
    openModal('pdfModal');
    renderPdf();
  }
  async function renderPdf() {
    const box = $('#pdfPages'), id = ++pdfTask;
    box.innerHTML = '<p class="muted" style="padding:24px;text-align:center;">Cargando documento…</p>';
    try {
      if (!window.pdfjsLib) throw new Error('visor no disponible');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument(state.pdfUrl).promise;
      if (id !== pdfTask) return;
      box.innerHTML = '';
      const w = Math.max(280, box.clientWidth - 16) * state.pdfZoom, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (id !== pdfTask) return;
        const base = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: (w / base.width) * dpr });
        const c = document.createElement('canvas');
        c.className = 'pdf-page'; c.width = vp.width; c.height = vp.height;
        c.style.width = w + 'px'; c.style.height = (vp.height / dpr) + 'px';
        box.appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
    } catch (e) {
      if (id !== pdfTask) return;
      box.innerHTML = '<div style="padding:28px;text-align:center;"><p>No se pudo mostrar el documento aquí.</p><a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(state.pdfUrl) + '">Abrir PDF</a></div>';
    }
  }

  function openModal(id) {
    const m = $('#' + id);
    showLayer(m);
    m.setAttribute('aria-hidden', 'false');
  }
  function closeModal(id) {
    const m = $('#' + id);
    m.setAttribute('aria-hidden', 'true');
    hideLayer(m);
    if (id === 'pdfModal') { pdfTask++; setTimeout(() => { $('#pdfPages').innerHTML = ''; }, 250); }
  }

  function openLightbox(items, index = 0) {
    if (!items.length) return;
    state.lightbox = { items, index };
    showLayer($('#lightbox'));
    updateLightbox();
  }
  function updateLightbox() {
    const { items, index } = state.lightbox;
    const it = items[index];
    if (!it) return;
    const img = $('#lbImg');
    img.src = it.image || PLACEHOLDER;
    img.onerror = () => { img.src = PLACEHOLDER; };
    img.alt = it.title || '';
    img.classList.remove('lb-swap'); void img.offsetWidth; img.classList.add('lb-swap');
    $('#lbTitle').textContent = it.title || '';
    $('#lbDesc').textContent = it.description || '';
    $('#lbCount').textContent = `${index + 1} / ${items.length}`;
  }
  function lbPrev() { const { items, index } = state.lightbox; state.lightbox.index = (index - 1 + items.length) % items.length; updateLightbox(); }
  function lbNext() { const { items, index } = state.lightbox; state.lightbox.index = (index + 1) % items.length; updateLightbox(); }
  function lbClose() { hideLayer($('#lightbox')); }

  function renderGallery() {
    const cats = ['Todas', ...new Set((vis(state.data.gallery)).map(g => g.category).filter(Boolean))];
    if (!cats.includes(state.galleryFilter)) state.galleryFilter = 'Todas';
    $('#galleryFilters').innerHTML = cats.map(c =>
      `<button class="filter-chip ${state.galleryFilter === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
    $$('#galleryFilters .filter-chip').forEach(b => b.addEventListener('click', () => {
      state.galleryFilter = b.dataset.cat; renderGallery(); playEnter($('#section-galeria'));
    }));

    const items = (vis(state.data.gallery)).filter(g => state.galleryFilter === 'Todas' || g.category === state.galleryFilter);
    $('#galleryCount').textContent = items.length + ' imagen' + (items.length === 1 ? '' : 'es');
    $('#galleryEmpty').hidden = items.length !== 0;

    $('#galleryGrid').innerHTML = items.map((g, i) => `
      <div class="gallery-tile" data-idx="${i}" role="button" tabindex="0" aria-label="Ver imagen: ${esc(g.title)}">
        <img src="${esc(g.image || PLACEHOLDER_SQ)}" alt="${esc(g.title)}" loading="lazy"
             onerror="this.src='${PLACEHOLDER_SQ}'">
        <div class="overlay-txt">${esc(g.title)}${badge(g)}</div>
      </div>
    `).join('');

    $$('#galleryGrid .gallery-tile').forEach(t => {
      t.addEventListener('click', () => {
        const lbItems = items.map(g => ({ image: g.image, title: g.title, description: g.description }));
        openLightbox(lbItems, +t.dataset.idx);
      });
    });
  }

  function renderApps() {
    const apps = vis(state.data.apps);
    $('#appsGrid').innerHTML = apps.map(a => `
      <article class="project-card" style="cursor:default;">
        <div class="project-thumb">
          <img src="${esc(a.image || PLACEHOLDER)}" alt="${esc(a.name)}" loading="lazy"
               onerror="this.src='${PLACEHOLDER}'">
        </div>
        <div class="project-body">
          <h3 class="project-title">${esc(a.name)}${badge(a)}</h3>
          <p class="project-desc">${esc(a.description || '')}</p>
          <div class="project-tags">${(a.technologies || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          ${a.functionality ? `<p class="muted small" style="margin:0;">${esc(a.functionality)}</p>` : ''}
          <div class="row-actions" style="margin-top:10px;">
            ${a.url ? `<a class="btn btn-sm btn-primary" href="${esc(a.url)}" target="_blank" rel="noopener">↗ Abrir aplicación</a>` : ''}
            ${a.repo ? `<a class="btn btn-sm btn-outline" href="${esc(a.repo)}" target="_blank" rel="noopener">⧉ Repositorio</a>` : ''}
          </div>
        </div>
      </article>
    `).join('') || '<p class="muted">No hay aplicaciones registradas.</p>';
  }

  function renderSkills() {
    const skills = vis(state.data.skills);
    $('#skillsGrid').innerHTML = skills.map(s => `
      <div class="skill-card">
        <span class="skill-cat">${esc(s.category || '')}</span>
        <div class="skill-name">${esc(s.name)}${badge(s)}</div>
        <p class="skill-desc">${esc(s.description || '')}</p>
        <div class="skill-bar"><span style="width:${Math.max(0, Math.min(100, +s.level || 0))}%"></span></div>
        <div class="skill-level">${esc(s.level || 0)}%</div>
      </div>
    `).join('') || '<p class="muted">Sin habilidades registradas.</p>';
  }

  function renderExperience() {
    const items = vis(state.data.experience);
    $('#timeline').innerHTML = items.map(e => `
      <div class="tl-item">
        <div class="tl-card">
          <div class="tl-period">${esc(e.period || '')}</div>
          <div class="tl-role">${esc(e.position || '')}${badge(e)}</div>
          <div class="tl-company">${esc(e.company || '')}</div>
          ${(e.activities || []).length ? `<ul class="tl-list">${e.activities.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
          ${(e.achievements || []).length ? `<h3 style="font-size:12px;margin:10px 0 4px;color:var(--primary);text-transform:uppercase;letter-spacing:.5px;">Logros</h3><ul class="tl-list">${e.achievements.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    `).join('') || '<p class="muted">Sin experiencia registrada.</p>';
  }

  function renderContact() {
    const c = state.data.contact || {};
    const cards = [
      { key: 'email', label: 'Correo', value: c.email, href: c.email ? 'mailto:' + c.email : '', icon: '✉' },
      { key: 'linkedin', label: 'LinkedIn', value: c.linkedin, href: c.linkedin, icon: 'in' },
      { key: 'github', label: 'GitHub', value: c.github, href: c.github, icon: '⌥' },
      { key: 'phone', label: 'Teléfono', value: c.phone, href: c.phone ? 'tel:' + c.phone.replace(/\s/g, '') : '', icon: '☎' },
      { key: 'cv', label: 'Currículum', value: 'Descargar PDF', href: c.cv || 'documents/cv.pdf', icon: '⬇', download: true }
    ].filter(x => x.value && !ph(c, x.key));
    $('#contactGrid').innerHTML = cards.map(card => `
      <a class="contact-card" href="${esc(card.href)}" ${card.download ? 'download' : 'target="_blank" rel="noopener"'}>
        <div class="contact-icon">${esc(card.icon)}</div>
        <div><strong>${esc(card.label)}</strong><span>${esc(card.value)}</span></div>
      </a>
    `).join('');
  }

  function bindGlobalSearch() {
    const input = $('#globalSearch');
    const box = $('#searchResults');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { box.hidden = true; return; }
      const results = [];
      (vis(state.data.projects)).forEach(p => {
        const hay = [p.name, p.description, p.category, ...(p.software || [])].join(' ').toLowerCase();
        if (hay.includes(q)) results.push({ type: 'Proyecto', label: p.name, action: () => openProjectModal(p.id) });
      });
      (vis(state.data.apps)).forEach(a => {
        const hay = [a.name, a.description, ...(a.technologies || [])].join(' ').toLowerCase();
        if (hay.includes(q)) results.push({ type: 'App', label: a.name, action: () => navigate('aplicaciones') });
      });
      (vis(state.data.skills)).forEach(s => {
        if ((s.name + ' ' + (s.category || '')).toLowerCase().includes(q))
          results.push({ type: 'Habilidad', label: s.name, action: () => navigate('habilidades') });
      });
      if (!results.length) {
        box.innerHTML = '<div class="sr-empty">Sin resultados</div>';
      } else {
        box.innerHTML = results.slice(0, 12).map((r, i) =>
          `<div class="sr-item" data-i="${i}"><span class="sr-badge">${esc(r.type)}</span><span>${esc(r.label)}</span></div>`
        ).join('');
        $$('.sr-item', box).forEach((el, i) => el.addEventListener('click', () => {
          results[i].action(); box.hidden = true; input.value = '';
        }));
      }
      box.hidden = false;
    });
    box.addEventListener('mousedown', e => e.preventDefault());   // el campo no pierde el foco al pulsar un resultado (táctil o clic lento)
    input.addEventListener('keydown', e => { if (e.key === 'Escape') box.hidden = true; });
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 180));
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
  }
  function initTheme() {
    const t = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(t);
    $('#themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  /* =========================================================
     ADMINISTRACIÓN
     ========================================================= */
  const SCHEMAS = {
    profile: {
      label: 'Perfil', singleton: true, dataKey: 'profile',
      fields: [
        { key: 'name', label: 'Nombre completo', type: 'text' },
        { key: 'role', label: 'Profesión', type: 'text' },
        { key: 'specialty', label: 'Especialidad (subtítulo)', type: 'text' },
        { key: 'status', label: 'Estado (pill)', type: 'text' },
        { key: 'experienceYears', label: 'Años de experiencia', type: 'number' },
        { key: 'photo', label: 'Ruta de la fotografía', type: 'text', hint: 'Ej: assets/profile.jpg' },
        { key: 'cv', label: 'Ruta del CV PDF', type: 'text', hint: 'Ej: documents/cv.pdf' },
        { key: 'description', label: 'Descripción profesional', type: 'textarea', full: true },
        { key: 'specialties', label: 'Especialidades (una por línea)', type: 'list', full: true }
      ]
    },
    projects: {
      label: 'Proyectos', titleKey: 'name', dataKey: 'projects',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'category', label: 'Categoría', type: 'text' },
        { key: 'date', label: 'Fecha (YYYY-MM)', type: 'text' },
        { key: 'featured', label: 'Destacado en inicio', type: 'checkbox' },
        { key: 'description', label: 'Descripción', type: 'textarea', full: true },
        { key: 'software', label: 'Software (uno por línea)', type: 'list', full: true },
        { key: 'images', label: 'Imágenes (una ruta por línea)', type: 'list', full: true, hint: 'Ej: assets/p1-1.jpg' },
        { key: 'documents', label: 'Documentos PDF (formato: Nombre|ruta.pdf, uno por línea)', type: 'pairs', full: true, hint: 'Nombre|documents/plano.pdf' },
        { key: 'links', label: 'Enlaces (formato: Etiqueta|https://…, uno por línea)', type: 'pairs', full: true },
        { key: 'notes', label: 'Observaciones técnicas', type: 'textarea', full: true }
      ]
    },
    gallery: {
      label: 'Galería', titleKey: 'title', dataKey: 'gallery',
      fields: [
        { key: 'title', label: 'Título', type: 'text', required: true },
        { key: 'category', label: 'Categoría', type: 'text' },
        { key: 'image', label: 'Ruta de la imagen', type: 'text', full: true, hint: 'Ej: assets/g1.jpg' },
        { key: 'description', label: 'Descripción', type: 'textarea', full: true }
      ]
    },
    apps: {
      label: 'Aplicaciones', titleKey: 'name', dataKey: 'apps',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'image', label: 'Portada', type: 'text', hint: 'Ej: assets/app1.jpg' },
        { key: 'description', label: 'Descripción', type: 'textarea', full: true },
        { key: 'technologies', label: 'Tecnologías (una por línea)', type: 'list', full: true },
        { key: 'functionality', label: 'Funcionalidad principal', type: 'textarea', full: true },
        { key: 'url', label: 'URL de la app', type: 'text' },
        { key: 'repo', label: 'URL del repositorio', type: 'text' }
      ]
    },
    skills: {
      label: 'Habilidades', titleKey: 'name', dataKey: 'skills',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'category', label: 'Categoría', type: 'text' },
        { key: 'level', label: 'Nivel (0–100)', type: 'number' },
        { key: 'description', label: 'Descripción', type: 'textarea', full: true }
      ]
    },
    experience: {
      label: 'Experiencia', titleKey: 'position', dataKey: 'experience',
      fields: [
        { key: 'position', label: 'Puesto', type: 'text', required: true },
        { key: 'company', label: 'Empresa', type: 'text' },
        { key: 'period', label: 'Periodo', type: 'text', hint: 'Ej: 2021 — Actualidad' },
        { key: 'activities', label: 'Actividades (una por línea)', type: 'list', full: true },
        { key: 'achievements', label: 'Logros (uno por línea)', type: 'list', full: true }
      ]
    },
    contact: {
      label: 'Contacto', singleton: true, dataKey: 'contact',
      fields: [
        { key: 'email', label: 'Correo electrónico', type: 'text' },
        { key: 'phone', label: 'Teléfono', type: 'text' },
        { key: 'linkedin', label: 'URL LinkedIn', type: 'text' },
        { key: 'github', label: 'URL GitHub', type: 'text' },
        { key: 'cv', label: 'Ruta del CV PDF', type: 'text' }
      ]
    }
  };

  ['projects','gallery','apps','skills','experience'].forEach(k =>
    SCHEMAS[k].fields.push({ key: 'hidden', label: '🚫 Ocultar al público', type: 'checkbox' }));
  SCHEMAS.profile.hideable = SCHEMAS.contact.hideable = true;
  SCHEMAS.projects.fields.splice(SCHEMAS.projects.fields.findIndex(f => f.key === 'hidden'), 0,
    { key: 'models', label: 'Modelos 3D .glb (formato: Nombre|ruta.glb, uno por línea)', type: 'pairs', full: true, hint: 'Nombre|models/pieza.glb' });
  const upl = (s, k, t) => { SCHEMAS[s].fields.find(f => f.key === k).upload = t; };
  upl('profile', 'photo', 'image'); upl('profile', 'cv', 'pdf'); upl('contact', 'cv', 'pdf');
  upl('gallery', 'image', 'image'); upl('apps', 'image', 'image');
  upl('projects', 'images', 'image'); upl('projects', 'documents', 'pdf'); upl('projects', 'models', 'glb');
  SCHEMAS.site = {
    label: 'Sitio', singleton: true, dataKey: 'site',
    fields: [
      { key: 'pageTitle', label: 'Título de la pestaña del navegador', type: 'text' },
      { key: 'footer', label: 'Texto del pie de página', type: 'text' },
      ...SECS.flatMap(([k, name]) => [
        { key: k + '_hide', label: '🚫 Ocultar sección «' + name + '» al público', type: 'checkbox', full: true },
        { key: k + '_title', label: name + ' · título', type: 'text' },
        { key: k + '_sub', label: name + ' · subtítulo', type: 'text' }
      ])
    ]
  };

  function renderAdminTabs() {
    const keys = Object.keys(SCHEMAS);
    $('#adminTabs').innerHTML = keys.map(k =>
      `<button class="tab ${state.adminTab === k ? 'active' : ''}" data-tab="${k}">${esc(SCHEMAS[k].label)}</button>`
    ).join('');
    $$('#adminTabs .tab').forEach(b => b.addEventListener('click', () => {
      state.adminTab = b.dataset.tab; renderAdmin();
      const pn = $('#adminPanel'); pn.classList.remove('tab-in'); void pn.offsetWidth; pn.classList.add('tab-in');
    }));
  }

  function renderAdmin() {
    renderAdminTabs();
    const tab = state.adminTab;
    const schema = SCHEMAS[tab];
    const panel = $('#adminPanel');

    if (schema.singleton) {
      const value = state.data[schema.dataKey] || {};
      panel.innerHTML = `
        <h2 class="h2">Editar ${esc(schema.label)}</h2>
        ${buildForm(schema, value)}
        <div class="form-actions">
          <button class="btn btn-primary" id="adminSave">💾 Guardar (borrador local)</button>
        </div>`;
      bindForm(schema, null, value, true);
    } else {
      const items = state.data[schema.dataKey] || [];
      panel.innerHTML = `
        <div class="admin-toolbar">
          <h2 class="h2" style="margin:0;">${esc(schema.label)} (${items.length})</h2>
          <button class="btn btn-primary btn-sm" id="adminAdd">+ Añadir ${esc(schema.label)}</button>
        </div>
        <div class="admin-list">
          ${items.map(it => `
            <div class="admin-item">
              <div>
                <strong>${esc(it[schema.titleKey] || it.name || it.id)}</strong>${it.hidden ? ' <span class="badge-hidden">Oculto</span>' : ''}
                ${it.category ? `<div class="muted">${esc(it.category)}</div>` : ''}
              </div>
              <div class="row-actions">
                <button class="btn btn-sm btn-outline" data-edit="${esc(it.id)}">Editar</button>
                <button class="btn btn-sm btn-ghost" data-vis="${esc(it.id)}">${it.hidden ? '👁 Mostrar' : '🚫 Ocultar'}</button>
                <button class="btn btn-sm btn-danger" data-del="${esc(it.id)}">Eliminar</button>
              </div>
            </div>`).join('') || '<p class="muted">No hay elementos todavía.</p>'}
        </div>
        <div id="adminFormWrap" style="margin-top:18px;" hidden></div>`;

      const wrap = $('#adminFormWrap');
      $('#adminAdd').addEventListener('click', () => {
        wrap.hidden = false;
        wrap.innerHTML = `<h3 class="h2">Nuevo ${esc(schema.label)}</h3>${buildForm(schema, {})}
          <div class="form-actions">
            <button class="btn btn-outline" id="adminCancel">Cancelar</button>
            <button class="btn btn-primary" id="adminSave">💾 Guardar</button>
          </div>`;
        bindForm(schema, null, {}, false, true);
        $('#adminCancel').addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
      });

      $$('.admin-item [data-edit]').forEach(b => b.addEventListener('click', () => {
        const item = items.find(x => x.id === b.dataset.edit);
        if (!item) return;
        wrap.hidden = false;
        wrap.innerHTML = `<h3 class="h2">Editar ${esc(schema.label)}</h3>${buildForm(schema, item)}
          <div class="form-actions">
            <button class="btn btn-outline" id="adminCancel">Cancelar</button>
            <button class="btn btn-primary" id="adminSave">💾 Guardar</button>
          </div>`;
        bindForm(schema, item, item, false);
        $('#adminCancel').addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
      }));

      $$('.admin-item [data-vis]').forEach(b => b.addEventListener('click', () => {
        const it = items.find(x => x.id === b.dataset.vis); if (!it) return;
        it.hidden = !it.hidden; saveDraft(); renderAll(); renderAdmin();
        toast(it.hidden ? 'Oculto al público.' : 'Visible al público.', 'success');
      }));

      $$('.admin-item [data-del]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('¿Eliminar este elemento?')) return;
        state.data[schema.dataKey] = items.filter(x => x.id !== b.dataset.del);
        saveDraft(); renderAdmin(); renderAll();
        toast('Elemento eliminado.', 'success');
      }));
    }
  }

  function buildForm(schema, value) {
    return `<div class="form-grid">${schema.fields.map(f => {
      const v = value[f.key];
      const full = f.full ? ' full' : '';
      let control = '';
      if (f.type === 'textarea') {
        control = `<textarea data-field="${f.key}" ${f.required ? 'required' : ''}>${esc(v || '')}</textarea>`;
      } else if (f.type === 'checkbox') {
        control = `<label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text);">
          <input type="checkbox" data-field="${f.key}" ${v ? 'checked' : ''} style="width:auto;"> ${esc(f.label)}</label>`;
      } else if (f.type === 'number') {
        control = `<input type="number" data-field="${f.key}" value="${esc(v ?? '')}" ${f.required ? 'required' : ''}>`;
      } else if (f.type === 'list') {
        const txt = Array.isArray(v) ? v.join('\n') : '';
        control = `<textarea data-field="${f.key}" data-type="list" ${f.required ? 'required' : ''}>${esc(txt)}</textarea>`;
      } else if (f.type === 'pairs') {
        const txt = Array.isArray(v) ? v.map(x => `${x.label || ''}|${x.url || ''}`).join('\n') : '';
        control = `<textarea data-field="${f.key}" data-type="pairs" ${f.required ? 'required' : ''}>${esc(txt)}</textarea>`;
      } else {
        control = `<input type="text" data-field="${f.key}" value="${esc(v ?? '')}" ${f.required ? 'required' : ''}>`;
      }
      return `<div class="field${full}">
        <label>${esc(f.label)}${schema.hideable ? ` <span class="hide-toggle"><input type="checkbox" data-hide="${f.key}" ${(value.hide || {})[f.key] ? 'checked' : ''}> ocultar</span>` : ''}</label>
        ${control}
        ${f.upload ? `<div style="margin-top:6px;"><button type="button" class="btn btn-sm btn-outline" data-upload="${f.upload}">📎 Subir ${f.upload === 'pdf' ? 'PDF' : f.upload === 'glb' ? 'modelo 3D (.glb)' : 'imagen'}${f.type === 'list' ? ' (una o varias)' : ''}</button>${f.upload === 'image' ? ' <label class="small" style="margin-left:8px;"><input type="checkbox" data-wm checked style="width:auto;"> Marca de agua</label>' : ''}${f.upload === 'pdf' ? ' <label class="small" style="margin-left:8px;"><input type="checkbox" data-cmp checked style="width:auto;"> Comprimir</label>' : ''}${f.upload === 'glb' ? ' <select class="input" data-tex style="width:auto;display:inline-block;margin-left:8px;padding:6px 8px;"><option value="2048">Texturas 2048 px</option><option value="1024" selected>Texturas 1024 px</option><option value="512">Texturas 512 px</option></select>' : ''}</div>` : ''}
        ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function bindForm(schema, existingItem, currentValue, singleton = false, isNew = false) {
    const saveBtn = $('#adminSave');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', () => {
      const out = singleton ? { ...currentValue } : { ...(existingItem || { id: uid() }) };
      $$('#adminPanel [data-field]').forEach(el => {
        const key = el.dataset.field;
        const type = el.dataset.type;
        if (el.type === 'checkbox') out[key] = el.checked;
        else if (el.type === 'number') out[key] = el.value === '' ? 0 : Number(el.value);
        else if (type === 'list') out[key] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (type === 'pairs') out[key] = el.value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [label, url] = line.split('|').map(s => s.trim());
          return { label: label || '', url: url || label || '' };
        });
        else out[key] = el.value;
      });

      if (schema.hideable) {
        out.hide = {};
        $$('#adminPanel [data-hide]').forEach(el => { if (el.checked) out.hide[el.dataset.hide] = true; });
      }
      const required = schema.fields.filter(f => f.required);
      for (const f of required) {
        if (!out[f.key]) { toast('El campo "' + f.label + '" es obligatorio.', 'error'); return; }
      }

      if (singleton) {
        state.data[schema.dataKey] = out;
      } else {
        const arr = state.data[schema.dataKey] = state.data[schema.dataKey] || [];
        const idx = arr.findIndex(x => x.id === out.id);
        if (idx >= 0) arr[idx] = out; else arr.push(out);
      }

      saveDraft();
      renderAll();
      renderAdmin();
      toast('Guardado como borrador local. Pulsa "Guardar en GitHub" para publicar.', 'success');
    });
  }

  /* ---------- Guardar / Exportar / Importar ---------- */
  function bindAdminIO() {
    // Exportar copia local
    $('#btnExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'projects.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 500);
      toast('Copia local descargada.', 'success');
    });

    // Importar JSON
    $('#btnImport').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object') throw new Error('Formato inválido');
          state.data = data;
          saveDraft();
          renderAll(); renderAdmin();
          toast('JSON importado. Revisa el borrador local.', 'success');
        } catch (err) {
          toast('Error al importar: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Descartar borrador
    $('#discardDraft').addEventListener('click', clearDraft);

    // Abrir modal de GitHub
    $('#btnSaveGithub').addEventListener('click', () => {
      const saved = JSON.parse(localStorage.getItem('gh_cfg') || '{}');
      $('#ghOwner').value  = saved.owner  || GH_DEFAULTS.owner;
      $('#ghRepo').value   = saved.repo   || GH_DEFAULTS.repo;
      $('#ghBranch').value = saved.branch || GH_DEFAULTS.branch;
      $('#ghPath').value   = saved.path   || GH_DEFAULTS.path;
      const hasTok = !!localStorage.getItem('gh_tok_enc');
      $('#ghToken').value = '';
      $('#ghToken').placeholder = hasTok ? '✓ Token guardado en este dispositivo (déjalo vacío)' : 'github_pat_...';
      $('#ghForget').style.display = hasTok ? '' : 'none';
      $('#ghStatus').textContent = '';
      $('#ghStatus').className = 'small';
      openModal('ghModal');
      setTimeout(() => $('#ghToken').focus(), 150);
    });

    $('#ghConfirm').addEventListener('click', saveToGitHub);
  }

  async function saveToGitHub() {
    if (state.ghBusy || !state.admin) return;
    const owner  = $('#ghOwner').value.trim();
    const repo   = $('#ghRepo').value.trim();
    const branch = $('#ghBranch').value.trim() || 'main';
    const path   = $('#ghPath').value.trim() || 'projects.json';
    const typed  = $('#ghToken').value.trim();
    let token = typed;
    if (!token && state.pw && localStorage.getItem('gh_tok_enc')) {
      try { token = await openToken(state.pw, localStorage.getItem('gh_tok_enc')); } catch (e) { /* ignora */ }
    }
    const msg    = $('#ghMsg').value.trim() || 'Actualizar portafolio desde el panel';

    const status = $('#ghStatus');
    const setStatus = (txt, cls) => { status.textContent = txt; status.className = 'small ' + (cls || ''); };

    if (!owner || !repo) { setStatus('Faltan usuario y/o repositorio.', 'err'); return; }
    if (!token)          { setStatus('Falta el token de GitHub.', 'err'); return; }
    if (!/^github_pat_|^ghp_/.test(token)) {
      setStatus('El token no parece válido (debe empezar por github_pat_ o ghp_).', 'err'); return;
    }

    if (state.usedFallback) {
      setStatus('❌ No se pudo cargar projects.json del sitio y se muestran datos de ejemplo. Recarga la página antes de guardar para no sobrescribir tus datos.', 'err'); return;
    }
    state.ghBusy = true;
    const btn = $('#ghConfirm');
    busy(btn, true);
    btn.textContent = 'Guardando…';
    setStatus('Conectando con GitHub…', 'work');

    localStorage.setItem('gh_cfg', JSON.stringify({ owner, repo, branch, path }));

    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    try {
      // 1) Obtener SHA actual (si existe)
      let sha = null;
      setStatus('Leyendo archivo actual…', 'work');
      const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
      if (getRes.ok) {
        const meta = await getRes.json();
        sha = meta.sha;
        let remoteObj = null;
        try { remoteObj = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((meta.content || '').replace(/\s/g, '')), ch => ch.charCodeAt(0)))); } catch (e) { /* ilegible */ }
        if (remoteObj && state.baseJson && JSON.stringify(remoteObj) !== state.baseJson && JSON.stringify(remoteObj) !== JSON.stringify(state.data)) {
          const lost = [];
          [['projects', 'Proyectos'], ['gallery', 'Galería'], ['apps', 'Aplicaciones'], ['skills', 'Habilidades'], ['experience', 'Experiencia']].forEach(([k, lab]) => {
            const have = new Set((state.data[k] || []).map(x => x.id));
            const miss = (remoteObj[k] || []).filter(x => !have.has(x.id)).map(x => x.name || x.title || x.company || x.id);
            if (miss.length) lost.push('• ' + lab + ': ' + miss.join(', '));
          });
          const ok = window.confirm('⚠️ El archivo en GitHub cambió desde que cargaste esta página (otro dispositivo o una publicación reciente).\n\n' +
            (lost.length ? 'Si continúas se PERDERÁN estos elementos que están en GitHub y no en tu versión:\n' + lost.join('\n') : 'Si continúas se sobrescribirán esos cambios.') +
            '\n\nAntes se descargará una copia del archivo actual de GitHub.\n\n¿Sobrescribir de todos modos?');
          if (!ok) { setStatus('Cancelado: no se modificó nada en GitHub. Recarga la página y revisa.', 'err'); return; }
          try {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(remoteObj, null, 2)], { type: 'application/json' }));
            a.download = 'respaldo-github-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
            a.click();
          } catch (e) { /* ignora */ }
        }
      } else if (getRes.status !== 404) {
        const errText = await getRes.text();
        throw new Error(`No se pudo leer el archivo (HTTP ${getRes.status}). ${errText.slice(0, 120)}`);
      }

      // 2) Codificar en Base64 (soporta tildes/emojis)
      setStatus('Preparando contenido…', 'work');
      const jsonStr = JSON.stringify(state.data, null, 2);
      const bytes = new TextEncoder().encode(jsonStr);
      let bin = '';
      bytes.forEach(b => bin += String.fromCharCode(b));
      const contentB64 = btoa(bin);

      // 3) PUT con el nuevo contenido
      setStatus('Subiendo a GitHub…', 'work');
      const body = { message: msg, content: contentB64, branch };
      if (sha) body.sha = sha;

      const putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        let detail = '';
        try { const j = await putRes.json(); detail = j.message || ''; } catch {}
        throw new Error(`GitHub respondió ${putRes.status}. ${detail}`);
      }

      if (typed && state.pw && $('#ghRemember').checked) {
        try { localStorage.setItem('gh_tok_enc', await sealToken(state.pw, typed)); } catch (e) { /* ignora */ }
      }
      const putJson = await putRes.json();
      const commitUrl = putJson.commit?.html_url || '';
      setStatus('✅ Guardado. GitHub Pages publicará los cambios en 1–3 minutos.', 'ok');
      toast('Cambios subidos a GitHub correctamente.', 'success');

      // Copia de seguridad (no afecta la web pública)
      try { localStorage.setItem('portfolio_backup_last', jsonStr); } catch {}
      state.baseJson = JSON.stringify(state.data);
      try { localStorage.setItem(BASE_KEY, state.baseJson); } catch {}

      if (commitUrl) {
        const link = document.createElement('a');
        link.href = commitUrl; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = 'Ver commit en GitHub ↗';
        link.style.cssText = 'display:inline-block;margin-top:8px;font-size:13px;';
        status.appendChild(document.createElement('br'));
        status.appendChild(link);
      }
    } catch (err) {
      console.error(err);
      setStatus('❌ ' + (err.message || 'Error desconocido.'), 'err');
      toast('No se pudo guardar en GitHub: ' + (err.message || ''), 'error');
    } finally {
      state.ghBusy = false;
      busy(btn, false);
      btn.textContent = '💾 Confirmar guardado';
      $('#ghToken').value = '';
    }
  }

  /* ---------- Acceso ---------- */
  async function derive(pw, tag) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(AUTH.salt + ':' + tag), iterations: AUTH.iter, hash: 'SHA-256' }, base, 256);
  }
  async function aesKey(pw) { return crypto.subtle.importKey('raw', await derive(pw, 'tok'), 'AES-GCM', false, ['encrypt', 'decrypt']); }
  async function sealToken(pw, tok) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(pw), enc.encode(tok));
    return hex(iv) + ':' + hex(ct);
  }
  async function openToken(pw, s) {
    const [iv, ct] = s.split(':');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(iv) }, await aesKey(pw), unhex(ct)));
  }
  function openLogin() { $('#loginStatus').textContent = ''; openModal('loginModal'); setTimeout(() => $('#loginUser').focus(), 150); }
  async function doLogin() {
    const btn = $('#loginConfirm'); if (btn.disabled) return;
    busy(btn, true);
    try { await tryLogin(); } finally { busy(btn, false); }
  }
  async function tryLogin() {
    const st = $('#loginStatus'), u = $('#loginUser').value.trim(), p = $('#loginPass').value;
    if (!window.crypto || !crypto.subtle) { st.textContent = '❌ Abre el sitio por https (GitHub Pages) para iniciar sesión.'; st.className = 'small err'; return; }
    const ok = u === AUTH.user && hex(await derive(p, 'auth')) === AUTH.hash;
    if (!ok) { st.textContent = '❌ Usuario o contraseña incorrectos.'; st.className = 'small err'; return; }
    state.admin = true; state.pw = p; $('#loginPass').value = '';
    closeModal('loginModal');
    await loadData(); applyAdminUI(); renderAll(); navigate('admin');
    toast('Sesión iniciada.', 'success');
  }
  function logout() {
    state.admin = false; state.preview = false; state.pw = null;
    setPreviewLabel();
    loadData().then(() => { applyAdminUI(); renderAll(); navigate('inicio'); });
  }
  function setPreviewLabel() {
    const b = $('#previewBtn'), t = state.preview ? 'Volver a editar' : 'Vista pública';
    b.innerHTML = '<span aria-hidden="true">' + (state.preview ? '✏️' : '👁') + '</span><span class="lbl">' + t + '</span>';
    b.setAttribute('aria-label', t);
  }
  function applyAdminUI() {
    const on = state.admin;
    ['navAdmin', 'adminBtn', 'previewBtn', 'logoutBtn'].forEach(id => { $('#' + id).style.display = on ? '' : 'none'; });
    $('#loginLink').style.display = on ? 'none' : '';
  }
  function applySite() {
    const s = state.data.site || {};
    SECS.forEach(([k]) => {
      const hid = !!s[k + '_hide'], off = hid && !showAll();
      $$('[data-nav="' + k + '"]').forEach(b => { b.style.display = off ? 'none' : ''; if (b.classList.contains('nav-item')) b.classList.toggle('is-hidden', hid); });
      const h = $('#section-' + k + ' .h1'), d = $('#section-' + k + ' .section-head .muted');
      if (h) { h.dataset.def = h.dataset.def || h.textContent; h.textContent = s[k + '_title'] || h.dataset.def; }
      if (d) { d.dataset.def = d.dataset.def || d.textContent; d.textContent = s[k + '_sub'] || d.dataset.def; }
    });
    document.title = s.pageTitle || DEFAULT_TITLE;
    const ft = $('#footerText'); ft.dataset.def = ft.dataset.def || ft.textContent; ft.textContent = s.footer || ft.dataset.def;
  }
  function bindAuth() {
    $('#loginConfirm').addEventListener('click', doLogin);
    $('#loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('#loginLink').addEventListener('click', e => { e.preventDefault(); openLogin(); });
    $('#logoutBtn').addEventListener('click', logout);
    $('#previewBtn').addEventListener('click', () => {
      state.preview = !state.preview;
      setPreviewLabel();
      if (state.preview && state.section === 'admin') navigate('inicio');
      renderAll();
    });
    $('#ghForget').addEventListener('click', () => {
      localStorage.removeItem('gh_tok_enc'); $('#ghForget').style.display = 'none';
      $('#ghToken').placeholder = 'github_pat_...'; toast('Token olvidado en este dispositivo.', 'success');
    });
    window.addEventListener('hashchange', () => { if (location.hash === '#admin' && !state.admin) openLogin(); });
  }

  /* ---------- Subida de imágenes y PDF a GitHub ---------- */
  async function shrinkImage(file, ext, wm) {
    if (!/^(jpe?g|png|webp)$/.test(ext)) return { blob: file, ext };          // gif/svg: tal cual
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      if (wm) {                                                     // marca de agua diagonal repetida
        const txt = '© ' + ((state.data.profile && state.data.profile.name) || 'Portafolio');
        const fs = Math.max(16, Math.round(c.width / 28)), reach = c.width + c.height;
        ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, fs / 18);
        ctx.font = '600 ' + fs + 'px sans-serif'; ctx.rotate(-Math.PI / 8);
        const step = ctx.measureText(txt).width + fs * 3;
        for (let y = -reach; y < reach; y += fs * 5) for (let x = -reach; x < reach; x += step) { ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y); }
        ctx.restore();
      }
      const png = ext === 'png';
      const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.85));
      return { blob, ext: png ? 'png' : 'jpg' };
    } catch (e) { throw new Error('No se pudo procesar la imagen (usa JPG, PNG o WebP).'); }
  }

  /* >>> BIG */
  // Archivos grandes: la API de "contents" de GitHub los rechaza (422); la de blobs/commits admite hasta 100 MB.
  async function ghApi(url, token, method, body) {
    const res = await fetch('https://api.github.com' + url, {
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) { let d = ''; try { d = (await res.json()).message || ''; } catch (e) {} throw new Error('GitHub respondió ' + res.status + '. ' + d); }
    return res.json();
  }
  async function putLarge(owner, repo, branch, token, path, b64, message) {
    const r = '/repos/' + owner + '/' + repo, br = branch.split('/').map(encodeURIComponent).join('/');
    const ref = await ghApi(r + '/git/ref/heads/' + br, token, 'GET');
    const parent = ref.object.sha;
    const commit = await ghApi(r + '/git/commits/' + parent, token, 'GET');
    const blob = await ghApi(r + '/git/blobs', token, 'POST', { content: b64, encoding: 'base64' });
    const tree = await ghApi(r + '/git/trees', token, 'POST', { base_tree: commit.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] });
    const nc = await ghApi(r + '/git/commits', token, 'POST', { message, tree: tree.sha, parents: [parent] });
    await ghApi(r + '/git/refs/heads/' + br, token, 'PATCH', { sha: nc.sha });
  }
  /* <<< BIG */

  async function uploadFile(file, kind, opt = {}, step = () => {}) {
    if (!state.admin) throw new Error('Inicia sesión.');
    const cfg = JSON.parse(localStorage.getItem('gh_cfg') || '{}');
    const owner = cfg.owner || GH_DEFAULTS.owner, repo = cfg.repo || GH_DEFAULTS.repo, branch = cfg.branch || GH_DEFAULTS.branch;
    if (/^TU-/.test(owner) || /^TU-/.test(repo)) throw new Error('Primero pulsa «Guardar en GitHub» una vez para registrar usuario y repositorio.');
    const stored = localStorage.getItem('gh_tok_enc');
    if (!stored || !state.pw) throw new Error('Falta el token: guarda una vez en GitHub con «Recordar token» marcado.');
    const token = await openToken(state.pw, stored);

    let blob = file, ext = (file.name.split('.').pop() || '').toLowerCase();
    if (kind === 'image') {
      if (!file.type.startsWith('image/')) throw new Error('Elige un archivo de imagen.');
      ({ blob, ext } = await shrinkImage(file, ext, opt.wm));
    } else if (kind === 'glb') {
      if (ext !== 'glb') throw new Error('Solo se permiten archivos .glb.');
      step('Optimizando modelo…'); blob = await optimizeGlb(file, opt.tex || 1024, step);
    } else {
      if (ext !== 'pdf') throw new Error('Solo se permiten archivos PDF.');
      if (opt.compress) { step('Comprimiendo PDF…'); blob = await compressPdf(file, step); }
    }
    if (blob !== file) toast('Optimizado: ' + (file.size / 1048576).toFixed(1) + ' MB → ' + (blob.size / 1048576).toFixed(1) + ' MB');
    const maxMb = 60;   // tope razonable para subir desde el navegador (memoria del celular)
    if (blob.size > maxMb * 1024 * 1024) throw new Error('Pesa ' + (blob.size / 1048576).toFixed(1) + ' MB' + (blob !== file ? ' incluso optimizado' : '') + ' y el límite es ' + maxMb + ' MB. ' +
      (kind === 'glb' ? 'Elige texturas de 512 px o simplifica la malla (Decimate en Blender).' : 'Divide o reduce el PDF.'));
    step('Subiendo ' + (blob.size / 1048576).toFixed(1) + ' MB…');
    if (kind === 'glb' && blob.size > 8 * 1024 * 1024) toast('El modelo pesa ' + (blob.size / 1048576).toFixed(1) + ' MB y tardará en abrir. Conviene optimizarlo (compresión Draco y texturas de 1024 px).');

    const base = file.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'archivo';
    const path = (kind === 'pdf' ? 'documents/' : kind === 'glb' ? 'models/' : 'assets/') + base + '-' + Date.now().toString(36) + '.' + ext;
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
      r.readAsDataURL(blob);
    });
    if (blob.size > 20 * 1024 * 1024) {
      step('Subiendo archivo grande (' + (blob.size / 1048576).toFixed(1) + ' MB)… puede tardar');
      await putLarge(owner, repo, branch, token, path, b64, 'Subir ' + path);
      return { path, name: file.name.replace(/\.[^.]+$/, '') };
    }
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Subir ' + path, content: b64, branch })
    });
    if (!res.ok) { let d = ''; try { d = (await res.json()).message || ''; } catch (e) {} throw new Error(`GitHub respondió ${res.status}. ${d}`); }
    return { path, name: file.name.replace(/\.[^.]+$/, '') };
  }

  /* >>> OPT */
  // Reduce las texturas incrustadas de un .glb (normalmente lo que más pesa). La geometría no se toca.
  async function shrinkTexture(bytes, mime, maxTex) {
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const k = Math.min(1, maxTex / Math.max(bmp.width, bmp.height));
    if (k === 1 && bytes.length < 400 * 1024) { if (bmp.close) bmp.close(); return null; }
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    let alpha = false;
    if (mime === 'image/png') { const d = ctx.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4) { if (d[i] < 255) { alpha = true; break; } } }
    const blob = await new Promise(r => c.toBlob(r, alpha ? 'image/png' : 'image/jpeg', 0.85));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: alpha ? 'image/png' : 'image/jpeg' };
  }

  async function optimizeGlb(file, maxTex, step) {
    const buf = await file.arrayBuffer(), dv = new DataView(buf);
    if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(4, true) !== 2) throw new Error('El archivo no es un GLB válido.');
    let off = 12, json = null, bin = null;
    while (off + 8 <= buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), start = off + 8;
      if (type === 0x4E4F534A && !json) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len)));
      else if (type === 0x004E4942 && !bin) bin = new Uint8Array(buf, start, len);
      off = start + len;
    }
    if (!json || !bin || !json.images || !json.images.length || !json.bufferViews) return file;
    const imgOf = new Map();
    json.images.forEach((im, i) => { if (im.bufferView !== undefined) imgOf.set(im.bufferView, i); });
    const parts = []; let pos = 0, done = 0;
    for (let i = 0; i < json.bufferViews.length; i++) {
      const bv = json.bufferViews[i];
      if ((bv.buffer || 0) !== 0) continue;
      const o0 = bv.byteOffset || 0;
      let bytes = bin.subarray(o0, o0 + bv.byteLength);
      if (imgOf.has(i)) {
        const im = json.images[imgOf.get(i)];
        step('Optimizando texturas (' + (++done) + '/' + imgOf.size + ')…');
        try {
          const r = await shrinkTexture(bytes, im.mimeType || 'image/png', maxTex);
          if (r && r.bytes.length < bytes.length) { bytes = r.bytes; im.mimeType = r.mime; }
        } catch (e) { /* deja la textura original */ }
      }
      const pad = (4 - pos % 4) % 4;
      if (pad) { parts.push(new Uint8Array(pad)); pos += pad; }
      bv.byteOffset = pos; bv.byteLength = bytes.length;
      parts.push(bytes); pos += bytes.length;
    }
    const binLen = pos + ((4 - pos % 4) % 4);
    json.buffers[0].byteLength = binLen;
    const js = new TextEncoder().encode(JSON.stringify(json));
    const jl = js.length + ((4 - js.length % 4) % 4);
    const total = 12 + 8 + jl + 8 + binLen;
    const out = new Uint8Array(total), o = new DataView(out.buffer);
    o.setUint32(0, 0x46546C67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
    o.setUint32(12, jl, true); o.setUint32(16, 0x4E4F534A, true);
    out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + jl);
    const b0 = 20 + jl;
    o.setUint32(b0, binLen, true); o.setUint32(b0 + 4, 0x004E4942, true);
    let p = b0 + 8;
    for (const part of parts) { out.set(part, p); p += part.length; }
    return new Blob([out], { type: 'model/gltf-binary' });
  }

  // PDF: dibuja cada página como imagen JPEG y arma un PDF nuevo (más liviano; el texto deja de ser seleccionable)
  function buildPdf(pages) {
    const te = new TextEncoder(), chunks = [], offs = []; let len = 0;
    const add = d => { const b = typeof d === 'string' ? te.encode(d) : d; chunks.push(b); len += b.length; };
    const obj = (id, body) => { offs[id] = len; add(id + ' 0 obj\n' + body + '\nendobj\n'); };
    const n = pages.length, total = 3 + 3 * n;
    add('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + pages.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] >>');
    pages.forEach((p, i) => {
      const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2, w = p.w.toFixed(2), h = p.h.toFixed(2);
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>');
      const cs = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q';
      obj(ct, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
      offs[im] = len;
      add(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.pw + ' /Height ' + p.ph + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpg.length + ' >>\nstream\n');
      add(p.jpg); add('\nendstream\nendobj\n');
    });
    const xr = len;
    add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (let i = 1; i < total; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    add('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function compressPdf(file, step) {
    if (!window.pdfjsLib || file.size < 1.5 * 1024 * 1024) return file;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      step('Comprimiendo PDF: página ' + n + '/' + pdf.numPages + '…');
      const page = await pdf.getPage(n), base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2.5, 2200 / Math.max(base.width, base.height)) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.72));
      pages.push({ w: base.width, h: base.height, pw: c.width, ph: c.height, jpg: new Uint8Array(await blob.arrayBuffer()) });
      c.width = c.height = 1;
    }
    const out = buildPdf(pages);
    return out.size < file.size * 0.7 ? out : file;   // solo si realmente ahorra al menos 30 %
  }
  /* <<< OPT */

  function bindUploads() {
    // Disuasión para visitantes: sin menú contextual ni arrastre sobre imágenes (no es protección real)
    document.addEventListener('contextmenu', e => { if (!state.admin && e.target.closest && e.target.closest('img')) e.preventDefault(); });
    document.addEventListener('dragstart', e => { if (!state.admin && e.target.tagName === 'IMG') e.preventDefault(); });
    $('#adminPanel').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-upload]');
      if (!btn) return;
      const kind = btn.dataset.upload;
      const row = btn.parentElement, q = s => row.querySelector(s);
      const opt = { wm: !!(q('[data-wm]') || {}).checked, compress: !!(q('[data-cmp]') || {}).checked, tex: parseInt((q('[data-tex]') || {}).value, 10) || 1024 };
      const ctrl = btn.closest('.field').querySelector('[data-field]');
      const multi = ctrl.dataset.type === 'list' || ctrl.dataset.type === 'pairs';
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = multi;
      input.accept = kind === 'pdf' ? 'application/pdf,.pdf' : kind === 'glb' ? '.glb,model/gltf-binary' : 'image/*';
      input.onchange = async () => {
        const label = btn.textContent;
        busy(btn, true);
        let ok = 0;
        for (const file of Array.from(input.files)) {
          try {
            btn.textContent = 'Subiendo ' + file.name + '…';
            const { path, name } = await uploadFile(file, kind, opt, t => { btn.textContent = t; });
            const line = ctrl.dataset.type === 'pairs' ? name + '|' + path : path;
            ctrl.value = multi ? (ctrl.value.trim() ? ctrl.value.trim() + '\n' : '') + line : line;
            ok++;
          } catch (err) { toast(file.name + ': ' + err.message, 'error'); }
        }
        busy(btn, false); btn.textContent = label;
        if (ok) toast(ok + ' archivo(s) subido(s). Pulsa «Guardar» y luego «Guardar en GitHub».', 'success');
      };
      input.click();
    });
  }

  /* ---------- Bind UI ---------- */
  function bindUI() {
    $$('.nav-item').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
    $$('[data-nav]').forEach(b => {
      if (b.classList.contains('nav-item')) return;
      b.addEventListener('click', () => navigate(b.dataset.nav));
    });
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#overlay').addEventListener('click', closeSidebar);
    $('#adminBtn').addEventListener('click', () => navigate('admin'));

    $('#projectSearch').addEventListener('input', (e) => {
      state.projectQuery = e.target.value; renderProjects();
    });

    $$('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.closeModal)));
    $$('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'ghModal' && m.id !== 'loginModal') closeModal(m.id); }));

    $('#pdfFull').addEventListener('click', () => {
      const f = $('.pdf-body');
      if (f.requestFullscreen) f.requestFullscreen().catch(() => {});
      else if (f.webkitRequestFullscreen) f.webkitRequestFullscreen();
    });

    const zoomPdf = d => { state.pdfZoom = Math.min(3, Math.max(0.6, (state.pdfZoom || 1) + d)); renderPdf(); };
    $('#pdfZoomIn').addEventListener('click', () => zoomPdf(0.25));
    $('#pdfZoomOut').addEventListener('click', () => zoomPdf(-0.25));

    $('#lbClose').addEventListener('click', lbClose);
    $('#lbPrev').addEventListener('click', lbPrev);
    $('#lbNext').addEventListener('click', lbNext);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') lbClose(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isOpen($('#lightbox'))) lbClose();
        else if (isOpen($('#loginModal'))) closeModal('loginModal');
        else if (isOpen($('#ghModal'))) closeModal('ghModal');
        else if (isOpen($('#pdfModal'))) closeModal('pdfModal');
        else if (isOpen($('#projectModal'))) closeModal('projectModal');
        else if ($('#sidebar').classList.contains('open')) closeSidebar();
      }
      if (isOpen($('#lightbox'))) {
        if (e.key === 'ArrowLeft') lbPrev();
        if (e.key === 'ArrowRight') lbNext();
      }
      // Enter / Espacio activan tarjetas de proyecto y miniaturas de galería
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.project-card[role="button"], .gallery-tile[role="button"]')) {
        e.preventDefault(); e.target.click();
      }
    });

    // Lightbox táctil: deslizar a izquierda/derecha cambia de imagen
    let sx = 0, sy = 0;
    $('#lightbox').addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
    $('#lightbox').addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && state.lightbox.items.length > 1) (dx < 0 ? lbNext : lbPrev)();
    }, { passive: true });

    // Si se pasa a vista de escritorio con el menú móvil abierto, se cierra (evita fondo atascado)
    window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) closeSidebar(); });

    // Botón «Atrás»: cierra capas abiertas y vuelve a la sección anterior
    window.addEventListener('popstate', (e) => {
      $$('.modal.open, .lightbox.open').forEach(hideLayer);
      const h = location.hash.slice(1);
      navigate((e.state && e.state.s) || (PUBLIC_SECS.includes(h) ? h : 'inicio'), true);
    });
  }

  function renderAll() {
    $('#draftBanner').hidden = !(state.admin && state.isDraft && !state.preview);
    applySite();
    renderHome();
    renderProjectFilters();
    renderProjects();
    renderGallery();
    renderApps();
    renderSkills();
    renderExperience();
    renderContact();
  }

  async function init() {
    try {
      initTheme();
      $('#year').textContent = new Date().getFullYear();
      await loadData();
      renderAll();
      bindUI();
      bindGlobalSearch();
      bindAdminIO();
      bindAuth();
      bindUploads();
      applyAdminUI();
      const h = location.hash.slice(1);
      navigate(PUBLIC_SECS.includes(h) ? h : 'inicio', true);
      if (location.hash === '#admin') openLogin();
    } catch (err) {
      console.error(err);
    } finally {
      // Siempre se retira el loader, aunque algo falle (antes podía quedarse "Cargando…" para siempre)
      const l = $('#appLoader'); l.classList.add('done');
      setTimeout(() => { l.style.display = 'none'; }, 400);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
