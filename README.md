# Integración numérica aplicada — ejercicios 19 al 27

Proyecto académico para **COM-254 Métodos Numéricos**. Implementa los ejercicios 19–27 del desafío de integración numérica mediante Angular, TypeScript y Tailwind CSS.

## Tecnologías

- Angular 21.2.4
- TypeScript 5.9.3
- Tailwind CSS 3.4.19
- PostCSS 8.5.6
- Autoprefixer 10.4.21
- Zone.js 0.16.3

Se usa la misma combinación estable aplicada en los proyectos académicos anteriores, evitando la mezcla Tailwind 3/Tailwind 4 que había producido problemas de estilos y dependencias.

## Funcionalidad principal

- Selector de ejercicios 19–27.
- Datos tabulados editables sin reconstruir las filas mientras se escribe.
- Funciones, límites, parámetros y número de subintervalos editables.
- Trapecio compuesto.
- Simpson 1/3 con validación de `n` par.
- Simpson 3/8 con validación de `n` múltiplo de 3.
- Simpson combinado 1/3 + 3/8 para casos como `n = 7`.
- Simpson 1/3 + trapecio final para el ejercicio 21.
- Tabla de pesos efectivos y contribuciones.
- Comparación automática entre métodos compatibles.
- Error absoluto y porcentual cuando existe valor de referencia.
- Gráfico SVG con nodos y área bajo la curva.
- Prueba académica con `f(x)=x²` en `[0,2]`.
- Ejercicio 27 con selector entre volumen y superficie simplificada.
- Ejercicio 26 preparado para introducir las anchuras digitalizadas sin inventar datos.

## Resultados de referencia iniciales

| Ejercicio | Trapecio | Simpson / referencia |
|---|---:|---:|
| 19 | 0.147083 mi | 0.147072 mi (combinado) |
| 20 | 4.544000 lb·in | 4.577167 lb·in (combinado) |
| 21 | 36.400000 u² | 36.850000 u² (1/3 + trapecio) |
| 22 | 44.042044 ft | 43.899213 ft; exacto 43.898841 |
| 23 | 11.681778 in³/s | 12.151244 in³/s; exacto 12.828170 |
| 24 | 78.969264 | 80.010767; exacto 80 |
| 25 | 3.48662008e9 J | 3.48623690e9 J; ref. 3.486236787e9 J |
| 26 | depende de anchuras | referencia 9940 mi² |
| 27 | 199.404740 in³ | 201.842092 in³ |

## Instalación

```bash
npm install
npm start
```

Luego abrir `http://localhost:4200`.

No debería ser necesario utilizar `--force` ni `--legacy-peer-deps`.

## Compilación

```bash
npm run build
```

Salida de producción:

```text
dist/integracion-numerica-la-paz/browser
```

## Nota sobre el ejercicio 26

El documento fuente no incluye la tabla común de anchuras medidas en la figura. Por ello la aplicación conserva las posiciones `x = 40, 60, ..., 260` mi pero deja las anchuras vacías. El área de referencia `9940 mi²` se usa únicamente para calcular el error una vez introducidos datos reales de digitalización.

## Nota sobre el ejercicio 27

La expresión `S = 2π∫r dz` se presenta como **superficie simplificada**, no como área superficial exacta. El área de revolución real requiere el factor `sqrt(1 + (r')²)`.
