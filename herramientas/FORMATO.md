# Formato de los contenidos

Todos los textos se escriben en español de España, en registro ORAL (es un discurso para
memorizar y decir en voz alta ante un tribunal). Ritmo de referencia: 130 palabras/minuto.

## contenido/programacion.json  (Parte A: defensa de la programación, máx. 30 min)

```json
{
  "id": "programacion",
  "titulo": "Defensa de la programación didáctica «Aprendemos juntos»",
  "objetivoMinutos": 28.5,
  "secciones": [
    {
      "id": "p1",                                  // p1, p2, ... únicos
      "titulo": "Introducción y justificación",    // título corto (se usa en el índice)
      "rubrica": ["Introducción y justificación"], // ítems de la rúbrica de DEFENSA PD que cubre
      "minutos": 2.5,                              // minutos objetivo de la sección
      "esquema": ["...", "..."],                   // 3-8 viñetas: el esquema para memorizar
      "bloques": [
        {
          "id": "p1b1",                            // único en todo el fichero
          "texto": "Párrafo del discurso (40-130 palabras).",
          "pizarra": [                              // lo que se escribe en la pizarra en ese momento (puede ser [])
            { "zona": "cabecera|indice|centro|normativa", "texto": "...", "caja": "Título de caja (solo zona centro)" }
          ]
        }
      ]
    }
  ]
}
```

## contenido/ud_plantilla.json  (Parte B: exposición de UNA unidad didáctica, máx. 30 min)

Igual que el anterior, pero los textos (bloques y pizarra) contienen huecos `{{id_hueco}}` que se
rellenan con los valores de cada UD. Además:

```json
{
  "id": "ud_plantilla",
  "objetivoMinutos": 28.5,
  "huecos": [
    { "id": "titulo", "descripcion": "Qué va aquí y con qué forma gramatical", "ejemplo": "Somos un equipo", "palabras": [2, 8] }
  ],
  "secciones": [ ... como arriba, ids u1, u2 ... y bloques u1b1 ... ],
  "guion": "Guion DIN A5 con huecos (máx. 120 palabras una vez rellenado)"
}
```

- `palabras`: [mínimo, máximo] de palabras que debe tener el valor del hueco.
- Ids de hueco: minúsculas, dígitos y guion bajo.

## contenido/uds/udNN.json  (valores de cada UD)

```json
{
  "numero": 1,
  "titulo": "Somos un equipo",
  "trimestre": 1,
  "fechas": "Del 10 al 27 de septiembre",
  "dias": 14,
  "valores": { "id_hueco": "valor", ... }   // TODOS los huecos de la plantilla
}
```

## contenido/fichas/udNN.json  (ficha extraída literalmente de la programación)
Ver el esquema que se usa en la extracción (datos fieles al documento, sin inventar).

## Pizarra
Zonas: `cabecera` (título arriba, ancho completo), `indice` (columna izquierda: índice numerado de la
exposición), `centro` (zona central, agrupada en cajas con `caja`), `normativa` (columna derecha:
normativa y autores citados). Frases MUY cortas (máx. ~10 palabras), como se escribirían a mano.
