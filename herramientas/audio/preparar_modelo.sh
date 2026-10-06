#!/usr/bin/env bash
# Descarga el modelo Kokoro-82M (cuantizado) y la voz española ef_dora desde el registro de npm
# y los deja listos para generar_audio.py. Uso: bash herramientas/audio/preparar_modelo.sh [carpeta]
set -euo pipefail
DEST="${1:-$HOME/.cache/kokoro-es}"
mkdir -p "$DEST" && cd "$DEST"
tarball() { curl -fsS "https://registry.npmjs.org/$1/latest" | python3 -c 'import json,sys;print(json.load(sys.stdin)["dist"]["tarball"])'; }
if [ ! -f kokoro-q8.onnx ]; then
  curl -fsSL -o shards.tgz "$(tarball kokoro-q8-shards)"
  mkdir -p shards && tar xzf shards.tgz -C shards
  cat shards/package/kokoro-q8.part{0,1,2,3,4,5}.bin > kokoro-q8.onnx
  rm -rf shards shards.tgz
fi
if [ ! -f voces-es.npz ]; then
  curl -fsSL -o kjs.tgz "$(tarball kokoro-js)"
  mkdir -p kjs && tar xzf kjs.tgz -C kjs
  python3 - <<'PY'
import numpy as np, os
d = {n[:-4]: np.fromfile(os.path.join('kjs/package/voices', n), dtype=np.float32).reshape(-1, 1, 256)
     for n in os.listdir('kjs/package/voices') if n[:2] in ('ef', 'em')}
np.savez('voces-es.npz', **d)
print('voces:', ', '.join(sorted(d)))
PY
  rm -rf kjs kjs.tgz
fi
echo "Listo: $DEST/kokoro-q8.onnx y $DEST/voces-es.npz"
