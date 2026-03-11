Propuesta de Producto: Etendo SaaS — Edición Base + Enterprise

Fecha: 2026-03-06
Versión: 1.0
Fuentes: Análisis de Etendo ERP v0.11.1, Holded, Odoo 18 + Comparativa Etendo vs Holded

Resumen ejecutivo
Este documento presenta la propuesta funcional del nuevo Etendo SaaS, definiendo qué módulos componen la edición Base (producto estándar accesible para PyMEs) y qué funcionalidades se reservan para la edición Enterprise (empresas medianas-grandes con necesidades avanzadas).
La propuesta se fundamenta en el análisis exhaustivo de tres productos — Etendo ERP actual (370+ ventanas, 15 agentes IA), Holded (referente de UX y simplicidad SaaS) y Odoo 18 (líder open source con 170K+ clientes) — y busca combinar la profundidad funcional de Etendo con la accesibilidad y experiencia de usuario que el mercado SaaS demanda.
Principios rectores del nuevo Etendo SaaS:
Simplicidad por defecto, potencia bajo demanda — Formularios limpios con campos esenciales visibles; los campos avanzados se despliegan a pedido
Copilot IA como protagonista — Los agentes de IA no son un complemento: son la interfaz principal para tareas comunes
Sin paywalls en funcionalidades core — Todo lo que un negocio necesita para operar está en Base, sin costos ocultos
Consistencia visual y de interacción — Un patrón de UX uniforme en todos los módulos (inspirado en la consistencia de Odoo)
Onboarding guiado — Un nuevo usuario debe poder emitir su primera factura en menos de 10 minutos

Módulos — Etendo SaaS Base
La edición Base incluye 13 módulos que cubren el ciclo completo de operación de una PyME.

1. Dashboard
Descripción: Pantalla principal del ERP. Centro de mando que muestra el estado del negocio de un vistazo y permite acceder rápidamente a las acciones más comunes.
Flujo principal:
Usuario ingresa al ERP
       │
       ▼
┌─────────────────────────────────────────────────┐
│                   DASHBOARD                      │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Ingresos │ │  Gastos  │ │Beneficio │  KPIs  │
│  │ del mes  │ │ del mes  │ │   neto   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                  │
│  📈 Gráfico de tendencia (últimos 12 meses)     │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Acciones rápidas:                        │    │
│  │ [+ Factura] [+ Pedido] [+ Contacto]     │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Tareas pendientes:                       │    │
│  │ • 3 facturas por cobrar vencidas         │    │
│  │ • 2 pedidos pendientes de envío          │    │
│  │ • 1 factura de proveedor sin conciliar   │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ 🤖 Copilot: "¿Qué necesitás hacer hoy?" │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
Funcionalidades incluidas:
KPIs financieros (ingresos, gastos, beneficio neto) con comparativa vs período anterior
Gráfico de tendencia temporal (12 meses)
Accesos rápidos para crear documentos frecuentes
Panel de tareas pendientes / acciones requeridas (facturas vencidas, pedidos sin enviar, etc.)
Widgets personalizables (el usuario elige qué ver)
Copilot IA integrado como punto de entrada (permite operar via chat)
Lo nuevo vs Etendo actual:
Gráficos de tendencia (actual: widgets estáticos sin valores)
Accesos rápidos de creación (actual: no existen)
Tareas pendientes accionables (actual: no existe)
KPIs con comparativa temporal (actual: valores en cero en demo)
Copilot como entrada principal al sistema (actual: botón accesorio)
Widgets personalizables (actual: fijos)
Simplificaciones vs Etendo actual:
Se elimina el concepto de "dashboard vacío" — siempre muestra datos (reales o de ejemplo)
Se elimina el widget de "Aging Balance" del dashboard principal (se mueve a Contabilidad)

2. CRM (módulo nuevo)
Descripción: Gestión comercial pre-venta. Permite gestionar el pipeline de oportunidades desde el primer contacto hasta el cierre, con vista Kanban visual.
Flujo principal:
Lead/Oportunidad ingresa (manual, web, Copilot, importación)
       │
       ▼
┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌─────────┐
│  Nuevo   │───▶│  Contactado  │───▶│  Propuesta  │───▶│ Ganado  │
│          │    │              │    │  enviada    │    │         │
│ • Datos  │    │ • Llamada/   │    │ • Presupu-  │    │ • Se    │
│   básicos│    │   email reg. │    │   esto      │    │   convierte
│ • Origen │    │ • Necesidad  │    │   adjunto   │    │   en pedido
│ • Valor  │    │   detectada  │    │ • Negocia-  │    │   de venta
│   estimado    │ • Actividad  │    │   ción      │    │         │
└──────────┘    │   planificada│    └────────────┘    └─────────┘
                └──────────────┘           │
                                           ▼
                                     ┌─────────┐
                                     │ Perdido │
                                     │ • Motivo│
                                     └─────────┘
Funcionalidades incluidas:
Pipeline Kanban con etapas configurables y drag & drop
Tarjeta de oportunidad: contacto, valor estimado, probabilidad, prioridad, fecha esperada de cierre, vendedor asignado
Múltiples embudos (por equipo, producto, región)
Actividades programables (llamada, reunión, email, tarea) con recordatorios
Conversión automática: Oportunidad ganada → Pedido de venta
Vista Lista, Kanban y Calendario
Filtros por vendedor, etapa, periodo, prioridad
Reportes básicos: tasa de conversión, valor del pipeline, oportunidades por etapa
Integración con Contactos (auto-creación de Business Partner al ganar)
Lo nuevo vs Etendo actual:
Módulo completamente nuevo (Etendo actual solo tiene "CRM Connector" como integración)
Inspirado en: Pipeline Kanban de Holded + Vistas múltiples y drag & drop de Odoo + Prioridades con estrellas de Odoo

3. Ventas
Descripción: Ciclo completo de venta, desde el presupuesto hasta el cobro. Es el módulo transaccional principal para ingresos.
Flujo principal:
                    ┌─────────────────────────┐
                    │    CRM (Oportunidad      │
                    │    ganada) ──────────────┼──┐
                    └─────────────────────────┘  │
                                                  │
                                                  ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Presupuesto  │───▶│  Pedido de   │───▶│  Albarán     │
│ (Quotation)  │    │  Venta       │    │  de Salida   │
│              │    │  (Sales      │    │  (Goods      │
│ • Cliente    │    │   Order)     │    │   Shipment)  │
│ • Líneas     │    │              │    │              │
│ • Precios    │    │ • Confirma   │    │ • Genera     │
│ • Validez    │    │   precio y   │    │   movimiento │
│ • Enviar     │    │   condiciones│    │   de stock   │
│   al cliente │    │ • Reserva    │    │ • Entrega    │
│              │    │   stock      │    │   parcial o  │
│ [Aceptar]    │    │              │    │   total      │
└──────────────┘    └──────────────┘    └──────────────┘
                           │                    │
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │  Factura de  │◀───│ (Automático  │
                    │  Venta       │    │  o manual)   │
                    │              │    └──────────────┘
                    │ • Genera     │
                    │   asiento    │
                    │   contable   │
                    │ • Envío por  │
                    │   email      │
                    │ • PDF        │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Cobro      │
                    │   (Payment   │
                    │    In)       │
                    │              │
                    │ • Manual     │
                    │ • Pasarela   │
                    │   de pago    │
                    │ • Concilia-  │
                    │   ción banco │
                    └──────────────┘

