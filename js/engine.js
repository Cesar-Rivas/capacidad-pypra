function limpiarTexto(texto) {
    if (!texto) return "";
    // Convierte a minúscula, quita espacios extra y ELIMINA ACENTOS (áéíóú -> aeiou)
    return texto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// Función inteligente para cruzar el nombre del JSON con la Estación real
function encontrarEstacion(nombreProcesoOriginal, llavesEstaciones) {
    const pLimpio = limpiarTexto(nombreProcesoOriginal);

    // 1er Filtro: Búsqueda Exacta (Garantiza que Insercion vaya a Insercion)
    let target = llavesEstaciones.find(est => limpiarTexto(est) === pLimpio);
    if (target) return target;

    // 2do Filtro: Mapeo por raíces (Evita que palabras cortas se roben horas)
    target = llavesEstaciones.find(est => {
        const eLimpio = limpiarTexto(est);
        if (!eLimpio) return false; // Protección contra strings vacíos o nulos

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
            const pKeyLimpio = limpiarTexto(pName); // <- Texto sin acentos

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
                // Usamos la nueva función segura
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

    // Retornamos las llaves también para que UI sepa qué columnas dibujar
    return { resumenModelos, omitidos, estacionesOriginales, estacionesKeys };
}