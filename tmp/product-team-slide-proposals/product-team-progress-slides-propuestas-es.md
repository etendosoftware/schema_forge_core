# Propuesta de slides: avances del equipo de Producto

Fuente narrativa: `/Users/sebastianbarrozo/Documents/product-team-progress-presentacion-es.md`  
Duración objetivo: 10 a 15 minutos  
Audiencia: técnica, pero no necesariamente expuesta al trabajo diario de Schema Forge / NEO / ERP agéntico  
Idioma: español

---

## Criterio general

La presentación debería sentirse como una actualización ejecutiva-técnica: clara, concreta y basada en evidencia. La idea no es explicar cada detalle interno de Schema Forge, sino mostrar que estamos construyendo una versión de Etendo ERP más agéntica, simple y atractiva, o "sexy" en términos de producto, apoyada en una metodología repetible para convertir metadata del ERP en producto verificable.

Recomendación de tono visual:

- fondos claros o neutros;
- poco texto por slide;
- diagramas simples;
- métricas grandes y legibles;
- evitar slides densas tipo documento;
- usar notas del presentador para el discurso largo.

---

# Propuesta seleccionada: hilo conductor en 11 slides

La presentación necesita funcionar como una historia, no como una lista de temas. El hilo conductor propuesto es:

```txt
Etendo ya tiene profundidad funcional
  -> el problema es hacerlo más simple y moderno de operar
  -> no lo reescribimos: construimos Etendo GO como capa sobre Etendo Classic
  -> Schema Forge convierte metadata en producto verificable
  -> la herramienta todavía está en refinamiento
  -> esa base ya existe con datos concretos
  -> ahora la extendemos a UI humana y operación agéntica
  -> validamos con resultados, uso real y trazabilidad
```

---

## Slide 1: La oportunidad

### Título

Etendo tiene profundidad; el desafío es hacerlo más operable

### Subtítulo

Producto, UI y agentes sobre una misma base funcional

### Mensaje central

El objetivo no es reemplazar la potencia de Etendo. Es convertirla en una experiencia más simple, atractiva y operable en Etendo GO: usuarios humanos, APIs, herramientas y agentes sobre una misma base funcional.

### Contenido en slide

- Etendo Classic ya concentra reglas, procesos, permisos y consistencia transaccional.
- El problema de producto es reducir fricción sin perder profundidad funcional.
- La oportunidad es crear una capa moderna: simple para humanos y operable para agentes.

### Nota del presentador

Abriría con esta idea para ordenar toda la presentación. No estamos empezando desde una hoja en blanco ni intentando competir contra Etendo Classic. Estamos usando esa profundidad como ventaja y construyendo una experiencia de producto más simple, configurable y "sexy" encima.

---

## Slide 2: Tesis de producto

### Título

Etendo GO: agéntico, simple y configurable

### Subtítulo

Una capa de software sobre Etendo Classic, no una reescritura desde cero

### Mensaje central

Estamos construyendo Etendo GO como una nueva capa de producto: aprovecha la plataforma existente y la adapta a una forma moderna de operar el ERP.

### Contenido en slide

```txt
Etendo Classic
  -> capa de producto
  -> NEO Headless
  -> UI simplificada
  -> tools agénticas
  -> validación y observabilidad
```

Norte de posicionamiento:

- más simple de usar que un ERP tradicional complejo;
- más directo y atractivo como producto;
- más simple que Odoo como aspiración de UX;
- más configurable que Holded como aspiración de producto;
- con la profundidad funcional de Etendo por debajo.

### Nota del presentador

Esta slide evita una confusión importante: no estamos reescribiendo Etendo Classic. Estamos construyendo una capa que se apoya en sus reglas, entidades, procesos y permisos. La promesa es que el usuario no tenga que sufrir toda la complejidad del ERP clásico para obtener su valor.

---

## Slide 3: Qué es Etendo GO

### Título

Etendo GO es la nueva capa de operación del ERP

### Subtítulo

UI simplificada, contratos, NEO y herramientas agénticas sobre Etendo Classic

### Mensaje central

Etendo GO no duplica la lógica central ni reemplaza Etendo Classic. Ordena las nuevas superficies de operación del ERP: UI humana, APIs, automatizaciones, tools y agentes.