Flujos alternativos:
─────────────────────
• Presupuesto → Factura directa (sin pedido)
• Pedido → Factura (sin albarán, para servicios)
• Factura directa (sin presupuesto ni pedido)
• Devolución de cliente → Nota de crédito
Funcionalidades incluidas:
Presupuestos: Creación, envío por email, seguimiento de estado, vencimiento, conversión a pedido
Pedidos de venta: Confirmación, reserva de stock, estados (Borrador → Confirmado → Cerrado)
Albaranes de salida: Entrega total o parcial, trazabilidad
Facturas de venta: Generación desde pedido (individual o masiva), factura directa, envío por email, PDF
Facturas recurrentes (nuevo): Programación de facturas automáticas (mensual, trimestral, anual)
Cobros: Registro manual o automático vía conciliación bancaria
Devoluciones: Proceso de devolución con nota de crédito vinculada
Notas de crédito: Vinculadas a factura original
Reportes: Ventas por periodo, por producto, por cliente, facturas pendientes de cobro
Lo nuevo vs Etendo actual:
Facturas recurrentes (inspirado en Holded)
Envío de factura por email directo desde el sistema (inspirado en Holded)
Cobros online via pasarela de pago (inspirado en Holded)
Chatter/notas integrado en cada documento (inspirado en Odoo)
Vista Kanban de presupuestos por estado (inspirado en Odoo)
KPIs en header: total presupuestado, total facturado, pendiente de cobro (inspirado en Odoo)
Simplificaciones vs Etendo actual:
Formulario de pedido: de 15+ campos a ~8 campos visibles por defecto (Cliente, Fecha, Líneas, Tarifa, Forma de pago, Almacén, Notas). Campos avanzados (Intercompany, Intrastat, Dimensiones, SII) se ocultan
Sub-tabs: de 7 a 3 visibles (Líneas, Impuestos, Pagos). Los tabs avanzados (Line Tax, Intrastat, Reserved Stock, Basic Discounts) pasan a modo expandido
Se unifican procesos masivos en un solo botón "Facturar seleccionados"
Se elimina "Commission Payment" del Base (→ Enterprise)
Tabs de localización (SII, Verifactu, TBAI) solo visibles si el país de la organización es España

4. Compras
Descripción: Ciclo completo de compras, desde la solicitud hasta el pago al proveedor. Incluye control de recepciones y conciliación básica.
Flujo principal:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Pedido de   │───▶│  Recepción   │───▶│  Factura de  │
│  Compra      │    │  de Mercancía│    │  Proveedor   │
│  (Purchase   │    │  (Goods      │    │  (Purchase   │
│   Order)     │    │   Receipt)   │    │   Invoice)   │
│              │    │              │    │              │
│ • Proveedor  │    │ • Verifica   │    │ • Match con  │
│ • Líneas     │    │   cantidad   │    │   pedido y   │
│ • Precios    │    │   recibida   │    │   recepción  │
│ • Fecha      │    │ • Recepción  │    │ • Genera     │
│   entrega    │    │   parcial o  │    │   asiento    │
│ • Almacén    │    │   total      │    │   contable   │
│   destino    │    │ • Actualiza  │    │              │
│              │    │   stock      │    │              │
│ [Confirmar]  │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │    Pago      │
                                        │  (Payment    │
                                        │   Out)       │
                                        │              │
                                        │ • Manual     │
                                        │ • Concilia-  │
                                        │   ción banco │
                                        └──────────────┘

Flujos alternativos:
─────────────────────
• Factura directa (sin pedido de compra — para gastos simples)
• Smart Scan: digitalizar factura con OCR/IA → factura de compra automática
• Devolución a proveedor → Nota de crédito
Funcionalidades incluidas:
Pedidos de compra: Creación, confirmación, seguimiento de entregas, estados
Recepción de mercancía: Recepción total o parcial, actualización de stock
Facturas de proveedor: Registro manual o desde OCR, vinculación con pedido/recepción
Smart Scan / OCR (nuevo): Digitalización automática de facturas via Copilot IA — se sube un PDF o imagen y el sistema extrae proveedor, fecha, líneas, importes
Pagos a proveedores: Registro manual o vía conciliación bancaria
Devoluciones: Proceso de devolución a proveedor con trazabilidad
Notas de crédito de proveedor
Reportes: Compras por periodo, por proveedor, facturas pendientes de pago, estado de pedidos
Lo nuevo vs Etendo actual:
Smart Scan / OCR para facturas (inspirado en Holded + potenciado por Copilot IA en lugar de OCR tradicional)
Email dedicado para recepción de facturas (inspirado en Holded)
Chatter/notas integrado en cada documento (inspirado en Odoo)
KPIs en header: total pedido, entregas a tiempo, pendiente de pago (inspirado en Odoo)
Flujo simplificado de gasto directo (factura sin pedido) para compras menores
Simplificaciones vs Etendo actual:
Se unifica "Inbound Receipt" y "Goods Receipt" en una sola ventana "Recepción de Mercancía"
Se elimina "Requisition" del Base (→ Enterprise) — en Base, el pedido es directo
Se elimina "Matched Purchase Invoices" como ventana separada — la conciliación se integra dentro de la factura
Se elimina "Landed Cost" del Base (→ Enterprise)
Formulario simplificado: ~7 campos visibles (Proveedor, Fecha, Líneas, Almacén destino, Forma de pago, Notas)

