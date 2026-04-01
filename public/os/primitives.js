/**
 * primitives.js — The 28 HTML atoms, prime-addressed c2→c29
 *
 * Each primitive is a function: (data, config) → HTMLElement
 * The address IS the function. Composites decompose to primes.
 * c3 × c2 = 6 means "card containing input".
 *
 * These never get served directly. The rebuild MF reads the UI table,
 * decomposes each composite address to primes, renders the atoms,
 * nests them according to the factorization, and commits to DOM
 * only after verifying the receipt.
 *
 * (c) 2026 — ManifoldOS / PRIMOS
 */

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_INV = PHI - 1;

// ================================================================
// WAVELENGTH → RGB (from the physics, not from a palette)
// ================================================================

function wavelengthToRGB(wl) {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440)      { r = -(wl - 440) / 60; b = 1; }
  else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
  else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
  else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
  else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
  else if (wl >= 645 && wl <= 780){ r = 1; }
  let f = 1;
  if (wl >= 380 && wl < 420) f = 0.3 + 0.7 * (wl - 380) / 40;
  else if (wl > 700) f = 0.3 + 0.7 * (780 - wl) / 80;
  return [Math.round(r*f*255), Math.round(g*f*255), Math.round(b*f*255)];
}

function lightToColor(light) {
  if (light === 0) return '#1a1a2e';
  const norm = Math.min(1, Math.log(light + 1) / Math.log(100));
  const wl = 780 - norm * 400;
  const [r, g, b] = wavelengthToRGB(wl);
  return `rgb(${r},${g},${b})`;
}

// ================================================================
// RECEIPT — verify before commit
// ================================================================