### Contenido en slide

```txt
Core ERP
  -> reglas + datos + procesos

Etendo GO
  -> UI enfocada
  -> APIs y contratos
  -> tools agénticas
  -> métricas de uso
```

### Nota del presentador

Esta slide le da sentido al nombre real del producto. Etendo GO es la capa donde ocurre la operación moderna: humanos que necesitan pantallas simples, agentes que necesitan herramientas, y Producto que necesita observar qué pasa para mejorar.

---

## Slide 4: Cómo lo hacemos

### Título

Schema Forge convierte metadata del ERP en producto

### Subtítulo

La metodología que conecta Etendo Classic con Etendo GO

### Mensaje central

Schema Forge nos permite partir de metadata real del ERP y convertirla en decisiones de producto, contratos, UI, tools, pruebas y documentación.

### Contenido en slide

```txt
Metadata de Etendo
  -> extracción
  -> decisiones de producto
  -> contratos frontend/backend
  -> configuración NEO
  -> UI React
  -> tools agénticas
  -> pruebas y documentación
```

### Nota del presentador

El valor no está solamente en generar código. El valor está en hacer explícitas las decisiones: qué campos se muestran, cuáles son editables, qué reglas se mantienen, qué procesos se exponen, qué necesita UX custom y qué se valida automáticamente.

---

## Slide 5: Por qué esta metodología importa

### Título

El ERP no escala si cada pantalla se redescubre a mano

### Subtítulo

Necesitamos trazabilidad desde la metadata hasta la experiencia final

### Mensaje central

Un ERP tiene demasiada superficie funcional para depender de análisis, diseño, implementación y documentación artesanal en cada pantalla.

### Contenido en slide

- Ventas, compras, inventario, finanzas y contactos.
- Procesos, reportes, estados y documentos relacionados.
- Reglas contables, permisos, defaults y validaciones.
- Decisiones de producto que deben quedar auditables.

### Nota del presentador

Schema Forge cambia el costo de escala porque deja trazabilidad. No se pierde el porqué de cada decisión y se puede repetir el proceso con una secuencia clara: DEV, REVIEW, QA y DOCS.

---

## Slide 6: Autocrítica necesaria

### Título

Schema Forge nos trajo hasta acá, pero todavía está en refinamiento

### Subtítulo

No estamos mostrando una herramienta cerrada, sino una metodología viva

### Mensaje central

La herramienta ya nos permitió modelar una parte importante de Etendo GO, pero todavía estamos mejorando su precisión, cobertura, criterios de generación, validaciones y documentación.

### Contenido en slide

Qué estamos refinando:

- calidad de decisiones generadas y curadas;
- consistencia entre contratos, UI, NEO y documentación;
- cobertura de reglas de negocio y edge cases;
- soporte para ventanas, reportes, dashboards y tools;
- validación automática y pruebas E2E;
- claridad para que humanos y agentes usen la misma base funcional.

### Nota del presentador

Esta autocrítica es importante. Schema Forge no es una caja mágica terminada. Es una herramienta y una metodología que nos permitió llegar a una escala que antes habría sido mucho más costosa, pero justamente por eso ahora vemos mejor sus límites. Cada ventana, cada contrato, cada prueba y cada validación agéntica nos devuelve información para mejorar la herramienta.

---

## Slide 7: Evidencia de avance

### Título

Ya hay una base amplia, no una prueba aislada

### Subtítulo

Etendo GO ya tiene superficie modelada, generada y documentada

### Mensaje central

El repositorio muestra una base concreta de artefactos, contratos, entidades, campos y guías funcionales.

### Contenido en slide

| Métrica | Valor |
|---|---:|
| Artefactos | 80 |
| Contratos de ventanas | 53 |
| Contratos de reportes | 17 |
| Contratos agregados / dashboards | 11 |
| Entidades modeladas | 142 |
| Campos expuestos | 1.321 |
| Guías funcionales documentadas | 40 |

### Nota del presentador

Estos números cambian la conversación. No estamos mostrando una intención metodológica, sino una base considerable de superficie del ERP ya modelada para producto.