5. Inventario
Descripción: Gestión de stock, movimientos y almacenes. Versión Base cubre las necesidades de una PyME con uno o más almacenes.
Flujo principal:
                        ENTRADAS DE STOCK
                    ┌───────────────────────┐
                    │                       │
           ┌───────┴───────┐      ┌────────┴────────┐
           │  Recepción de │      │   Ajuste de     │
           │  compra       │      │   inventario    │
           │  (desde       │      │   (conteo       │
           │   Compras)    │      │    físico)      │
           └───────┬───────┘      └────────┬────────┘
                   │                       │
                   ▼                       ▼
           ┌─────────────────────────────────────┐
           │            STOCK ACTUAL              │
           │                                      │
           │  📦 Almacén Principal                │
           │     • Producto A: 150 uds            │
           │     • Producto B: 80 uds             │
           │                                      │
           │  📦 Almacén Secundario               │
           │     • Producto A: 30 uds             │
           │                                      │
           │  ┌─────────────────────────────┐    │
           │  │ Transferencia entre almacenes│    │
           │  │ (Goods Movement)             │    │
           │  └─────────────────────────────┘    │
           └─────────────────────────────────────┘
                   │                       │
                   ▼                       ▼
           ┌───────┴───────┐      ┌────────┴────────┐
           │  Albarán de   │      │   Consumo       │
           │  salida       │      │   interno       │
           │  (desde       │      │                 │
           │   Ventas)     │      │                 │
           └───────────────┘      └─────────────────┘
                        SALIDAS DE STOCK
Funcionalidades incluidas:
Consulta de stock: Stock actual por producto, por almacén, con filtros y búsqueda
Multi-almacén: Gestión de múltiples almacenes con stock independiente
Movimientos entre almacenes: Transferencias internas con trazabilidad
Inventario físico / Conteo: Ajuste de stock basado en conteo real
Consumo interno: Registro de consumos que no son ventas
Historial de movimientos: Log completo de entradas, salidas y ajustes por producto
Reportes: Stock actual, movimientos de producto, historial de stock, valoración de inventario básica
Alertas de stock mínimo (nuevo): Notificación cuando un producto baja del mínimo definido
Vistas: Lista de productos con stock, vista por almacén
Lo nuevo vs Etendo actual:
Dashboard de inventario tipo resumen visual (inspirado en Odoo)
Alertas de stock mínimo automáticas
Vista simplificada de "Stock actual" como pantalla principal del módulo
Integración con Copilot para consultas rápidas ("¿cuánto stock tengo del producto X?")
Simplificaciones vs Etendo actual:
Se eliminan del Base: Inventory Quality Inspection, Packing, Warehouse Picking List, Stock Reservation, Inventory Amount Update, Cost Adjustment, Referenced Inventory, Sales Order for Picking, Barcode Components Configuration, Advanced Warehouse → todo esto pasa a Enterprise
De 43 ventanas (14 transacciones + 13 reportes + 16 config) se reducen a ~10 ventanas esenciales
Configuración simplificada: crear almacén con nombre y dirección (sin Storage Bins avanzados en Base)

6. Contabilidad y Finanzas
Descripción: Gestión financiera completa para una PyME. Incluye facturación, cobros/pagos, conciliación bancaria, plan de cuentas y reportes fiscales básicos.
Flujo principal:
┌─────────────────────────────────────────────────────────┐
│                  TABLERO DE CONTABILIDAD                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ Ventas   │  │ Compras  │  │  Banco   │  │Impuestos││
│  │ Facturas │  │ Facturas │  │ Conciliar│  │ Declarar ││
│  │ por cobrar│  │ por pagar│  │ movimien-│  │          ││
│  │ [Nuevo]  │  │ [Subir]  │  │ tos      │  │          ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
└─────────────────────────────────────────────────────────┘

FLUJO DE CUENTAS POR COBRAR:
─────────────────────────────
Factura de venta → Vencimiento → Cobro → Conciliación bancaria
                                   │
                                   ▼
                            Asiento contable automático

