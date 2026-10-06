// Utilidades compartidas: carga, renderizado de huecos y recuento de palabras.
import fs from 'node:fs';
import path from 'node:path';

export const WPM = 130;
export const ZONAS = ['cabecera', 'indice', 'centro', 'normativa'];
export const HUECO_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

export const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function leerJSON(fichero) {
  return JSON.parse(fs.readFileSync(fichero, 'utf8'));
}

export function contarPalabras(texto) {
  const t = String(texto || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

export function huecosDe(texto) {
  return [...String(texto || '').matchAll(HUECO_RE)].map((m) => m[1]);
}

export function rellenar(texto, valores) {
  return String(texto || '').replace(HUECO_RE, (_, id) =>
    Object.prototype.hasOwnProperty.call(valores, id) ? valores[id] : `{{${id}}}`
  );
}

// Devuelve una copia del discurso con los huecos rellenados.
export function renderizarDiscurso(doc, valores = null) {
  const r = (t) => (valores ? rellenar(t, valores) : t);
  return {
    ...doc,
    secciones: doc.secciones.map((s) => ({
      ...s,
      titulo: r(s.titulo),
      esquema: (s.esquema || []).map(r),
      bloques: s.bloques.map((b) => ({
        ...b,
        texto: r(b.texto),
        pizarra: (b.pizarra || []).map((p) => ({ ...p, texto: r(p.texto), caja: p.caja ? r(p.caja) : p.caja })),
      })),
    })),
    guion: doc.guion ? r(doc.guion) : doc.guion,
  };
}

export function palabrasDiscurso(doc) {
  return doc.secciones.reduce((acc, s) => acc + s.bloques.reduce((a, b) => a + contarPalabras(b.texto), 0), 0);
}

export function ficheroUD(n) {
  return path.join(raiz, 'contenido', 'uds', `ud${String(n).padStart(2, '0')}.json`);
}
