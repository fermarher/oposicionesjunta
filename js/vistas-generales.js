/* Vistas generales: inicio, unidades, plantilla común, diferencias, sorteo y ajustes. */
(function () {
  'use strict';
  const Opo = window.Opo;
  const { esc, $, $$, mmss, coma, htmlPartes, partes, partesPorFrase, Modelo, Progreso, reproductor, Almacen } = Opo;
  const V = Opo.Vistas;

  const TRIM = ['', 'Primer trimestre', 'Segundo trimestre', 'Tercer trimestre'];
  const sdaDe = (u) => {
    const f = Modelo.fichas[u.numero];
    return (f && f.sda && f.sda.ud && (f.sda.ud.producto || f.sda.ud.titulo)) || '';
  };
  const dominioHtml = (expo) => {
    if (!expo) return '';
    const s = Progreso.srs()[expo.id] || {};
    return `<span class="dominio" aria-label="Dominio ${Math.round(Progreso.dominio(expo) * 100)} %">${expo.secciones.map((sec) => `<i class="n${(s[sec.id] && s[sec.id].n) || 0}"></i>`).join('')}</span>`;
  };

  // ================================================================ INICIO
  function barrasPerdidas(tipo, max = 8) {
    const R = Modelo.rubricas && Modelo.rubricas[tipo];
    if (!R) return '';
    const items = R.items.map((it) => ({ ...it, perdidos: (it.peso * (10 - it.media2025)) / 100 })).sort((a, b) => b.perdidos - a.perdidos).slice(0, max);
    const tope = Math.max(...items.map((i) => i.perdidos), 0.01);
    return `<div class="barras" role="list">${items.map((it) => `
      <div class="barra-fila" role="listitem" title="${esc(it.titulo)} · peso ${coma(it.peso, 1)} % · media 2025: ${coma(it.media2025, 2)} · puntos perdidos: ${coma(it.perdidos, 2)}">
        <span class="et"><b>${esc(it.titulo.replace(/:.*/, ''))}</b> · peso ${coma(it.peso, 1)} % · media ${coma(it.media2025, 2)}</span>
        <span class="val">−${coma(it.perdidos, 2)}</span>
        <span class="pista"><span class="relleno" style="width:${(it.perdidos / tope) * 100}%"></span></span>
      </div>`).join('')}</div>`;
  }

  // Dónde deberías estar en los minutos 10 y 20 de cada exposición.
  function puntosControl() {
    const linea = (expo, etiqueta) => {
      if (!expo) return '';
      const en = (m) => { const s = expo.secciones.find((x) => x.iniMin <= m && x.finMin > m) || expo.secciones[expo.secciones.length - 1]; return s ? s.titulo.charAt(0).toLowerCase() + s.titulo.slice(1) : ''; };
      return `<li><b>${etiqueta}:</b> en el minuto 10, ${esc(en(10))}; en el 20, ${esc(en(20))}; a los 28, cerrando.</li>`;
    };
    const ud = Modelo.uds.length ? Modelo.expo(Modelo.idUD(Modelo.uds[0].numero)) : null;
    return linea(Modelo.expo('pd'), 'Programación') + linea(ud, 'Unidad didáctica') + '<li>Termina antes de 30:00: la exposición no puede exceder de treinta minutos.</li>';
  }

  function vistaInicio() {
    const pd = Modelo.expo('pd');
    const R = Modelo.rubricas;
    const media = (l) => (l && l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
    const pend = Progreso.pendientes().slice(0, 6);
    const ens = Progreso.ensayos().slice(0, 5);
    const nombre = (eid) => { const e = Modelo.expo(eid); return e ? e.corto : eid; };
    const secNombre = (eid, sid) => { const e = Modelo.expo(eid); const s = e && e.secciones.find((x) => x.id === sid); return s ? s.titulo : sid; };
    const udsHtml = Modelo.uds.map((u) => {
      const e = Modelo.expo(Modelo.idUD(u.numero));
      const d = Progreso.dominio(e);
      const n = d >= 0.75 ? 4 : d >= 0.5 ? 3 : d >= 0.25 ? 2 : d > 0 ? 1 : 0;
      return `<a class="chip ${['', 'critico', 'aviso', 'acento', 'bueno'][n]}" href="#${Modelo.idUD(u.numero)}-esquema" title="${esc(u.titulo)} · dominio ${Math.round(d * 100)} %">${u.numero}</a>`;
    }).join('');
    const html = `
      <div class="pila" style="gap:24px">
        <section class="hero">
          <div class="tarjeta elevada pila">
            <span class="eyebrow">Maestros · Educación Primaria · Andalucía</span>
            <h1>Segunda prueba: <span>dos exposiciones de 30 minutos</span></h1>
            <p class="suave">Programación «Aprendemos juntos» (3.º de Primaria) y sus 12 unidades didácticas. Cada exposición tiene su esquema, el discurso completo, el audio sincronizado con la pizarra y herramientas para memorizarla y ensayarla con cronómetro.</p>
            <div class="fila"><a class="btn primario" href="#pd-esquema">Empezar por la programación</a><a class="btn" href="#sorteo">Sortear una unidad</a></div>
          </div>
          <div class="tarjeta linea-prueba">
            <span class="eyebrow">Cómo es la prueba</span>
            <div class="reloj-prueba">
              <div class="a"><b>30'</b>Parte A · defensa de la programación<br><span class="tenue">30 % de la nota</span></div>
              <div class="b"><b>30'</b>Parte B · unidad didáctica<br><span class="tenue">70 % de la nota</span></div>
            </div>
            <ul class="esq-lista tenue">${(R ? R.prueba : []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          </div>
        </section>

        <section class="rejilla-2">
          <a class="tarjeta acceso" href="#pd-esquema">
            <span class="eyebrow">Parte A</span>
            <h2>Defensa de la programación</h2>
            ${pd ? `<p class="suave">${pd.secciones.length} secciones · ${pd.palabras} palabras · ≈ ${coma(pd.minutosTexto)} min · ${pd.audio ? 'audio grabado' : 'voz del navegador'}</p>${dominioHtml(pd)}` : '<p class="suave">Contenido pendiente.</p>'}
          </a>
          <div class="tarjeta acceso">
            <span class="eyebrow">Parte B</span>
            <h2><a href="#uds" style="color:inherit;text-decoration:none">Unidades didácticas</a></h2>
            <p class="suave">Un discurso común para las 12: memorízalo una vez y después solo lo propio de cada unidad.</p>
            <div class="fila" style="gap:6px">${udsHtml}</div>
            <div><a class="btn mini" href="#uds">Ver las 12 unidades</a></div>
          </div>
        </section>

        ${R ? `<section class="pila">
          <div><h2>Dónde se perdieron puntos en 2025</h2><p class="suave">Puntos perdidos en cada apartado = peso × (10 − media del tribunal). Lo de arriba es lo que más nota puede subir. Medias 2025: parte A ${coma(media(R.pd.totales2025), 2)} · parte B ${coma(media(R.ud.totales2025), 2)}.</p></div>
          <div class="rejilla-2">
            <div class="tarjeta pila"><h3>Parte B · unidad didáctica</h3>${barrasPerdidas('ud')}</div>
            <div class="tarjeta pila"><h3>Parte A · defensa de la programación</h3>${barrasPerdidas('pd')}</div>
          </div>
          <p class="nota-pie">Los discursos de esta app están escritos para nombrar en voz alta cada indicador de la rúbrica, con más tiempo para la secuencia didáctica, la metodología y la evaluación, y con más de tres citas normativas y bibliográficas.</p>
        </section>` : ''}

        <section class="rejilla-2">
          <div class="tarjeta pila">
            <h3>Repasos pendientes</h3>
            ${pend.length ? `<ul class="lista-limpia">${pend.map((p) => `<li><a href="#${p.expo}-memorizar" data-pend-sec="${esc(p.seccion)}" data-pend-expo="${esc(p.expo)}">${esc(nombre(p.expo))} · ${esc(secNombre(p.expo, p.seccion))}</a></li>`).join('')}</ul>` : '<p class="suave">Nada pendiente. Cuando califiques secciones en «Memorizar», aquí aparecerá lo que toca repasar cada día.</p>'}
          </div>
          <div class="tarjeta pila">
            <h3>Últimos ensayos</h3>
            ${ens.length ? `<div class="desliza"><table class="tabla"><tbody>${ens.map((e) => `<tr><td>${esc(nombre(e.expo))}</td><td>${new Date(e.fecha).toLocaleDateString('es-ES')}</td><td class="n">${mmss(e.total)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="suave">Aún no has hecho ningún ensayo cronometrado.</p>'}
          </div>
        </section>

        <section class="tarjeta pila">
          <h2>Antes de entrar al aula</h2>
          <div class="rejilla">
            <div class="pila" style="gap:6px"><h3>Pizarra</h3><ul class="esq-lista suave"><li>Al empezar, escribe la cabecera y el índice numerado a la izquierda.</li><li>Centro para las ideas clave, derecha para normativa y autores: siempre igual.</li><li>Letra grande, líneas rectas y sin faltas: repasa las tildes (situación, evaluación, didáctica, metodología).</li></ul></div>
            <div class="pila" style="gap:6px"><h3>Tiempo</h3><ul class="esq-lista suave">${puntosControl()}</ul></div>
            <div class="pila" style="gap:6px"><h3>Guion y voz</h3><ul class="esq-lista suave"><li>Guion A5: máximo 120 palabras, una cara, se entrega al final.</li><li>Mira al tribunal, haz una pausa al cambiar de apartado y anúncialo («Paso al punto…»).</li><li>Sin muletillas: mejor un silencio breve que un «eh».</li></ul></div>
          </div>
        </section>

        <section class="tarjeta pila">
          <h2>Método de estudio</h2>
          <ol class="esq-lista">
            <li><b>Esquema.</b> Aprende primero el orden de las secciones y sus minutos.</li>
            <li><b>Escuchar con la pizarra.</b> Oye el discurso mientras ves cómo se escribe la pizarra; a velocidad 0,9 al principio.</li>
            <li><b>Memorizar por secciones.</b> Leer → huecos al 25-50-75-100 % → iniciales → recitar con el esquema. Califícate y la app te dirá cuándo repasar.</li>
            <li><b>Unidades didácticas.</b> Primero la plantilla común (igual en las 12) y después «Lo propio» de cada unidad y las tarjetas de diferencias.</li>
            <li><b>Ensayo de 30 minutos</b> en voz alta, con cronómetro por secciones, y <b>autoevaluación</b> con la rúbrica oficial.</li>
            <li><b>Sorteo.</b> Simula el examen: tres bolas, eliges una, una hora de preparación y 30 minutos de exposición.</li>
          </ol>
        </section>
      </div>`;
    return {
      html, titulo: 'Inicio',
      montar(raiz) {
        raiz.addEventListener('click', (ev) => {
          const a = ev.target.closest('[data-pend-sec]');
          if (!a) return;
          const e = Modelo.expo(a.dataset.pendExpo);
          const i = e ? e.secciones.findIndex((s) => s.id === a.dataset.pendSec) : -1;
          if (i >= 0) Opo.App.pendiente = { seccion: i };
        });
      },
    };
  }

  // ================================================================ UNIDADES
  function vistaUDs() {
    const porTrim = [1, 2, 3].map((t) => ({ t, uds: Modelo.uds.filter((u) => Number(u.trimestre) === t) }));
    const sinTrim = Modelo.uds.filter((u) => ![1, 2, 3].includes(Number(u.trimestre)));
    const tarjeta = (u) => {
      const e = Modelo.expo(Modelo.idUD(u.numero));
      return `<a class="tarjeta ud-tarjeta" href="#${Modelo.idUD(u.numero)}-esquema">
        <span class="ud-num">UD ${u.numero}</span>
        <h3>${esc(u.titulo)}</h3>
        <span class="tenue">${esc(u.fechas || '')}${u.dias ? ` · ${esc(u.dias)} días` : ''}</span>
        ${sdaDe(u) ? `<span class="sda">SdA: ${esc(sdaDe(u))}</span>` : ''}
        ${dominioHtml(e)}
      </a>`;
    };
    const html = `
      <div class="pila" style="gap:22px">
        <div class="pila" style="gap:8px">
          <div class="migas"><a href="#inicio">Inicio</a> › Parte B</div>
          <h1>Unidades didácticas</h1>
          <p class="suave" style="max-width:70ch">Las 12 exposiciones comparten el mismo discurso. Solo cambian los datos propios de cada unidad (título, fechas, situación de aprendizaje, criterios, actividades de cada semana…), que aparecen <span class="propio">resaltados</span>. Memoriza la plantilla común una vez y después repasa lo propio de cada UD.</p>
        </div>
        <div class="rejilla">
          <a class="tarjeta acceso" href="#plantilla"><span class="eyebrow">Paso 1</span><h3>Plantilla común</h3><p class="suave">El discurso con los huecos marcados: lo que dirás igual en cualquier unidad.</p></a>
          <a class="tarjeta acceso" href="#diferencias"><span class="eyebrow">Paso 2</span><h3>Diferencias y tarjetas</h3><p class="suave">Tabla comparativa de las 12 UD y tarjetas para memorizar lo propio de cada una.</p></a>
          <a class="tarjeta acceso" href="#sorteo"><span class="eyebrow">Paso 3</span><h3>Sorteo y simulacro</h3><p class="suave">Tres bolas al azar, eliges una, una hora de preparación y 30 minutos de exposición.</p></a>
        </div>
        ${porTrim.filter((g) => g.uds.length).map((g) => `<section class="ud-trimestre"><h2>${TRIM[g.t]}</h2><div class="rejilla">${g.uds.map(tarjeta).join('')}</div></section>`).join('')}
        ${sinTrim.length ? `<section class="ud-trimestre"><div class="rejilla">${sinTrim.map(tarjeta).join('')}</div></section>` : ''}
        ${Modelo.uds.length ? '' : '<div class="aviso-caja">Todavía no hay unidades cargadas.</div>'}
      </div>`;
    return { html, titulo: 'Unidades didácticas' };
  }

  // ================================================================ PLANTILLA COMÚN
  function vistaPlantilla() {
    const pl = Modelo.plantilla;
    if (!pl) return { html: '<div class="aviso-caja">La plantilla aún no está disponible.</div>' };
    const st = { ud: 0 };
    const v1 = ((Modelo.uds.find((x) => x.numero === 1) || {}).valores) || {};
    const huecosTabla = `<div class="desliza"><table class="tabla"><thead><tr><th>Hueco</th><th>Qué va</th><th>En la UD 1</th></tr></thead><tbody>
      ${(pl.huecos || []).map((h) => `<tr><td><b>${esc(Modelo.etiquetasHuecos[h.id])}</b></td><td>${esc(h.descripcion)}</td><td class="tenue">${esc(v1[h.id] ?? h.ejemplo)}</td></tr>`).join('')}</tbody></table></div>`;
    const cuerpo = () => {
      const u = st.ud ? Modelo.uds.find((x) => x.numero === st.ud) : null;
      const val = u ? u.valores : null;
      return (pl.secciones || []).map((s, i) => `
        <section><h3>${i + 1}. ${esc(Opo.textoDe(partes(s.titulo, val || {})))} <span class="min">${coma(s.minutos)} min</span></h3>
          ${s.bloques.map((b) => `<p>${htmlPartes(partes(b.texto, val), val ? {} : { etiquetas: Modelo.etiquetasHuecos })}</p>`).join('')}</section>`).join('');
    };
    const html = `
      <div class="pila">
        <div class="migas"><a href="#inicio">Inicio</a> › <a href="#uds">Parte B</a> › Plantilla común</div>
        <h1>Plantilla común de las unidades didácticas</h1>
        <p class="suave" style="max-width:70ch">Este es el discurso que se repite en las 12 unidades. Los huecos ⟨así⟩ se rellenan con los datos de la unidad que salga en el sorteo. Aprende primero el texto común; los huecos los trabajarás en «Lo propio» y en las tarjetas.</p>
        <div class="fila"><label class="campo" style="flex-direction:row;align-items:center;gap:8px">Ver con los datos de
          <select data-ud><option value="0">ninguna UD (huecos)</option>${Modelo.uds.map((u) => `<option value="${u.numero}">UD ${u.numero}. ${esc(u.titulo)}</option>`).join('')}</select></label></div>
        <div class="tarjeta"><div class="discurso" data-cuerpo>${cuerpo()}</div></div>
        <details class="tarjeta"><summary><b>Los ${(pl.huecos || []).length} huecos de la plantilla</b></summary><div style="margin-top:10px">${huecosTabla}</div></details>
      </div>`;
    return {
      html, titulo: 'Plantilla común',
      montar(raiz) { $('[data-ud]', raiz).addEventListener('change', (ev) => { st.ud = Number(ev.target.value); $('[data-cuerpo]', raiz).innerHTML = cuerpo(); }); },
    };
  }

  // ================================================================ DIFERENCIAS Y TARJETAS
  function contextoHueco(expo, huecoId) {
    for (const bl of expo.bloques) {
      const ip = bl.partes.findIndex((p) => p.h === huecoId);
      if (ip < 0) continue;
      let off = 0;
      for (let i = 0; i < ip; i++) off += bl.partes[i].t.length;
      let corte = bl.cortes.find(([a, b]) => off >= a && off < b) || [0, bl.texto.length];
      let trozo = partesPorFrase(bl.partes, [corte]).find((t) => t.frase === 0);
      if (!trozo) continue;
      // si la frase es solo el hueco, se amplía con la frase anterior (o la siguiente) para que haya contexto
      if (trozo.trozos.every((t) => t.h === huecoId || !t.t.trim())) {
        const k = bl.cortes.indexOf(corte);
        if (k > 0) corte = [bl.cortes[k - 1][0], corte[1]];
        else if (k >= 0 && k < bl.cortes.length - 1) corte = [corte[0], bl.cortes[k + 1][1]];
        else return null;
        trozo = partesPorFrase(bl.partes, [corte]).find((t) => t.frase === 0);
        if (!trozo) return null;
      }
      let puesto = false;
      return trozo.trozos.map((t) => {
        if (t.h === huecoId) { if (puesto) return ''; puesto = true; return '<span class="hueco-vacio">¿…?</span>'; }
        return t.h ? `<span class="propio">${esc(t.t)}</span>` : esc(t.t);
      }).join('');
    }
    return null;
  }

  function vistaDiferencias() {
    const pl = Modelo.plantilla;
    if (!pl || !Modelo.uds.length) return { html: '<div class="aviso-caja">Faltan las unidades.</div>' };
    const huecos = (pl.huecos || []).map((h) => h.id);
    const st = { modo: 'tarjetas', ud: 0, hueco: '', actual: null, mostrado: false, aciertos: 0, fallos: 0 };
    const tabla = () => `<div class="matriz-cont"><table class="matriz"><thead><tr><th>Hueco</th>${Modelo.uds.map((u) => `<th>UD ${u.numero}. ${esc(u.titulo)}</th>`).join('')}</tr></thead><tbody>
      ${huecos.map((h) => `<tr><th>${esc(Modelo.etiquetasHuecos[h])}</th>${Modelo.uds.map((u) => `<td>${esc((u.valores || {})[h] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const elegir = (previa) => {
      const t = Progreso.tarjetas();
      let candidatos = [];
      Modelo.uds.forEach((u) => {
        if (st.ud && u.numero !== st.ud) return;
        huecos.forEach((h) => {
          if (st.hueco && h !== st.hueco) return;
          // por defecto, solo lo que se dice en voz alta (no los rótulos de pizarra o guion)
          if (!st.hueco && /^(pz_|numero$|trimestre_letra$|ods_corto$)/.test(h)) return;
          const v = t[`${u.numero}:${h}`] || { ok: 0, ko: 0 };
          const peso = 1 + v.ko * 2 - Math.min(v.ok, 4) * 0.2;
          candidatos.push({ n: u.numero, h, peso: Math.max(0.2, peso) });
        });
      });
      if (previa && candidatos.length > 1) candidatos = candidatos.filter((c) => !(c.n === previa.n && c.h === previa.h));
      const total = candidatos.reduce((a, c) => a + c.peso, 0);
      let r = Math.random() * total;
      for (const c of candidatos) { r -= c.peso; if (r <= 0) return c; }
      return candidatos[candidatos.length - 1];
    };
    const htmlTarjeta = () => {
      if (!st.actual) st.actual = elegir(st.previa);
      const { n, h } = st.actual;
      const u = Modelo.uds.find((x) => x.numero === n);
      const e = Modelo.expo(Modelo.idUD(n));
      const ctx = e ? contextoHueco(e, h) : null;
      const cab = h === 'titulo' ? `UD ${n}` : h === 'numero' ? esc(u.titulo) : `UD ${n} · ${esc(u.titulo)}`;
      return `<div class="tarjeta elevada pila">
        <div class="fila entre"><span class="eyebrow">${cab}</span><span class="chip">${esc(Modelo.etiquetasHuecos[h])}</span></div>
        <p class="contexto-hueco">${ctx || `¿Qué va en «${esc(Modelo.etiquetasHuecos[h])}»?`}</p>
        ${st.mostrado ? `<div class="info-caja"><b>${esc((u.valores || {})[h] || '')}</b></div>
          <div class="fila"><button class="btn" data-acc="mal">No me lo sabía</button><button class="btn primario" data-acc="bien">Me lo sabía</button></div>`
        : '<div class="fila"><button class="btn primario" data-acc="mostrar">Mostrar la respuesta</button><button class="btn" data-acc="saltar">Otra tarjeta</button></div>'}
        <p class="tenue">Esta sesión: ${st.aciertos} aciertos · ${st.fallos} fallos</p>
      </div>`;
    };
    const html = `
      <div class="pila">
        <div class="migas"><a href="#inicio">Inicio</a> › <a href="#uds">Parte B</a> › Diferencias</div>
        <h1>Lo propio de cada unidad</h1>
        <div class="fila entre">
          <div class="fila" role="group" aria-label="Vista"><button class="chip" data-modo="tarjetas" aria-pressed="true">Tarjetas</button><button class="chip" data-modo="tabla" aria-pressed="false">Tabla comparativa</button></div>
          <div class="fila" data-filtros>
            <label class="campo" style="flex-direction:row;align-items:center;gap:6px">UD <select data-f="ud"><option value="0">todas</option>${Modelo.uds.map((u) => `<option value="${u.numero}">${u.numero}. ${esc(u.titulo)}</option>`).join('')}</select></label>
            <label class="campo" style="flex-direction:row;align-items:center;gap:6px">Dato <select data-f="hueco"><option value="">todos</option>${huecos.map((h) => `<option value="${esc(h)}">${esc(Modelo.etiquetasHuecos[h])}</option>`).join('')}</select></label>
          </div>
        </div>
        <div data-cuerpo></div>
      </div>`;
    return {
      html, titulo: 'Diferencias entre UD',
      montar(raiz) {
        const pintar = () => {
          $$('[data-modo]', raiz).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === st.modo)));
          $('[data-filtros]', raiz).hidden = st.modo !== 'tarjetas';
          $('[data-cuerpo]', raiz).innerHTML = st.modo === 'tabla' ? tabla() : htmlTarjeta();
        };
        pintar();
        raiz.addEventListener('click', (ev) => {
          const m = ev.target.closest('[data-modo]');
          if (m) { st.modo = m.dataset.modo; pintar(); return; }
          const b = ev.target.closest('[data-acc]');
          if (!b) return;
          const a = b.dataset.acc;
          if (a === 'mostrar') st.mostrado = true;
          else if (a === 'saltar') { st.previa = st.actual; st.actual = null; st.mostrado = false; }
          else if (a === 'bien' || a === 'mal') {
            Progreso.marcarTarjeta(`${st.actual.n}:${st.actual.h}`, a === 'bien');
            if (a === 'bien') st.aciertos++; else st.fallos++;
            st.previa = st.actual; st.actual = null; st.mostrado = false;
          }
          pintar();
        });
        $$('[data-f]', raiz).forEach((s) => s.addEventListener('change', () => {
          st.ud = Number($('[data-f=ud]', raiz).value);
          st.hueco = $('[data-f=hueco]', raiz).value;
          st.actual = null; st.mostrado = false; pintar();
        }));
      },
    };
  }

  // ================================================================ SORTEO
  function vistaSorteo() {
    const st = { bolas: [], fase: 'bombo', elegida: 0, prepInicio: 0, prepAcum: 0, prepCorriendo: false };
    let timer = null;
    let esperas = [];
    let vivo = true;
    const nums = Modelo.uds.map((u) => u.numero);
    const pintar = (raiz) => {
      const c = $('[data-cuerpo]', raiz);
      if (st.fase === 'preparacion') {
        const u = Modelo.uds.find((x) => x.numero === st.elegida);
        const id = Modelo.idUD(st.elegida);
        c.innerHTML = `<div class="ensayo-panel">
          <div class="tarjeta elevada pila">
            <span class="eyebrow">Preparación · UD ${u.numero}. ${esc(u.titulo)}</span>
            <div class="cronometro" data-prep>60:00</div>
            <p class="suave">Una hora sin dispositivos: escribe el guion A5 (máx. 120 palabras) y repasa el esquema. Aquí puedes consultarlo todo.</p>
            <div class="fila"><button class="btn" data-acc="prep-pausa">${st.prepCorriendo ? 'Pausa' : 'Seguir'}</button><button class="btn primario" data-acc="exponer">Empezar la exposición (30:00)</button><button class="btn" data-acc="prep-cancelar">Cancelar y volver a sortear</button></div>
          </div>
          <div class="tarjeta pila">
            <h3>Material de la unidad</h3>
            <div class="fila"><a class="btn" href="#${id}-guion">Guion A5</a><a class="btn" href="#${id}-esquema">Esquema</a><a class="btn" href="#${id}-memorizar">Lo propio</a><a class="btn" href="#${id}-ficha">Ficha</a><a class="btn" href="#${id}-pizarra">Pizarra</a></div>
            <p class="tenue">Al volver a esta pestaña, el cronómetro de preparación sigue contando.</p>
          </div>
        </div>`;
        ticPrep(raiz);
        return;
      }
      c.innerHTML = `
        <div class="tarjeta elevada pila">
          <div class="bombo" aria-label="Bolas">${nums.map((n) => `<span class="bola ${st.bolas.includes(n) ? 'sale' : st.bolas.length === 3 ? 'apagada' : ''}">${n}</span>`).join('')}</div>
          <div class="fila">
            <button class="btn primario" data-acc="sacar" ${st.fase === 'sacando' ? 'disabled' : ''}>${st.bolas.length ? 'Volver a sortear' : 'Sacar tres bolas'}</button>
            <label class="interruptor"><input type="checkbox" id="so-peso" ${Almacen.leer('sorteoPonderado', false) ? 'checked' : ''}> Más probabilidad para las UD que menos dominas</label>
          </div>
        </div>
        ${st.bolas.length === 3 && st.fase === 'elegir' ? `<h2>Elige una</h2><div class="elegir-ud">${st.bolas.map((n) => {
          const u = Modelo.uds.find((x) => x.numero === n);
          const e = Modelo.expo(Modelo.idUD(n));
          return `<div class="tarjeta pila"><span class="ud-num">UD ${n}</span><h3>${esc(u.titulo)}</h3><span class="tenue">${esc(u.fechas || '')}</span>${sdaDe(u) ? `<span class="suave">SdA: ${esc(sdaDe(u))}</span>` : ''}${dominioHtml(e)}<button class="btn primario" data-elegir="${n}">Elegir esta unidad</button></div>`;
        }).join('')}</div>` : ''}
        ${historial()}`;
    };
    const historial = () => {
      const l = Progreso.sorteos().slice(0, 10);
      if (!l.length) return '';
      return `<div class="tarjeta"><h3>Sorteos anteriores</h3><div class="desliza"><table class="tabla"><tbody>${l.map((s) => `<tr><td>${new Date(s.fecha).toLocaleDateString('es-ES')}</td><td>Bolas ${s.bolas.join(' · ')}</td><td>${s.elegida ? `Elegida: UD ${s.elegida}` : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
    };
    const ticPrep = (raiz) => {
      const el = $('[data-prep]', raiz);
      if (!el) return;
      const t = st.prepAcum + (st.prepCorriendo ? (performance.now() - st.prepInicio) / 1000 : 0);
      const resto = 3600 - t;
      el.textContent = resto >= 0 ? mmss(resto) : `+${mmss(-resto)}`;
      el.classList.toggle('critico', resto < 300);
    };
    const sacar = (raiz) => {
      const ponderado = $('#so-peso', raiz) && $('#so-peso', raiz).checked;
      Almacen.escribir('sorteoPonderado', !!ponderado);
      const bolsa = nums.map((n) => ({ n, peso: ponderado ? 1.6 - Progreso.dominio(Modelo.expo(Modelo.idUD(n))) : 1 }));
      const salen = [];
      while (salen.length < Math.min(3, bolsa.length)) {
        const quedan = bolsa.filter((b) => !salen.includes(b.n));
        const tot = quedan.reduce((a, b) => a + b.peso, 0);
        let r = Math.random() * tot;
        let pick = quedan[quedan.length - 1].n;
        for (const b of quedan) { r -= b.peso; if (r <= 0) { pick = b.n; break; } }
        salen.push(pick);
      }
      st.bolas = []; st.fase = 'sacando'; pintar(raiz);
      esperas.forEach(clearTimeout);
      esperas = salen.map((n, i) => setTimeout(() => {
        if (!vivo) return;
        st.bolas.push(n);
        if (st.bolas.length === salen.length) { st.fase = 'elegir'; Progreso.guardarSorteo({ fecha: Date.now(), bolas: salen.slice(), elegida: 0 }); }
        pintar(raiz);
      }, 650 * (i + 1)));
    };
    const html = `
      <div class="pila">
        <div class="migas"><a href="#inicio">Inicio</a> › <a href="#uds">Parte B</a> › Sorteo</div>
        <h1>Sorteo de la unidad didáctica</h1>
        <p class="suave" style="max-width:70ch">Como en el examen: salen tres unidades de tu programación, eliges una, tienes una hora para prepararla y la expones en 30 minutos como máximo.</p>
        <div data-cuerpo class="pila"></div>
      </div>`;
    return {
      html, titulo: 'Sorteo',
      montar(raiz) {
        const prev = Almacen.leer('prepActual', null);
        if (prev && prev.elegida && Date.now() - prev.desde < 3 * 3600 * 1000) {
          Object.assign(st, { fase: 'preparacion', elegida: prev.elegida, prepAcum: (Date.now() - prev.desde) / 1000, prepInicio: performance.now(), prepCorriendo: false });
          st.prepAcum = prev.pausado ? prev.acum : (Date.now() - prev.desde) / 1000;
          st.prepCorriendo = !prev.pausado;
          st.prepInicio = performance.now();
        }
        pintar(raiz);
        timer = setInterval(() => ticPrep(raiz), 500);
        raiz.addEventListener('change', (ev) => { if (ev.target.id === 'so-peso') Almacen.escribir('sorteoPonderado', ev.target.checked); });
        raiz.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-acc],[data-elegir]');
          if (!b) return;
          if (b.dataset.elegir) {
            st.elegida = Number(b.dataset.elegir);
            const l = Progreso.sorteos(); if (l[0]) { l[0].elegida = st.elegida; Almacen.escribir('sorteos', l); }
            Object.assign(st, { fase: 'preparacion', prepAcum: 0, prepInicio: performance.now(), prepCorriendo: true });
            Almacen.escribir('prepActual', { elegida: st.elegida, desde: Date.now(), pausado: false, acum: 0 });
            pintar(raiz);
            return;
          }
          const a = b.dataset.acc;
          if (a === 'sacar') sacar(raiz);
          else if (a === 'prep-pausa') {
            if (st.prepCorriendo) { st.prepAcum += (performance.now() - st.prepInicio) / 1000; st.prepCorriendo = false; Almacen.escribir('prepActual', { elegida: st.elegida, desde: Date.now() - st.prepAcum * 1000, pausado: true, acum: st.prepAcum }); }
            else { st.prepInicio = performance.now(); st.prepCorriendo = true; Almacen.escribir('prepActual', { elegida: st.elegida, desde: Date.now() - st.prepAcum * 1000, pausado: false, acum: st.prepAcum }); }
            pintar(raiz);
          } else if (a === 'prep-cancelar') {
            Almacen.escribir('prepActual', null);
            Object.assign(st, { fase: 'bombo', bolas: [], elegida: 0, prepAcum: 0, prepCorriendo: false });
            pintar(raiz);
          } else if (a === 'exponer') {
            Almacen.escribir('prepActual', null);
            Opo.App.pendiente = { empezar: true };
            Opo.App.ir(`${Modelo.idUD(st.elegida)}-ensayo`);
          }
        });
      },
      destruir() { vivo = false; clearInterval(timer); esperas.forEach(clearTimeout); },
    };
  }

  // ================================================================ AJUSTES
  function vistaAjustes() {
    const aj = Opo.Ajustes.leer();
    const voces = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang)) : [];
    const html = `
      <div class="pila">
        <h1>Ajustes</h1>
        <div class="rejilla-2">
          <div class="tarjeta pila">
            <h3>Pantalla</h3>
            <label class="campo">Tema<select id="aj-tema"><option value="sistema">Según el sistema</option><option value="claro">Claro (pizarra blanca)</option><option value="oscuro">Oscuro (pizarra verde)</option></select></label>
            <label class="campo">Tamaño del texto del discurso<input type="range" id="aj-tam" min="0.9" max="1.6" step="0.04" value="${aj.tamTexto}"></label>
          </div>
          <div class="tarjeta pila">
            <h3>Audio</h3>
            <label class="campo">Fuente<select id="aj-fuente"><option value="auto">Audio grabado si existe (recomendado)</option><option value="voz">Siempre la voz del navegador</option></select></label>
            <label class="campo">Voz del navegador<select id="aj-voz"><option value="">Automática</option>${voces.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
            <div class="fila"><button class="btn" data-acc="probar">Probar la voz</button></div>
            <p class="tenue" id="aj-sin-voces" ${voces.length ? 'hidden' : ''}>Este navegador no ofrece voces en español (o aún no las ha cargado).</p>
          </div>
        </div>
        <div class="tarjeta pila">
          <h3>Tu progreso</h3>
          <p class="suave">El progreso (repasos, ensayos, autoevaluaciones y tarjetas) se guarda solo en este navegador. Para pasarlo a otro dispositivo, copia el texto y pégalo allí.</p>
          <textarea id="aj-datos" aria-label="Datos de progreso" spellcheck="false"></textarea>
          <div class="fila"><button class="btn" data-acc="exportar">Copiar mi progreso</button><button class="btn" data-acc="importar">Cargar el texto pegado</button><button class="btn peligro" data-acc="borrar">Borrar todo el progreso</button></div>
          <div data-confirmar></div>
        </div>
        <p class="nota-pie">Contenidos elaborados a partir de la programación didáctica «Aprendemos juntos», de los criterios de actuación de los tribunales (Cuerpo 597, Andalucía 2025) y de la actilla de calificación de la segunda prueba. Revisa siempre la normativa vigente de tu convocatoria.</p>
      </div>`;
    return {
      html, titulo: 'Ajustes',
      destruir() { if (this._quitarVoces) this._quitarVoces(); },
      montar(raiz) {
        if ('speechSynthesis' in window) {
          const rellenar = () => {
            const sel = $('#aj-voz', raiz);
            if (!sel) return;
            const vs = window.speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
            sel.innerHTML = '<option value="">Automática</option>' + vs.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
            sel.value = Opo.Ajustes.leer().voz;
            $('#aj-sin-voces', raiz).hidden = vs.length > 0;
          };
          try { window.speechSynthesis.addEventListener('voiceschanged', rellenar); this._quitarVoces = () => window.speechSynthesis.removeEventListener('voiceschanged', rellenar); } catch (e) { /* nada */ }
        }
        $('#aj-tema', raiz).value = aj.tema;
        $('#aj-fuente', raiz).value = aj.fuente;
        $('#aj-voz', raiz).value = aj.voz;
        $('#aj-tema', raiz).addEventListener('change', (e) => Opo.Ajustes.poner('tema', e.target.value));
        $('#aj-tam', raiz).addEventListener('input', (e) => Opo.Ajustes.poner('tamTexto', Number(e.target.value)));
        $('#aj-fuente', raiz).addEventListener('change', (e) => { Opo.Ajustes.poner('fuente', e.target.value); reproductor.cambiarFuente(); });
        $('#aj-voz', raiz).addEventListener('change', (e) => Opo.Ajustes.poner('voz', e.target.value));
        raiz.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-acc]');
          if (!b) return;
          const a = b.dataset.acc;
          const ta = $('#aj-datos', raiz);
          if (a === 'probar' && 'speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance('Buenos días, miembros del tribunal. Paso a exponer la unidad didáctica.');
            const v = Opo.vozPreferida(); if (v) u.voice = v; u.lang = (v && v.lang) || 'es-ES';
            window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
          } else if (a === 'exportar') { ta.value = JSON.stringify(Almacen.exportar()); Opo.copiar(ta.value, ta); }
          else if (a === 'importar') {
            try { Almacen.importar(JSON.parse(ta.value)); Opo.Ajustes.aplicar(); Opo.aviso('Progreso cargado'); } catch (e) { Opo.aviso('El texto pegado no es un progreso válido.'); }
          } else if (a === 'borrar') {
            $('[data-confirmar]', raiz).innerHTML = '<div class="aviso-caja fila entre"><span>¿Seguro? Se borrarán repasos, ensayos, autoevaluaciones y ajustes de este navegador.</span><span class="fila"><button class="btn peligro" data-acc="borrar-si">Sí, borrar</button><button class="btn" data-acc="borrar-no">Cancelar</button></span></div>';
          } else if (a === 'borrar-si') { Almacen.borrarTodo(); Opo.Ajustes.aplicar(); $('[data-confirmar]', raiz).innerHTML = ''; Opo.aviso('Progreso borrado'); }
          else if (a === 'borrar-no') $('[data-confirmar]', raiz).innerHTML = '';
        });
      },
    };
  }

  Object.assign(Opo.Vistas, { inicio: vistaInicio, uds: vistaUDs, plantilla: vistaPlantilla, diferencias: vistaDiferencias, sorteo: vistaSorteo, ajustes: vistaAjustes });
})();