---

## Slide 8: Calidad y aprendizaje con IA

### Título

La IA acelera, pero exige reglas más explícitas

### Subtítulo

Velocidad sin precisión funcional produce inconsistencia

### Mensaje central

Cuando usamos IA para desarrollar más rápido, cada regla de negocio, fuente de verdad y criterio de validación tiene que estar escrito con más precisión.

### Contenido en slide

Ejemplo:

```txt
descuento = base imponible * porcentaje de descuento
total línea = base imponible - descuento + impuestos aplicables
```

Hay que definir:

- sobre qué monto se calcula;
- cuándo se aplica;
- qué redondeo usamos;
- qué valida backend;
- qué muestra frontend.

### Nota del presentador

El rol humano se desplaza: describe el comportamiento esperado, solicita el cambio, valida si lo generado cumple y aplica criterio sobre UX, negocio y riesgo. Schema Forge ayuda porque convierte esas decisiones en contratos, pruebas y documentación.

---

## Slide 9: La dimensión agéntica

### Título

El humano usa UI; el agente usa tools

### Subtítulo

Agent-first no significa una pantalla para robots

### Mensaje central

Un ERP agéntico no es un chatbot sobre el ERP. Es una capa donde agentes pueden descubrir capacidades, usar herramientas, ejecutar acciones controladas y verificar resultados dentro de reglas de negocio.

### Contenido en slide

```txt
Humano -> UI -> experiencia guiada
Agente -> tools -> acciones con contexto
```

Términos útiles:

- **Agentic ERP:** ERP con agentes capaces de percibir contexto, razonar, actuar y verificar dentro de límites definidos.
- **Agentic workflow:** flujo orientado a objetivos, con herramientas, estado, manejo de errores, escalamiento y observabilidad.
- **Agent-first:** capacidades expuestas como tools/APIs con contratos claros, no pantallas que el agente intenta imitar.

### Nota del presentador

Esta slide entra recién después de explicar la base, porque ahí se entiende mejor: Etendo GO no solo simplifica la UI humana, también expone capacidades operables por agentes. El agente no debería "llenar una pantalla"; debería usar herramientas con contexto y verificación.

---

## Slide 10: Estado de la versión agéntica

### Título

Ya tenemos una primera versión agéntica en validación

### Subtítulo

Estamos probando si el agente puede completar tareas reales, no si conversa bien

### Mensaje central

La validación empieza sobre capacidades reales del ERP: discovery, schemas, defaults, resolución de IDs, ejecución mínima y lectura del resultado.

### Contenido en slide

Estamos validando:

- discovery de capacidades del ERP;
- consulta de schemas, campos requeridos y defaults;
- resolución de datos humanos a IDs reales;
- ejecución mínima mediante tools;
- lectura del resultado desde el ERP;
- comparación contra el objetivo original.

### Nota del presentador

El punto importante es que la versión agéntica no arranca desde cero. Arranca desde la misma base de contratos y metadata. Todavía estamos validando alcance, límites, calidad de contratos y comportamiento ante errores, pero ya existe una superficie inicial que permite aprender con casos reales.

---

## Slide 11: Cierre y siguiente aprendizaje

### Título

Medir uso real para decidir mejor

### Subtítulo

La próxima etapa es observabilidad de humanos y agentes

### Mensaje central

No vamos a medir solo si una pantalla existe o si un agente responde. Vamos a observar qué hacen humanos y agentes, interpretar esas señales y convertirlas en decisiones de producto.

### Contenido en slide

```txt
uso real
  -> métricas
  -> interpretación de producto
  -> decisiones
  -> mejora del sistema
```

Preguntas de validación:

- ¿La UI reduce fricción para el usuario?
- ¿El agente elige la tool correcta?
- ¿Resuelve datos reales sin inventar?
- ¿Ejecuta lo mínimo necesario?
- ¿Verifica el resultado contra el objetivo?

### Nota del presentador

El cierre es que estamos construyendo Etendo GO como una capa sobre Etendo: más simple y atractiva para humanos, más operable para agentes y más observable para Producto. La meta no es decir "hicimos una demo", sino tener evidencia para saber qué mejorar después.
