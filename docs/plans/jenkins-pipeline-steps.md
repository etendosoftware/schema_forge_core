# Jenkins Pipeline - Schema Forge Setup

## Pasos a ejecutar

### 1. Clonar y alinear repositorios
- Clonar: `schema_forge`, `etendo_core`, `com.etendoerp.go`
- Alinear las ramas en los tres repositorios (misma rama en todos)

### 2. Crear la base de datos
- Ejecutar: `./gradlew install` en Etendo root
- La base de datos queda disponible y lista para usar
- No es necesario levantar Tomcat ni ningún servicio

### 3. Regenerar y sincronizar schema_forge
- Ir al directorio `schema_forge`
- Ejecutar: `make regen PUSH_TO_NEO=1 ONLY=<windows-affected>`

### 4. Exportar configuración a la base de datos
- Ir a Etendo root
- Ejecutar: `./gradlew export.database`

### 5. Validación de cambios locales
- Verificar que NO haya cambios sin commitear en:
  - `schema_forge`
  - `com.etendoerp.go`
- Si hay cambios, imprimir en el log los `git diff` de ambos repositorios