FLUJO DE CUENTAS POR PAGAR:
─────────────────────────────
Factura de compra → Vencimiento → Pago → Conciliación bancaria
                                   │
                                   ▼
                            Asiento contable automático

FLUJO CONTABLE:
─────────────────
                    ┌──────────────┐
                    │  Documentos  │
                    │  (facturas,  │
                    │  cobros,     │
                    │  pagos)      │
                    └──────┬───────┘
                           │ Automático
                           ▼
                    ┌──────────────┐
                    │  Asientos    │
                    │  contables   │
                    │  (automáticos│
                    │  + manuales) │
                    └──────┬───────┘
                           │
                           ▼
            ┌──────────────┴──────────────┐
            │                             │
     ┌──────▼──────┐              ┌───────▼──────┐
     │   Balance   │              │  Estado de   │
     │   General   │              │  Resultados  │
     └─────────────┘              └──────────────┘
Funcionalidades incluidas:
Tablero de contabilidad (nuevo): Dashboard accionable con 4 áreas (Ventas, Compras, Banco, Impuestos) — inspirado directamente en Odoo
Facturas de venta: Creación, envío por email, estados (Borrador → Confirmada → Pagada)
Facturas de compra: Registro manual o vía Smart Scan/OCR
Notas de crédito (venta y compra)
Cobros (Payment In): Registro y vinculación con facturas
Pagos (Payment Out): Registro y vinculación con facturas
Cuentas bancarias: Alta de cuentas, conexión bancaria (donde esté disponible)
Conciliación bancaria: Matching automático y manual de movimientos
Plan de cuentas: Preconfigurado por país (localización)
Asientos contables: Automáticos (desde documentos) y manuales (Simple G/L Journal)
Balance general y Estado de resultados: Reportes estándar
Libro mayor básico
Reporte de IVA / impuestos básico
Aging reports: Facturas pendientes de cobro/pago por antigüedad
España: SII (Suministro Inmediato de Información — 7 ventanas), Verifactu (3 ventanas), TBAI

Lo nuevo vs Etendo actual:
Tablero de contabilidad accionable (inspirado en Odoo — actual no tiene)
Conexión bancaria directa (inspirado en Holded y Odoo — 26.000+ bancos)
Smart Scan / OCR para facturas de compra desde el módulo contable (inspirado en Odoo)
Wizard de configuración inicial contable: país → plan de cuentas → cuentas bancarias → impuestos (actual requiere navegar ~30 ventanas de setup)
Simplificaciones vs Etendo actual:
De ~97 ventanas (transacciones + reportes + config) se reducen a ~20 ventanas esenciales
Se elimina del Base: Budget, End Year Close, Remittances, Check Printing, Payment Execution, Payment Proposal, Doubtful Debt, Tax Payment avanzado → todo a Enterprise
Se elimina del Base: toda la sección SII (7 ventanas), Verifactu (3 ventanas) → Enterprise / Localización
Setup contable: de ~30 ventanas de configuración a 1 wizard guiado
Activos fijos y amortizaciones → Enterprise
Financial Type Configuration → oculto (preconfigurado)
Reportes: de 15+ a 6 esenciales (Balance, P&L, Libro Mayor, IVA, Aging Cobrar, Aging Pagar)

7. Contactos
Descripción: Directorio unificado de clientes, proveedores y contactos del negocio. Base de datos centralizada para toda la operación.
Flujo principal:
┌─────────────────────────────────────────────────────────┐
│              DIRECTORIO DE CONTACTOS                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Todos    │  │ Clientes │  │Proveedores│              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 👤 Empresa ABC S.L.                    ⭐      │    │
│  │    📧 contacto@empresa.com                      │    │
│  │    📞 +34 91 234 5678                           │    │
│  │    📍 Madrid, España                            │    │
│  │    Tags: [Cliente] [VIP]                        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Vistas: [Lista] [Kanban] [Mapa]                        │
└─────────────────────────────────────────────────────────┘

