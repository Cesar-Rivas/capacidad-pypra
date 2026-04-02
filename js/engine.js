function getCapacidadSemanalProceso(nombreProceso, numEstaciones) {
    const p = nombreProceso.toLowerCase();
    let horasSemanaEstacion = 0;

    // Función auxiliar para sumar los turnos de todos los días en la matriz
    const sumarHoras = (departamento) => {
        let total = 0;
        for (const dia in appConfig[departamento]) {
            total += (appConfig[departamento][dia].turno1 + appConfig[departamento][dia].turno2);
        }
        return total;
    };

    if (p.includes('lavado') || p.includes('masking') || p.includes('pintura')) {
        // Taller de Pintura: Suma total de sus turnos (Suele ser eficiencia 100%)
        horasSemanaEstacion = sumarHoras('tallerPintura');
    } else {
        // Planta Principal: Suma total de sus turnos multiplicada por la eficiencia global
        horasSemanaEstacion = sumarHoras('plantaPrincipal') * appConfig.eficienciaGlobal;
    }

    return {
        unitaria: horasSemanaEstacion,
        totalSemanal: horasSemanaEstacion * numEstaciones
    };
}

function calcularCargaProcesos(ordenesAProcesar) {
    const carga = {};
    const semanasUnicas = new Set();

    // Inicializar usando las llaves reales en minúsculas
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

            const hrsReq = po.cantidad / pzasHr;
            const pKey = pName.toLowerCase().trim();

            if (pKey === 'corte') {
                const tipoCorte = (mod.corte_tipo || 'torreta').toLowerCase();
                if (tipoCorte === 'dual') {
                    acumular(carga, 'corte torreta', semLabel, hrsReq / 2);
                    acumular(carga, 'corte láser', semLabel, hrsReq / 2);
                } else if (tipoCorte.includes('laser') || tipoCorte.includes('láser')) {
                    acumular(carga, 'corte láser', semLabel, hrsReq);
                } else {
                    acumular(carga, 'corte torreta', semLabel, hrsReq);
                }
            } else {
                let target = Object.keys(carga).find(est => pKey.includes(est) || est.includes(pKey));
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

// Filtra las órdenes según el selector de mes
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

// Extrae la lógica de sumar las horas por modelo que antes estaba revuelta en la UI
function procesarDesgloseModelos(ordenesAProcesar) {
    const resumenModelos = {};
    const omitidos = {};

    // Extraer todos los procesos dinámicamente desde la BD
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

        // Inicializar el modelo con todas las estaciones en 0
        if (!resumenModelos[idBusqueda]) {
            resumenModelos[idBusqueda] = { cant: 0, hrs: {} };
            estacionesKeys.forEach(est => resumenModelos[idBusqueda].hrs[est] = 0);
        }
        resumenModelos[idBusqueda].cant += po.cantidad;

        Object.entries(modInfo.tasas).forEach(([pName, tasa]) => {
            if (!tasa || tasa === 0) return;
            const hrs = po.cantidad / tasa;
            const pKey = pName.toLowerCase().trim();

            if (pKey === 'corte') {
                // Encontrar dinámicamente las llaves de Láser y Torreta
                let targetLaser = estacionesKeys.find(e => e.includes('laser') || e.includes('láser'));
                let targetTorreta = estacionesKeys.find(e => e.includes('torreta'));
                const tipo = (modInfo.corte_tipo || 'torreta').toLowerCase();

                if (tipo === 'dual') {
                    if (targetLaser) resumenModelos[idBusqueda].hrs[targetLaser] += (hrs / 2);
                    if (targetTorreta) resumenModelos[idBusqueda].hrs[targetTorreta] += (hrs / 2);
                } else if (tipo.includes('laser') || tipo.includes('láser')) {
                    if (targetLaser) resumenModelos[idBusqueda].hrs[targetLaser] += hrs;
                } else {
                    if (targetTorreta) resumenModelos[idBusqueda].hrs[targetTorreta] += hrs;
                }
            } else {
                // Para el resto de procesos, mapeo idéntico al motor general
                let target = estacionesKeys.find(est => pKey.includes(est) || est.includes(pKey));
                if (target) {
                    resumenModelos[idBusqueda].hrs[target] += hrs;
                }
            }
        });
    });

    // Retornamos las llaves también para que UI sepa qué columnas dibujar
    return { resumenModelos, omitidos, estacionesOriginales, estacionesKeys };
}