function computeReceipt(I, O, K) {
  const str = `${JSON.stringify(I)}|${JSON.stringify(O)}|${JSON.stringify(K)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ================================================================
// THE 28 PRIMITIVES — c2 through c29
// ================================================================

const PRIMITIVES = {
  // c2: inputs
  2: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-input';
    el.innerHTML = `
      ${data.label ? `<label>${data.label}</label>` : ''}
      <input type="${data.type || 'text'}"
             placeholder="${data.placeholder || ''}"
             value="${data.value || ''}" />
    `;
    return el;
  },

  // c3: cards — 2-column: body left, aside right
  3: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-card';
    el.style.borderLeft = `3px solid ${lightToColor(data.light || 0)}`;
    el.innerHTML = `
      <div class="p-card-header">${data.title || ''}</div>
      <div class="p-card-layout">
        <div class="p-card-body"></div>
        <div class="p-card-aside">${data.aside || data.figure || ''}</div>
      </div>
      ${data.footer ? `<div class="p-card-footer">${data.footer}</div>` : ''}
    `;
    return el;
  },

  // c4: buttons
  4: (data = {}) => {
    const el = document.createElement('button');
    el.className = `p-btn ${data.variant || ''}`;
    el.textContent = data.label || 'Action';
    if (data.action) el.dataset.action = data.action;
    return el;
  },

  // c5: calendars
  5: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-calendar';
    const deadlines = data.deadlines || [];
    el.innerHTML = `
      <div class="p-calendar-header">${data.month || new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}</div>
      <div class="p-calendar-deadlines">
        ${deadlines.map(d => `<div class="p-deadline ${d.overdue ? 'overdue' : ''}">${d.date} — ${d.name}</div>`).join('')}
      </div>
    `;
    return el;
  },

  // c6: forms — 3D native shape builder with pan/orbit
  6: (data = {}) => {
    const el = document.createElement('form');
    el.className = 'p-form';
    el.onsubmit = (e) => e.preventDefault();

    const shapes2d = [
      { name: 'circle', sides: 0 },
      { name: 'triangle', sides: 3 },
      { name: 'square', sides: 4 },
      { name: 'pentagon', sides: 5 },
      { name: 'hexagon', sides: 6 },
      { name: 'heptagon', sides: 7 },
      { name: 'octagon', sides: 8 },
    ];

    const shapes3d = [
      { name: 'd4',  label: 'Tetrahedron' },
      { name: 'd6',  label: 'Cube' },
      { name: 'd8',  label: 'Octahedron' },
      { name: 'd12', label: 'Dodecahedron' },
      { name: 'd20', label: 'Icosahedron' },
      { name: 'sphere',   label: 'Sphere' },
      { name: 'torus',    label: 'Torus' },
      { name: 'cylinder', label: 'Cylinder' },
      { name: 'cone',     label: 'Cone' },
      { name: 'knot',     label: 'Trefoil Knot' },
    ];

    // 3D viewport container
    const viewport = document.createElement('div');
    viewport.className = 'p-form-viewport';
    viewport.style.cssText = 'width:100%; height:220px; border-radius:6px; border:1px solid var(--border); overflow:hidden; position:relative; background:#08080f;';

    // Label overlay
    const label = document.createElement('div');
    label.style.cssText = 'position:absolute; bottom:6px; left:8px; font-size:10px; color:#6a6a7e; pointer-events:none; z-index:1;';
    label.textContent = 'd20 — Icosahedron';
    viewport.appendChild(label);

    el.innerHTML = `
      <div class="p-form-fields">
        <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">2D Shapes</div>
        <div class="p-form-shapes" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
          ${shapes2d.map(s => `<button type="button" class="p-btn p-shape-btn" data-type="2d" data-shape="${s.name}" data-sides="${s.sides}" title="${s.name}">${s.sides === 0 ? '○' : s.sides + '-gon'}</button>`).join('')}
        </div>
        <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">3D Solids</div>
        <div class="p-form-shapes" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
          ${shapes3d.map(s => `<button type="button" class="p-btn p-shape-btn" data-type="3d" data-shape="${s.name}" title="${s.label}">${s.name}</button>`).join('')}
        </div>
      </div>
      <div class="p-form-actions"></div>
    `;

    el.insertBefore(viewport, el.querySelector('.p-form-actions'));

    // Three.js mini viewport
    let scene3d, cam3d, renderer3d, currentMesh, animId;
    let isDrag = false, prevMX, prevMY, rX = 0.4, rY = 0.6, dist = 3.5;

    function initViewport() {
      scene3d = new THREE.Scene();
      scene3d.background = new THREE.Color(0x08080f);
      cam3d = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
      cam3d.position.set(0, 1.5, dist);
      cam3d.lookAt(0, 0, 0);

      renderer3d = new THREE.WebGLRenderer({ antialias: true });
      renderer3d.setSize(viewport.clientWidth, viewport.clientHeight);
      renderer3d.setPixelRatio(window.devicePixelRatio);
      viewport.insertBefore(renderer3d.domElement, label);

      scene3d.add(new THREE.AmbientLight(0x444466, 1.2));
      const pl = new THREE.PointLight(0xffffff, 1, 50);
      pl.position.set(3, 4, 3);
      scene3d.add(pl);
      scene3d.add(new THREE.GridHelper(6, 12, 0x1a1a2e, 0x10101e));

      // Orbit controls
      viewport.addEventListener('mousedown', (e) => { isDrag = true; prevMX = e.clientX; prevMY = e.clientY; e.stopPropagation(); });
      viewport.addEventListener('mousemove', (e) => {
        if (!isDrag) return;
        rY += (e.clientX - prevMX) * 0.008;
        rX += (e.clientY - prevMY) * 0.008;
        rX = Math.max(-1.4, Math.min(1.4, rX));
        prevMX = e.clientX; prevMY = e.clientY;
        cam3d.position.set(dist * Math.sin(rY) * Math.cos(rX), dist * Math.sin(rX), dist * Math.cos(rY) * Math.cos(rX));
        cam3d.lookAt(0, 0, 0);
        e.stopPropagation();
      });
      viewport.addEventListener('mouseup', () => isDrag = false);
      viewport.addEventListener('mouseleave', () => isDrag = false);
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault(); e.stopPropagation();
        dist *= e.deltaY > 0 ? 1.1 : 0.9;
        dist = Math.max(1, Math.min(15, dist));
        cam3d.position.set(dist * Math.sin(rY) * Math.cos(rX), dist * Math.sin(rX), dist * Math.cos(rY) * Math.cos(rX));
        cam3d.lookAt(0, 0, 0);
      }, { passive: false });

      function anim() {
        animId = requestAnimationFrame(anim);
        if (currentMesh) currentMesh.rotation.y += 0.005;
        renderer3d.render(scene3d, cam3d);
      }
      anim();
    }

    function makeMaterial() {
      return new THREE.MeshPhongMaterial({
        color: 0x5577cc,
        emissive: 0x223366,
        emissiveIntensity: 0.3,
        wireframe: false,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
    }

    function setShape(type, name, sides) {
      if (currentMesh) scene3d.remove(currentMesh);
      const mat = makeMaterial();
      const wire = new THREE.MeshBasicMaterial({ color: 0x88aaee, wireframe: true, transparent: true, opacity: 0.3 });

      let geo;
      if (type === '2d') {
        // Extrude 2D shapes slightly for 3D presence
        const s = parseInt(sides);
        if (s === 0) {
          geo = new THREE.CylinderGeometry(1, 1, 0.05, 32);
        } else {
          geo = new THREE.CylinderGeometry(1, 1, 0.05, s);
        }
        label.textContent = name;
      } else {
        switch(name) {
          case 'd4':  geo = new THREE.TetrahedronGeometry(1); break;
          case 'd6':  geo = new THREE.BoxGeometry(1.2, 1.2, 1.2); break;
          case 'd8':  geo = new THREE.OctahedronGeometry(1); break;
          case 'd12': geo = new THREE.DodecahedronGeometry(1); break;
          case 'd20': geo = new THREE.IcosahedronGeometry(1); break;
          case 'sphere': geo = new THREE.SphereGeometry(1, 24, 24); break;
          case 'torus': geo = new THREE.TorusGeometry(0.8, 0.35, 16, 32); break;
          case 'cylinder': geo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 24); break;
          case 'cone': geo = new THREE.ConeGeometry(0.8, 1.5, 24); break;
          case 'knot': geo = new THREE.TorusKnotGeometry(0.6, 0.2, 64, 8, 2, 3); break;
          default: geo = new THREE.SphereGeometry(1, 16, 16);
        }
        const s3 = shapes3d.find(s => s.name === name);
        label.textContent = `${name} — ${s3?.label || name}`;
      }

      const group = new THREE.Group();
      group.add(new THREE.Mesh(geo, mat));
      group.add(new THREE.Mesh(geo, wire));
      scene3d.add(group);
      currentMesh = group;
    }

    // Shape measurements (exact geometric properties)
    const measurements = {
      'd4':  { faces: 4, edges: 6, verts: 4, dihedral: '70.53°', volume: 'a³/(6√2)', surface: '√3·a²', symmetry: 'Td' },
      'd6':  { faces: 6, edges: 12, verts: 8, dihedral: '90°', volume: 'a³', surface: '6a²', symmetry: 'Oh' },
      'd8':  { faces: 8, edges: 12, verts: 6, dihedral: '109.47°', volume: '(√2/3)a³', surface: '2√3·a²', symmetry: 'Oh' },
      'd12': { faces: 12, edges: 30, verts: 20, dihedral: '116.57°', volume: '(15+7√5)/4·a³', surface: '3√(25+10√5)·a²', symmetry: 'Ih' },
      'd20': { faces: 20, edges: 30, verts: 12, dihedral: '138.19°', volume: '(5(3+√5)/12)a³', surface: '5√3·a²', symmetry: 'Ih' },
      'sphere':   { faces: '∞', edges: '∞', verts: '∞', volume: '(4/3)πr³', surface: '4πr²', symmetry: 'O(3)' },
      'torus':    { faces: '∞', edges: '∞', verts: '∞', volume: '2π²Rr²', surface: '4π²Rr', symmetry: 'O(2)×O(2)', R: 0.8, r: 0.35 },
      'cylinder': { faces: 3, edges: 2, verts: '∞', volume: 'πr²h', surface: '2πr(r+h)', symmetry: 'O(2)', r: 0.6, h: 1.5 },
      'cone':     { faces: 2, edges: 1, verts: 1, volume: '(1/3)πr²h', surface: 'πr(r+√(r²+h²))', symmetry: 'O(2)', r: 0.8, h: 1.5 },
      'knot':     { faces: '∞', edges: '∞', verts: '∞', volume: '2π²Rr²', surface: '4π²Rr', symmetry: '(2,3) torus knot', p: 2, q: 3 },
      'circle':   { sides: 0, area: 'πr²', perimeter: '2πr', symmetry: 'O(2)' },
      'triangle': { sides: 3, area: '(√3/4)a²', perimeter: '3a', interior: '60°', symmetry: 'D₃' },
      'square':   { sides: 4, area: 'a²', perimeter: '4a', interior: '90°', symmetry: 'D₄' },
      'pentagon': { sides: 5, area: '(a²/4)√(25+10√5)', perimeter: '5a', interior: '108°', symmetry: 'D₅' },
      'hexagon':  { sides: 6, area: '(3√3/2)a²', perimeter: '6a', interior: '120°', symmetry: 'D₆' },
      'heptagon': { sides: 7, area: '(7a²/4)cot(π/7)', perimeter: '7a', interior: '128.57°', symmetry: 'D₇' },
      'octagon':  { sides: 8, area: '2(1+√2)a²', perimeter: '8a', interior: '135°', symmetry: 'D₈' },
    };

    // Edit button — editable measurements
    const editBtn = document.createElement('button');
    editBtn.className = 'p-btn';
    editBtn.textContent = 'Edit';
    editBtn.style.cssText = 'position:absolute; top:6px; right:6px; z-index:2; font-size:9px; padding:2px 8px;';
    editBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      viewport.querySelectorAll('.p-form-measure').forEach(m => m.remove());

      const activeBtn = el.querySelector('.p-shape-btn.primary');
      const shapeName = activeBtn?.dataset.shape || 'd20';
      const m = measurements[shapeName] || {};

      const panel = document.createElement('div');
      panel.className = 'p-form-measure';
      panel.style.cssText = `
        position:absolute; z-index:10; top:4px; right:4px; bottom:4px;
        width:200px; background:rgba(12,12,20,0.95); backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,0.08); border-radius:8px;
        padding:10px; font-size:10px; color:#aab; overflow-y:auto;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      `;

      let html = `<div style="font-size:12px; font-weight:600; color:#dde; margin-bottom:8px;">${shapeName} <span style="color:#667; font-weight:400;">edit</span></div>`;
      for (const [key, val] of Object.entries(m)) {
        html += `<div style="margin-bottom:4px;">
          <label style="display:block; font-size:9px; color:#556; margin-bottom:2px;">${key}</label>
          <input type="text" value="${val}" data-key="${key}" style="
            width:100%; background:#0a0a14; border:1px solid #2a2a3e; border-radius:4px;
            padding:3px 6px; color:#aac; font-family:monospace; font-size:10px;
          "/>
        </div>`;
      }
      html += `<button class="p-btn primary" style="width:100%; margin-top:8px; font-size:9px;">Apply</button>`;
      panel.innerHTML = html;

      panel.querySelector('.p-btn.primary').addEventListener('click', () => {
        panel.querySelectorAll('input').forEach(inp => {
          const k = inp.dataset.key;
          const v = inp.value;
          measurements[shapeName][k] = isNaN(v) ? v : parseFloat(v);
        });
        panel.remove();
      });

      viewport.appendChild(panel);
    });
    viewport.appendChild(editBtn);

    // Right-click context menu for measurements
    viewport.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      // Remove existing
      viewport.querySelectorAll('.p-form-measure').forEach(m => m.remove());

      const activeBtn = el.querySelector('.p-shape-btn.primary');
      const shapeName = activeBtn?.dataset.shape || 'd20';
      const m = measurements[shapeName];
      if (!m) return;

      const menu = document.createElement('div');
      menu.className = 'p-form-measure';
      menu.style.cssText = `
        position:absolute; z-index:10;
        top:${e.offsetY}px; left:${e.offsetX}px;
        background:rgba(12,12,20,0.92); backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,0.08); border-radius:8px;
        padding:10px 14px; font-size:10px; color:#aab;
        min-width:180px; pointer-events:auto;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      `;

      let html = `<div style="font-size:12px; font-weight:600; color:#dde; margin-bottom:6px;">${shapeName}</div>`;
      for (const [key, val] of Object.entries(m)) {
        html += `<div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
          <span style="color:#667;">${key}</span><span style="color:#aac; font-family:monospace;">${val}</span>
        </div>`;
      }
      menu.innerHTML = html;
      viewport.appendChild(menu);

      const dismiss = () => { menu.remove(); document.removeEventListener('click', dismiss); };
      setTimeout(() => document.addEventListener('click', dismiss), 10);
    });

    // Init after DOM mount (guard for THREE availability)
    requestAnimationFrame(() => {
      if (typeof THREE !== 'undefined' && viewport.clientWidth > 0) {
        initViewport();
        setShape('3d', 'd20');
      } else if (viewport.clientWidth > 0) {
        viewport.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:11px;">Three.js not loaded</div>';
      }
    });

    // Wire buttons
    el.querySelectorAll('.p-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.p-shape-btn').forEach(b => b.classList.remove('primary'));
        btn.classList.add('primary');
        if (scene3d) setShape(btn.dataset.type, btn.dataset.shape, btn.dataset.sides);
      });
    });

    return el;
  },

  // c7: modals
  7: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-modal-overlay';
    el.innerHTML = `
      <div class="p-modal">
        <div class="p-modal-header">${data.title || ''}<span class="p-modal-close">&times;</span></div>
        <div class="p-modal-body"></div>
      </div>
    `;
    el.querySelector('.p-modal-close').onclick = () => el.remove();
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    return el;
  },

  // c8: toggles
  8: (data = {}) => {
    const el = document.createElement('label');
    el.className = 'p-toggle';
    el.innerHTML = `
      <input type="checkbox" ${data.checked ? 'checked' : ''} />
      <span class="p-toggle-slider"></span>
      <span class="p-toggle-label">${data.label || ''}</span>
    `;
    return el;
  },

  // c9: grids
  9: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-grid';
    el.style.gridTemplateColumns = `repeat(${data.cols || 3}, 1fr)`;
    return el;
  },

  // c10: datepickers
  10: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-datepicker';
    el.innerHTML = `
      <label>${data.label || 'Date'}</label>
      <input type="datetime-local" value="${data.value || ''}" />
    `;
    return el;
  },

  // c11: labels
  11: (data = {}) => {
    const el = document.createElement('span');
    el.className = `p-label ${data.variant || ''}`;
    el.textContent = data.text || '';
    if (data.color) el.style.background = data.color;
    return el;
  },

  // c12: toolbars
  12: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-toolbar';
    const items = data.items || ['File', 'Edit', 'View', 'Tools'];
    el.innerHTML = items.map(item =>
      typeof item === 'string'
        ? `<button class="p-btn p-toolbar-btn">${item}</button>`
        : `<button class="p-btn p-toolbar-btn ${item.active ? 'active' : ''}" data-action="${item.action || ''}">${item.label}</button>`
    ).join('') + (data.spacer !== false ? '<div style="flex:1"></div>' : '') +
    (data.right || []).map(item => `<button class="p-btn p-toolbar-btn">${item}</button>`).join('');
    return el;
  },

  // c13: overlays
  13: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-overlay';
    el.style.opacity = data.opacity || '0.8';
    return el;
  },

  // c14: prompts
  14: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-prompt';
    el.innerHTML = `
      <div class="p-prompt-text">${data.text || 'Input needed'}</div>
      <input type="text" class="p-prompt-input" placeholder="${data.placeholder || ''}" />
      <button class="p-btn p-prompt-submit">Send</button>
    `;
    return el;
  },

  // c15: timelines
  15: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-timeline';
    const items = data.items || [];
    el.innerHTML = items.map((item, i) =>
      `<div class="p-timeline-item">
        <div class="p-timeline-dot" style="background:${lightToColor(item.light || i * 10)}"></div>
        <div class="p-timeline-content">${item.label || ''}</div>
      </div>`
    ).join('');
    return el;
  },

  // c16: sliders
  16: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-slider';
    el.innerHTML = `
      <label>${data.label || ''}</label>
      <input type="range" min="${data.min || 0}" max="${data.max || 100}" value="${data.value || 50}" />
      <span class="p-slider-value">${data.value || 50}</span>
    `;
    el.querySelector('input').oninput = (e) => {
      el.querySelector('.p-slider-value').textContent = e.target.value;
    };
    return el;
  },

  // c17: canvases
  17: (data = {}) => {
    const el = document.createElement('canvas');
    el.className = 'p-canvas';
    el.width = data.width || 800;
    el.height = data.height || 600;
    return el;
  },

  // c18: tables
  18: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-table-wrap';
    const headers = data.headers || [];
    const rows = data.rows || [];
    el.innerHTML = `
      <table class="p-table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
    return el;
  },

  // c19: alerts
  19: (data = {}) => {
    const el = document.createElement('div');
    el.className = `p-alert ${data.type || 'info'}`;
    const icons = { info: '◆', warning: '▲', error: '✕', success: '✓' };
    const icon = icons[data.type] || icons.info;
    el.innerHTML = `
      <span class="p-alert-icon">${icon}</span>
      <span class="p-alert-msg">${data.message || ''}</span>
      ${data.dismissible !== false ? '<span class="p-alert-close">✕</span>' : ''}
    `;
    el.querySelector('.p-alert-close')?.addEventListener('click', () => {
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 200);
    });
    return el;
  },

  // c20: schedulers — pill-based, draggable blocks
  20: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-scheduler';
    const days = data.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const hours = data.hours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const events = data.events || [];

    // Build grid
    const grid = document.createElement('div');
    grid.className = 'p-scheduler-grid';
    grid.style.cssText = `display:grid; grid-template-columns: 40px repeat(${days.length}, 1fr); grid-template-rows: auto repeat(${hours.length}, 28px); font-size:10px; gap:1px;`;

    // Header row
    grid.innerHTML = `<div></div>${days.map(d => `<div style="text-align:center; padding:4px; color:var(--text-dim); font-weight:600; font-size:9px;">${d}</div>`).join('')}`;

    // Hour rows
    hours.forEach(h => {
      const hourLabel = document.createElement('div');
      hourLabel.style.cssText = 'padding:2px 4px; color:var(--text-dim); text-align:right; font-size:9px; line-height:28px;';
      hourLabel.textContent = `${h}:00`;
      grid.appendChild(hourLabel);

      days.forEach((d, di) => {
        const cell = document.createElement('div');
        cell.style.cssText = 'border-bottom:1px solid rgba(42,42,62,0.3); min-height:28px; position:relative;';

        const ev = events.find(e => e.day === di && e.hour === h);
        if (ev) {
          const pill = document.createElement('div');
          pill.className = 'p-scheduler-pill';
          const duration = ev.duration || 1;
          pill.style.cssText = `
            position:absolute; top:2px; left:2px; right:2px;
            height:${duration * 28 - 4}px;
            background: rgba(100,140,220,0.15);
            border-left: 3px solid ${lightToColor(ev.light || 20)};
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 9px;
            color: var(--text-bright);
            cursor: grab;
            z-index: 1;
            transition: background 0.15s;
          `;
          pill.textContent = ev.name;
          pill.title = `${ev.name} (${duration}h)`;
          pill.addEventListener('mouseenter', () => pill.style.background = 'rgba(100,140,220,0.25)');
          pill.addEventListener('mouseleave', () => pill.style.background = 'rgba(100,140,220,0.15)');
          cell.appendChild(pill);
        }
        grid.appendChild(cell);
      });
    });

    el.innerHTML = `<div class="p-scheduler-header">${data.title || 'Schedule'}</div>`;
    el.appendChild(grid);
    return el;
  },

  // c21: panels — glass effect
  21: (data = {}) => {
    const el = document.createElement('div');
    el.className = `p-panel ${data.position || ''} ${data.glass ? 'p-panel-glass' : ''}`;
    el.innerHTML = `
      <div class="p-panel-title">${data.title || ''}</div>
      <div class="p-panel-content">${data.content || ''}</div>
    `;
    return el;
  },

  // c22: searches
  22: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-search';
    el.innerHTML = `<input type="search" placeholder="${data.placeholder || 'Search...'}" /><div class="p-search-results"></div>`;
    return el;
  },

  // c23: charts — multiple types
  23: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-chart-container';
    const canvas = document.createElement('canvas');
    canvas.className = 'p-chart';
    canvas.width = data.width || 400;
    canvas.height = data.height || 200;
    el.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return el;

    const type = data.type || 'bar';
    const values = data.values || [];
    const labels = data.labels || [];
    const title = data.title || '';
    const w = canvas.width, h = canvas.height;
    const pad = { t: 24, b: 24, l: 40, r: 12 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

    // Title
    ctx.fillStyle = '#8888aa'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(title, pad.l, 14);

    // Axes
    ctx.strokeStyle = '#2a2a3e'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();

    if (values.length === 0) return el;
    const maxVal = Math.max(...values.map(v => Array.isArray(v) ? Math.max(...v) : v), 0.001);

    function colorAt(i) {
      const wl = 420 + (i / Math.max(values.length - 1, 1)) * 280;
      const [r,g,b] = wavelengthToRGB(wl);
      return `rgb(${r},${g},${b})`;
    }

    if (type === 'bar') {
      const barW = plotW / values.length;
      values.forEach((v, i) => {
        const bh = (v / maxVal) * plotH;
        ctx.fillStyle = colorAt(i);
        ctx.fillRect(pad.l + i * barW + 4, h - pad.b - bh, barW - 8, bh);
        ctx.fillStyle = '#6a6a7e'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        if (labels[i]) ctx.fillText(labels[i], pad.l + i * barW + barW/2, h - pad.b + 12);
      });
    } else if (type === 'line') {
      ctx.beginPath(); ctx.strokeStyle = colorAt(3); ctx.lineWidth = 2;
      values.forEach((v, i) => {
        const x = pad.l + (i / (values.length - 1)) * plotW;
        const y = h - pad.b - (v / maxVal) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Dots
      values.forEach((v, i) => {
        const x = pad.l + (i / (values.length - 1)) * plotW;
        const y = h - pad.b - (v / maxVal) * plotH;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = colorAt(i); ctx.fill();
      });
    } else if (type === 'pie') {
      const total = values.reduce((a, b) => a + b, 0);
      let angle = -Math.PI / 2;
      const cx = w / 2, cy = h / 2, radius = Math.min(plotW, plotH) / 2.5;
      values.forEach((v, i) => {
        const slice = (v / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, angle + slice); ctx.closePath();
        ctx.fillStyle = colorAt(i); ctx.fill();
        // Label
        const mid = angle + slice / 2;
        const lx = cx + (radius + 14) * Math.cos(mid), ly = cy + (radius + 14) * Math.sin(mid);
        ctx.fillStyle = '#8888aa'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        if (labels[i]) ctx.fillText(labels[i], lx, ly);
        angle += slice;
      });
    } else if (type === 'scatter') {
      // values = [{x,y}...]
      const xs = values.map(p => p.x), ys = values.map(p => p.y);
      const maxX = Math.max(...xs, 1), maxY = Math.max(...ys, 1);
      values.forEach((p, i) => {
        const px = pad.l + (p.x / maxX) * plotW;
        const py = h - pad.b - (p.y / maxY) * plotH;
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = colorAt(i); ctx.fill();
      });
    } else if (type === 'area') {
      ctx.beginPath();
      ctx.moveTo(pad.l, h - pad.b);
      values.forEach((v, i) => {
        const x = pad.l + (i / (values.length - 1)) * plotW;
        const y = h - pad.b - (v / maxVal) * plotH;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.l + plotW, h - pad.b); ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, colorAt(2) + '44'); grad.addColorStop(1, colorAt(2) + '08');
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.strokeStyle = colorAt(2); ctx.lineWidth = 2;
      values.forEach((v, i) => {
        const x = pad.l + (i / (values.length - 1)) * plotW;
        const y = h - pad.b - (v / maxVal) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }); ctx.stroke();
    } else if (type === 'horizontal') {
      const barH = plotH / values.length;
      values.forEach((v, i) => {
        const bw = (v / maxVal) * plotW;
        ctx.fillStyle = colorAt(i);
        ctx.fillRect(pad.l, pad.t + i * barH + 3, bw, barH - 6);
        ctx.fillStyle = '#8888aa'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
        if (labels[i]) ctx.fillText(labels[i], pad.l - 4, pad.t + i * barH + barH/2 + 3);
      });
    } else if (type === 'radar') {
      const cx = w / 2, cy = h / 2, radius = Math.min(plotW, plotH) / 2.8;
      const n = values.length;
      // Grid
      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath(); ctx.strokeStyle = '#1a1a3e';
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r = radius * ring / 4;
          const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        } ctx.stroke();
      }
      // Data
      ctx.beginPath(); ctx.strokeStyle = colorAt(3); ctx.lineWidth = 2;
      values.forEach((v, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = (v / maxVal) * radius;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = colorAt(3) + '22'; ctx.fill();
      // Labels
      values.forEach((v, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + (radius + 14) * Math.cos(a), ly = cy + (radius + 14) * Math.sin(a);
        ctx.fillStyle = '#6a6a7e'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        if (labels[i]) ctx.fillText(labels[i], lx, ly + 3);
      });
    }

    // Y-axis labels
    ctx.fillStyle = '#4a4a6e'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = h - pad.b - (i / 4) * plotH;
      const val = (maxVal * i / 4);
      ctx.fillText(val >= 1 ? val.toFixed(0) : val.toFixed(2), pad.l - 4, y + 3);
    }

    return el;
  },

  // c24: accordions
  24: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-accordion';
    const sections = data.sections || [];
    el.innerHTML = sections.map(s =>
      `<div class="p-accordion-item">
        <div class="p-accordion-header">${s.title}</div>
        <div class="p-accordion-body">${s.content || ''}</div>
      </div>`
    ).join('');
    el.querySelectorAll('.p-accordion-header').forEach(h => {
      h.onclick = () => h.parentElement.classList.toggle('open');
    });
    return el;
  },

  // c25: planners — kanban-style lanes
  25: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-planner';
    const lanes = data.lanes || [
      { name: 'To Do', items: [] },
      { name: 'In Progress', items: [] },
      { name: 'Done', items: [] },
    ];
    el.innerHTML = `
      <div class="p-planner-header">${data.title || 'Plan'}</div>
      <div class="p-planner-lanes">
        ${lanes.map((lane, i) => `
          <div class="p-planner-lane">
            <div class="p-planner-lane-header">${lane.name} <span style="color:var(--text-dim)">(${lane.items.length})</span></div>
            <div class="p-planner-lane-body">
              ${lane.items.map(item => `
                <div class="p-planner-item" draggable="true" style="border-left:3px solid ${lightToColor(item.light || (i+1)*15)}">
                  <div style="font-size:11px;">${item.name || item}</div>
                  ${item.deadline ? `<div style="font-size:9px; color:var(--text-dim);">${item.deadline}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    // Drag and drop between lanes
    el.querySelectorAll('.p-planner-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        item.style.opacity = '0.4';
        item._dragging = true;
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        item._dragging = false;
      });
    });
    el.querySelectorAll('.p-planner-lane-body').forEach(body => {
      body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        body.style.background = 'rgba(74,74,142,0.1)';
      });
      body.addEventListener('dragleave', () => {
        body.style.background = '';
      });
      body.addEventListener('drop', (e) => {
        e.preventDefault();
        body.style.background = '';
        const dragging = el.querySelector('.p-planner-item[style*="opacity: 0.4"]') ||
                         [...el.querySelectorAll('.p-planner-item')].find(i => i._dragging);
        if (dragging) body.appendChild(dragging);
      });
    });
    return el;
  },

  // c26: dropdowns
  26: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-dropdown';
    const options = data.options || [];
    el.innerHTML = `
      <div class="p-dropdown-trigger">${data.label || 'Select'}</div>
      <div class="p-dropdown-menu">${options.map(o => `<div class="p-dropdown-item" data-value="${o.value || o}">${o.label || o}</div>`).join('')}</div>
    `;
    el.querySelector('.p-dropdown-trigger').onclick = () => el.classList.toggle('open');
    return el;
  },

  // c27: dashboards — composed from other primitives
  27: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-dashboard';
    const widgets = data.widgets || [];
    el.innerHTML = `<div class="p-dashboard-grid"></div>`;
    const grid = el.querySelector('.p-dashboard-grid');
    // If no widgets, render sample
    if (widgets.length === 0 && data.sample) {
      // Stats row
      const stats = [
        { label: 'Stars', value: data.stars || 0, light: 15 },
        { label: 'Planets', value: data.planets || 0, light: 30 },
        { label: 'Moons', value: data.moons || 0, light: 50 },
        { label: 'Mass', value: data.mass || '0', light: 70 },
      ];
      stats.forEach(s => {
        const card = document.createElement('div');
        card.className = 'p-card';
        card.style.borderLeft = `3px solid ${lightToColor(s.light)}`;
        card.innerHTML = `
          <div class="p-card-body" style="padding:12px;">
            <div style="font-size:22px; font-weight:700; color:var(--text-bright);">${s.value}</div>
            <div style="font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px;">${s.label}</div>
          </div>
        `;
        grid.appendChild(card);
      });
    }
    return el;
  },

  // c28: confirms — action button has color
  28: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-confirm';
    el.innerHTML = `
      <div class="p-confirm-message">${data.message || 'Are you sure?'}</div>
      <div class="p-confirm-actions">
        <button class="p-btn ${data.danger !== false ? 'danger' : 'primary'} confirm-yes">${data.yes || 'Yes'}</button>
        <button class="p-btn confirm-no">${data.no || 'Cancel'}</button>
      </div>
    `;
    return el;
  },

  // c29: spaces (the 3D canvas container)
  29: (data = {}) => {
    const el = document.createElement('div');
    el.className = 'p-space';
    el.dataset.spaceId = data.space_id || 1;
    el.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; min-height:80px; color:var(--text-dim); font-size:11px;">
        Space ${data.space_id || 1} — ${data.objects || 0} objects · ${data.name || '3D viewport'}
      </div>
    `;
    return el;
  },
};


// ================================================================
// DECOMPOSE — Composite address → prime factors → nested primitives
// ================================================================

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

function factorize(n) {
  const factors = [];
  for (const p of PRIMES) {
    while (n % p === 0) {
      factors.push(p);
      n /= p;
    }
  }
  return factors;
}

function decompose(address, data = {}) {
  /**
   * THE MF: composite address → nested HTML
   *
   * address=6 → factors [2, 3] → input inside card
   * address=12 → factors [2, 2, 3] → two inputs inside card
   * address=15 → factors [3, 5] → card with calendar
   *
   * Largest prime = outermost container. Smaller = inner children.
   */
  const factors = factorize(address);
  if (factors.length === 0) return document.createTextNode('');

  // Sort descending — largest prime = outermost shell
  const sorted = [...factors].sort((a, b) => b - a);

  // Build from outside in
  let root = null;
  let current = null;

  for (const prime of sorted) {
    const renderer = PRIMITIVES[prime];
    if (!renderer) continue;

    const el = renderer(data);

    if (!root) {
      root = el;
      current = el;
    } else {
      // Find the body/content area of current
      const body = current.querySelector('.p-card-body') ||
                   current.querySelector('.p-form-fields') ||
                   current.querySelector('.p-modal-body') ||
                   current.querySelector('.p-panel-content') ||
                   current.querySelector('.p-dashboard-grid') ||
                   current.querySelector('.p-planner-lanes') ||
                   current;
      body.appendChild(el);
      current = el;
    }
  }

  return root || document.createTextNode('');
}


// ================================================================
// REBUILD MF — The full render cycle
// ================================================================

function rebuildMF(shellLayout, workspaceData, uiTable) {
  /**
   * I = {shellLayout, workspaceData}
   * K = uiTable (the 28 primitives + their current weights)
   * x = decompose → address → render → verify
   * O = DOM tree
   * R = receipt
   */
  const I = { shell: shellLayout, workspace: workspaceData };

  // The output DOM
  const root = document.createElement('div');
  root.className = 'manifoldos';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'shell-top';
  topBar.innerHTML = `<div class="shell-datetime">${new Date().toLocaleString()}</div>`;
  root.appendChild(topBar);

  // Main layout: left | canvas | right
  const main = document.createElement('div');
  main.className = 'shell-main';

  // Left panel
  const left = PRIMITIVES[21]({ title: 'Tools', position: 'left' });
  left.classList.add('shell-left');
  main.appendChild(left);

  // Canvas (center)
  const canvas = PRIMITIVES[29]({ space_id: workspaceData?.space_id || 1 });
  canvas.classList.add('shell-canvas');
  main.appendChild(canvas);

  // Right panel
  const right = PRIMITIVES[21]({ title: 'Inbox', position: 'right' });
  right.classList.add('shell-right');
  main.appendChild(right);

  root.appendChild(main);

  // Bottom meeps drawer
  const bottom = document.createElement('div');
  bottom.className = 'shell-bottom';
  root.appendChild(bottom);

  // Compute receipt
  const O = root.innerHTML.length;
  const R = computeReceipt(I, O, 'rebuild');

  return { dom: root, receipt: R, components: Object.keys(PRIMITIVES).length };
}


// ================================================================
// EXPORTS
// ================================================================

export {
  PRIMITIVES, decompose, rebuildMF, factorize,
  lightToColor, wavelengthToRGB, computeReceipt,
  PHI, PHI_INV, PRIMES,
};
