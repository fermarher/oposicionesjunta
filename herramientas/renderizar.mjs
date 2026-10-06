#!/usr/bin/env node
// Muestra un discurso como texto plano para leerlo/revisarlo.
// Uso: node herramientas/renderizar.mjs programacion [--pizarra]
//      node herramientas/renderizar.mjs ud <n> [--pizarra]
//      node herramientas/renderizar.mjs plantilla [--pizarra]   (con los ejemplos de cada hueco)
import path from 'node:path';
import { raiz, leerJSON, renderizarDiscurso, contarPalabras, WPM, ficheroUD } from './lib.mjs';

const args = process.argv.slice(2);
const conPizarra = args.includes('--pizarra');
const [modo, n] = args.filter((a) => !a.startsWith('--'));

let doc;
if (modo === 'programacion') doc = leerJSON(path.join(raiz, 'contenido', 'programacion.json'));
else {
  const pl = leerJSON(path.join(raiz, 'contenido', 'ud_plantilla.json'));
  if (modo === 'plantilla') doc = renderizarDiscurso(pl, Object.fromEntries(pl.huecos.map((h) => [h.id, h.ejemplo])));
  else if (modo === 'ud') {
    const ud = leerJSON(ficheroUD(Number(n)));
    doc = renderizarDiscurso(pl, ud.valores);
    console.log(`UD ${ud.numero}. ${ud.titulo} (${ud.fechas})\n`);
  } else { console.log('Uso: renderizar.mjs programacion|plantilla|ud <n> [--pizarra]'); process.exit(2); }
}

let acumulado = 0;
for (const s of doc.secciones) {
  const w = s.bloques.reduce((a, b) => a + contarPalabras(b.texto), 0);
  const ini = acumulado / WPM;
  acumulado += w;
  console.log(`\n## ${s.titulo}  [${ini.toFixed(1)}' → ${(acumulado / WPM).toFixed(1)}'; ${w} palabras]`);
  for (const b of s.bloques) {
    console.log(`\n${b.texto}`);
    if (conPizarra) for (const p of b.pizarra || []) console.log(`   [pizarra:${p.zona}${p.caja ? ' / ' + p.caja : ''}] ${p.texto}`);
  }
}
if (doc.guion) console.log(`\n## GUION A5 (${contarPalabras(doc.guion)} palabras)\n${doc.guion}`);
