/* Pizarra: se dibuja entera (con lo no escrito invisible, para que el reparto del espacio no salte)
   y se van "escribiendo" los elementos según avanza el discurso.
   En pantallas estrechas se muestra como lista legible (mismas zonas, de arriba abajo). */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { esc, htmlPartes } = Opo;

  const ANCHO = 1280;
  const ALTO = 720;
  const ANCHO_MIN_PIZARRA = 760;

  function htmlPizarra(expo) {
    const cab = [];
    const ind = [];
    const norm = [];
    const cajas = new Map();
    expo.pizarra.forEach((p) => {
      const ref = p.zona === 'indice' && p.ref != null ? ` data-ref="${p.ref}"` : '';
      const span = `<span class="pz-it" data-pz="${esc(p.id)}" data-frase="${p.frase}"${ref}>${htmlPartes(p.partes)}</span>`;
      if (p.zona === 'cabecera') cab.push(span);
      else if (p.zona === 'indice') ind.push(span);
      else if (p.zona === 'normativa') norm.push(span);
      else {
        const c = p.caja || 'Ideas clave';
        if (!cajas.has(c)) cajas.set(c, { frase: p.frase, items: [] });
        cajas.get(c).items.push(span);
      }
    });
    const htmlCajas = Array.from(cajas.entries()).map(([titulo, c]) =>
      `<section class="pz-caja"><h4 class="pz-it" data-pz="caja-${esc(titulo)}" data-frase="${c.frase}">${esc(titulo)}</h4>${c.items.join('')}</section>`).join('');
    return `<div class="pizarra" role="img" aria-label="Pizarra de la exposición">
      <div class="pz-cabecera">${cab.join('')}</div>
      <div class="pz-cuerpo">
        <div class="pz-col pz-indice">${ind.join('')}</div>
        <div class="pz-col pz-centro">${htmlCajas}</div>
        <div class="pz-col pz-normativa">${norm.join('')}</div>
      </div>
      <div class="pz-vacia" hidden>La pizarra está en blanco</div>
    </div>`;
  }

  function ajustarLetra(piz) {
    // reduce el tamaño de letra hasta que todo cabe (con todos los elementos ocupando su sitio)
    let tam = 21;
    const cols = Array.from(piz.querySelectorAll('.pz-col'));
    const cabe = () => cols.every((c) => c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 2);
    piz.style.setProperty('--pz-tam', tam + 'px');
    let guard = 0;
    while (!cabe() && tam > 11 && guard++ < 20) { tam -= 1; piz.style.setProperty('--pz-tam', tam + 'px'); }
  }

  class VistaPizarra {
    /** modo: 'auto' (lista si el hueco es estrecho), 'pizarra' o 'lista'. */
    constructor(marco, expo, { modo = 'auto' } = {}) {
      this.marco = marco;
      this.expo = expo;
      this.modo = modo;
      this.vistos = new Set();
      this.todo = false;
      this.seccionActual = -1;
      marco.classList.add('pz-marco');
      marco.innerHTML = `<div class="pz-escala">${htmlPizarra(expo)}</div>`;
      this.escala = marco.firstElementChild;
      this.piz = this.escala.firstElementChild;
      this.items = Array.from(this.piz.querySelectorAll('.pz-it'));
      this.cajas = Array.from(this.piz.querySelectorAll('.pz-caja'));
      this.vacia = this.piz.querySelector('.pz-vacia');
      this.hasta = -1;
      this.aplicarModo();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!this.lista) ajustarLetra(this.piz); this.reescalar(); });
      if ('ResizeObserver' in window) { this.ro = new ResizeObserver(() => { this.aplicarModo(); this.reescalar(); }); this.ro.observe(marco); } else { this.alRedim = () => { this.aplicarModo(); this.reescalar(); }; window.addEventListener('resize', this.alRedim); }
      this.mostrarHasta(-1, -1, false);
    }
    get lista() { return this.marco.classList.contains('pz-lista'); }
    aplicarModo() {
      const ancho = this.marco.clientWidth || window.innerWidth;
      const lista = this.modo === 'lista' || (this.modo === 'auto' && ancho < ANCHO_MIN_PIZARRA && !this.marco.closest('.pz-pantalla'));
      if (lista === this.lista && this._modoAplicado) return;
      this._modoAplicado = true;
      this.marco.classList.toggle('pz-lista', lista);
      if (lista) { this.escala.style.transform = 'none'; this.escala.style.left = ''; this.escala.style.top = ''; this.piz.style.removeProperty('--pz-tam'); } else {
        this.items.forEach((it) => { it.hidden = false; });
        this.cajas.forEach((c) => { c.hidden = false; });
        ajustarLetra(this.piz);
      }
      this.mostrarHasta(this.hasta, this.seccionActual, false);
    }
    ponerModo(m) { this.modo = m; this._modoAplicado = false; this.aplicarModo(); this.reescalar(); }
    reescalar() {
      if (this.lista) return;
      const w = this.marco.clientWidth - 16;
      const h = this.marco.clientHeight - 16;
      if (w <= 0) return;
      let s = w / ANCHO;
      if (h > 0 && this.marco.closest('.pz-pantalla')) s = Math.min(s, h / ALTO);
      this.escala.style.transform = `scale(${s})`;
      const usadoW = ANCHO * s;
      const usadoH = ALTO * s;
      this.escala.style.left = `${8 + Math.max(0, (w - usadoW) / 2)}px`;
      this.escala.style.top = `${8 + Math.max(0, (h - usadoH) / 2)}px`;
    }
    /** Muestra lo escrito hasta la frase global "frase"; seccionActual marca el índice. */
    mostrarHasta(frase, seccionActual, animar = true) {
      this.hasta = frase;
      this.seccionActual = seccionActual;
      const lista = this.lista;
      let visibles = 0;
      let ultimo = null;
      this.items.forEach((it) => {
        const f = Number(it.dataset.frase);
        const ver = this.todo || f <= frase;
        // En la pizarra lo no escrito ocupa su sitio (invisible); en la lista simplemente no aparece.
        it.style.visibility = ver || lista ? 'visible' : 'hidden';
        it.hidden = lista && !ver;
        const id = it.dataset.pz;
        if (ver) {
          visibles++;
          if (!this.vistos.has(id)) {
            this.vistos.add(id);
            if (animar && !this.todo) { it.classList.remove('nuevo'); void it.offsetWidth; it.classList.add('nuevo'); ultimo = it; }
          }
        } else if (this.vistos.has(id)) { this.vistos.delete(id); it.classList.remove('nuevo'); }
        if (it.dataset.ref !== undefined) it.classList.toggle('actual', Number(it.dataset.ref) === seccionActual);
      });
      this.cajas.forEach((c) => {
        const h = c.querySelector('h4');
        const escrita = !!h && (this.todo || Number(h.dataset.frase) <= frase);
        c.classList.toggle('sin-escribir', !escrita);
        c.hidden = lista && !escrita;
      });
      this.vacia.hidden = visibles > 0;
      if (lista && ultimo && this.marco.scrollHeight > this.marco.clientHeight) {
        const r = ultimo.getBoundingClientRect();
        const rm = this.marco.getBoundingClientRect();
        if (r.bottom > rm.bottom || r.top < rm.top) this.marco.scrollTop += r.top - rm.top - rm.height / 2;
      }
    }
    ponerTodo(v) { this.todo = v; this.mostrarHasta(this.hasta, this.seccionActual, false); }
    destruir() { if (this.ro) this.ro.disconnect(); if (this.alRedim) window.removeEventListener('resize', this.alRedim); }
  }

  Opo.VistaPizarra = VistaPizarra;
})();