Al abrir un contacto:
─────────────────────
┌─────────────────────────────────────────────┐
│ Empresa ABC S.L.                             │
│                                              │
│ [Datos generales] [Direcciones] [Contactos]  │
│                                              │
│  Nombre comercial: ABC                       │
│  CIF/NIF: B12345678                          │
│  Categoría: Cliente Premium                  │
│  Tarifa: General                             │
│  Forma de pago: Transferencia 30 días        │
│  Email: contacto@empresa.com                 │
│  Teléfono: +34 91 234 5678                   │
│                                              │
│  ── Resumen de actividad ──                  │
│  Última venta: 15/02/2026 — $4.500           │
│  Total facturado (12m): $52.000              │
│  Saldo pendiente: $3.200                     │
│                                              │
│  💬 Chatter: Notas y mensajes               │
└─────────────────────────────────────────────┘
Funcionalidades incluidas:
Ficha unificada de contacto (un registro puede ser cliente y proveedor a la vez, como en Etendo actual)
Datos esenciales visibles: Nombre, CIF/NIF, categoría, email, teléfono, dirección, foto/avatar
Múltiples direcciones por contacto (facturación, envío, etc.)
Múltiples personas de contacto por empresa
Condiciones comerciales: Tarifa de precios, forma de pago, términos de pago
Resumen de actividad (nuevo): Última venta, total facturado, saldo pendiente — visible al abrir el contacto
Tags / Etiquetas para clasificación libre
Vistas: Lista, Kanban con avatar, Mapa (nuevo, inspirado en Odoo)
Chatter (nuevo): Notas y mensajes sobre el contacto
Búsqueda global: Encontrar contactos desde cualquier lugar del ERP
Integración con CRM: Los contactos se vinculan automáticamente a oportunidades
Lo nuevo vs Etendo actual:
Avatar / foto del contacto (actual no tiene)
Resumen de actividad comercial en la ficha (actual no tiene)
Vista Mapa (inspirado en Odoo)
Chatter / notas integradas (inspirado en Odoo)
Tags / etiquetas libres (actual usa solo categorías)
Simplificaciones vs Etendo actual:
De 11 sub-tabs se reducen a 3 visibles: Datos generales, Direcciones, Contactos
Se ocultan: Bank Account, Document Type, Basic Discount, Rappel, Customer Accounting, Intrastat → accesibles desde "Más opciones" o vía Enterprise
Columnas del grid por defecto: Nombre, Email, Teléfono, Categoría, Saldo pendiente (actuales poco útiles)

8. Productos
Descripción: Catálogo de productos y servicios. Base de datos central para todo lo que la empresa vende, compra o fabrica.
Flujo principal:
┌─────────────────────────────────────────────────────────┐
│                CATÁLOGO DE PRODUCTOS                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Todos   │  │ Productos│  │ Servicios│              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 📦 Cerveza Ale 0,5L              Stock: 150    │    │
│  │    SKU: BEER-ALE-05                             │    │
│  │    Categoría: Bebidas                           │    │
│  │    Precio venta: $4,50                          │    │
│  │    Precio compra: $2,20                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Vistas: [Lista] [Kanban con foto]                      │
└─────────────────────────────────────────────────────────┘

Ficha de producto:
──────────────────
┌─────────────────────────────────────────────┐
│ 📷 Cerveza Ale 0,5L                         │
│                                              │
│ [General] [Precios] [Stock] [Compra]         │
│                                              │
│  Nombre: Cerveza Ale 0,5L                    │
│  SKU / Referencia: BEER-ALE-05               │
│  Tipo: Producto almacenable                  │
│  Categoría: Bebidas > Cervezas               │
│  Unidad de medida: Unidad                    │
│  Precio de venta: $4,50                      │
│  Impuesto de venta: IVA 21%                  │
│                                              │
│  Tab Precios: Tarifas aplicables             │
│  Tab Stock: Stock por almacén                │
│  Tab Compra: Proveedor, precio compra, plazo │
│                                              │
│  💬 Chatter: Notas                           │
└─────────────────────────────────────────────┘
Funcionalidades incluidas:
Ficha de producto simplificada: Nombre, SKU, categoría, tipo (producto/servicio), unidad de medida, precio venta, impuesto, foto
Tipos: Producto almacenable (con stock), Servicio (sin stock), Consumible
Categorías jerárquicas
Precios: Precio de venta, precio de compra, múltiples tarifas
Stock: Visualización de stock por almacén (lectura desde Inventario)
Datos de compra: Proveedor preferido, precio de compra, plazo de entrega
Foto del producto (nuevo)
Vista Kanban con foto (nuevo)
Variantes de producto (talle, color, etc.)
Búsqueda rápida por nombre, SKU, categoría
Lo nuevo vs Etendo actual:
Foto del producto visible en ficha y Kanban (actual no tiene)
Vista Kanban de productos (actual solo grid)
Stock visible directamente en la ficha del producto
Chatter / notas (inspirado en Odoo)
Simplificaciones vs Etendo actual:
De 14 sub-tabs se reducen a 4 visibles: General, Precios, Stock, Compra
Se ocultan del Base: Accounting, Costing Rule, Costing, Manufacturing (BOM), Translation, Characteristics, Barcode, Stock by Logistic Units, Intrastat, Transaction Adjustments → Enterprise o "Más opciones"

