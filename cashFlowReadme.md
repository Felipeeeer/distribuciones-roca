# 📊 Submódulo de Flujo de Caja - Distribuciones ROCA

## Descripción General

El submódulo de Flujo de Caja es una herramienta integral para el análisis cronológico de movimientos de dinero en la empresa. Permite visualizar, filtrar y analizar de forma clara todos los ingresos y egresos del negocio.

## 🎯 Características Principales

### ✅ Funcionalidades Implementadas

1. **Visualización Cronológica**
   - Movimientos ordenados por fecha y hora
   - Vista detallada (movimiento por movimiento)
   - Vista resumida (totales diarios)

2. **Cálculo de Saldo en Tiempo Real**
   - Saldo acumulado después de cada movimiento
   - Saldo inicial para rangos de fechas específicos
   - Actualización automática

3. **Filtros Avanzados**
   - Rango de fechas personalizable
   - Filtros por tipo de movimiento
   - Búsqueda por concepto

4. **Análisis y Estadísticas**
   - Total de ingresos y egresos
   - Promedios y tendencias
   - Indicadores de liquidez

5. **Integración Completa**
   - Sincronización con ventas y compras existentes
   - Actualización en tiempo real
   - Diseño consistente con el sistema

## 🏗️ Arquitectura del Sistema

### Archivos Principales

```
public/js/
├── services/
│   └── cashFlowService.js      # Lógica de negocio y datos
├── components/
│   └── cashFlowComponent.js    # Interfaz de usuario
├── utils/
│   └── cashFlowUtils.js        # Utilidades y formateo
└── modules/
    └── finanzas.js             # Integración principal
```

### Servicios (`cashFlowService.js`)

**Funciones Principales:**
- `cargarDatosFlujoCaja()` - Carga ventas y compras
- `calcularSaldoAcumulado()` - Calcula saldos en tiempo real
- `filtrarMovimientosPorFecha()` - Filtros por rango de fechas
- `agruparMovimientosPorDia()` - Agrupación para vista resumida
- `calcularEstadisticas()` - Análisis estadístico

**Estado del Servicio:**
```javascript
let cashFlowCache = {
  ventas: [],           // Ventas pagadas (no a crédito)
  compras: [],          // Todas las compras
  movimientos: [],      // Movimientos procesados
  saldoInicial: 0       // Saldo inicial configurado
};
```

### Componente (`cashFlowComponent.js`)

**Funciones de Renderizado:**
- `renderizarEstadisticas()` - Tarjetas de estadísticas
- `renderizarVistaDetallada()` - Tabla de movimientos
- `renderizarVistaResumida()` - Resumen diario
- `renderizarFiltros()` - Controles de filtrado

**Estados del Componente:**
```javascript
let currentView = 'detallado';  // 'detallado' | 'resumido'
let currentFilters = {
  fechaInicio: null,
  fechaFin: null
};
```

## 📊 Tipos de Movimientos

### Ingresos
- **Ventas**: Dinero recibido por ventas de productos
- **Excluye**: Ventas a crédito o pendientes de pago

### Egresos
- **Compras**: Dinero gastado en compra de productos
- **Futuro**: Gastos operativos, inversiones, etc.

### Cálculo de Saldo
```javascript
// Para cada movimiento:
if (movimiento.tipo === 'ingreso') {
  saldo += movimiento.monto;
} else {
  saldo -= movimiento.monto;
}
```

## 🎨 Interfaz de Usuario

### Vista Detallada
- Tabla cronológica de movimientos
- Columnas: Fecha, Hora, Tipo, Concepto, Descripción, Monto, Saldo
- Indicadores visuales por tipo de movimiento
- Responsive para móviles

### Vista Resumida
- Tarjetas diarias con totales
- Ingresos, egresos y saldo por día
- Botón para ver detalles del día
- Diseño tipo dashboard

### Estadísticas
- Total de ingresos y egresos
- Saldo final actual
- Cantidad de movimientos
- Saldo inicial (si aplica)

## 🔧 Configuración y Uso

### Inicialización
```javascript
// En finanzas.js
import * as CashFlowService from '../services/cashFlowService.js';
import * as CashFlowComponent from '../components/cashFlowComponent.js';

// Inicializar servicio
CashFlowService.inicializarFlujoCaja();

// Inicializar componente
CashFlowComponent.inicializarComponente('flujoCajaContainer');
```

