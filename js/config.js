let appConfig = JSON.parse(localStorage.getItem('industrialConfig'));

// Condición mejorada: Si no hay configuración, O si la configuración guardada 
// es de una versión vieja (no tiene plantaPrincipal), cargamos los defaults.
if (!appConfig || !appConfig.plantaPrincipal) {
    appConfig = {
        eficienciaGlobal: 0.85,
        plantaPrincipal: {
            lun: { turno1: 8.5, turno2: 11 },
            mar: { turno1: 8.5, turno2: 11 },
            mie: { turno1: 8.5, turno2: 11 },
            jue: { turno1: 8.5, turno2: 3.5 },
            vie: { turno1: 8.5, turno2: 0 },
            sab: { turno1: 0, turno2: 0 },
            dom: { turno1: 0, turno2: 0 }
        },
        tallerPintura: {
            lun: { turno1: 8.5, turno2: 0 },
            mar: { turno1: 8.5, turno2: 0 },
            mie: { turno1: 8.5, turno2: 0 },
            jue: { turno1: 8.5, turno2: 0 },
            vie: { turno1: 8.5, turno2: 0 },
            sab: { turno1: 0, turno2: 0 },
            dom: { turno1: 0, turno2: 0 }
        }
    };

    // Guardamos automáticamente esta nueva estructura limpia
    localStorage.setItem('industrialConfig', JSON.stringify(appConfig));
}