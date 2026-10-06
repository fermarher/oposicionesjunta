#!/usr/bin/env node
// Valida los contenidos de la app.
// Uso: node herramientas/validar.mjs programacion | plantilla | ud <n> | todo
import fs from 'node:fs';
import path from 'node:path';
import {
  WPM, ZONAS, HUECO_RE, raiz, leerJSON, contarPalabras, huecosDe, rellenar,
  renderizarDiscurso, palabrasDiscurso, ficheroUD,
} from './lib.mjs';

const errores = [];
const avisos = [];
const info = [];
const E = (m) => errores.push(m);
const A = (m) => avisos.push(m);
const I = (m) => info.push(m);

const fProg = path.join(raiz, 'contenido', 'programacion.json');
const fPlant = path.join(raiz, 'contenido', 'ud_plantilla.json');

function validarEstructura(doc, etiqueta, { conHuecos = false } = {}) {
  if (!Array.isArray(doc.secciones) || !doc.secciones.length) { E(`${etiqueta}: faltan secciones`); return; }
  if (typeof doc.objetivoMinutos !== 'number') E(`${etiqueta}: falta objetivoMinutos numérico`);
  const ids = new Set();
  let sumaMin = 0;
  let nCabecera = 0;
  let nIndice = 0;
  for (const s of doc.secciones) {
    const et = `${etiqueta} sección ${s.id}`;
    if (!s.id || ids.has(s.id)) E(`${et}: id vacío o repetido`);
    ids.add(s.id);
    if (!s.titulo) E(`${et}: falta título`);
    if (!Array.isArray(s.rubrica) || !s.rubrica.length) A(`${et}: sin ítems de rúbrica`);
    if (typeof s.minutos !== 'number') E(`${et}: minutos no numérico`); else sumaMin += s.minutos;
    if (!Array.isArray(s.esquema) || s.esquema.length < 3 || s.esquema.length > 8) A(`${et}: el esquema debería tener 3-8 viñetas (tiene ${s.esquema?.length ?? 0})`);
    if (!Array.isArray(s.bloques) || !s.bloques.length) { E(`${et}: sin bloques`); continue; }
    for (const b of s.bloques) {
      const eb = `${etiqueta} bloque ${b.id}`;
      if (!b.id || ids.has(b.id)) E(`${eb}: id vacío o repetido`);
      ids.add(b.id);
      if (typeof b.texto !== 'string' || !b.texto.trim()) { E(`${eb}: texto vacío`); continue; }
      if (!conHuecos && huecosDe(b.texto).length) E(`${eb}: contiene huecos {{}} sin rellenar`);
      const w = contarPalabras(b.texto);
      if (w < 25 || w > 170) A(`${eb}: ${w} palabras (recomendado 40-130)`);
      for (const p of b.pizarra || []) {
        if (!ZONAS.includes(p.zona)) E(`${eb}: zona de pizarra no válida "${p.zona}"`);
        if (!p.texto || !String(p.texto).trim()) E(`${eb}: elemento de pizarra vacío`);
        else if (!conHuecos && contarPalabras(p.texto) > 14) A(`${eb}: texto de pizarra largo (${contarPalabras(p.texto)} palabras): "${p.texto}"`);
        if (p.zona === 'centro' && !p.caja) A(`${eb}: elemento de zona centro sin "caja"`);
        if (p.zona === 'cabecera') nCabecera++;
        if (p.zona === 'indice') nIndice++;
      }
    }
  }
  if (!nCabecera) A(`${etiqueta}: la pizarra no tiene cabecera`);
  if (nIndice && nIndice !== doc.secciones.length) A(`${etiqueta}: ${nIndice} elementos de índice para ${doc.secciones.length} secciones`);
  if (Math.abs(sumaMin - doc.objetivoMinutos) > 1) A(`${etiqueta}: la suma de minutos por sección (${sumaMin.toFixed(1)}) no cuadra con objetivoMinutos (${doc.objetivoMinutos})`);
}

function informeTiempos(doc, etiqueta) {
  const total = palabrasDiscurso(doc);
  const min = total / WPM;
  I(`${etiqueta}: ${total} palabras ≈ ${min.toFixed(1)} min a ${WPM} ppm`);
  if (min > 30) E(`${etiqueta}: supera los 30 minutos (${min.toFixed(1)})`);
  else if (min > 29.5 || min < 26.5) A(`${etiqueta}: duración ${min.toFixed(1)} min fuera del rango recomendado 26,5-29,5`);
  for (const s of doc.secciones) {
    const w = s.bloques.reduce((a, b) => a + contarPalabras(b.texto), 0);
    const m = w / WPM;
    const desv = s.minutos ? (m - s.minutos) / s.minutos : 0;
    const marca = Math.abs(desv) > 0.25 ? '  <-- desviación' : '';
    I(`   ${s.id.padEnd(4)} ${String(s.titulo).slice(0, 48).padEnd(48)} ${String(w).padStart(5)} pal  ${m.toFixed(1).padStart(5)} min (obj. ${s.minutos})${marca}`);
    if (Math.abs(desv) > 0.25) A(`${etiqueta} ${s.id}: ${m.toFixed(1)} min frente a ${s.minutos} previstos`);
  }
}

function validarProgramacion() {
  if (!fs.existsSync(fProg)) { E('No existe contenido/programacion.json'); return; }
  const doc = leerJSON(fProg);
  validarEstructura(doc, 'programación');
  informeTiempos(doc, 'programación');
}