9. RRHH Básico (módulo nuevo)
Descripción: Gestión básica de empleados, control horario y ausencias. Cubre las necesidades mínimas de una PyME para administrar su equipo.
Flujo principal:
┌─────────────────────────────────────────────────────────┐
│                    EQUIPO                                 │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Empleados │  │ Horarios │  │ Ausencias│              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘

DIRECTORIO DE EMPLEADOS:
────────────────────────
┌──────────────────────────────────────────────┐
│  👤 Ana García          Departamento: Ventas │
│     📧 ana@empresa.com                       │
│     📞 +34 612 345 678                       │
│     📅 Antigüedad: 2 años                   │
│     Puesto: Ejecutiva de cuentas             │
└──────────────────────────────────────────────┘

CONTROL HORARIO:
────────────────
┌───────────────────────────────────────┐
│  [▶ Fichar entrada]  [⏹ Fichar salida] │
│                                         │
│  Hoy: 8:30 — (en curso)               │
│  Esta semana: 32h 15min / 40h          │
│                                         │
│  Lun: 8:00 - 17:00 (8h)               │
│  Mar: 8:30 - 17:30 (8h)               │
│  Mié: 8:15 - 17:15 (8h)               │
│  Jue: 8:30 - (en curso)               │
└───────────────────────────────────────┘

GESTIÓN DE AUSENCIAS:
─────────────────────
Solicitud de ausencia → Aprobación → Registro en calendario
     │                       │
     │ • Tipo: Vacaciones,   │ • Aprobador:
     │   Enfermedad,         │   Manager del
     │   Personal            │   departamento
     │ • Fechas              │
     │ • Días disponibles    │
     └───────────────────────┘
Funcionalidades incluidas:
Directorio de empleados: Ficha con datos personales, departamento, puesto, fecha de alta, contacto
Departamentos: Estructura organizacional básica
Control horario: Fichaje de entrada/salida, registro semanal/mensual, resumen de horas
Gestión de ausencias: Solicitud, aprobación, tipos configurables (vacaciones, enfermedad, personal), calendario de ausencias del equipo
Vista Kanban de empleados por departamento
Calendario de ausencias del equipo
Lo nuevo vs Etendo actual:
Módulo completamente nuevo (Etendo actual solo tiene "Employee" como dato dentro de Business Partner, sin funcionalidad RRHH)
Inspirado en: Control horario de Holded + Directorio Kanban de Odoo + Gestión de ausencias de Odoo

