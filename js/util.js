/* Utilidades generales. Todo cuelga de window.Opo para funcionar abriendo index.html sin servidor. */
(function () {
  'use strict';
  const Opo = (window.Opo = window.Opo || {});

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  // ---------------------------------------------------------------- almacenamiento local (puede fallar)
  const PREFIJO = 'opos597:';
  const Almacen = {
    leer(clave, defecto) {
      try {
        const v = window.localStorage.getItem(PREFIJO + clave);
        return v == null ? defecto : JSON.parse(v);
      } catch (e) { return defecto; }
    },
    escribir(clave, valor) {
      try { window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); return true; } catch (e) { return false; }
    },
    borrarTodo() {
      try {
        Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => window.localStorage.removeItem(k));
      } catch (e) { /* sin almacenamiento */ }
    },
    exportar() {
      const out = {};
      try {
        Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => { out[k.slice(PREFIJO.length)] = JSON.parse(window.localStorage.getItem(k)); });
      } catch (e) { /* nada */ }
      return out;
    },
    importar(obj) {
      Object.entries(obj || {}).forEach(([k, v]) => Almacen.escribir(k, v));
    },
  };

  // ---------------------------------------------------------------- tiempo y números
  const mmss = (seg) => {
    seg = Math.max(0, Math.round(seg || 0));
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const coma = (n, dec = 1) => Number(n).toFixed(dec).replace('.', ',');
  const contarPalabras = (t) => { const s = String(t || '').trim(); return s ? s.split(/\s+/).length : 0; };
  const PPM = 130;

  // ---------------------------------------------------------------- huecos {{id}}
  const HUECO_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
  /** Divide un texto con huecos en partes [{t, h}] (h = id de hueco o null). */
  function partes(texto, valores) {
    const out = [];
    let ultimo = 0;
    const s = String(texto || '');
    HUECO_RE.lastIndex = 0;
    let m;
    while ((m = HUECO_RE.exec(s))) {
      if (m.index > ultimo) out.push({ t: s.slice(ultimo, m.index), h: null });
      const v = valores ? (Object.prototype.hasOwnProperty.call(valores, m[1]) ? String(valores[m[1]]) : '') : null;
      out.push({ t: v == null ? m[0] : v, h: m[1] });
      ultimo = m.index + m[0].length;
    }
    if (ultimo < s.length) out.push({ t: s.slice(ultimo), h: null });
    return out;
  }
  const textoDe = (ps) => ps.map((p) => p.t).join('');
  function htmlPartes(ps, { etiquetas = null } = {}) {
    return ps.map((p) => {
      if (!p.h) return esc(p.t);
      const contenido = etiquetas ? `⟨${esc(etiquetas[p.h] || p.h)}⟩` : esc(p.t);
      return `<span class="propio" data-hueco="${esc(p.h)}">${contenido}</span>`;
    }).join('');
  }

  // ---------------------------------------------------------------- frases (mismo criterio que herramientas/audio/generar_audio.py)
  const FIN_FRASE = /[.!?…]["»”)]*\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ0-9])|[:;]["»”)]*\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ])/g;
  function frases(texto) {
    const res = [];
    let inicio = 0;
    FIN_FRASE.lastIndex = 0;
    let m;
    while ((m = FIN_FRASE.exec(texto))) {
      const corte = m.index + 1;
      const trozo = texto.slice(inicio, corte).trim();
      const previo = texto.slice(Math.max(0, corte - 6), corte);
      if (/\b(art|Sr|Sra|núm|pág|etc|p\. ej|ej)\.$/.test(previo) || trozo.length < 20) continue;
      res.push([inicio, corte]);
      inicio = m.index + m[0].length;
    }
    if (texto.slice(inicio).trim()) res.push([inicio, texto.length]);
    return res.map(([a, b]) => {
      while (a < b && /\s/.test(texto[a])) a++;
      while (b > a && /\s/.test(texto[b - 1])) b--;
      return [a, b];
    });
  }

  /** Corta las partes (con huecos) en trozos por frase: [{frase, trozos:[{t,h}]}] y "entre" (huecos de texto sueltos). */
  function partesPorFrase(ps, cortes) {
    const texto = textoDe(ps);
    // posiciones de partes
    const segs = [];
    let pos = 0;
    ps.forEach((p) => { segs.push({ a: pos, b: pos + p.t.length, h: p.h }); pos += p.t.length; });
    const res = [];
    let cursor = 0;
    const tomar = (a, b, frase) => {
      if (b <= a) return;
      const trozos = [];
      segs.forEach((s) => {
        const x = Math.max(a, s.a);
        const y = Math.min(b, s.b);
        if (y > x) trozos.push({ t: texto.slice(x, y), h: s.h });
      });
      res.push({ frase, trozos });
    };
    cortes.forEach(([a, b], i) => {
      tomar(cursor, a, null);
      tomar(a, b, i);
      cursor = b;
    });
    tomar(cursor, texto.length, null);
    return res;
  }

  // ---------------------------------------------------------------- aleatorio con semilla
  function aleatorio(semilla) {
    let s = semilla >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashTexto(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---------------------------------------------------------------- texto para la voz del navegador
  const SIGLAS = {
    TDAH: 'te de a hache', ODS: 'o de ese', STEAM: 'estim', ABP: 'a be pe', APS: 'a pe ese', PT: 'pe te', AL: 'a ele',
    LCL: 'Lengua Castellana y Literatura', MAT: 'Matemáticas', CMN: 'Conocimiento del Medio', EAR: 'Educación Artística',
    UD: 'unidad didáctica', SdA: 'situación de aprendizaje', NEAE: 'neáe', DUA: 'dúa', ETCP: 'e te ce pe',
  };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DESCRIPTORES = { CCL: 'ce ce ele', CP: 'ce pe', STEM: 'estem', CD: 'ce de', CPSAA: 'ce pe ese a a', CC: 'ce ce', CE: 'ce e', CCEC: 'ce ce e ce' };
  function paraVoz(t) {
    return String(t)
      .replace(/\b(CCL|CPSAA|CCEC|STEM|CP|CD|CC|CE)(\d)\b/g, (m, a, n) => `${DESCRIPTORES[a]} ${n}`)
      .replace(/[«»“”"]/g, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/y\/o/g, 'y o')
      .replace(/(\d+)\/(\d+)\/(\d{4})/g, (m, d, mes, a) => (MESES[+mes - 1] ? `${d} de ${MESES[+mes - 1]} de ${a}` : m))
      .replace(/(\d+)\/(\d{4})/g, '$1 de $2')
      .replace(/\b(\d)\.º/g, (m, d) => ({ 1: 'primero', 2: 'segundo', 3: 'tercero', 4: 'cuarto', 5: 'quinto', 6: 'sexto' }[d] || d))
      .replace(/\b\d+(?:\.[0-9A-Za-z]+)+\b/g, (m) => m.split('.').map((p, i, arr) => (i === 0 ? p : (/^\d+$/.test(p) ? ' punto ' + p : (i === arr.length - 1 && p.length === 1 ? ' ' + p : ' punto ' + p)))).join(''))
      .replace(/(\d+)\s*%/g, '$1 por ciento')
      .replace(/\b[A-Za-z]{2,5}\b/g, (w) => SIGLAS[w] || w);
  }

  // ---------------------------------------------------------------- avisos y portapapeles
  let toastTimer = null;
  function aviso(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  async function copiar(texto, nodoSeleccion) {
    try { await navigator.clipboard.writeText(texto); aviso('Copiado'); return true; } catch (e) {
      if (nodoSeleccion) {
        const r = document.createRange(); r.selectNodeContents(nodoSeleccion);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        aviso('Texto seleccionado: cópialo con Ctrl+C');
      }
      return false;
    }
  }

  // ---------------------------------------------------------------- iconos
  const ICONOS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 6h2v12H6zM9.5 12 18 6v12z"/></svg>',
    adelante: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 6h2v12h-2zM14.5 12 6 18V6z"/></svg>',
    menos10: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">10</text></svg>',
    mas10: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">10</text></svg>',
    pantalla: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    micro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21"/></svg>',
  };

  Object.assign(Opo, { esc, $, $$, Almacen, mmss, coma, contarPalabras, PPM, partes, textoDe, htmlPartes, frases, partesPorFrase, aleatorio, hashTexto, paraVoz, aviso, copiar, ICONOS, HUECO_RE });
})();
