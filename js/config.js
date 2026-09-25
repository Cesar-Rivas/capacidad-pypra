let appConfig = JSON.parse(localStorage.getItem('industrialConfig'));

const isOldVersion = !appConfig || !appConfig.plantaPrincipal || appConfig.plantaPrincipal.lun.turno3 === undefined;

if (isOldVersion) {
    appConfig = {
        eficienciaGlobal: 0.85,
        usarCapacidadesManuales: true,
        plantaPrincipal: {
            lun: { turno1: 8.5, turno2: 11, turno3: 0 },
            mar: { turno1: 8.5, turno2: 11, turno3: 0 },
            mie: { turno1: 8.5, turno2: 11, turno3: 0 },
            jue: { turno1: 8.5, turno2: 3.5, turno3: 0 },
            vie: { turno1: 8.5, turno2: 0, turno3: 0 },
            sab: { turno1: 0, turno2: 0, turno3: 0 },
            dom: { turno1: 0, turno2: 0, turno3: 0 }
        },
        tallerPintura: {
            lun: { turno1: 8.5, turno2: 0, turno3: 0 },
            mar: { turno1: 8.5, turno2: 0, turno3: 0 },
            mie: { turno1: 8.5, turno2: 0, turno3: 0 },
            jue: { turno1: 8.5, turno2: 0, turno3: 0 },
            vie: { turno1: 8.5, turno2: 0, turno3: 0 },
            sab: { turno1: 0, turno2: 0, turno3: 0 },
            dom: { turno1: 0, turno2: 0, turno3: 0 }
        },
        manualCapacities: {
            "corte torreta": 210,
            "corte láser": 210,
            "rebabeo": 280,
            "doblez": 210,
            "soldadura": 210
        },
        stationCounts: {}
    };
    localStorage.setItem('industrialConfig', JSON.stringify(appConfig));
} else {
    if (appConfig.usarCapacidadesManuales === undefined) {
        appConfig.usarCapacidadesManuales = true;
    }
    if (!appConfig.stationCounts) {
        appConfig.stationCounts = {};
    }
}