10. Proyectos
Descripción: Gestión de proyectos, tareas y seguimiento de tiempo. Permite organizar el trabajo del equipo y medir la rentabilidad de cada proyecto.
Flujo principal:
┌──────────────┐    ┌──────────────────────────────────────┐
│   Crear      │───▶│          PROYECTO                     │
│   Proyecto   │    │                                       │
│              │    │  Nombre: Implementación CRM            │
│ • Nombre     │    │  Cliente: Empresa ABC                  │
│ • Cliente    │    │  Responsable: Ana García               │
│ • Responsable│    │  Presupuesto: $15.000                  │
│ • Presupuesto│    │  Estado: En curso                      │
│ • Fechas     │    │                                       │
└──────────────┘    │  ┌──────────────────────────────────┐ │
                    │  │         TABLERO KANBAN            │ │
                    │  │                                    │ │
                    │  │ Por hacer │ En curso │ Hecho      │ │
                    │  │ ┌───────┐ │┌───────┐│┌───────┐   │ │
                    │  │ │Tarea 1│ ││Tarea 3│││Tarea 2│   │ │
                    │  │ │ 3h    │ ││ 5h    │││ 8h    │   │ │
                    │  │ │ Ana   │ ││ Pedro │││ Ana   │   │ │
                    │  │ └───────┘ │└───────┘│└───────┘   │ │
                    │  │ ┌───────┐ │         │            │ │
                    │  │ │Tarea 4│ │         │            │ │
                    │  │ │ 2h    │ │         │            │ │
                    │  │ │ María │ │         │            │ │
                    │  │ └───────┘ │         │            │ │
                    │  └──────────────────────────────────┘ │
                    │                                       │
                    │  Horas: 18h / 50h presupuestadas      │
                    │  Costo: $3.600 / $15.000 presupuesto  │
                    │  Margen: 76%                           │
                    └───────────────────────────────────────┘
Funcionalidades incluidas:
Proyectos: Creación con nombre, cliente, responsable, fechas, presupuesto
Tareas: Gestión con tablero Kanban (columnas configurables), asignación, horas estimadas/reales
Seguimiento de tiempo: Registro de horas por tarea
Gastos de proyecto: Registro de gastos vinculados al proyecto
Rentabilidad (mejorado): Cálculo automático de costo vs presupuesto vs facturado
Vistas: Kanban de proyectos, Kanban de tareas, Lista, Calendario (nuevo)
Calificación (nuevo): Sistema de satisfacción del cliente por proyecto (inspirado en Odoo)
Lo nuevo vs Etendo actual:
Tablero Kanban para tareas (actual solo tiene vista de ventana)
Seguimiento de tiempo visual (actual tiene Expense Sheet pero no time tracking)
Vista Calendario de tareas (nuevo)
Calificación de proyecto (inspirado en Odoo)
Simplificaciones vs Etendo actual:
Se simplifica "Multiphase Project" a un modelo más intuitivo (proyecto → tareas con Kanban)
Se eliminan procesos específicos del Base: "Create Sales Orders from Expenses", "Create AP Expense Invoices" → Enterprise

11. Documentos / DMS (módulo nuevo)
Descripción: Gestor documental integrado en el ERP. Permite almacenar, organizar y compartir archivos del negocio sin necesidad de herramientas externas.
Flujo principal:
┌─────────────────────────────────────────────────────────┐
│                    DOCUMENTOS                            │
│                                                          │
│  📁 Mi empresa                                          │
│  ├── 📁 Finanzas                                        │
│  │   ├── 📁 Facturas de venta                           │
│  │   ├── 📁 Facturas de compra                          │
│  │   └── 📁 Extractos bancarios                         │
│  ├── 📁 Contratos                                       │
│  ├── 📁 RRHH                                            │
│  │   ├── 📁 Contratos laborales                         │
│  │   └── 📁 Nóminas                                     │
│  ├── 📁 Proyectos                                       │
│  └── 📁 General                                         │
│                                                          │
│  [Subir archivo] [Nueva carpeta] [Buscar...]            │
│                                                          │
│  Vistas: [Kanban] [Lista]                               │
└─────────────────────────────────────────────────────────┘

Carpetas auto-vinculadas:
─────────────────────────
• Las facturas de venta se almacenan automáticamente en Finanzas/Facturas de venta
• Los adjuntos de un pedido se vinculan al documento original
• Los contratos de empleados se almacenan en RRHH
Funcionalidades incluidas:
Carpetas jerárquicas organizadas por área funcional (preconfiguradas)
Subida de archivos: Drag & drop, múltiples formatos
Vinculación automática: Los PDFs de facturas, pedidos y otros documentos se almacenan automáticamente en la carpeta correspondiente
Búsqueda por nombre de archivo, tipo, fecha
Vistas: Kanban (con preview) y Lista
Compartir archivos con link (lectura)
Lo nuevo vs Etendo actual:
Módulo completamente nuevo (Etendo actual solo tiene "Attachments" por documento individual, sin DMS centralizado)
Inspirado en: DMS de Odoo con carpetas por área funcional + organización tipo Google Drive


