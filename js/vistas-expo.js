/* Vistas de una exposición (programación o una UD). */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { esc, $, $$, mmss, coma, htmlPartes, partesPorFrase, textoDe, contarPalabras, aleatorio, hashTexto, ICONOS, Modelo, Progreso, reproductor } = Opo;

  const PESTANAS = [
    ['esquema', 'Esquema'], ['discurso', 'Discurso'], ['escuchar', 'Escuchar'], ['pizarra', 'Pizarra'],
    ['memorizar', 'Memorizar'], ['ensayo', 'Ensayo'], ['guion', 'Guion A5', 'ud'], ['ficha', 'Ficha', 'ud'], ['rubrica', 'Rúbrica'],
  ];

  const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

  function itemRubrica(tipo, nombre) {
    const items = (Modelo.rubricas && Modelo.rubricas[tipo] && Modelo.rubricas[tipo].items) || [];
    const n = normalizar(nombre);
    if (!n) return null;
    return items.find((it) => normalizar(it.titulo) === n)
      || items.find((it) => normalizar(it.titulo).startsWith(n) || n.startsWith(normalizar(it.titulo)))
      || items.find((it) => normalizar(it.titulo).includes(n) || n.includes(normalizar(it.titulo)))
      || items.find((it) => n.split(' ').filter((w) => w.length > 5).some((w) => normalizar(it.titulo).includes(w)));
  }
  function claseNota(m) { return m < 5 ? 'critico' : m < 7 ? 'aviso' : 'bueno'; }
  function chipsRubrica(expo, sec) {
    const vistos = new Set();
    return sec.rubrica.map((r) => {
      const it = itemRubrica(expo.tipo, r);
      if (!it) return `<span class="chip">${esc(r)}</span>`;
      if (vistos.has(it.id)) return '';
      vistos.add(it.id);
      return `<span class="chip ${claseNota(it.media2025)}" title="Peso ${coma(it.peso, 1)} % · media 2025: ${coma(it.media2025, 2)}">${esc(it.titulo.replace(/:.*/, ''))} · ${coma(it.peso, 1)} %<span class="sr"> (nota media 2025 ${coma(it.media2025, 2)})</span></span>`;
    }).join(' ');
  }
  function puntosDominio(expo) {
    const s = Progreso.srs()[expo.id] || {};
    return `<span class="dominio" title="Dominio por secciones" style="min-width:120px">${expo.secciones.map((sec) => `<i class="n${(s[sec.id] && s[sec.id].n) || 0}"></i>`).join('')}</span>`;
  }

  function htmlBloque(bl) {
    return partesPorFrase(bl.partes, bl.cortes).map((tr) => {
      const inner = htmlPartes(tr.trozos);
      if (tr.frase == null) return inner;
      const propia = tr.trozos.some((x) => x.h && x.t.trim());
      return `<span class="frase${propia ? ' con-propio' : ''}" data-f="${bl.primeraFrase + tr.frase}">${inner}</span>`;
    }).join('');
  }
  function htmlNotas(expo, bl) {
    const items = expo.pizarra.filter((p) => p.bloque === expo.bloques.indexOf(bl));
    if (!items.length) return '';
    return `<div class="notas-pizarra" aria-label="Pizarra">${items.map((p) => `<span data-zona="${esc(p.zona)}">${p.caja && p.zona === 'centro' ? `<b>${esc(p.caja)}:</b> ` : ''}${htmlPartes(p.partes)}</span>`).join('')}</div>`;
  }
  function htmlDiscurso(expo, { notas = false } = {}) {
    return expo.secciones.map((sec, si) => `
      <section data-sec="${si}" id="sec-${esc(expo.id)}-${si}">
        <h3>${si + 1}. ${esc(sec.titulo)} <span class="min">${mmss(sec.iniMin * 60)}–${mmss(sec.finMin * 60)}</span></h3>
        ${sec.bloques.map((bl) => `<p>${htmlBloque(bl)}</p>${notas ? htmlNotas(expo, bl) : ''}`).join('')}
      </section>`).join('');
  }

  // Resalta la frase en curso dentro de un contenedor y la mantiene a la vista.
  function seguidorFrases(cont, expo, { desplazar = 'contenedor' } = {}) {
    let ultima = -1;
    const pintar = (e) => {
      if (!e.expo || e.expo.id !== expo.id) return;
      if (e.frase === ultima) return;
      const prev = cont.querySelector('.frase.actual');
      if (prev) prev.classList.remove('actual');
      $$('.frase', cont).forEach((n) => n.classList.toggle('leida', Number(n.dataset.f) < e.frase));
      const act = cont.querySelector(`.frase[data-f="${e.frase}"]`);
      if (act) {
        act.classList.add('actual');
        if (ultima !== -1 || e.reproduciendo) {
          if (desplazar === 'contenedor') {
            const r = act.getBoundingClientRect();
            const rc = cont.getBoundingClientRect();
            if (r.top < rc.top + 40 || r.bottom > rc.bottom - 40) cont.scrollTop += r.top - rc.top - rc.height / 3;
          } else if (desplazar === 'pagina' && e.reproduciendo) {
            const r = act.getBoundingClientRect();
            if (r.top < 90 || r.bottom > window.innerHeight - 110) window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: 'smooth' });
          }
        }
      }
      ultima = e.frase;
    };
    cont.addEventListener('click', (ev) => {
      const f = ev.target.closest('.frase');
      if (!f) return;
      reproductor.cargar(expo);
      reproductor.irAFrase(Number(f.dataset.f), { reproducir: true });
    });
    const quitar = reproductor.suscribir(pintar);
    pintar(reproductor.estado());
    return quitar;
  }

  // ---------------------------------------------------------------- controles del reproductor
  function htmlControles(expo, { grande = true } = {}) {
    const vels = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
    return `<div class="reproductor" data-rep>
      <div class="controles">
        <button class="btn redondo" data-acc="sec-ant" title="Sección anterior" aria-label="Sección anterior">${ICONOS.atras}</button>
        <button class="btn redondo" data-acc="menos10" title="Retroceder 10 segundos" aria-label="Retroceder 10 segundos">${ICONOS.menos10}</button>
        <button class="btn ${grande ? 'grande' : 'redondo'} primario" data-acc="play" aria-label="Reproducir">${ICONOS.play}</button>
        <button class="btn redondo" data-acc="mas10" title="Avanzar 10 segundos" aria-label="Avanzar 10 segundos">${ICONOS.mas10}</button>
        <button class="btn redondo" data-acc="sec-sig" title="Sección siguiente" aria-label="Sección siguiente">${ICONOS.adelante}</button>
        <label class="campo" style="margin-left:auto"><span class="sr">Velocidad</span>
          <select data-acc="vel" aria-label="Velocidad">${vels.map((v) => `<option value="${v}">${coma(v, 2).replace(/,?0+$/, '')}×</option>`).join('')}</select>
        </label>
        <label class="campo"><span class="sr">Ir a la sección</span>
          <select data-acc="ir-sec" aria-label="Ir a la sección">${expo.secciones.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.titulo)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="progreso"><span data-t>00:00</span><input type="range" min="0" max="1000" value="0" data-acc="barra" aria-label="Posición"><span data-d>00:00</span></div>
      <div class="fuente-audio" data-fuente></div>
    </div>`;
  }
  function montarControles(raiz, expo) {
    const r = raiz.querySelector('[data-rep]');
    if (!r) return () => {};
    let arrastrando = false;
    r.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-acc]');
      if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
      reproductor.cargar(expo);
      const a = b.dataset.acc;
      if (a === 'play') reproductor.alternar();
      else if (a === 'sec-ant') reproductor.seccionRelativa(-1);
      else if (a === 'sec-sig') reproductor.seccionRelativa(1);
      else if (a === 'menos10') reproductor.saltarSeg(-10);
      else if (a === 'mas10') reproductor.saltarSeg(10);
      else if (a === 'fuente') { Opo.Ajustes.poner('fuente', Opo.Ajustes.leer().fuente === 'voz' ? 'auto' : 'voz'); reproductor.cambiarFuente(); }
    });
    r.querySelector('[data-acc=vel]').addEventListener('change', (ev) => { reproductor.cargar(expo); reproductor.ponerVelocidad(Number(ev.target.value)); });
    r.querySelector('[data-acc=ir-sec]').addEventListener('change', (ev) => { reproductor.cargar(expo); reproductor.irASeccion(Number(ev.target.value)); });
    const barra = r.querySelector('[data-acc=barra]');
    barra.addEventListener('input', () => { arrastrando = true; });
    barra.addEventListener('change', () => {
      reproductor.cargar(expo);
      const e = reproductor.estado();
      reproductor.irATiempo((Number(barra.value) / 1000) * e.duracion);
      arrastrando = false;
    });
    const pintar = (e) => {
      const propio = e.expo && e.expo.id === expo.id;
      const playBtn = r.querySelector('[data-acc=play]');
      playBtn.innerHTML = propio && e.reproduciendo ? ICONOS.pausa : ICONOS.play;
      playBtn.setAttribute('aria-label', propio && e.reproduciendo ? 'Pausa' : 'Reproducir');
      const dur = propio ? e.duracion : (expo.audio ? expo.audio.duracion : expo.duracionEst);
      r.querySelector('[data-t]').textContent = mmss(propio ? e.tiempo : 0);
      r.querySelector('[data-d]').textContent = mmss(dur);
      if (!arrastrando) barra.value = propio && dur ? Math.round((e.tiempo / dur) * 1000) : 0;
      r.querySelector('[data-acc=vel]').value = String(e.velocidad);
      if (propio) r.querySelector('[data-acc=ir-sec]').value = String(e.seccion);
      const modo = propio ? e.modo : (expo.audio && Opo.Ajustes.leer().fuente !== 'voz' ? 'mp3' : 'voz');
      const v = Opo.vozPreferida && Opo.vozPreferida();
      r.querySelector('[data-fuente]').innerHTML = (modo === 'mp3'
        ? 'Audio grabado con voz neuronal'
        : `Voz del navegador${v ? `: ${esc(v.name)}` : ''}${expo.audio ? '' : ' (esta exposición aún no tiene audio grabado)'}`)
        + (expo.audio ? ` · <button class="btn mini" data-acc="fuente">${modo === 'mp3' ? 'Usar la voz del navegador' : 'Usar el audio grabado'}</button>` : '')
        + (propio && e.error ? ` · <span style="color:var(--aviso)">${esc(e.error)}</span>` : '');
    };
    const quitar = reproductor.suscribir(pintar);
    pintar(reproductor.estado());
    return quitar;
  }

  // ================================================================ PESTAÑAS
  const Pest = {};

  Pest.esquema = (expo) => {
    const total = expo.secciones.reduce((a, s) => a + s.minutos, 0) || 30;
    const html = `
      <div class="pila">
        ${expo.tipo === 'ud' ? '<p class="info-caja">Lo <span class="propio">resaltado</span> es lo propio de esta unidad; todo lo demás es idéntico en las 12 unidades didácticas.</p>' : ''}
        <div class="tarjeta pila" style="gap:8px">
          <div class="fila entre"><h3>Reparto del tiempo</h3><span class="tenue num">Texto: ${expo.palabras} palabras ≈ ${coma(expo.minutosTexto)} min a 130 palabras/min</span></div>
          <div class="linea-tiempo" role="list">${expo.secciones.map((s, i) => `<a role="listitem" href="#${expo.id}-discurso" data-ir-sec="${i}" style="flex:${s.minutos}" title="${esc(s.titulo)} · ${coma(s.minutos)} min">${i + 1}</a>`).join('')}</div>
          <div class="marcas-tiempo"><span>00:00</span><span>${mmss((total / 2) * 60)}</span><span>${mmss(total * 60)}</span></div>
        </div>
        ${expo.secciones.map((s, i) => `
          <article class="tarjeta esq-seccion">
            <div class="esq-tiempo"><b>${i + 1}</b>${mmss(s.iniMin * 60)}–${mmss(s.finMin * 60)}<br>${coma(s.minutos)} min</div>
            <div class="pila" style="gap:8px">
              <div class="fila entre"><h3>${esc(s.titulo)}</h3><span class="tenue">${s.palabras} palabras</span></div>
              <div class="fila" style="gap:6px">${chipsRubrica(expo, s)}</div>
              <ul class="esq-lista">${s.esquema.map((e) => `<li>${htmlPartes(e)}</li>`).join('')}</ul>
              <div class="fila"><a class="btn mini" href="#${expo.id}-discurso" data-ir-sec="${i}">Leer</a><button class="btn mini" data-escuchar-sec="${i}">Escuchar</button><a class="btn mini" href="#${expo.id}-memorizar" data-memo-sec="${i}">Memorizar</a></div>
            </div>
          </article>`).join('')}
      </div>`;
    return {
      html,
      montar(raiz) {
        raiz.addEventListener('click', (ev) => {
          const a = ev.target.closest('[data-ir-sec]');
          if (a) Opo.App.pendiente = { seccion: Number(a.dataset.irSec) };
          const m = ev.target.closest('[data-memo-sec]');
          if (m) Opo.App.pendiente = { seccion: Number(m.dataset.memoSec) };
          const e = ev.target.closest('[data-escuchar-sec]');
          if (e) { reproductor.cargar(expo); reproductor.irASeccion(Number(e.dataset.escucharSec)); reproductor.play(); Opo.App.ir(`${expo.id}-escuchar`); }
        });
      },
    };
  };

  Pest.discurso = (expo) => {
    const aj = Opo.Ajustes.leer();
    const html = `
      <div class="fila entre">
        <div class="fila">
          ${expo.tipo === 'ud' ? `<label class="interruptor"><input type="checkbox" id="op-marca" ${aj.marcaPropio ? 'checked' : ''}> Resaltar lo propio de la UD</label>` : ''}
          <label class="interruptor"><input type="checkbox" id="op-notas" ${aj.notasPizarra ? 'checked' : ''}> Ver lo que va en la pizarra</label>
        </div>
        <div class="fila"><span class="tenue">Tamaño</span><button class="btn mini" data-tam="-1" aria-label="Letra más pequeña">A−</button><button class="btn mini" data-tam="1" aria-label="Letra más grande">A+</button></div>
      </div>
      <p class="tenue">Pulsa cualquier frase para escucharla desde ahí.</p>
      <div class="con-lateral">
        <nav class="indice-lateral" aria-label="Secciones">${expo.secciones.map((s, i) => `<a href="#${expo.id}-discurso" data-sec-link="${i}">${i + 1}. ${esc(s.titulo)}</a>`).join('')}</nav>
        <div class="discurso ${aj.marcaPropio ? '' : 'sin-marca'}" data-texto>${htmlDiscurso(expo, { notas: aj.notasPizarra })}</div>
      </div>`;
    let quitar = null;
    return {
      html,
      montar(raiz) {
        const texto = $('[data-texto]', raiz);
        const remontar = () => { if (quitar) quitar(); texto.innerHTML = htmlDiscurso(expo, { notas: Opo.Ajustes.leer().notasPizarra }); quitar = seguidorFrases(texto, expo, { desplazar: 'pagina' }); };
        quitar = seguidorFrases(texto, expo, { desplazar: 'pagina' });
        const marca = $('#op-marca', raiz);
        if (marca) marca.addEventListener('change', () => { Opo.Ajustes.poner('marcaPropio', marca.checked); texto.classList.toggle('sin-marca', !marca.checked); });
        $('#op-notas', raiz).addEventListener('change', (ev) => { Opo.Ajustes.poner('notasPizarra', ev.target.checked); remontar(); });
        $$('[data-tam]', raiz).forEach((b) => b.addEventListener('click', () => {
          const v = Math.max(0.9, Math.min(1.6, Opo.Ajustes.leer().tamTexto + Number(b.dataset.tam) * 0.08));
          Opo.Ajustes.poner('tamTexto', Math.round(v * 100) / 100);
        }));
        raiz.addEventListener('click', (ev) => {
          const l = ev.target.closest('[data-sec-link]');
          if (!l) return;
          ev.preventDefault();
          const s = $(`#sec-${expo.id}-${l.dataset.secLink}`, raiz);
          if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const p = Opo.App.tomarPendiente();
        if (p && p.seccion != null) setTimeout(() => { const s = $(`#sec-${expo.id}-${p.seccion}`, raiz); if (s) s.scrollIntoView({ block: 'start' }); }, 30);
      },
      destruir() { if (quitar) quitar(); },
    };
  };

  Pest.escuchar = (expo) => {
    const html = `
      <div class="tarjeta elevada">${htmlControles(expo)}</div>
      <div class="escuchar">
        <div class="tarjeta"><div class="texto-vivo discurso ${Opo.Ajustes.leer().marcaPropio ? '' : 'sin-marca'}" data-texto>${htmlDiscurso(expo)}</div></div>
        <div class="panel-pizarra">
          <div data-pz></div>
          <div class="fila"><button class="btn mini" data-acc-pz="pantalla">${ICONOS.pantalla} Pantalla completa</button><label class="interruptor"><input type="checkbox" data-acc-pz="todo"> Ver la pizarra completa</label></div>
          ${expo.tipo === 'ud' ? '<label class="interruptor"><input type="checkbox" data-acc-pz="propias"> Escuchar solo las frases con lo propio de esta UD</label>' : ''}
        </div>
      </div>`;
    const limpiar = [];
    let pz = null;
    return {
      html,
      montar(raiz) {
        reproductor.cargar(expo);
        limpiar.push(montarControles(raiz, expo));
        limpiar.push(seguidorFrases($('[data-texto]', raiz), expo));
        pz = new Opo.VistaPizarra($('[data-pz]', raiz), expo);
        const sincro = (e) => { if (e.expo && e.expo.id === expo.id) pz.mostrarHasta(e.frase, e.seccion); };
        limpiar.push(reproductor.suscribir(sincro));
        sincro(reproductor.estado());
        $('[data-acc-pz=todo]', raiz).addEventListener('change', (ev) => pz.ponerTodo(ev.target.checked));
        $('[data-acc-pz=pantalla]', raiz).addEventListener('click', () => Opo.pantallaPizarra(expo));
        const prop = $('[data-acc-pz=propias]', raiz);
        if (prop) {
          prop.checked = reproductor.soloPropias;
          prop.addEventListener('change', () => { reproductor.cargar(expo); reproductor.ponerSoloPropias(prop.checked); $('[data-texto]', raiz).classList.toggle('solo-propias', prop.checked); });
          $('[data-texto]', raiz).classList.toggle('solo-propias', prop.checked);
        }
      },
      destruir() { limpiar.forEach((f) => f && f()); if (pz) pz.destruir(); },
    };
  };

  Pest.pizarra = (expo) => {
    const zonas = { cabecera: 'Cabecera', indice: 'Índice (izquierda)', centro: 'Centro', normativa: 'Normativa y autores (derecha)' };
    const plan = Object.keys(zonas).map((z) => {
      const items = expo.pizarra.filter((p) => p.zona === z);
      if (!items.length) return '';
      return `<div><h4 class="eyebrow">${zonas[z]}</h4><ul class="lista-limpia">${items.map((p) => `<li>${z === 'centro' && p.caja ? `<b>${esc(p.caja)}</b> · ` : ''}${htmlPartes(p.partes)} <span class="tenue">(${esc(expo.secciones[p.seccion].titulo)})</span></li>`).join('')}</ul></div>`;
    }).join('');
    const html = `
      <div class="pila">
        <div data-pz></div>
        <div class="fila">
          <button class="btn" data-pz-acc="ant">← Anterior</button>
          <button class="btn primario" data-pz-acc="play">${ICONOS.play} Escribir al ritmo del audio</button>
          <button class="btn" data-pz-acc="sig">Siguiente →</button>
          <label class="interruptor"><input type="checkbox" data-pz-acc="todo"> Ver completa</label>
          <button class="btn" data-pz-acc="pantalla">${ICONOS.pantalla} Pantalla completa</button>
        </div>
        <p class="tenue">Con «Anterior» y «Siguiente» (o las flechas del teclado) escribes la pizarra paso a paso. ${expo.tipo === 'ud' ? 'La distribución es la misma en todas las UD: así la tienes automatizada.' : ''}</p>
        <details class="tarjeta"><summary><b>El plan de pizarra en texto</b> (${expo.pizarra.length} anotaciones)</summary><div class="rejilla-2" style="margin-top:12px">${plan}</div></details>
      </div>`;
    const limpiar = [];
    let pz = null;
    return {
      html,
      montar(raiz) {
        reproductor.cargar(expo);
        pz = new Opo.VistaPizarra($('[data-pz]', raiz), expo);
        const pasos = Array.from(new Set(expo.pizarra.map((p) => p.frase))).sort((a, b) => a - b);
        const sincro = (e) => {
          if (!(e.expo && e.expo.id === expo.id)) return;
          pz.mostrarHasta(e.frase, e.seccion);
          const b = $('[data-pz-acc=play]', raiz);
          b.innerHTML = e.reproduciendo ? `${ICONOS.pausa} Pausa` : `${ICONOS.play} Escribir al ritmo del audio`;
        };
        limpiar.push(reproductor.suscribir(sincro));
        sincro(reproductor.estado());
        const paso = (d) => {
          const actual = reproductor.estado().frase;
          let destino;
          if (d > 0) destino = pasos.find((f) => f > actual);
          else destino = pasos.slice().reverse().find((f) => f < actual);
          if (destino == null) destino = d > 0 ? expo.frases.length - 1 : 0;
          reproductor.irAFrase(destino, { reproducir: false });
        };
        raiz.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-pz-acc]');
          if (!b || b.tagName === 'INPUT') return;
          const a = b.dataset.pzAcc;
          if (a === 'play') reproductor.alternar();
          else if (a === 'ant') paso(-1);
          else if (a === 'sig') paso(1);
          else if (a === 'pantalla') Opo.pantallaPizarra(expo);
        });
        $('[data-pz-acc=todo]', raiz).addEventListener('change', (ev) => pz.ponerTodo(ev.target.checked));
        const tecla = (ev) => {
          if (ev.target.closest('input,select,textarea')) return;
          if (ev.key === 'ArrowRight') { ev.preventDefault(); paso(1); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); paso(-1); }
        };
        document.addEventListener('keydown', tecla);
        limpiar.push(() => document.removeEventListener('keydown', tecla));
      },
      destruir() { limpiar.forEach((f) => f && f()); if (pz) pz.destruir(); },
    };
  };

  // ---------------------------------------------------------------- memorizar
  const RE_PALABRA = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+(?:[.'’][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)*)/g;
  function htmlConHuecos(ps, nivel, rnd, modo) {
    // modo: 'huecos' | 'iniciales'
    return ps.map((p) => {
      const trozo = p.t.split(RE_PALABRA).map((tok, i) => {
        if (i % 2 === 0) return esc(tok);
        if (modo === 'iniciales') return `<span class="inicial">${esc(tok[0])}<i>${'·'.repeat(Math.min(tok.length - 1, 8))}</i></span>`;
        const larga = tok.length >= 4;
        const prob = nivel >= 1 ? 1 : larga ? Math.min(1, nivel * 1.25) : nivel * 0.5;
        if (rnd() < prob) return `<span class="oculta" role="button" tabindex="0" title="Pulsa para ver">${esc(tok)}</span>`;
        return esc(tok);
      }).join('');
      return p.h ? `<span class="propio">${trozo}</span>` : trozo;
    }).join('');
  }
  const RECONOCIMIENTO = window.SpeechRecognition || window.webkitSpeechRecognition;
  function palabrasClave(t) { return normalizar(t).split(' ').filter((w) => w.length >= 4); }

  Pest.memorizar = (expo) => {
    const p = Opo.App.tomarPendiente();
    const st = { sec: p && p.seccion != null ? p.seccion : 0, modo: 'huecos', nivel: 0.5, semilla: 1, revelado: false, transcripcion: '' };
    const modos = [['leer', 'Leer'], ['huecos', 'Huecos'], ['iniciales', 'Iniciales'], ['recitar', 'Recitar']].concat(expo.tipo === 'ud' ? [['propio', 'Lo propio']] : []);
    const nivelChip = (i) => { const n = Progreso.nivel(expo.id, expo.secciones[i].id); return ['', 'critico', 'aviso', 'acento', 'bueno'][n] || ''; };
    const html = `
      <div class="pila">
        <div class="fila" data-secs role="group" aria-label="Sección">${expo.secciones.map((s, i) => `<button class="chip ${nivelChip(i)}" data-sec="${i}" aria-pressed="false">${i + 1}. ${esc(s.titulo)}</button>`).join('')}</div>
        <div class="fila entre">
          <div class="fila" role="group" aria-label="Modo">${modos.map(([k, t]) => `<button class="chip" data-modo="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
          <div class="fila" data-nivel-caja>
            <label class="campo" style="flex-direction:row;align-items:center;gap:6px">Ocultar
              <select data-nivel><option value="0.25">25 %</option><option value="0.5" selected>50 %</option><option value="0.75">75 %</option><option value="1">100 %</option></select></label>
            <button class="btn mini" data-acc="mezcla">Otra mezcla</button><button class="btn mini" data-acc="ver-todo">Ver todo</button>
          </div>
        </div>
        <div class="tarjeta"><div data-cuerpo></div></div>
        <div class="tarjeta pila" style="gap:10px">
          <b>¿Cómo te ha salido esta sección?</b>
          <div class="srs">
            <button class="btn" data-srs="otra">Otra vez<small>repasar en 10 min</small></button>
            <button class="btn" data-srs="dificil">Con dudas<small>mañana</small></button>
            <button class="btn" data-srs="bien">Bien<small>espaciar el repaso</small></button>
            <button class="btn" data-srs="facil">Perfecta<small>repasar mucho más tarde</small></button>
          </div>
        </div>
      </div>`;
    let raizRef = null;
    let rec = null;
    const pintar = () => {
      const raiz = raizRef;
      const sec = expo.secciones[st.sec];
      $$('[data-sec]', raiz).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sec) === st.sec)));
      $$('[data-modo]', raiz).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === st.modo)));
      $('[data-nivel-caja]', raiz).hidden = st.modo !== 'huecos';
      const cuerpo = $('[data-cuerpo]', raiz);
      const rnd = aleatorio(hashTexto(sec.id) + st.semilla * 7919);
      let h = '';
      if (st.modo === 'leer') h = `<div class="memo-texto discurso">${sec.bloques.map((b) => `<p>${htmlPartes(b.partes)}</p>`).join('')}</div>`;
      else if (st.modo === 'huecos' || st.modo === 'iniciales') h = `<div class="memo-texto">${sec.bloques.map((b) => `<p>${htmlConHuecos(b.partes, st.nivel, rnd, st.modo)}</p>`).join('')}</div>`;
      else if (st.modo === 'recitar') {
        h = `<div class="pila">
          <p class="suave">Di la sección en voz alta guiándote solo por el esquema. Después muestra el texto y compara.</p>
          <ul class="esq-lista">${sec.esquema.map((e) => `<li>${htmlPartes(e)}</li>`).join('')}</ul>
          <div class="fila">
            ${RECONOCIMIENTO ? `<button class="btn" data-acc="micro">${ICONOS.micro} ${rec ? 'Parar y comparar' : 'Recitar con micrófono'}</button>` : ''}
            <button class="btn primario" data-acc="revelar">${st.revelado ? 'Ocultar el texto' : 'Mostrar el texto'}</button>
          </div>
          ${st.transcripcion ? `<div class="info-caja"><b>Lo que he entendido:</b> ${esc(st.transcripcion)}</div>` : ''}
          <div data-comparacion></div>
          ${st.revelado ? `<div class="memo-texto discurso">${sec.bloques.map((b) => `<p>${htmlPartes(b.partes)}</p>`).join('')}</div>` : ''}
          ${RECONOCIMIENTO ? '' : '<p class="tenue">Para que la app escuche y compare lo que dices, ábrela en Chrome o Edge con micrófono.</p>'}
        </div>`;
      } else if (st.modo === 'propio') {
        const bloques = sec.bloques.filter((b) => b.partes.some((x) => x.h));
        h = bloques.length ? `<p class="suave">Completa mentalmente cada hueco con lo propio de esta UD y pulsa para comprobarlo.</p>
          <div class="memo-texto">${bloques.map((b) => `<p>${b.partes.map((x) => (x.h ? `<span class="oculta" role="button" tabindex="0" title="${esc(Modelo.etiquetasHuecos[x.h] || x.h)}">${esc(x.t)}</span>` : esc(x.t))).join('')}</p>`).join('')}</div>`
          : '<p class="suave">Esta sección es idéntica en todas las UD: no tiene nada propio que memorizar.</p>';
      }
      cuerpo.innerHTML = h;
      if (st.modo === 'recitar' && st.revelado && st.transcripcion) comparar(cuerpo, sec);
    };
    const comparar = (cuerpo, sec) => {
      const dichas = new Set(palabrasClave(st.transcripcion));
      const total = sec.bloques.flatMap((b) => palabrasClave(b.texto));
      const ok = total.filter((w) => dichas.has(w)).length;
      const pct = total.length ? Math.round((ok / total.length) * 100) : 0;
      $('[data-comparacion]', cuerpo).innerHTML = `<p class="${pct >= 80 ? 'info-caja' : 'aviso-caja'}">Has dicho el <b>${pct} %</b> de las palabras clave de la sección. En rojo, las que no he oído.</p>`;
      const cont = cuerpo.querySelector('.memo-texto');
      if (!cont) return;
      cont.innerHTML = sec.bloques.map((b) => `<p>${b.texto.split(RE_PALABRA).map((tok, i) => {
        if (i % 2 === 0) return esc(tok);
        const n = normalizar(tok);
        if (n.length < 4) return esc(tok);
        return dichas.has(n) ? `<span class="palabra-dicha">${esc(tok)}</span>` : `<span class="palabra-falta">${esc(tok)}</span>`;
      }).join('')}</p>`).join('');
    };
    const pararRec = () => { if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) { /* nada */ } } };
    return {
      html,
      montar(raiz) {
        raizRef = raiz;
        pintar();
        raiz.addEventListener('click', (ev) => {
          const t = ev.target;
          const s = t.closest('[data-sec]');
          if (s) { st.sec = Number(s.dataset.sec); st.revelado = false; st.transcripcion = ''; pararRec(); pintar(); return; }
          const m = t.closest('[data-modo]');
          if (m) { st.modo = m.dataset.modo; st.revelado = false; pintar(); return; }
          const o = t.closest('.oculta');
          if (o) { o.classList.add('vista'); return; }
          const a = t.closest('[data-acc]');
          if (a) {
            const acc = a.dataset.acc;
            if (acc === 'mezcla') { st.semilla++; pintar(); }
            else if (acc === 'ver-todo') $$('.oculta', raiz).forEach((x) => x.classList.add('vista'));
            else if (acc === 'revelar') { st.revelado = !st.revelado; pintar(); }
            else if (acc === 'micro') {
              if (rec) { pararRec(); st.revelado = true; pintar(); return; }
              st.transcripcion = '';
              try {
                rec = new RECONOCIMIENTO();
                rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
                rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) st.transcripcion += ' ' + e.results[i][0].transcript; };
                rec.onerror = (e) => { Opo.aviso(e.error === 'not-allowed' ? 'No hay permiso para usar el micrófono aquí.' : 'El reconocimiento de voz se ha detenido.'); rec = null; pintar(); };
                rec.onend = () => { if (rec) { try { rec.start(); } catch (e) { rec = null; } } };
                rec.start();
                Opo.aviso('Escuchando… pulsa «Parar y comparar» al terminar.');
              } catch (e) { rec = null; Opo.aviso('No se puede usar el micrófono en este navegador.'); }
              pintar();
            }
            return;
          }
          const r = t.closest('[data-srs]');
          if (r) {
            const v = Progreso.calificar(expo.id, expo.secciones[st.sec].id, r.dataset.srs);
            Opo.aviso(`Guardado: nivel ${v.n} de 4 en «${expo.secciones[st.sec].titulo}»`);
            const chip = $(`[data-sec="${st.sec}"]`, raiz);
            chip.className = `chip ${nivelChip(st.sec)}`;
            if (st.sec < expo.secciones.length - 1) { st.sec++; st.revelado = false; st.transcripcion = ''; pintar(); }
          }
        });
        raiz.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('oculta')) { ev.preventDefault(); ev.target.classList.add('vista'); } });
        $('[data-nivel]', raiz).addEventListener('change', (ev) => { st.nivel = Number(ev.target.value); pintar(); });
      },
      destruir() { pararRec(); },
    };
  };

  // ---------------------------------------------------------------- ensayo cronometrado
  function pitido(frec = 880, dur = 0.25) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = Pest._ctx || (Pest._ctx = new Ctx());
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = frec; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur + 0.05);
    } catch (e) { /* sin audio */ }
  }

  Pest.ensayo = (expo) => {
    const LIMITE = 30 * 60;
    const st = { fase: 'preparar', t: 0, inicio: 0, acumulado: 0, corriendo: false, sec: 0, cortes: [], esquema: true, guion: false, grabar: false, transcribir: false, pitidos: true, grabacion: null, trozos: [], textos: [], avisados: {} };
    const hayMicro = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    let timer = null; let raizRef = null; let rec = null; let media = null; let stream = null; let wake = null;
    const objetivo = (i) => expo.secciones[i].finMin * 60;
    const ahora = () => st.acumulado + (st.corriendo ? (performance.now() - st.inicio) / 1000 : 0);
    const htmlPreparar = () => `
      <div class="tarjeta elevada pila">
        <h3>Ensayo cronometrado de 30 minutos</h3>
        <p class="suave">Expón en voz alta como en el examen. Pulsa <b>Siguiente sección</b> (o la barra espaciadora) cada vez que cambies de apartado: al final verás tus tiempos frente a los previstos.</p>
        <div class="pila" style="gap:8px">
          <label class="interruptor"><input type="checkbox" id="en-esq" checked> Ver el esquema de la sección en curso</label>
          ${expo.guion ? '<label class="interruptor"><input type="checkbox" id="en-guion"> Ver el guion A5 (como en el examen)</label>' : ''}
          <label class="interruptor"><input type="checkbox" id="en-pit" checked> Avisos sonoros a los 25 y 29 minutos</label>
          ${hayMicro ? '<label class="interruptor"><input type="checkbox" id="en-grab"> Grabar mi voz para escucharme después</label>' : ''}
          ${RECONOCIMIENTO ? '<label class="interruptor"><input type="checkbox" id="en-trans"> Transcribir y comparar con el discurso (Chrome/Edge)</label>' : ''}
          ${hayMicro ? '' : '<p class="tenue">La grabación de voz no está disponible en este navegador o en esta vista.</p>'}
        </div>
        <div><button class="btn primario" data-acc="empezar">Empezar · 30:00</button></div>
      </div>
      ${htmlHistorial()}`;
    const htmlHistorial = () => {
      const l = Progreso.ensayos().filter((e) => e.expo === expo.id).slice(0, 8);
      if (!l.length) return '';
      return `<div class="tarjeta"><h3>Tus ensayos de esta exposición</h3><div class="desliza"><table class="tabla"><thead><tr><th>Fecha</th><th class="n">Duración</th><th class="n">Secciones</th><th class="n">Cobertura</th></tr></thead><tbody>
        ${l.map((e) => `<tr><td>${new Date(e.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td><td class="n">${mmss(e.total)}</td><td class="n">${e.cortes.length}/${expo.secciones.length}</td><td class="n">${e.cobertura != null ? e.cobertura + ' %' : '—'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    };
    const htmlCorriendo = () => {
      const sec = expo.secciones[st.sec];
      return `
      <div class="ensayo-panel">
        <div class="tarjeta elevada pila">
          <div class="fila entre"><span class="eyebrow">Tiempo</span><span class="tenue num" data-restante></span></div>
          <div class="cronometro" data-crono>00:00</div>
          <div class="tramos">${expo.secciones.map((s, i) => `<span style="flex:${s.minutos}" class="${i < st.sec ? 'hecho' : i === st.sec ? 'actual' : ''}" title="${esc(s.titulo)}">${i + 1}</span>`).join('')}<i class="aguja" data-aguja></i></div>
          <div class="fila">
            <button class="btn primario" data-acc="siguiente">${st.sec < expo.secciones.length - 1 ? 'Siguiente sección ▸' : 'Terminar ▸'}</button>
            <button class="btn" data-acc="pausa">${st.corriendo ? 'Pausa' : 'Seguir'}</button>
            <button class="btn peligro" data-acc="terminar">Terminar</button>
          </div>
          ${st.grabar ? '<p class="tenue">● Grabando tu voz</p>' : ''}
        </div>
        <div class="tarjeta pila">
          <span class="eyebrow">Sección ${st.sec + 1} de ${expo.secciones.length}</span>
          <h3>${esc(sec.titulo)}</h3>
          <p class="tenue num">Previsto: ${mmss(sec.iniMin * 60)}–${mmss(sec.finMin * 60)} · <span data-desfase></span></p>
          ${st.esquema ? `<ul class="esq-lista">${sec.esquema.map((e) => `<li>${htmlPartes(e)}</li>`).join('')}</ul>` : ''}
          ${st.guion && expo.guion ? `<div class="a5" style="width:100%;aspect-ratio:auto;font-size:1rem">${htmlPartes(expo.guion)}</div>` : ''}
        </div>
      </div>`;
    };
    const htmlFin = () => {
      const filas = st.cortes.map((c, i) => {
        const s = expo.secciones[i];
        const dur = c - (i ? st.cortes[i - 1] : 0);
        const prev = s.minutos * 60;
        const d = dur - prev;
        return `<tr><td>${i + 1}. ${esc(s.titulo)}</td><td class="n">${mmss(prev)}</td><td class="n">${mmss(dur)}</td><td class="n" style="color:${Math.abs(d) > 60 ? 'var(--critico)' : Math.abs(d) > 30 ? 'var(--aviso)' : 'var(--bueno)'}">${d >= 0 ? '+' : '−'}${mmss(Math.abs(d))}</td></tr>`;
      }).join('');
      const total = st.cortes.length ? st.cortes[st.cortes.length - 1] : st.t;
      return `
      <div class="tarjeta elevada pila">
        <div class="fila entre"><h3>Resultado del ensayo</h3><span class="chip ${total > LIMITE ? 'critico' : total > LIMITE - 60 ? 'aviso' : 'bueno'}">${mmss(total)} ${total > LIMITE ? '· te has pasado de 30:00' : ''}</span></div>
        <div class="desliza"><table class="tabla"><thead><tr><th>Sección</th><th class="n">Previsto</th><th class="n">Real</th><th class="n">Diferencia</th></tr></thead><tbody>${filas}</tbody></table></div>
        ${st.cobertura != null ? `<p class="${st.cobertura >= 80 ? 'info-caja' : 'aviso-caja'}">Palabras clave del discurso que se han oído: <b>${st.cobertura} %</b>.</p>` : ''}
        ${st.grabacion ? `<div class="pila" style="gap:6px"><b>Tu grabación</b><audio controls src="${st.grabacion}" style="width:100%"></audio><a class="btn mini" href="${st.grabacion}" download="ensayo-${esc(expo.id)}.webm">Descargar la grabación</a></div>` : ''}
        <div class="fila"><button class="btn primario" data-acc="otra">Otro ensayo</button><a class="btn" href="#${expo.id}-rubrica">Autoevaluarme con la rúbrica</a></div>
      </div>
      ${htmlHistorial()}`;
    };
    const pintar = () => {
      const r = $('[data-ensayo]', raizRef);
      r.innerHTML = st.fase === 'preparar' ? htmlPreparar() : st.fase === 'corriendo' ? htmlCorriendo() : htmlFin();
      tic();
    };
    const tic = () => {
      if (st.fase !== 'corriendo') return;
      const t = ahora();
      st.t = t;
      const c = $('[data-crono]', raizRef);
      if (!c) return;
      c.textContent = mmss(t);
      c.classList.toggle('aviso', t >= 25 * 60 && t < 29 * 60);
      c.classList.toggle('critico', t >= 29 * 60);
      $('[data-restante]', raizRef).textContent = t <= LIMITE ? `quedan ${mmss(LIMITE - t)}` : `+${mmss(t - LIMITE)} sobre 30:00`;
      const total = expo.secciones[expo.secciones.length - 1].finMin * 60 || LIMITE;
      $('[data-aguja]', raizRef).style.left = `${Math.min(100, (t / total) * 100)}%`;
      const d = t - objetivo(st.sec);
      const df = $('[data-desfase]', raizRef);
      if (df) df.innerHTML = d > 0 ? `<b style="color:var(--critico)">vas ${mmss(d)} retrasada respecto al final previsto de la sección</b>` : `te quedan ${mmss(-d)} para esta sección`;
      if (st.pitidos) {
        [[25 * 60, 660], [29 * 60, 880], [30 * 60, 1040]].forEach(([s, f]) => { if (t >= s && !st.avisados[s]) { st.avisados[s] = true; pitido(f, 0.35); } });
      }
    };
    const empezarGrabacion = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        media = new MediaRecorder(stream);
        st.trozos = [];
        media.ondataavailable = (e) => { if (e.data.size) st.trozos.push(e.data); };
        media.onstop = () => {
          const blob = new Blob(st.trozos, { type: media.mimeType || 'audio/webm' });
          st.grabacion = URL.createObjectURL(blob);
          if (st.fase === 'fin') pintar();
          if (stream) stream.getTracks().forEach((tr) => tr.stop());
        };
        media.start(1000);
      } catch (e) { st.grabar = false; Opo.aviso('No se ha podido usar el micrófono: el ensayo sigue sin grabar.'); }
    };
    const empezarTranscripcion = () => {
      try {
        rec = new RECONOCIMIENTO();
        rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) st.textos.push(e.results[i][0].transcript); };
        rec.onerror = (e) => { if (e.error === 'not-allowed') { Opo.aviso('Sin permiso de micrófono: no se transcribirá.'); rec = null; } };
        rec.onend = () => { if (rec && st.fase === 'corriendo') { try { rec.start(); } catch (e) { /* nada */ } } };
        rec.start();
      } catch (e) { rec = null; }
    };
    const terminar = () => {
      if (st.fase !== 'corriendo') return;
      st.t = ahora();
      if (st.cortes.length < expo.secciones.length && (!st.cortes.length || st.cortes[st.cortes.length - 1] < st.t - 1)) st.cortes.push(st.t);
      st.fase = 'fin'; st.corriendo = false;
      clearInterval(timer);
      if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) { /* nada */ } }
      if (media && media.state !== 'inactive') media.stop();
      if (wake) { try { wake.release(); } catch (e) { /* nada */ } wake = null; }
      if (st.textos.length) {
        const dichas = new Set(palabrasClave(st.textos.join(' ')));
        const hasta = expo.secciones.slice(0, st.cortes.length).flatMap((s) => s.bloques.flatMap((b) => palabrasClave(b.texto)));
        st.cobertura = hasta.length ? Math.round((hasta.filter((w) => dichas.has(w)).length / hasta.length) * 100) : 0;
      }
      Progreso.guardarEnsayo({ expo: expo.id, fecha: Date.now(), total: Math.round(st.t), cortes: st.cortes.map((c) => Math.round(c)), cobertura: st.cobertura ?? null });
      pintar();
    };
    const siguiente = () => {
      if (st.fase !== 'corriendo') return;
      st.cortes.push(ahora());
      if (st.sec >= expo.secciones.length - 1) { terminar(); return; }
      st.sec++;
      pintar();
    };
    const tecla = (ev) => {
      if (st.fase !== 'corriendo' || ev.target.closest('input,select,textarea,button')) return;
      if (ev.code === 'Space' || ev.key === 'Enter') { ev.preventDefault(); siguiente(); }
    };
    return {
      html: '<div data-ensayo class="pila"></div>',
      montar(raiz) {
        raizRef = raiz;
        reproductor.pausa();
        pintar();
        document.addEventListener('keydown', tecla);
        raiz.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-acc]');
          if (!b) return;
          const a = b.dataset.acc;
          if (a === 'empezar') {
            st.esquema = !!$('#en-esq', raiz)?.checked; st.guion = !!$('#en-guion', raiz)?.checked; st.pitidos = !!$('#en-pit', raiz)?.checked;
            st.grabar = !!$('#en-grab', raiz)?.checked; st.transcribir = !!$('#en-trans', raiz)?.checked;
            Object.assign(st, { fase: 'corriendo', acumulado: 0, inicio: performance.now(), corriendo: true, sec: 0, cortes: [], textos: [], avisados: {}, grabacion: null, cobertura: undefined });
            if (st.pitidos) pitido(520, 0.12);
            if (st.grabar) await empezarGrabacion();
            if (st.transcribir && RECONOCIMIENTO) empezarTranscripcion();
            try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
            clearInterval(timer); timer = setInterval(tic, 250);
            pintar();
          } else if (a === 'siguiente') siguiente();
          else if (a === 'pausa') {
            if (st.corriendo) { st.acumulado = ahora(); st.corriendo = false; if (media && media.state === 'recording') media.pause(); }
            else { st.inicio = performance.now(); st.corriendo = true; if (media && media.state === 'paused') media.resume(); }
            pintar();
          } else if (a === 'terminar') terminar();
          else if (a === 'otra') { st.fase = 'preparar'; pintar(); }
        });
        const p = Opo.App.tomarPendiente();
        if (p && p.empezar) setTimeout(() => { const b = $('[data-acc=empezar]', raiz); if (b) { const g = $('#en-guion', raiz); if (g) g.checked = true; b.click(); } }, 50);
      },
      destruir() {
        clearInterval(timer);
        document.removeEventListener('keydown', tecla);
        if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) { /* nada */ } }
        if (media && media.state !== 'inactive') { try { media.stop(); } catch (e) { /* nada */ } }
        if (stream) stream.getTracks().forEach((tr) => tr.stop());
        if (wake) { try { wake.release(); } catch (e) { /* nada */ } }
      },
    };
  };

  // ---------------------------------------------------------------- guion A5
  Pest.guion = (expo) => {
    if (!expo.guion) return { html: '<p>Esta exposición no tiene guion.</p>' };
    const texto = textoDe(expo.guion);
    const n = contarPalabras(texto);
    const plantilla = Modelo.plantilla && Modelo.plantilla.guion ? Opo.partes(Modelo.plantilla.guion, null) : null;
    const html = `
      <div class="rejilla-2">
        <div class="pila">
          <div class="fila entre"><h3>Guion para el DIN A5</h3><span class="chip ${n <= 120 ? 'bueno' : 'critico'}">${n} / 120 palabras</span></div>
          <div class="a5" data-a5>${htmlPartes(expo.guion)}</div>
          <div class="fila"><button class="btn" data-acc="copiar">Copiar el guion</button></div>
        </div>
        <div class="pila">
          <div class="tarjeta pila" style="gap:8px">
            <h3>Normas del guion</h3>
            <ul class="esq-lista">
              <li>Una cara de un DIN A5 que te da el tribunal, en blanco.</li>
              <li>Máximo 120 palabras; si las supera, no te dejan usarlo.</li>
              <li>Lo escribes durante la hora de preparación y lo entregas al terminar.</li>
              <li>El material auxiliar no puede tener contenido curricular.</li>
            </ul>
          </div>
          ${plantilla ? `<div class="tarjeta pila" style="gap:8px"><h3>Estructura común (igual en las 12 UD)</h3><p class="suave" style="line-height:1.8">${htmlPartes(plantilla, { etiquetas: Modelo.etiquetasHuecos })}</p></div>` : ''}
        </div>
      </div>`;
    return {
      html,
      montar(raiz) { $('[data-acc=copiar]', raiz).addEventListener('click', () => Opo.copiar(texto, $('[data-a5]', raiz))); },
    };
  };

  // ---------------------------------------------------------------- ficha de la UD
  Pest.ficha = (expo) => {
    const f = expo.ficha;
    if (!f) return { html: '<p class="suave">No hay ficha extraída para esta unidad.</p>' };
    const t = (x) => esc(x || '—');
    const areas = (f.areas || []).map((a) => `
      <div class="tarjeta pila" style="gap:8px">
        <h3>${esc(a.area)}</h3>
        <div class="desliza"><table class="tabla"><thead><tr><th>Competencias específicas</th><th>Criterios de evaluación</th><th>Saberes básicos</th></tr></thead><tbody><tr>
          <td><ul class="lista-limpia">${(a.competencias || []).map((c) => `<li><b>${esc(c.num)}.</b> ${esc(c.texto)}</li>`).join('')}</ul></td>
          <td><ul class="lista-limpia">${(a.criterios || []).map((c) => `<li><b>${esc(c.codigo)}</b> ${esc(c.texto)}</li>`).join('')}</ul></td>
          <td><ul class="lista-limpia">${(a.saberes || []).map((c) => `<li><b>${esc(c.codigo)}</b> ${esc(c.texto)}</li>`).join('')}</ul></td>
        </tr></tbody></table></div>
      </div>`).join('');
    const semanas = (f.semanas || []).map((s) => `
      <div class="tarjeta"><h3>Semana ${esc(s.numero)} · ${esc(s.fase)}</h3>
        <dl style="margin-top:8px">${['LCL', 'MAT', 'CMN', 'EAR'].filter((k) => s[k]).map((k) => `<dt>${k}</dt><dd>${esc(s[k])}</dd>`).join('')}</dl></div>`).join('');
    const sda = f.sda || {};
    const html = `
      <div class="pila">
        <p class="tenue">Datos tal como aparecen en la programación, para consultar durante el estudio.</p>
        <div class="rejilla">
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Identificación</span>
            <p><b>${t(f.fechas)}</b> · ${t(f.dias)} días lectivos · trimestre ${t(f.trimestre)}</p>
            <p>Centro de interés: ${t(f.centroInteres)}</p>
            <p>Objetivos de etapa: ${esc((f.objetivosEtapa || []).join(', '))}</p></div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Justificación</span><p>${t(f.relevanciaSocial)}</p><p>${esc((f.ods || []).join(' · '))}</p></div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Situaciones de aprendizaje</span>
            <p><b>UD:</b> ${t(sda.ud && (sda.ud.producto || sda.ud.titulo))}</p>
            <p><b>Proyecto ${t(sda.proyecto && sda.proyecto.nombre)}:</b> ${t(sda.proyecto && sda.proyecto.producto)}</p>
            <p><b>APS ${t(sda.aps && sda.aps.nombre)}:</b> ${t(sda.aps && sda.aps.producto)}</p></div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Actividad complementaria</span><p>${t(f.complementaria)}</p></div>
        </div>
        <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Objetivos de aprendizaje</span><ul class="lista-limpia">${(f.objetivosAprendizaje || []).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
          <p class="tenue">Descriptores: ${t(f.competenciasClave)}</p></div>
        ${areas}
        <h3>Secuencia didáctica</h3>
        <div class="ficha-semanas">${semanas}</div>
        <div class="rejilla">
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Metodología</span><p>${t(f.metodologia)}</p><p>${t(f.agrupamientos)}</p><p class="tenue">${t(f.principiosPedagogicos)}</p></div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Recursos</span>${Object.entries(f.recursos || {}).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')}</div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Atención a la diversidad</span>${(f.diversidad && f.diversidad.dua || []).map((d) => `<p>${esc(d)}</p>`).join('')}<p>${t(f.diversidad && f.diversidad.medidasGenerales)}</p><p>${t(f.diversidad && f.diversidad.medidasEspecificas)}</p></div>
          <div class="tarjeta pila" style="gap:6px"><span class="eyebrow">Evaluación</span><p>${t(f.evaluacion && f.evaluacion.instrumentos)}</p><p>${t(f.evaluacion && f.evaluacion.procedimientos)}</p><p class="tenue">${t(f.evaluacion && f.evaluacion.productos)}</p></div>
        </div>
        ${(f.observaciones || []).length ? `<div class="aviso-caja"><b>Erratas o incoherencias detectadas en esta UD de la programación</b> (conviene tenerlas presentes para no repetirlas en la exposición):<ul>${f.observaciones.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
    return { html };
  };

  // ---------------------------------------------------------------- rúbrica / autoevaluación
  Pest.rubrica = (expo) => {
    const R = Modelo.rubricas && Modelo.rubricas[expo.tipo];
    if (!R) return { html: '<p>No hay rúbrica.</p>' };
    const notas = {};
    R.items.forEach((it) => { notas[it.id] = 5; });
    const ult = Progreso.autoevaluaciones().find((r) => r.expo === expo.id);
    if (ult) Object.assign(notas, ult.notas);
    const sumaPesos = R.items.reduce((a, it) => a + it.peso, 0);
    const total = () => R.items.reduce((a, it) => a + it.peso * notas[it.id], 0) / sumaPesos;
    const total2025 = R.items.reduce((a, it) => a + it.peso * it.media2025, 0) / sumaPesos;
    const html = `
      <div class="pila">
        <div class="tarjeta elevada fila entre">
          <div class="pila" style="gap:4px"><span class="eyebrow">Tu nota estimada (${expo.tipo === 'pd' ? 'defensa' : 'exposición'})</span><span class="rub-total num" data-total>0</span></div>
          <div class="pila" style="gap:4px;text-align:right"><span class="eyebrow">Media del tribunal en 2025</span><span class="num" style="font-size:1.6rem;font-weight:800">${coma(total2025, 2)}</span></div>
          <button class="btn primario" data-acc="guardar">Guardar autoevaluación</button>
        </div>
        <p class="tenue">${esc(R.nota)} ${esc(R.penalizacion)} Puntúa cada apartado tras un ensayo; los indicadores son los de la rúbrica oficial.</p>
        <div>${R.items.map((it) => `
          <div class="rub-item">
            <div><b>${esc(it.titulo)}</b> <span class="chip">${coma(it.peso, 1)} %</span> <span class="chip ${claseNota(it.media2025)}">2025: ${coma(it.media2025, 2)}</span>
              <ul>${it.indicadores.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
            <div class="pila" style="gap:4px"><input type="range" min="0" max="10" step="0.25" value="${notas[it.id]}" data-item="${esc(it.id)}" aria-label="${esc(it.titulo)}"><span class="num tenue" data-val="${esc(it.id)}">${coma(notas[it.id], 2)}</span></div>
          </div>`).join('')}</div>
        <div data-hist></div>
      </div>`;
    const pintarHist = (raiz) => {
      const l = Progreso.autoevaluaciones().filter((r) => r.expo === expo.id).slice(0, 10);
      $('[data-hist]', raiz).innerHTML = l.length ? `<div class="tarjeta"><h3>Historial</h3><div class="desliza"><table class="tabla"><thead><tr><th>Fecha</th><th class="n">Nota</th></tr></thead><tbody>${l.map((r) => `<tr><td>${new Date(r.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td><td class="n">${coma(r.total, 2)}</td></tr>`).join('')}</tbody></table></div></div>` : '';
    };
    return {
      html,
      montar(raiz) {
        const pt = () => { $('[data-total]', raiz).textContent = coma(total(), 2); };
        pt();
        pintarHist(raiz);
        raiz.addEventListener('input', (ev) => {
          const r = ev.target.closest('[data-item]');
          if (!r) return;
          notas[r.dataset.item] = Number(r.value);
          $(`[data-val="${r.dataset.item}"]`, raiz).textContent = coma(Number(r.value), 2);
          pt();
        });
        $('[data-acc=guardar]', raiz).addEventListener('click', () => {
          Progreso.guardarAutoevaluacion({ expo: expo.id, tipo: expo.tipo, fecha: Date.now(), notas: { ...notas }, total: total() });
          Opo.aviso('Autoevaluación guardada');
          pintarHist(raiz);
        });
      },
    };
  };

  // ================================================================ vista contenedora
  function vistaExpo(expoId, pestana) {
    const expo = Modelo.expo(expoId);
    if (!expo) return { html: '<div class="aviso-caja">Todavía no hay contenido para esta exposición.</div>' };
    const pests = PESTANAS.filter((p) => !p[2] || p[2] === expo.tipo);
    if (!pests.find((p) => p[0] === pestana)) pestana = 'esquema';
    const sub = (Pest[pestana] || Pest.esquema)(expo);
    const u = expo.ud;
    const numUD = u ? u.numero : 0;
    const vecinos = u ? `<div class="fila">${numUD > 1 ? `<a class="btn mini" href="#${Modelo.idUD(numUD - 1)}-${pestana}">← UD ${numUD - 1}</a>` : ''}${numUD < 12 && Modelo.expo(Modelo.idUD(numUD + 1)) ? `<a class="btn mini" href="#${Modelo.idUD(numUD + 1)}-${pestana}">UD ${numUD + 1} →</a>` : ''}</div>` : '';
    const fi = expo.ficha;
    const sda = (fi && fi.sda && fi.sda.ud && (fi.sda.ud.producto || fi.sda.ud.titulo)) || '';
    const html = `
      <div class="pila">
        <div class="cab-expo">
          <div class="titulo">
            <div class="migas"><a href="#inicio">Inicio</a> › ${expo.tipo === 'pd' ? 'Parte A · Programación' : '<a href="#uds">Parte B · Unidades didácticas</a>'}</div>
            <h1>${expo.tipo === 'pd' ? 'Defensa de la programación' : esc(expo.titulo)}</h1>
            <p class="suave">${expo.tipo === 'pd' ? '«Aprendemos juntos» · 3.º de Educación Primaria · máximo 30 minutos' : `${esc(u.fechas || '')} · ${u.dias ? esc(u.dias) + ' días lectivos · ' : ''}${esc(['', 'primer', 'segundo', 'tercer'][u.trimestre] || '')} trimestre${sda ? ` · SdA: ${esc(sda)}` : ''}`}</p>
          </div>
          <div class="pila" style="gap:6px;align-items:flex-end">
            <div class="fila"><span class="chip num" title="Duración del texto a 130 palabras por minuto">≈ ${coma(expo.minutosTexto)} min</span><span class="chip ${expo.audio ? 'bueno' : ''}">${expo.audio ? 'Audio grabado' : 'Voz del navegador'}</span></div>
            ${puntosDominio(expo)}
            ${vecinos}
          </div>
        </div>
        <nav class="pestanas" aria-label="Apartados">${pests.map(([k, t]) => `<a href="#${expo.id}-${k}" ${k === pestana ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
        <div data-sub>${sub.html}</div>
      </div>`;
    return {
      html,
      titulo: `${expo.corto} · ${pests.find((p) => p[0] === pestana)[1]}`,
      montar(raiz) { if (sub.montar) sub.montar($('[data-sub]', raiz)); },
      destruir() { if (sub.destruir) sub.destruir(); },
    };
  }

  // ================================================================ pizarra a pantalla completa
  Opo.pantallaPizarra = (expo) => {
    const capa = document.createElement('div');
    capa.className = 'pz-pantalla';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-label', 'Pizarra a pantalla completa');
    capa.innerHTML = `<div data-pz></div><div class="controles">
      <button class="btn redondo" data-a="ant" aria-label="Sección anterior">${ICONOS.atras}</button>
      <button class="btn grande" data-a="play" aria-label="Reproducir o pausar">${ICONOS.play}</button>
      <button class="btn redondo" data-a="sig" aria-label="Sección siguiente">${ICONOS.adelante}</button>
      <button class="btn" data-a="cerrar">${ICONOS.cerrar} Cerrar</button></div>`;
    document.body.appendChild(capa);
    reproductor.cargar(expo);
    const pz = new Opo.VistaPizarra($('[data-pz]', capa), expo);
    const sincro = (e) => {
      if (e.expo && e.expo.id === expo.id) pz.mostrarHasta(e.frase, e.seccion);
      $('[data-a=play]', capa).innerHTML = e.reproduciendo ? ICONOS.pausa : ICONOS.play;
    };
    const quitar = reproductor.suscribir(sincro);
    sincro(reproductor.estado());
    const cerrar = () => {
      quitar(); pz.destruir(); capa.remove(); document.removeEventListener('keydown', tecla);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    const tecla = (ev) => {
      if (ev.key === 'Escape') cerrar();
      else if (ev.key === ' ') { ev.preventDefault(); reproductor.alternar(); }
      else if (ev.key === 'ArrowRight') reproductor.seccionRelativa(1);
      else if (ev.key === 'ArrowLeft') reproductor.seccionRelativa(-1);
    };
    document.addEventListener('keydown', tecla);
    capa.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'cerrar') cerrar();
      else if (a === 'play') reproductor.alternar();
      else if (a === 'ant') reproductor.seccionRelativa(-1);
      else if (a === 'sig') reproductor.seccionRelativa(1);
    });
    try { if (capa.requestFullscreen) capa.requestFullscreen().catch(() => {}); } catch (e) { /* opcional */ }
    setTimeout(() => pz.reescalar(), 200);
  };

  Opo.Vistas = Object.assign(Opo.Vistas || {}, { expo: vistaExpo, itemRubrica, claseNota, htmlBloque, normalizar });
})();
