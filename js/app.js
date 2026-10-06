/* Arranque: enrutado por #ancla, barra superior y mini-reproductor. */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { esc, $, mmss, ICONOS, Modelo, reproductor } = Opo;

  Opo.Ajustes.aplicar();

  const NAV = [['inicio', 'Inicio'], ['pd-esquema', 'Programación'], ['uds', 'Unidades'], ['sorteo', 'Sorteo'], ['ajustes', 'Ajustes']];
  let actual = null;
  let rutaActual = '';

  const App = {
    pendiente: null,
    tomarPendiente() { const p = this.pendiente; this.pendiente = null; return p; },
    ir(r) { if (location.hash === '#' + r) pintar(); else location.hash = r; },
  };
  Opo.App = App;

  function resolver(ruta) {
    const V = Opo.Vistas;
    let m;
    if (!ruta || ruta === 'inicio') return { v: V.inicio(), nav: 'inicio' };
    if (ruta === 'pd') return { v: V.expo('pd', 'esquema'), nav: 'pd-esquema' };
    if ((m = ruta.match(/^pd-([a-z]+)$/))) return { v: V.expo('pd', m[1]), nav: 'pd-esquema', expo: 'pd', pest: m[1] };
    if ((m = ruta.match(/^(ud\d\d)(?:-([a-z]+))?$/))) return { v: V.expo(m[1], m[2] || 'esquema'), nav: 'uds', expo: m[1], pest: m[2] || 'esquema' };
    if (ruta === 'uds') return { v: V.uds(), nav: 'uds' };
    if (ruta === 'plantilla') return { v: V.plantilla(), nav: 'uds' };
    if (ruta === 'diferencias') return { v: V.diferencias(), nav: 'uds' };
    if (ruta === 'sorteo') return { v: V.sorteo(), nav: 'sorteo' };
    if (ruta === 'ajustes') return { v: V.ajustes(), nav: 'ajustes' };
    return { v: V.inicio(), nav: 'inicio' };
  }

  function pintar() {
    const ruta = decodeURIComponent((location.hash || '#inicio').slice(1));
    const main = $('#principal');
    if (actual && actual.v.destruir) { try { actual.v.destruir(); } catch (e) { console.error(e); } }
    let r;
    try { r = resolver(ruta); } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="aviso-caja">No se ha podido mostrar esta página: ${esc(e.message)}</div>`;
      return;
    }
    actual = r;
    // Cada vista se monta en un contenedor nuevo: al cambiar de página desaparecen sus manejadores.
    main.innerHTML = '<div data-vista></div>';
    const cont = main.firstElementChild;
    cont.innerHTML = r.v.html;
    try { if (r.v.montar) r.v.montar(cont); } catch (e) { console.error(e); }
    document.title = `${r.v.titulo || 'Inicio'} · Oposiciones 2.ª prueba`;
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.getAttribute('href') === '#' + r.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const mismaPagina = rutaActual.split('-')[0] === ruta.split('-')[0] && rutaActual !== '' && ruta.includes('-');
    if (!mismaPagina) window.scrollTo(0, 0);
    rutaActual = ruta;
    pintarMini(reproductor.estado());
  }

  // ---------------------------------------------------------------- mini-reproductor
  function pintarMini(e) {
    const mini = $('#mini');
    const r = actual || {};
    const visibleAqui = e.expo && r.expo === e.expo.id && (r.pest === 'escuchar' || r.pest === 'pizarra');
    const mostrar = e.expo && (e.reproduciendo || e.tiempo > 1) && !visibleAqui;
    mini.hidden = !mostrar;
    document.body.style.paddingBottom = mostrar ? '72px' : '';
    if (!mostrar) return;
    const sec = e.expo.secciones[e.seccion];
    $('[data-mini-play]', mini).innerHTML = e.reproduciendo ? ICONOS.pausa : ICONOS.play;
    $('[data-mini-play]', mini).setAttribute('aria-label', e.reproduciendo ? 'Pausa' : 'Reproducir');
    $('[data-mini-tit]', mini).textContent = e.expo.titulo;
    $('[data-mini-sec]', mini).textContent = `${sec ? `${e.seccion + 1}. ${sec.titulo}` : ''} · ${mmss(e.tiempo)} / ${mmss(e.duracion)}`;
    $('[data-mini-abrir]', mini).setAttribute('href', `#${e.expo.id}-escuchar`);
    $('.minirep-barra i', mini).style.width = `${e.duracion ? Math.min(100, (e.tiempo / e.duracion) * 100) : 0}%`;
  }

  function montarShell() {
    document.body.insertAdjacentHTML('afterbegin', `
      <header class="barra"><div class="barra-in">
        <a class="marca-app" href="#inicio"><b>Exposición oral</b><span>Maestros · Primaria · 2.ª prueba</span></a>
        <nav class="nav" aria-label="Principal">${NAV.map(([h, t]) => `<a href="#${h}">${t}</a>`).join('')}</nav>
      </div></header>
      <main id="principal" tabindex="-1"></main>
      <div class="minirep" id="mini" hidden>
        <div class="minirep-barra"><i></i></div>
        <div class="minirep-in">
          <button class="btn redondo primario" data-mini-play aria-label="Reproducir">${ICONOS.play}</button>
          <div class="info"><b data-mini-tit></b><span data-mini-sec></span></div>
          <a class="btn mini" data-mini-abrir href="#inicio">Abrir</a>
          <button class="btn redondo" data-mini-cerrar aria-label="Detener">${ICONOS.cerrar}</button>
        </div>
      </div>`);
    $('[data-mini-play]').addEventListener('click', () => reproductor.alternar());
    $('[data-mini-cerrar]').addEventListener('click', () => { reproductor.detener(); reproductor.irAFrase(0, { reproducir: false }); pintarMini({}); });
    reproductor.suscribir(pintarMini);
    document.addEventListener('keydown', (ev) => {
      if (ev.defaultPrevented || document.querySelector('.pz-pantalla')) return;
      if (ev.target.closest('input,select,textarea,button,a,[contenteditable]')) return;
      const r = actual || {};
      if (ev.code === 'Space' && r.expo && ['escuchar', 'discurso', 'pizarra'].includes(r.pest)) {
        ev.preventDefault();
        reproductor.cargar(Modelo.expo(r.expo));
        reproductor.alternar();
      }
    });
    window.addEventListener('hashchange', pintar);
  }

  function arrancar() {
    montarShell();
    if (!Modelo.expos.pd && !Modelo.uds.length) {
      $('#principal').innerHTML = '<div class="aviso-caja">No se han encontrado los datos (datos/contenido.js). Genera los contenidos con <code>node herramientas/construir.mjs</code>.</div>';
      return;
    }
    if (!Opo.Almacen.disponible()) {
      $('#principal').insertAdjacentHTML('beforebegin', '<div class="aviso-caja" style="max-width:1180px;margin:12px auto 0;width:calc(100% - 32px)">Este navegador no permite guardar datos: tu progreso no se conservará al cerrar. Usa «Copiar mi progreso» en Ajustes antes de salir.</div>');
    }
    pintar();
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.addEventListener('voiceschanged', () => reproductor.emitir()); } catch (e) { /* nada */ }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
