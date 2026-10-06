/* Pizarra: se dibuja entera (con lo no escrito invisible, para que el reparto del espacio no salte)
   y se van "escribiendo" los elementos según avanza el discurso. */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { esc, htmlPartes } = Opo;

  const ANCHO = 1280;
  const ALTO = 720;

  function htmlPizarra(expo) {
    const cab = [];
    const ind = [];
    const norm = [];
    const cajas = new Map();
    expo.pizarra.forEach((p) => {
      const span = `<span class="pz-it" data-pz="${esc(p.id)}" data-frase="${p.frase}" data-sec="${p.seccion}">${htmlPartes(p.partes)}</span>`;
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
    constructor(marco, expo) {
      this.marco = marco;
      this.expo = expo;
      this.vistos = new Set();
      this.todo = false;
      marco.classList.add('pz-marco');
      marco.innerHTML = `<div class="pz-escala">${htmlPizarra(expo)}</div>`;
      this.escala = marco.firstElementChild;
      this.piz = this.escala.firstElementChild;
      this.items = Array.from(this.piz.querySelectorAll('.pz-it'));
      this.vacia = this.piz.querySelector('.pz-vacia');
      this.reescalar();
      ajustarLetra(this.piz);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ajustarLetra(this.piz); this.reescalar(); });
      if ('ResizeObserver' in window) { this.ro = new ResizeObserver(() => this.reescalar()); this.ro.observe(marco); } else window.addEventListener('resize', () => this.reescalar());
      this.hasta = -1;
      this.mostrarHasta(-1, -1, false);
    }
    reescalar() {
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
      let visibles = 0;
      this.items.forEach((it) => {
        const f = Number(it.dataset.frase);
        const ver = this.todo || f <= frase;
        it.style.visibility = ver ? 'visible' : 'hidden';
        const id = it.dataset.pz;
        if (ver) {
          visibles++;
          if (!this.vistos.has(id)) {
            this.vistos.add(id);
            if (animar && !this.todo) { it.classList.remove('nuevo'); void it.offsetWidth; it.classList.add('nuevo'); }
          }
        } else if (this.vistos.has(id)) { this.vistos.delete(id); it.classList.remove('nuevo'); }
        if (it.dataset.sec !== undefined && it.closest('.pz-indice')) it.classList.toggle('actual', Number(it.dataset.sec) === seccionActual);
      });
      this.piz.querySelectorAll('.pz-caja').forEach((c) => { const h = c.querySelector('h4'); c.classList.toggle('sin-escribir', !!h && h.style.visibility === 'hidden'); });
      this.vacia.hidden = visibles > 0;
    }
    ponerTodo(v) { this.todo = v; this.mostrarHasta(this.hasta, -1, false); }
    destruir() { if (this.ro) this.ro.disconnect(); }
  }

  Opo.VistaPizarra = VistaPizarra;
})();
