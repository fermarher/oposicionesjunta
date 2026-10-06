/* Modelo de datos (exposiciones), progreso del estudio y reproductor de audio. */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { partes, textoDe, frases, contarPalabras, PPM, Almacen } = Opo;

  // =============================================================== MODELO
  const DATOS = window.OPOS_DATOS || {};
  const AUDIO = window.OPOS_AUDIO || {};

  const pad2 = (n) => String(n).padStart(2, '0');

  function construirExposicion({ id, tipo, doc, valores, audioClave, titulo, corto, ud, ficha }) {
    const secciones = [];
    const bloques = [];
    const lista = [];
    const pizarra = [];
    let minAcum = 0;
    let palabrasAcum = 0;
    (doc.secciones || []).forEach((s, si) => {
      const sec = {
        id: s.id, idx: si, titulo: textoDe(partes(s.titulo, valores)), rubrica: s.rubrica || [],
        minutos: Number(s.minutos) || 0, esquema: (s.esquema || []).map((e) => partes(e, valores)),
        bloques: [], palabras: 0, iniMin: minAcum, finMin: minAcum + (Number(s.minutos) || 0),
      };
      minAcum = sec.finMin;
      (s.bloques || []).forEach((b) => {
        const ps = partes(b.texto, valores);
        const texto = textoDe(ps);
        const cortes = frases(texto);
        const bl = { id: b.id, seccion: si, partes: ps, texto, cortes, primeraFrase: lista.length, nFrases: cortes.length, palabras: contarPalabras(texto) };
        const rangos = [];
        let pos = 0;
        ps.forEach((p) => { if (p.h && p.t.trim()) rangos.push([pos, pos + p.t.length]); pos += p.t.length; });
        cortes.forEach(([a, z], k) => {
          const t = texto.slice(a, z);
          const w = contarPalabras(t);
          const propia = rangos.some(([x, y]) => x < z && y > a);
          lista.push({ idx: lista.length, bloque: bloques.length, seccion: si, k, a, z, texto: t, palabras: w, propia, est0: (palabrasAcum / PPM) * 60, est1: ((palabrasAcum + w) / PPM) * 60 });
          palabrasAcum += w;
        });
        const items = b.pizarra || [];
        items.forEach((p, j) => {
          const k = cortes.length ? Math.min(cortes.length - 1, Math.floor((j * cortes.length) / Math.max(1, items.length))) : 0;
          pizarra.push({
            id: `${b.id}-${j}`, zona: p.zona, caja: p.caja ? textoDe(partes(p.caja, valores)) : '', partes: partes(p.texto, valores),
            seccion: si, bloque: bloques.length, frase: bl.primeraFrase + k,
          });
        });
        sec.palabras += bl.palabras;
        sec.bloques.push(bl);
        bloques.push(bl);
      });
      secciones.push(sec);
    });
    // tiempos de audio
    let audio = null;
    const a = AUDIO[audioClave];
    if (a && Array.isArray(a.frases)) {
      const porBloque = {};
      a.frases.forEach((f) => { (porBloque[f.b] = porBloque[f.b] || []).push(f); });
      let encaja = true;
      bloques.forEach((bl) => {
        const fs = porBloque[bl.id] || [];
        if (fs.length !== bl.nFrases) { encaja = false; return; }
        fs.forEach((f, k) => { const fr = lista[bl.primeraFrase + k]; fr.t0 = f.t0; fr.t1 = f.t1; });
      });
      if (encaja) audio = { src: `audio/${audioClave}.mp3`, duracion: a.duracion, voz: a.voz };
      else console.warn(`[audio] ${audioClave}: las frases no coinciden con el texto; se usará la voz del navegador.`);
    }
    const guion = doc.guion ? partes(doc.guion, valores) : null;
    return {
      id, tipo, titulo, corto, audioClave, secciones, bloques, frases: lista, pizarra, guion, audio, ud, ficha,
      palabras: palabrasAcum, minutosTexto: palabrasAcum / PPM, objetivoMinutos: doc.objetivoMinutos || minAcum,
      duracionEst: (palabrasAcum / PPM) * 60,
    };
  }

  const expos = {};
  const uds = (DATOS.uds || []).slice().sort((x, y) => x.numero - y.numero);
  const fichas = {};
  (DATOS.fichas || []).forEach((f) => { if (f && f.numero) fichas[f.numero] = f; });

  if (DATOS.programacion) {
    expos.pd = construirExposicion({
      id: 'pd', tipo: 'pd', doc: DATOS.programacion, valores: null, audioClave: 'programacion',
      titulo: DATOS.programacion.titulo || 'Defensa de la programación', corto: 'Programación',
    });
  }
  if (DATOS.plantilla) {
    uds.forEach((u) => {
      const id = `ud${pad2(u.numero)}`;
      expos[id] = construirExposicion({
        id, tipo: 'ud', doc: DATOS.plantilla, valores: u.valores || {}, audioClave: id,
        titulo: `UD ${u.numero}. ${u.titulo}`, corto: `UD ${u.numero}`, ud: u, ficha: fichas[u.numero] || null,
      });
    });
  }
  const etiquetasHuecos = {};
  ((DATOS.plantilla && DATOS.plantilla.huecos) || []).forEach((h) => {
    etiquetasHuecos[h.id] = h.etiqueta || h.id.replace(/_/g, ' ');
  });

  Opo.Modelo = {
    DATOS, expos, uds, fichas, etiquetasHuecos,
    rubricas: DATOS.rubricas || null,
    plantilla: DATOS.plantilla || null,
    idUD: (n) => `ud${pad2(n)}`,
    expo: (id) => expos[id] || null,
  };

  // =============================================================== PROGRESO
  const DIA = 86400000;
  const INTERVALOS = [0, 1, 3, 7, 16];
  const Progreso = {
    srs() { return Almacen.leer('srs', {}); },
    nivel(expoId, secId) { const s = this.srs(); return (s[expoId] && s[expoId][secId] && s[expoId][secId].n) || 0; },
    calificar(expoId, secId, nota) {
      const s = this.srs();
      s[expoId] = s[expoId] || {};
      const prev = s[expoId][secId] || { n: 0, veces: 0 };
      let n = prev.n;
      if (nota === 'otra') n = 0;
      else if (nota === 'dificil') n = Math.max(1, Math.min(n, 2));
      else if (nota === 'bien') n = Math.min(4, n + 1);
      else if (nota === 'facil') n = Math.min(4, n + 2);
      const ahora = Date.now();
      const prox = nota === 'otra' ? ahora + 10 * 60000 : ahora + INTERVALOS[n] * DIA;
      s[expoId][secId] = { n, veces: (prev.veces || 0) + 1, prox, ult: ahora };
      Almacen.escribir('srs', s);
      return s[expoId][secId];
    },
    dominio(expo) {
      if (!expo) return 0;
      const s = this.srs()[expo.id] || {};
      const total = expo.secciones.length * 4;
      return total ? expo.secciones.reduce((a, sec) => a + ((s[sec.id] && s[sec.id].n) || 0), 0) / total : 0;
    },
    pendientes() {
      const s = this.srs();
      const ahora = Date.now();
      const out = [];
      Object.entries(s).forEach(([eid, secs]) => Object.entries(secs).forEach(([sid, v]) => { if (v.prox && v.prox <= ahora) out.push({ expo: eid, seccion: sid, ...v }); }));
      return out.sort((a, b) => a.prox - b.prox);
    },
    ensayos() { return Almacen.leer('ensayos', []); },
    guardarEnsayo(e) { const l = this.ensayos(); l.unshift(e); Almacen.escribir('ensayos', l.slice(0, 200)); },
    autoevaluaciones() { return Almacen.leer('rubricas', []); },
    guardarAutoevaluacion(r) { const l = this.autoevaluaciones(); l.unshift(r); Almacen.escribir('rubricas', l.slice(0, 200)); },
    tarjetas() { return Almacen.leer('tarjetas', {}); },
    marcarTarjeta(clave, bien) {
      const t = this.tarjetas();
      const v = t[clave] || { ok: 0, ko: 0 };
      if (bien) v.ok++; else v.ko++;
      v.ult = Date.now();
      t[clave] = v;
      Almacen.escribir('tarjetas', t);
    },
    sorteos() { return Almacen.leer('sorteos', []); },
    guardarSorteo(s) { const l = this.sorteos(); l.unshift(s); Almacen.escribir('sorteos', l.slice(0, 100)); },
    escuchado(expoId, segundos) {
      const e = Almacen.leer('escuchado', {});
      e[expoId] = Math.max(e[expoId] || 0, segundos);
      Almacen.escribir('escuchado', e);
    },
  };
  Opo.Progreso = Progreso;

  // =============================================================== AJUSTES
  const AJ_DEF = { tema: 'sistema', tamTexto: 1.12, voz: '', velocidad: 1, fuente: 'auto', marcaPropio: true, notasPizarra: false };
  Opo.Ajustes = {
    leer() { return { ...AJ_DEF, ...Almacen.leer('ajustes', {}) }; },
    poner(k, v) { const a = this.leer(); a[k] = v; Almacen.escribir('ajustes', a); this.aplicar(); return a; },
    aplicar() {
      const a = this.leer();
      const r = document.documentElement;
      if (a.tema === 'claro') r.setAttribute('data-theme', 'light');
      else if (a.tema === 'oscuro') r.setAttribute('data-theme', 'dark');
      else r.removeAttribute('data-theme');
      r.style.setProperty('--texto-discurso', `${a.tamTexto}rem`);
    },
  };

  // =============================================================== REPRODUCTOR
  function buscarFrase(lista, t) {
    let lo = 0;
    let hi = lista.length - 1;
    let res = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((lista[mid].t0 ?? 0) <= t + 0.05) { res = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return res;
  }

  function vozPreferida() {
    if (!('speechSynthesis' in window)) return null;
    const voces = window.speechSynthesis.getVoices().filter((v) => /^es(-|_|$)/i.test(v.lang));
    if (!voces.length) return null;
    const elegida = Opo.Ajustes.leer().voz;
    const exacta = voces.find((v) => v.name === elegida);
    if (exacta) return exacta;
    const puntuar = (v) => (/es-ES/i.test(v.lang) ? 4 : 0) + (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google|elvira|alvaro|álvaro|lucia|lucía|mónica|monica|paulina|helena|laura/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    return voces.slice().sort((x, y) => puntuar(y) - puntuar(x))[0];
  }

  class Reproductor {
    constructor() {
      this.expo = null;
      this.modo = 'voz';
      this.frase = 0;
      this.reproduciendo = false;
      this.velocidad = Opo.Ajustes.leer().velocidad || 1;
      this.subs = new Set();
      this.audio = null;
      this.token = 0;
      this.errorAudio = '';
      this.blobUrls = {};
      this.soloPropias = false;
    }
    siguientePermitida(i) {
      const ex = this.expo;
      if (!ex || !this.soloPropias) return i;
      while (i < ex.frases.length && !ex.frases[i].propia) i++;
      return i;
    }
    ponerSoloPropias(v) {
      this.soloPropias = !!v;
      if (v && this.expo && !this.expo.frases[this.frase].propia) this.irAFrase(this.siguientePermitida(this.frase));
      this.emitir();
    }
    suscribir(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
    emitir() { const e = this.estado(); this.subs.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } }); }
    estado() {
      const ex = this.expo;
      const total = ex ? (this.modo === 'mp3' ? ex.audio.duracion : ex.duracionEst / this.velocidad) : 0;
      const fr = ex ? ex.frases[this.frase] : null;
      let t = 0;
      if (ex && this.modo === 'mp3' && this.audio) t = this.audio.currentTime;
      else if (fr) t = fr.est0 / this.velocidad;
      return { expo: ex, frase: this.frase, seccion: fr ? fr.seccion : 0, bloque: fr ? fr.bloque : 0, reproduciendo: this.reproduciendo, tiempo: t, duracion: total, modo: this.modo, velocidad: this.velocidad, error: this.errorAudio, soloPropias: this.soloPropias };
    }
    usarMp3(expo) {
      const pref = Opo.Ajustes.leer().fuente;
      return !!(expo && expo.audio && pref !== 'voz' && !this.fallidos?.has(expo.id));
    }
    cargar(expo) {
      if (this.expo && expo && this.expo.id === expo.id) return;
      this.detener();
      this.soloPropias = false;
      this.expo = expo;
      this.frase = 0;
      this.errorAudio = '';
      this.modo = this.usarMp3(expo) ? 'mp3' : 'voz';
      if (this.modo === 'mp3') this.prepararAudio();
      this.emitir();
    }
    prepararAudio() {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.audio.addEventListener('timeupdate', () => this.alTiempo());
        this.audio.addEventListener('ended', () => { this.reproduciendo = false; this.emitir(); });
        this.audio.addEventListener('pause', () => { if (this.reproduciendo && !this.audio.ended && !this._cambiando) { this.reproduciendo = false; this.emitir(); } });
        this.audio.addEventListener('play', () => { if (!this.reproduciendo) { this.reproduciendo = true; this.emitir(); } });
        this.audio.addEventListener('error', () => this.alError());
      }
      const ex = this.expo;
      this.audio.src = this.blobUrls[ex.id] || ex.audio.src;
      this.audio.playbackRate = this.velocidad;
    }
    async alError() {
      const ex = this.expo;
      if (!ex || this.modo !== 'mp3') return;
      if (!this.blobUrls[ex.id] && !this._intentoBlob) {
        // algunas plataformas bloquean <audio src> pero permiten fetch del mismo fichero
        this._intentoBlob = true;
        try {
          const r = await fetch(ex.audio.src);
          if (!r.ok) throw new Error(r.status);
          const b = await r.blob();
          this.blobUrls[ex.id] = URL.createObjectURL(b);
          this._intentoBlob = false;
          const seguir = this.reproduciendo;
          this.audio.src = this.blobUrls[ex.id];
          this.irAFrase(this.frase, { reproducir: seguir });
          return;
        } catch (e) { this._intentoBlob = false; }
      }
      this.fallidos = this.fallidos || new Set();
      this.fallidos.add(ex.id);
      this.errorAudio = 'No se pudo cargar el audio grabado; se usa la voz del navegador.';
      const seguir = this.reproduciendo;
      this.reproduciendo = false;
      this.modo = 'voz';
      this.emitir();
      if (seguir) this.play();
    }
    alTiempo() {
      if (this.modo !== 'mp3' || !this.expo) return;
      const t = this.audio.currentTime;
      let i = buscarFrase(this.expo.frases, t);
      if (this.soloPropias && this.reproduciendo && !this.expo.frases[i].propia) {
        const j = this.siguientePermitida(i);
        if (j >= this.expo.frases.length) { this.pausa(); return; }
        this.audio.currentTime = this.expo.frases[j].t0 + 0.01;
        i = j;
      }
      if (i !== this.frase || this.reproduciendo) {
        const cambio = i !== this.frase;
        this.frase = i;
        if (cambio) Opo.Progreso.escuchado(this.expo.id, t);
        this.emitir();
      }
    }
    play() {
      if (!this.expo) return;
      if (this.modo === 'mp3') {
        this.audio.playbackRate = this.velocidad;
        const p = this.audio.play();
        this.reproduciendo = true;
        if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') { this.reproduciendo = false; this.emitir(); } });
      } else {
        if (!('speechSynthesis' in window)) { Opo.aviso('Este navegador no tiene voz sintética.'); return; }
        this.reproduciendo = true;
        this.hablar(this.frase);
      }
      this.metadatos();
      this.emitir();
    }
    pausa() {
      this.reproduciendo = false;
      if (this.modo === 'mp3' && this.audio) this.audio.pause();
      else { this.token++; try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ } }
      this.emitir();
    }
    alternar() { if (this.reproduciendo) this.pausa(); else this.play(); }
    detener() {
      this.token++;
      this.reproduciendo = false;
      if (this.audio) { this._cambiando = true; this.audio.pause(); this._cambiando = false; }
      try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
    }
    hablar(i) {
      const ex = this.expo;
      i = this.siguientePermitida(i);
      if (!ex || i >= ex.frases.length) { this.reproduciendo = false; this.emitir(); return; }
      const tok = ++this.token;
      this.frase = i;
      this.emitir();
      const fr = ex.frases[i];
      const u = new SpeechSynthesisUtterance(Opo.paraVoz(fr.texto));
      const v = vozPreferida();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'es-ES';
      u.rate = this.velocidad;
      u.onend = () => {
        if (tok !== this.token || !this.reproduciendo) return;
        const sig = ex.frases[i + 1];
        const pausa = !sig ? 0 : sig.seccion !== fr.seccion ? 900 : sig.bloque !== fr.bloque ? 450 : 120;
        setTimeout(() => { if (tok === this.token && this.reproduciendo) this.hablar(i + 1); }, pausa / this.velocidad);
      };
      u.onerror = (e) => { if (tok === this.token && e.error !== 'interrupted' && e.error !== 'canceled') { this.reproduciendo = false; this.emitir(); } };
      try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
      window.speechSynthesis.speak(u);
    }
    irAFrase(i, { reproducir = null } = {}) {
      const ex = this.expo;
      if (!ex) return;
      i = Math.max(0, Math.min(ex.frases.length - 1, i));
      const seguir = reproducir == null ? this.reproduciendo : reproducir;
      this.frase = i;
      if (this.modo === 'mp3') {
        const t0 = ex.frases[i].t0 || 0;
        try { this.audio.currentTime = t0 + 0.01; } catch (e) { /* aún sin metadatos */ this.audio.addEventListener('loadedmetadata', () => { this.audio.currentTime = t0 + 0.01; }, { once: true }); }
        if (seguir) this.play(); else this.emitir();
      } else if (seguir) { this.reproduciendo = true; this.hablar(i); } else { this.emitir(); }
    }
    saltarSeg(d) {
      if (this.modo === 'mp3' && this.audio) { this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 1e9, this.audio.currentTime + d)); this.alTiempo(); return; }
      const ex = this.expo; if (!ex) return;
      const objetivo = (ex.frases[this.frase].est0 / this.velocidad) + d;
      let i = this.frase;
      while (d > 0 && i < ex.frases.length - 1 && ex.frases[i + 1].est0 / this.velocidad <= objetivo) i++;
      while (d < 0 && i > 0 && ex.frases[i].est0 / this.velocidad > objetivo) i--;
      this.irAFrase(i);
    }
    irATiempo(t) {
      const ex = this.expo; if (!ex) return;
      if (this.modo === 'mp3') { this.audio.currentTime = t; this.alTiempo(); return; }
      let i = 0;
      while (i < ex.frases.length - 1 && ex.frases[i + 1].est0 / this.velocidad <= t) i++;
      this.irAFrase(i);
    }
    seccionRelativa(d) {
      const ex = this.expo; if (!ex) return;
      const actual = ex.frases[this.frase].seccion;
      const objetivo = Math.max(0, Math.min(ex.secciones.length - 1, actual + d));
      const sec = ex.secciones[objetivo];
      this.irAFrase(sec.bloques[0].primeraFrase);
    }
    irASeccion(si) { const sec = this.expo && this.expo.secciones[si]; if (sec) this.irAFrase(sec.bloques[0].primeraFrase); }
    ponerVelocidad(v) {
      this.velocidad = v;
      Opo.Ajustes.poner('velocidad', v);
      if (this.modo === 'mp3' && this.audio) this.audio.playbackRate = v;
      else if (this.reproduciendo) this.hablar(this.frase);
      this.emitir();
    }
    cambiarFuente() {
      const ex = this.expo;
      this.detener();
      this.modo = this.usarMp3(ex) ? 'mp3' : 'voz';
      if (this.modo === 'mp3') this.prepararAudio();
      this.irAFrase(this.frase, { reproducir: false });
    }
    metadatos() {
      if (!('mediaSession' in navigator) || !this.expo) return;
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title: this.expo.titulo, artist: 'Oposiciones · segunda prueba', album: this.expo.tipo === 'pd' ? 'Programación didáctica' : 'Unidades didácticas' });
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pausa());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.seccionRelativa(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.seccionRelativa(1));
      } catch (e) { /* opcional */ }
    }
  }
  Opo.reproductor = new Reproductor();
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => {}; } catch (e) { /* nada */ }
  }
  Opo.vozPreferida = vozPreferida;
})();