### Filtros por Fecha
```javascript
// Aplicar filtros
const movimientos = CashFlowService.filtrarMovimientosPorFecha(
  '2024-01-01',  // fechaInicio
  '2024-01-31'   // fechaFin
);

// Calcular saldo con saldo inicial
const saldoInicial = CashFlowService.calcularSaldoInicial('2024-01-01');
const movimientosConSaldo = CashFlowService.calcularSaldoAcumulado(
  movimientos, 
  saldoInicial
);
```

### Eventos y Actualizaciones
```javascript
// Suscribirse a cambios
CashFlowService.suscribirseACambios((datos) => {
  console.log('Datos actualizados:', datos);
  // Actualizar interfaz
});

// Recargar datos manualmente
CashFlowService.recargarDatos();
```

## 📱 Responsive Design

### Desktop (>768px)
- Tabla completa con todas las columnas
- Estadísticas en grid de 4-5 columnas
- Filtros en línea horizontal

### Tablet (480px-768px)
- Tabla adaptativa con columnas principales
- Estadísticas en grid de 2-3 columnas
- Filtros apilados verticalmente

### Mobile (<480px)
- Vista de tarjetas para movimientos
- Estadísticas en columna única
- Filtros en modal o dropdown

## 🔄 Integración con el Sistema

### Sincronización Automática
- **Ventas**: Se actualiza automáticamente al registrar nuevas ventas
- **Compras**: Se actualiza automáticamente al registrar nuevas compras
- **Tiempo Real**: Cambios reflejados inmediatamente

### Navegación
- Acceso desde menú principal de Finanzas
- Submódulo integrado en la estructura existente
- Navegación por URL con parámetros

### Persistencia
- Configuración guardada en localStorage
- Filtros y preferencias de usuario
- Estado de vista (detallado/resumido)

## 🚀 Funcionalidades Futuras

### Próximas Mejoras
1. **Exportación Avanzada**
   - PDF con gráficos
   - Excel con fórmulas
   - Reportes personalizados

2. **Análisis Predictivo**
   - Proyecciones de flujo de caja
   - Alertas de saldo bajo
   - Recomendaciones de gestión

3. **Tipos de Movimientos Adicionales**
   - Gastos operativos
   - Inversiones
   - Préstamos
   - Retiros de ganancia

4. **Gráficos y Visualizaciones**
   - Gráfico de flujo de caja
   - Análisis de tendencias
   - Comparativas por período

## 🐛 Solución de Problemas

### Problemas Comunes

**1. No se muestran movimientos**
- Verificar que existan ventas y compras
- Comprobar filtros de fecha
- Revisar consola para errores

**2. Saldo incorrecto**
- Verificar cálculo de saldo inicial
- Comprobar orden cronológico
- Revisar tipos de movimiento

**3. No se actualiza en tiempo real**
- Verificar conexión a Firebase
- Comprobar suscripciones a cambios
- Revisar permisos de base de datos

### Debugging
```javascript
// Verificar datos del servicio
console.log('Cache:', CashFlowService.obtenerMovimientos());

// Verificar estadísticas
console.log('Stats:', CashFlowService.obtenerEstadisticasGenerales());

// Verificar filtros
const movimientos = CashFlowService.filtrarMovimientosPorFecha(
  '2024-01-01', 
  '2024-01-31'
);
console.log('Filtrados:', movimientos);
```

## 📋 Checklist de Implementación

- [x] Servicio de flujo de caja
- [x] Componente de interfaz
- [x] Utilidades y formateo
- [x] Integración en finanzas.js
- [x] Estilos CSS responsivos
- [x] Navegación y submódulos
- [x] Cálculo de saldos
- [x] Filtros por fecha
- [x] Vista detallada y resumida
- [x] Estadísticas en tiempo real
- [x] Actualización automática
- [x] Documentación completa

## 🤝 Contribución

Para contribuir al desarrollo del submódulo:

1. Seguir la estructura de archivos existente
2. Mantener consistencia con el diseño del sistema
3. Documentar nuevas funcionalidades
4. Probar en diferentes dispositivos
5. Verificar integración con módulos existentes

---

**Desarrollado para Distribuciones ROCA**  
*Sistema de Gestión Financiera Integral* 