#!/usr/bin/env node
// Genera datos/contenido.js y datos/audio.js a partir de contenido/ y audio/,
// y la versión de un solo fichero para publicar (publicar/index.html).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { raiz, leerJSON, rellenar } from './lib.mjs';

const C = (...p) => path.join(raiz, ...p);
const existe = (f) => fs.existsSync(f);
const pad = (n) => String(n).padStart(2, '0');

const datos = { generado: new Date().toISOString() };
if (existe(C('contenido', 'programacion.json'))) datos.programacion = leerJSON(C('contenido', 'programacion.json'));
if (existe(C('contenido', 'ud_plantilla.json'))) datos.plantilla = leerJSON(C('contenido', 'ud_plantilla.json'));
datos.uds = [];
datos.fichas = [];
for (let n = 1; n <= 12; n++) {
  const f = C('contenido', 'uds', `ud${pad(n)}.json`);
  if (existe(f)) datos.uds.push(leerJSON(f));
  const fi = C('contenido', 'fichas', `ud${pad(n)}.json`);
  if (existe(fi)) datos.fichas.push(leerJSON(fi));
}
if (existe(C('contenido', 'rubricas.json'))) datos.rubricas = leerJSON(C('contenido', 'rubricas.json'));
fs.mkdirSync(C('datos'), { recursive: true });
fs.writeFileSync(C('datos', 'contenido.js'), `window.OPOS_DATOS = ${JSON.stringify(datos)};\n`);

// Audio: comprueba que las frases de cada bloque coinciden con las que calcula la app.
const ctx = { window: {}, console };
vm.runInNewContext(fs.readFileSync(C('js', 'util.js'), 'utf8'), ctx);
const frases = ctx.window.Opo.frases;
const audio = {};
const pistas = [];
if (datos.programacion) pistas.push(['programacion', datos.programacion, {}]);
if (datos.plantilla) datos.uds.forEach((u) => pistas.push([`ud${pad(u.numero)}`, datos.plantilla, u.valores || {}]));
for (const [clave, doc, valores] of pistas) {
  const fj = C('audio', `${clave}.json`);
  if (!existe(fj) || !existe(C('audio', `${clave}.mp3`))) continue;
  const a = leerJSON(fj);
  const porBloque = {};
  a.frases.forEach((f) => { (porBloque[f.b] = porBloque[f.b] || []).push(f); });
  let ok = true;
  for (const s of doc.secciones) for (const b of s.bloques) {
    const texto = rellenar(b.texto, valores);
    const cortes = frases(texto);
    const fa = porBloque[b.id] || [];
    if (fa.length !== cortes.length) { ok = false; console.warn(`AVISO audio ${clave} bloque ${b.id}: ${fa.length} frases en el audio y ${cortes.length} en el texto`); }
  }
  if (ok) audio[clave] = { duracion: a.duracion, voz: a.voz, frases: a.frases.map((f) => ({ b: f.b, t0: f.t0, t1: f.t1 })) };
  else console.warn(`AVISO: el audio de ${clave} no coincide con el texto actual; regenera el audio.`);
}
fs.writeFileSync(C('datos', 'audio.js'), `window.OPOS_AUDIO = ${JSON.stringify(audio)};\n`);
console.log(`datos/contenido.js: programación ${datos.programacion ? 'sí' : 'no'}, plantilla ${datos.plantilla ? 'sí' : 'no'}, ${datos.uds.length} UD, ${datos.fichas.length} fichas`);
console.log(`datos/audio.js: ${Object.keys(audio).length} pistas con audio (${Object.keys(audio).join(', ')})`);

// Versión de un solo fichero (sin <html>/<head>/<body>: la plataforma de publicación los añade).
const html = fs.readFileSync(C('index.html'), 'utf8');
const css = fs.readFileSync(C('css', 'estilos.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const fuentes = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const titulo = html.match(/<title>[^<]*<\/title>/)[0];
const js = scripts.map((s) => `<script>\n${fs.readFileSync(C(s), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
const unico = `${titulo}\n${fuentes}\n<style>\n${css}\n</style>\n${js}\n`;
fs.mkdirSync(C('publicar'), { recursive: true });
fs.writeFileSync(C('publicar', 'oposiciones.html'), unico);
console.log(`publicar/oposiciones.html: ${(unico.length / 1024).toFixed(0)} KB`);
