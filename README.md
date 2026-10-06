# Exposición oral · Oposiciones de Maestros (Educación Primaria, Andalucía)

Aplicación web para **memorizar y practicar la segunda prueba** del procedimiento selectivo:

| Parte | Qué es | Tiempo | Peso |
|---|---|---|---|
| A | Defensa oral de la programación didáctica «Aprendemos juntos» (3.º de Primaria) | máx. 30 min | 30 % |
| B | Exposición de **una** unidad didáctica: salen 3 al azar, se elige una, 1 h de preparación | máx. 30 min | 70 % |

Para cada exposición (la programación y cada una de las 12 UD) la app incluye:

- **Esquema** con el reparto del tiempo por secciones, los ítems de la rúbrica que cubre cada una (con su peso y la nota media de 2025) y las ideas clave.
- **Discurso** completo escrito para unos 28-29 minutos (≈130 palabras por minuto).
- **Audio** del discurso, sincronizado frase a frase con el texto y con la pizarra (voz neuronal grabada; si falta, usa la voz del navegador).
- **Pizarra**: se va «escribiendo» mientras suena el discurso, con una distribución fija (cabecera, índice, cajas centrales y normativa/autores). Pantalla completa y paso a paso.
- **Memorizar**: huecos al 25-100 %, iniciales, recitar con el esquema (y, en Chrome/Edge, comparar con lo que dices por el micrófono) y repaso espaciado por secciones.
- **Ensayo** cronometrado de 30 minutos con cortes por sección, avisos a los 25 y 29 minutos y grabación de la propia voz.
- **Rúbrica**: autoevaluación con los indicadores oficiales y comparación con 2025.

Para las unidades didácticas, **el discurso es el mismo en las 12** y solo cambian los datos propios de cada una (título, fechas, situaciones de aprendizaje, criterios, actividades de cada semana…), que aparecen resaltados. Además hay:

- **Plantilla común** con los huecos marcados.
- **Diferencias y tarjetas**: tabla comparativa de las 12 UD y tarjetas de repaso de lo propio de cada una.
- **Guion A5** de cada UD (≤ 120 palabras, como permite la convocatoria) y **ficha** con los datos de la programación.
- **Sorteo**: tres bolas, eliges una, una hora de preparación y paso directo al ensayo de 30 minutos.

## Contenidos

- **Programación** («Aprendemos juntos»): 8 secciones, ≈3.800 palabras (≈29 min a 130 palabras/min; el audio va a ≈140 palabras/min y dura ≈27 min, para dejar margen para escribir en la pizarra).
- **Unidades didácticas**: plantilla común de 11 secciones (≈53 % de texto idéntico en las 12 UD) con 102 huecos para lo propio de cada unidad; cada UD dura entre 29,0 y 29,4 min a 130 palabras/min y su guion A5 tiene entre 105 y 117 palabras.
- Los discursos están escritos para nombrar cada indicador de las rúbricas oficiales, con más tiempo para lo que más pesa (secuencia didáctica, metodología, evaluación) y lo que más puntos perdió en 2025, y con más de tres citas normativas y bibliográficas (solo autores de la bibliografía de la programación).
- Cada ficha de UD incluye las erratas o incoherencias detectadas en la programación escrita (códigos de criterios, fechas, días lectivos…), para no repetirlas ante el tribunal.

## Cómo abrirla

- **En el ordenador**: abre `index.html` con doble clic (funciona sin servidor y sin conexión, salvo las tipografías).
- **En el móvil**: publica el repositorio con GitHub Pages (*Settings → Pages → Deploy from a branch*, rama principal, carpeta `/`) y abre la dirección que te dé GitHub.
- La grabación de voz y la comparación por micrófono necesitan un navegador con permiso de micrófono (Chrome o Edge recomendados).

El progreso (repasos, ensayos, autoevaluaciones) se guarda en el propio navegador; en *Ajustes* se puede copiar y llevar a otro dispositivo.

## Estructura

```
index.html, css/, js/          la aplicación (HTML + CSS + JavaScript sin dependencias)
datos/contenido.js, audio.js   datos generados para la app (no editar a mano)
contenido/programacion.json    discurso de la defensa de la programación
contenido/ud_plantilla.json    discurso común de las UD con huecos {{...}}, pizarra y guion
contenido/uds/udNN.json        valores de los huecos de cada UD
contenido/fichas/udNN.json     datos de cada UD extraídos de la programación
contenido/rubricas.json        rúbricas oficiales, pesos y notas de 2025
audio/*.mp3, audio/*.json      audios y marcas de tiempo por frase
herramientas/                  validación, construcción y generación de audio
```

## Editar los discursos

1. Edita los JSON de `contenido/` (formato en `herramientas/FORMATO.md`).
2. Comprueba duración y formato: `node herramientas/validar.mjs todo`
3. Lee el resultado como texto: `node herramientas/renderizar.mjs ud 7 --pizarra`
4. Regenera los datos de la app: `node herramientas/construir.mjs`
5. Si cambias el texto, regenera el audio (solo se sintetizan las frases nuevas):

```bash
pip install kokoro-onnx soundfile          # y ffmpeg instalado
bash herramientas/audio/preparar_modelo.sh ~/.cache/kokoro-es
python herramientas/audio/generar_audio.py --modelo ~/.cache/kokoro-es/kokoro-q8.onnx --voces ~/.cache/kokoro-es/voces-es.npz
node herramientas/construir.mjs
```

Si el audio de una exposición deja de coincidir con su texto, la app usa automáticamente la voz del navegador para esa exposición hasta que se regenere.

## Fuentes

- Programación didáctica «Aprendemos juntos», 3.º de Educación Primaria.
- *Determinación de los criterios de actuación de los tribunales y homogeneización*, Cuerpo de Maestros (597), convocatoria de la Orden de 21 de febrero de 2025 (Andalucía).
- Actilla de calificación de la segunda prueba (2025), usada para priorizar los apartados con más margen de mejora.

Los discursos se han redactado para cubrir de forma explícita cada indicador de las rúbricas oficiales. Revisa siempre la normativa y la convocatoria vigentes.