function cargarPlantilla() {
  if (!fs.existsSync(fPlant)) { E('No existe contenido/ud_plantilla.json'); return null; }
  return leerJSON(fPlant);
}

function textosPlantilla(pl) {
  const t = [];
  for (const s of pl.secciones || []) {
    t.push(s.titulo, ...(s.esquema || []));
    for (const b of s.bloques || []) { t.push(b.texto); for (const p of b.pizarra || []) t.push(p.texto, p.caja || ''); }
  }
  t.push(pl.guion || '');
  return t;
}

function validarPlantilla(pl) {
  validarEstructura(pl, 'plantilla', { conHuecos: true });
  if (!Array.isArray(pl.huecos) || !pl.huecos.length) { E('plantilla: falta la lista de huecos'); return; }
  const ids = new Set();
  for (const h of pl.huecos) {
    if (!/^[a-z0-9_]+$/.test(h.id || '')) E(`plantilla: id de hueco no válido "${h.id}"`);
    if (ids.has(h.id)) E(`plantilla: hueco repetido "${h.id}"`);
    ids.add(h.id);
    if (!h.descripcion) A(`plantilla: hueco ${h.id} sin descripción`);
    if (!h.ejemplo) A(`plantilla: hueco ${h.id} sin ejemplo`);
    if (!Array.isArray(h.palabras) || h.palabras.length !== 2) A(`plantilla: hueco ${h.id} sin rango "palabras" [min, max]`);
  }
  const usados = new Set(textosPlantilla(pl).flatMap(huecosDe));
  for (const u of usados) if (!ids.has(u)) E(`plantilla: se usa {{${u}}} pero no está definido en "huecos"`);
  for (const id of ids) if (!usados.has(id)) A(`plantilla: el hueco ${id} no se usa en ningún texto`);
  if (!pl.guion) E('plantilla: falta el guion A5');
  // Prueba con los ejemplos
  const ejemplo = Object.fromEntries(pl.huecos.map((h) => [h.id, h.ejemplo || h.id]));
  const r = renderizarDiscurso(pl, ejemplo);
  informeTiempos(r, 'plantilla (con ejemplos)');
  const g = contarPalabras(r.guion);
  I(`plantilla: guion con ejemplos = ${g} palabras`);
  if (g > 120) E(`plantilla: el guion con ejemplos tiene ${g} palabras (máx. 120)`);
  // Proporción de texto común
  const sinHuecos = pl.secciones.reduce((a, s) => a + s.bloques.reduce((x, b) => x + contarPalabras(b.texto.replace(HUECO_RE, ' ')), 0), 0);
  I(`plantilla: texto común ${sinHuecos} palabras de ${palabrasDiscurso(r)} (${Math.round((100 * sinHuecos) / palabrasDiscurso(r))} %)`);
}

function validarUD(pl, n) {
  const f = ficheroUD(n);
  const et = `UD ${n}`;
  if (!fs.existsSync(f)) { E(`${et}: no existe ${path.relative(raiz, f)}`); return; }
  const ud = leerJSON(f);
  if (ud.numero !== n) E(`${et}: "numero" vale ${ud.numero}`);
  for (const k of ['titulo', 'trimestre', 'fechas', 'dias', 'valores']) if (ud[k] === undefined) E(`${et}: falta "${k}"`);
  const v = ud.valores || {};
  const defs = Object.fromEntries((pl.huecos || []).map((h) => [h.id, h]));
  for (const id of Object.keys(defs)) {
    if (!(id in v)) { E(`${et}: falta el valor del hueco ${id}`); continue; }
    const val = String(v[id] ?? '');
    if (!val.trim()) E(`${et}: hueco ${id} vacío`);
    if (huecosDe(val).length) E(`${et}: el valor de ${id} contiene {{}}`);
    const w = contarPalabras(val);
    const [mn, mx] = defs[id].palabras || [0, 9999];
    if (w > mx * 1.5) E(`${et}: ${id} tiene ${w} palabras (máx. ${mx})`);
    else if (w < mn || w > mx) A(`${et}: ${id} tiene ${w} palabras (rango ${mn}-${mx})`);
  }
  for (const id of Object.keys(v)) if (!defs[id]) A(`${et}: valor sobrante "${id}"`);
  const r = renderizarDiscurso(pl, v);
  validarEstructura(r, et);
  informeTiempos(r, et);
  const g = contarPalabras(r.guion);
  I(`${et}: guion = ${g} palabras`);
  if (g > 120) E(`${et}: el guion tiene ${g} palabras (máx. 120)`);
}

const [modo, arg] = process.argv.slice(2);
if (modo === 'programacion') validarProgramacion();
else if (modo === 'plantilla') { const pl = cargarPlantilla(); if (pl) validarPlantilla(pl); }
else if (modo === 'ud') { const pl = cargarPlantilla(); if (pl) validarUD(pl, Number(arg)); }
else if (modo === 'todo') {
  validarProgramacion();
  const pl = cargarPlantilla();
  if (pl) { validarPlantilla(pl); for (let n = 1; n <= 12; n++) validarUD(pl, n); }
} else {
  console.log('Uso: node herramientas/validar.mjs programacion | plantilla | ud <n> | todo');
  process.exit(2);
}

for (const l of info) console.log(l);
for (const l of avisos) console.log('AVISO: ' + l);
for (const l of errores) console.log('ERROR: ' + l);
console.log(`\n${errores.length} errores, ${avisos.length} avisos`);
process.exit(errores.length ? 1 : 0);
