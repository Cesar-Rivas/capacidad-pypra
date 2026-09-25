function limpiarTexto(texto) {
    if (!texto) return "";
    return texto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getNumeroEstaciones(nombreEstacion) {
    if (appConfig.stationCounts && appConfig.stationCounts[nombreEstacion] !== undefined) {
        return appConfig.stationCounts[nombreEstacion];
    }
    if (globalData.estaciones && globalData.estaciones[nombreEstacion]) {
        return globalData.estaciones[nombreEstacion].cantidad;
    }
    return 1;
}

function encontrarEstacion(nombreProcesoOriginal, llavesEstaciones) {
    const pLimpio = limpiarTexto(nombreProcesoOriginal);

    let target = llavesEstaciones.find(est => limpiarTexto(est) === pLimpio);
    if (target) return target;

    target = llavesEstaciones.find(est => {
        const eLimpio = limpiarTexto(est);
        if (!eLimpio) return false;

        if (eLimpio.includes('inser') && pLimpio.includes('inser')) return true;
        if (eLimpio.includes('sold') && pLimpio.includes('sold')) return true;
        if (eLimpio.includes('pul') && pLimpio.includes('pul')) return true;
        if (eLimpio.includes('dob') && pLimpio.includes('dob')) return true;
        if (eLimpio.includes('pint') && pLimpio.includes('pint')) return true;
        if (eLimpio.includes('lav') && pLimpio.includes('lav')) return true;
        if (eLimpio.includes('empaq') && pLimpio.includes('empaq')) return true;
        if (eLimpio.includes('ensam') && pLimpio.includes('ensam')) return true;
        if (eLimpio.includes('rebab') && pLimpio.includes('rebab')) return true;

        return false;
    });

    return target;
}

function getCapacidadSemanalProceso(nombreProceso, numEstaciones) {
    const p = nombreProceso.toLowerCase();
    let horasSemanaEstacion = 0;

    const sumarHoras = (departamento) => {
        let total = 0;
        for (const dia in appConfig[departamento]) {
            total += (appConfig[departamento][dia].turno1 + 
                      appConfig[departamento][dia].turno2 + 
                      (appConfig[departamento][dia].turno3 || 0));
        }
        return total;
    };

    if (p.includes('lavado') || p.includes('masking') || p.includes('pintura')) {
        horasSemanaEstacion = sumarHoras('tallerPintura');
    } else {
        horasSemanaEstacion = sumarHoras('plantaPrincipal'); 
    }

    let unitaria = horasSemanaEstacion;
    let totalSemanal = horasSemanaEstacion * numEstaciones;

    if (appConfig.usarCapacidadesManuales && appConfig.manualCapacities && appConfig.manualCapacities[nombreProceso] !== undefined) {
        totalSemanal = parseFloat(appConfig.manualCapacities[nombreProceso]);
        unitaria = (numEstaciones > 0) ? (totalSemanal / numEstaciones) : 0;
    }

    return { unitaria, totalSemanal };
}

function calcularCargaProcesos(ordenesAProcesar) {
    const carga = {};
    const semanasUnicas = new Set();

    if (globalData.estaciones) {
        Object.keys(globalData.estaciones).forEach(e => {
            carga[e.toLowerCase().trim()] = {};
        });
    }

    ordenesAProcesar.forEach(po => {
        const idBusqueda = String(po.modelo).trim().toUpperCase();
        const modeloKey = Object.keys(globalData.modelos).find(k => k.toUpperCase() === idBusqueda);
        const mod = modeloKey ? globalData.modelos[modeloKey] : null;

        if (!mod || !mod.tasas) return;

        const numSem = getWeekNumber(po.fecha_entrega);
        const semLabel = numSem === 0 ? "Sem Indef." : `Sem ${numSem}`;
        semanasUnicas.add(semLabel);

        Object.entries(mod.tasas).forEach(([pName, pzasHr]) => {
            if (!pzasHr || pzasHr <= 0) return;

            const tasaEfectiva = pzasHr * (appConfig.eficienciaGlobal || 1);
            const hrsReq = po.cantidad / tasaEfectiva;
            
            const pKeyLimpio = limpiarTexto(pName);

            if (pKeyLimpio.includes('corte')) {
                const tipoCorte = limpiarTexto(mod.corte_tipo || 'torreta');
                if (tipoCorte === 'dual') {
                    acumular(carga, 'corte torreta', semLabel, hrsReq / 2);
                    acumular(carga, 'corte láser', semLabel, hrsReq / 2);
                } else if (tipoCorte.includes('laser')) {
                    acumular(carga, 'corte láser', semLabel, hrsReq);
                } else {
                    acumular(carga, 'corte torreta', semLabel, hrsReq);
                }
            } else {
                let target = encontrarEstacion(pName, Object.keys(carga));
                if (target) {
                    if (!carga[target][semLabel]) carga[target][semLabel] = 0;
                    carga[target][semLabel] += hrsReq;
                }
            }
        });
    });

    const listaSem = Array.from(semanasUnicas).sort((a, b) => {
        if (a === "Sem Indef.") return 1;
        if (b === "Sem Indef.") return -1;
        return parseInt(a.replace('Sem ', '')) - parseInt(b.replace('Sem ', ''));
    });

    return { carga, listaSem };
}

function filtrarOrdenesPorMes(ordenes, mesSeleccionado) {
    if (mesSeleccionado === "todos") return ordenes;

    return ordenes.filter(po => {
        let dStr = po.fecha_entrega;
        if (!dStr || dStr === 'S/F' || dStr === 'nan' || dStr === 'None') return false;

        let procesada = dStr.replace(/-/g, '/');
        let d = new Date(procesada);
        if (isNaN(d.getTime())) d = new Date(dStr.trim());
        if (isNaN(d.getTime())) return false;

        return d.getMonth() === parseInt(mesSeleccionado);
    });
}

function procesarDesgloseModelos(ordenesAProcesar) {
    const resumenModelos = {};
    const omitidos = {};

    const estacionesOriginales = Object.keys(globalData.estaciones);
    const estacionesKeys = estacionesOriginales.map(e => e.toLowerCase().trim());

    ordenesAProcesar.forEach(po => {
        const idBusqueda = po.modelo.trim().toUpperCase();
        const modeloKeyOriginal = Object.keys(globalData.modelos).find(k => k.toUpperCase() === idBusqueda);
        const modInfo = modeloKeyOriginal ? globalData.modelos[modeloKeyOriginal] : null;

        if (!modInfo || !modInfo.tasas || Object.keys(modInfo.tasas).length === 0) {
            omitidos[idBusqueda] = (omitidos[idBusqueda] || 0) + po.cantidad;
            return;
        }

        if (!resumenModelos[idBusqueda]) {
            resumenModelos[idBusqueda] = { cant: 0, hrs: {} };
            estacionesKeys.forEach(est => resumenModelos[idBusqueda].hrs[est] = 0);
        }
        resumenModelos[idBusqueda].cant += po.cantidad;

        Object.entries(modInfo.tasas).forEach(([pName, tasa]) => {
            if (!tasa || tasa === 0) return;
            
            const tasaEfectiva = tasa * (appConfig.eficienciaGlobal || 1);
            const hrs = po.cantidad / tasaEfectiva;
            
            const pKeyLimpio = limpiarTexto(pName);

            if (pKeyLimpio.includes('corte')) {
                let targetLaser = estacionesKeys.find(e => limpiarTexto(e).includes('laser'));
                let targetTorreta = estacionesKeys.find(e => limpiarTexto(e).includes('torreta'));
                const tipo = limpiarTexto(modInfo.corte_tipo || 'torreta');

                if (tipo === 'dual') {
                    if (targetLaser) resumenModelos[idBusqueda].hrs[targetLaser] += (hrs / 2);
                    if (targetTorreta) resumenModelos[idBusqueda].hrs[targetTorreta] += (hrs / 2);
                } else if (tipo.includes('laser')) {
                    if (targetLaser) resumenModelos[idBusqueda].hrs[targetLaser] += hrs;
                } else {
                    if (targetTorreta) resumenModelos[idBusqueda].hrs[targetTorreta] += hrs;
                }
            } else {
                let target = estacionesKeys.find(est => {
                    const estLimpio = limpiarTexto(est);
                    if (pKeyLimpio.includes(estLimpio) || estLimpio.includes(pKeyLimpio)) return true;
                    if (estLimpio.includes('soldadura') && pKeyLimpio.includes('sold')) return true;
                    if (estLimpio.includes('pulido') && pKeyLimpio.includes('pul')) return true;
                    return false;
                });

                if (target) {
                    resumenModelos[idBusqueda].hrs[target] += hrs;
                }
            }
        });
    });

    return { resumenModelos, omitidos, estacionesOriginales, estacionesKeys };
}
