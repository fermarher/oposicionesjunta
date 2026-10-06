#!/usr/bin/env python3
"""Genera los audios de las exposiciones con voz sintética (Kokoro-82M, voz española).

Para cada pista (programación y ud01..ud12) produce:
  audio/<pista>.mp3   el audio completo
  audio/<pista>.json  marcas de tiempo por frase: [{"b": id_bloque, "i": desde, "f": hasta, "t0": seg, "t1": seg}]
Las frases idénticas entre pistas (el texto común de la plantilla de UD) se sintetizan una sola vez (caché).

Uso:
  python generar_audio.py --modelo kokoro.onnx --voces voces.npz [--pistas programacion,ud01] [--procesos 4]
Requisitos: pip install kokoro-onnx soundfile ; ffmpeg en el PATH.
El modelo (model_quantized.onnx de onnx-community/Kokoro-82M-v1.0-ONNX) y la voz ef_dora se pueden
obtener del paquete npm kokoro-q8-shards (6 trozos que se concatenan) y de kokoro-js (voices/ef_dora.bin).
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave
from concurrent.futures import ProcessPoolExecutor, as_completed

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONTENIDO = os.path.join(RAIZ, 'contenido')
SALIDA = os.path.join(RAIZ, 'audio')
SR = 24000
HUECO = re.compile(r'\{\{\s*([a-z0-9_]+)\s*\}\}')

PAUSA_FRASE = 0.32
PAUSA_BLOQUE = 0.65
PAUSA_SECCION = 1.3

# ---------------------------------------------------------------- texto


def rellenar(texto, valores):
    return HUECO.sub(lambda m: valores.get(m.group(1), ''), texto)


FIN_FRASE = re.compile(r'(?<=[.!?…])["»”)]*\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ0-9])|(?<=[:;])["»”)]*\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ])')


def frases(texto):
    """Devuelve [(inicio, fin)] de cada frase dentro de texto (offsets de caracteres)."""
    res = []
    inicio = 0
    for m in FIN_FRASE.finditer(texto):
        corte = m.start()
        trozo = texto[inicio:corte].strip()
        # no partir abreviaturas ni números tipo "4.1.a" o "art." o "Sr."
        previo = texto[max(0, corte - 6):corte]
        if re.search(r'\b(art|Sr|Sra|núm|pág|etc|p\. ej|ej)\.$', previo) or len(trozo) < 20:
            continue
        res.append((inicio, corte))
        inicio = m.end()
    if texto[inicio:].strip():
        res.append((inicio, len(texto)))
    # recorta espacios
    out = []
    for a, b in res:
        while a < b and texto[a].isspace():
            a += 1
        while b > a and texto[b - 1].isspace():
            b -= 1
        out.append((a, b))
    return out


SIGLAS = {
    'TDAH': 'te de a hache', 'ODS': 'o de ese', 'STEAM': 'estim', 'NEAE': 'neáe', 'ANEAE': 'aneáe',
    'ABP': 'a be pe', 'APS': 'a pe ese', 'PT': 'pe te', 'AL': 'a ele', 'ETCP': 'e te ce pe',
    'TIC': 'tic', 'TAC': 'tac', 'PDI': 'pe de i', 'NEE': 'ene e e', 'DIA': 'de i a', 'COM': 'compensatoria',
    'AACCII': 'altas capacidades intelectuales', 'ACS': 'a ce ese', 'AAC': 'a a ce', 'ACAI': 'acái',
    'PRA': 'programa de refuerzo del aprendizaje', 'PE': 'programa específico', 'PAD': 'pad',
    'LCL': 'Lengua Castellana y Literatura', 'MAT': 'Matemáticas', 'CMN': 'Conocimiento del Medio',
    'EAR': 'Educación Artística', 'UD': 'unidad didáctica', 'SdA': 'situación de aprendizaje',
    'LOE': 'loe', 'LEA': 'lea', 'CEIP': 'ceip', 'CIMA': 'cima', 'ALDEA': 'aldea', 'DUA': 'dúa',
    'LOMLOE': 'lomloe',
    'APA': 'a pe a', 'INTEF': 'intef', 'ONG': 'o ene ge', 'TV': 'televisión',
}
ORDINALES = {'1': 'primero', '2': 'segundo', '3': 'tercero', '4': 'cuarto', '5': 'quinto', '6': 'sexto'}
ORDINALES_F = {'1': 'primera', '2': 'segunda', '3': 'tercera', '4': 'cuarta', '5': 'quinta', '6': 'sexta'}
LETRAS = {'a': 'a', 'b': 'be', 'c': 'ce', 'd': 'de', 'e': 'e', 'f': 'efe', 'g': 'ge', 'h': 'hache'}


MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
         'octubre', 'noviembre', 'diciembre']


def fecha_oral(m):
    d, mes, a = int(m.group(1)), int(m.group(2)), m.group(3)
    if 1 <= mes <= 12:
        return f'{d} de {MESES[mes - 1]} de {a}'
    return m.group(0)


def codigo_oral(m):
    partes = m.group(0).split('.')
    dicho = partes[0]
    for i, p in enumerate(partes[1:], 1):
        if p.isdigit():
            dicho += ' punto ' + p
        elif i == len(partes) - 1 and len(p) == 1:
            dicho += ' ' + LETRAS.get(p.lower(), p)
        else:
            dicho += ' punto ' + LETRAS.get(p.lower(), p)
    return dicho


DESCRIPTORES = {'CCL': 'ce ce ele', 'CP': 'ce pe', 'STEM': 'estem', 'CD': 'ce de', 'CPSAA': 'ce pe ese a a',
                'CC': 'ce ce', 'CE': 'ce e', 'CCEC': 'ce ce e ce', 'DO': 'de o', 'CEv': 'ce e uve', 'SB': 'ese be'}


def normalizar(t):
    """Adapta el texto para que la voz sintética lo lea como se diría en voz alta."""
    t = re.sub(r'\b(CCL|CPSAA|CCEC|STEM|CP|CD|CC|CE)(\d)\b', lambda m: f'{DESCRIPTORES[m.group(1)]} {m.group(2)}', t)
    t = t.replace('«', '').replace('»', '').replace('“', '').replace('”', '').replace('"', '')
    t = re.sub(r'\s*[—–]\s*', ', ', t)
    t = re.sub(r'\s*\(\s*', ', ', t)
    t = re.sub(r'\s*\)\s*', ', ', t)
    t = t.replace('y/o', 'y o')
    t = t.replace('/', ' / ')
    t = re.sub(r'(\d+) / (\d+) / (\d{4})', fecha_oral, t)  # 30/5/2023 -> 30 de mayo de 2023
    t = re.sub(r'(\d+) / (\d{4})', r'\1 de \2', t)               # 157/2022 -> 157 de 2022
    t = t.replace(' / ', ' o ')
    t = re.sub(r'\b(\d)\.º', lambda m: ORDINALES.get(m.group(1), m.group(1)), t)
    t = re.sub(r'\b(\d)\.ª', lambda m: ORDINALES_F.get(m.group(1), m.group(1)), t)
    t = re.sub(r'\b(\d)º', lambda m: ORDINALES.get(m.group(1), m.group(1)), t)
    t = re.sub(r'\b\d+(?:\.[0-9A-Za-z]+)+\b', codigo_oral, t)      # 4.1.a, 2.B.3.4, 10.2
    t = re.sub(r'(\d+)\s*%', r'\1 por ciento', t)
    t = re.sub(r'(\d+)-(\d+)', r'\1 a \2', t)
    t = re.sub(r'\bart\.\s*', 'artículo ', t)
    t = re.sub(r'\bn\.º\s*', 'número ', t)
    t = re.sub(r'\bp\. ej\.', 'por ejemplo', t)
    t = re.sub(r'\betc\.', 'etcétera.', t, flags=re.I)
    t = re.sub(r'\bs\.f\.', 'sin fecha', t)
    t = re.sub(r'\b[A-Za-z]{2,7}\b', lambda m: SIGLAS.get(m.group(0), m.group(0)), t)
    t = re.sub(r',\s*,', ',', t)
    t = re.sub(r',\s*([.;:!?])', r'\1', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'^,\s*', '', t)
    return t


# ---------------------------------------------------------------- pistas


def cargar(nombre):
    with open(os.path.join(CONTENIDO, nombre), encoding='utf-8') as f:
        return json.load(f)


def pistas_disponibles():
    pistas = {}
    if os.path.exists(os.path.join(CONTENIDO, 'programacion.json')):
        pistas['programacion'] = (cargar('programacion.json'), {})
    if os.path.exists(os.path.join(CONTENIDO, 'ud_plantilla.json')):
        pl = cargar('ud_plantilla.json')
        for n in range(1, 13):
            f = os.path.join(CONTENIDO, 'uds', f'ud{n:02d}.json')
            if os.path.exists(f):
                with open(f, encoding='utf-8') as fh:
                    ud = json.load(fh)
                pistas[f'ud{n:02d}'] = (pl, ud.get('valores', {}))
    return pistas


def segmentos(doc, valores):
    """Lista de (seccion_idx, bloque_id, desde, hasta, texto_frase) en orden."""
    out = []
    for si, s in enumerate(doc['secciones']):
        for b in s['bloques']:
            texto = rellenar(b['texto'], valores)
            for a, z in frases(texto):
                out.append((si, b['id'], a, z, texto[a:z]))
    return out


def clave(texto, voz, velocidad):
    return hashlib.sha1(f'{voz}|{velocidad}|{texto}'.encode('utf-8')).hexdigest()[:20]


# ---------------------------------------------------------------- síntesis

_kokoro = None


def _init(modelo, voces):
    global _kokoro
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    so = ort.SessionOptions()
    so.intra_op_num_threads = 1
    so.inter_op_num_threads = 1
    sess = ort.InferenceSession(modelo, so, providers=['CPUExecutionProvider'])
    _kokoro = Kokoro.from_session(sess, voces)


def _sintetizar(args):
    texto, destino, voz, velocidad = args
    import numpy as np
    import soundfile as sf
    muestras, sr = _kokoro.create(texto, voice=voz, speed=velocidad, lang='es')
    muestras = np.asarray(muestras, dtype=np.float32)
    # recorta silencios de los extremos
    umbral = 0.01
    idx = np.where(np.abs(muestras) > umbral)[0]
    if len(idx):
        muestras = muestras[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.06 * sr)]
    tmp = destino + '.tmp.wav'
    sf.write(tmp, muestras, sr, subtype='PCM_16')
    os.replace(tmp, destino)
    return destino, len(muestras) / sr


def duracion_wav(f):
    with wave.open(f) as w:
        return w.getnframes() / w.getframerate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--modelo', required=True)
    ap.add_argument('--voces', required=True)
    ap.add_argument('--voz', default='ef_dora')
    ap.add_argument('--velocidad', type=float, default=0.86)
    ap.add_argument('--pistas', default='')
    ap.add_argument('--procesos', type=int, default=4)
    ap.add_argument('--cache', default=os.path.join(RAIZ, '.cache_audio'))
    ap.add_argument('--kbps', type=int, default=32)
    ap.add_argument('--solo-sintetizar', action='store_true')
    a = ap.parse_args()

    os.makedirs(a.cache, exist_ok=True)
    os.makedirs(SALIDA, exist_ok=True)
    todas = pistas_disponibles()
    elegidas = [p for p in (a.pistas.split(',') if a.pistas else todas.keys()) if p in todas]
    plan = {}
    pendientes = {}
    for p in elegidas:
        doc, valores = todas[p]
        segs = segmentos(doc, valores)
        plan[p] = segs
        for (_, _, _, _, txt) in segs:
            n = normalizar(txt)
            k = clave(n, a.voz, a.velocidad)
            f = os.path.join(a.cache, k + '.wav')
            if not os.path.exists(f):
                pendientes[k] = (n, f)
    total = len(pendientes)
    print(f'Pistas: {", ".join(elegidas)} | frases nuevas a sintetizar: {total}', flush=True)
    if total:
        trabajos = [(n, f, a.voz, a.velocidad) for (n, f) in pendientes.values()]
        # primero las más largas para equilibrar la carga
        trabajos.sort(key=lambda t: -len(t[0]))
        hechas = 0
        with ProcessPoolExecutor(max_workers=a.procesos, initializer=_init, initargs=(a.modelo, a.voces)) as ex:
            futuros = [ex.submit(_sintetizar, t) for t in trabajos]
            for fu in as_completed(futuros):
                fu.result()
                hechas += 1
                if hechas % 25 == 0 or hechas == total:
                    print(f'  sintetizadas {hechas}/{total}', flush=True)
    if a.solo_sintetizar:
        return

    for p in elegidas:
        segs = plan[p]
        marcas = []
        t = 0.0
        lista = []
        with tempfile.TemporaryDirectory() as tmp:
            sil = {}

            def silencio(seg):
                if seg not in sil:
                    f = os.path.join(tmp, f'sil_{int(seg * 1000)}.wav')
                    with wave.open(f, 'wb') as w:
                        w.setnchannels(1)
                        w.setsampwidth(2)
                        w.setframerate(SR)
                        w.writeframes(b'\x00\x00' * int(SR * seg))
                    sil[seg] = f
                return sil[seg]
            prev = None
            for (si, bid, ini, fin, txt) in segs:
                if prev is not None:
                    pausa = PAUSA_SECCION if si != prev[0] else (PAUSA_BLOQUE if bid != prev[1] else PAUSA_FRASE)
                    lista.append(silencio(pausa))
                    t += pausa
                f = os.path.join(a.cache, clave(normalizar(txt), a.voz, a.velocidad) + '.wav')
                d = duracion_wav(f)
                marcas.append({'b': bid, 'i': ini, 'f': fin, 't0': round(t, 2), 't1': round(t + d, 2)})
                lista.append(f)
                t += d
                prev = (si, bid)
            lista.append(silencio(1.0))
            concat = os.path.join(tmp, 'lista.txt')
            with open(concat, 'w') as fh:
                for f in lista:
                    fh.write(f"file '{f}'\n")
            mp3 = os.path.join(SALIDA, f'{p}.mp3')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat,
                            '-ac', '1', '-ar', str(SR), '-codec:a', 'libmp3lame', '-b:a', f'{a.kbps}k', mp3], check=True)
        palabras = sum(len(s[4].split()) for s in segs)
        with open(os.path.join(SALIDA, f'{p}.json'), 'w', encoding='utf-8') as fh:
            json.dump({'pista': p, 'duracion': round(t, 2), 'voz': a.voz, 'velocidad': a.velocidad,
                       'palabras': palabras, 'frases': marcas}, fh, ensure_ascii=False, separators=(',', ':'))
        print(f'{p}: {t / 60:.1f} min, {palabras} palabras ({palabras / (t / 60):.0f} ppm) -> {mp3}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
