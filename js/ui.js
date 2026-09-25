function limpiarContenedores() {
    document.getElementById('processGrid').innerHTML = "";
    document.querySelector("#analisisTable tbody").innerHTML = "";
    document.querySelector("#modelosTable tbody").innerHTML = "";
    document.querySelector("#omitidosTable tbody").innerHTML = "";
}

function renderizarTablaModelos(resumenModelos, estacionesOriginales, estacionesKeys) {
    const theadTr = document.getElementById("modelosTableHeader");
    const tbody = document.querySelector("#modelosTable tbody");

    let theadHTML = `<th>Modelo</th><th>Cant. Total</th>`;
    estacionesOriginales.forEach(est => {
        theadHTML += `<th>${est.toUpperCase()}</th>`;
    });
    theadTr.innerHTML = theadHTML;

    tbody.innerHTML = "";
    Object.entries(resumenModelos).forEach(([name, data]) => {
        let rowHTML = `<tr>
            <td><small><b>${name}</b></small></td>
            <td>${data.cant}</td>`;

        estacionesKeys.forEach(estKey => {
            const hrs = data.hrs[estKey];
            rowHTML += `<td>${hrs > 0 ? hrs.toFixed(1) + 'h' : '-'}</td>`;
        });

        rowHTML += `</tr>`;
        tbody.innerHTML += rowHTML;
    });
}

function renderizarTablaOmitidos(omitidos) {
    const omitidosTableBody = document.querySelector("#omitidosTable tbody");
    Object.entries(omitidos).forEach(([name, cant]) => {
        omitidosTableBody.innerHTML += `
        <tr style="background: #fff5f5;">
            <td><b style="color: #c62828;">${name}</b></td>
            <td><b>${cant}</b> piezas</td>
            <td><span class="status-pill bg-overload">Modelo no definido en Base de Datos</span></td>
        </tr>`;
    });
}

function renderizarGraficasYAnalisis(carga, listaSem) {
    const grid = document.getElementById('processGrid');
    const tableBody = document.querySelector("#analisisTable tbody");
    const numSemanas = listaSem.length;

    Object.keys(globalData.estaciones).forEach(est => {
        const numEst = getNumeroEstaciones(est);
        const cap = getCapacidadSemanalProceso(est, numEst);
        const capSemanal = cap.totalSemanal;

        const targetKey = est.toLowerCase().trim();
        const dataReqNums = listaSem.map(s => carga[targetKey] ? (carga[targetKey][s] || 0) : 0);

        const overload = dataReqNums.some(v => v > capSemanal);

        const card = document.createElement('div');
        card.className = `process-card ${overload ? 'overload-card' : ''}`;
        card.innerHTML = `
        <div class="card-header">
            ${overload ? '<span class="badge badge-red">SOBRECARGA</span>' : ''}
            <h3>${est.toUpperCase()}</h3>
            <div class="subtitle"><b>${numEst}</b> Estaciones | <b>${cap.unitaria.toFixed(1)}h</b> disp. por estación</div>
        </div>
        <div class="chart-wrapper"><canvas id="c-${est.replace(/ /g,'-')}"></canvas></div>`;
        grid.appendChild(card);

        new Chart(card.querySelector('canvas'), {
            type: 'bar',
            data: {
                labels: listaSem,
                datasets: [{
                    label: 'Carga Req.',
                    data: dataReqNums.map(v => v.toFixed(1)),
                    backgroundColor: overload ? '#e57373' : '#64b5f6',
                    borderRadius: 5
                }, {
                    label: 'Capacidad',
                    data: listaSem.map(() => capSemanal.toFixed(1)),
                    type: 'line',
                    borderColor: '#37474f',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.max(...dataReqNums, capSemanal) * 1.2
                    }
                }
            }
        });

        const hReqTotal = dataReqNums.reduce((a, b) => a + b, 0);
        const hDispPeriodo = capSemanal * numSemanas;
        const balance = hDispPeriodo - hReqTotal;
        const pct = hDispPeriodo > 0 ? (hReqTotal / hDispPeriodo) * 100 : 0;
        const statusCls = pct > 100 ? 'bg-overload' : (pct > 85 ? 'bg-warning' : 'bg-optimal');

        tableBody.innerHTML += `
        <tr>
            <td><b>${est.toUpperCase()}</b></td>
            <td>${numEst}</td>
            <td>${cap.unitaria.toFixed(1)}h</td>
            <td>${hDispPeriodo.toFixed(1)}h</td>
            <td>${hReqTotal.toFixed(1)}h</td>
            <td class="${balance < 0 ? 'negativo' : 'positivo'}">${balance.toFixed(1)}h</td>
            <td><span class="status-pill ${statusCls}">${pct.toFixed(1)}%</span></td>
        </tr>`;
    });
}

function renderizarTodo() {
    const selector = document.getElementById('filtroMes');
    const mesSeleccionado = selector ? selector.value : "todos";

    const ordenesAProcesar = filtrarOrdenesPorMes(globalData.ordenes_compra, mesSeleccionado);
    const { carga, listaSem } = calcularCargaProcesos(ordenesAProcesar);
    const { resumenModelos, omitidos, estacionesOriginales, estacionesKeys } = procesarDesgloseModelos(ordenesAProcesar);

    limpiarContenedores();
    renderizarTablaModelos(resumenModelos, estacionesOriginales, estacionesKeys);
    renderizarTablaOmitidos(omitidos);
    renderizarGraficasYAnalisis(carga, listaSem);
}

// Recalcula horas automáticas teóricas basadas en la tabla de turnos y la cantidad de estaciones puesta en el modal
function calcularHorasAutoTemporales(nombreEstacion) {
    const p = nombreEstacion.toLowerCase();
    const idSafe = nombreEstacion.replace(/\s+/g, '-');
    const inputCant = document.getElementById(`cant-est-${idSafe}`);
    const numEstaciones = inputCant ? (parseInt(inputCant.value) || 1) : getNumeroEstaciones(nombreEstacion);

    const dias = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    let totalHorasSemana = 0;

    const dep = (p.includes('lavado') || p.includes('masking') || p.includes('pintura')) ? 'tp' : 'pp';

    dias.forEach(dia => {
        const t1 = parseFloat(document.getElementById(`${dep}-${dia}-t1`).value) || 0;
        const t2 = parseFloat(document.getElementById(`${dep}-${dia}-t2`).value) || 0;
        const t3 = parseFloat(document.getElementById(`${dep}-${dia}-t3`).value) || 0;
        totalHorasSemana += (t1 + t2 + t3);
    });

    return (totalHorasSemana * numEstaciones).toFixed(1);
}

function actualizarPlaceholdersAutomaticos() {
    Object.keys(globalData.estaciones).forEach(est => {
        const idSafe = est.replace(/\s+/g, '-');
        const input = document.getElementById(`cap-man-${idSafe}`);
        if (input) {
            const hrsAuto = calcularHorasAutoTemporales(est);
            input.placeholder = `Automático (${hrsAuto}h)`;
        }
    });
}

function inicializarModal() {
    const modal = document.getElementById('configModal');
    const btnAbrir = document.getElementById('btnConfig');
    const btnCerrar = document.getElementById('closeModal');
    const btnGuardar = document.getElementById('btnGuardarConfig');
    const switchModoManual = document.getElementById('switchModoManual');

    const dias = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

    btnAbrir.addEventListener('click', () => {
        document.getElementById('inEffGlobal').value = appConfig.eficienciaGlobal;

        switchModoManual.checked = appConfig.usarCapacidadesManuales !== false;

        dias.forEach(dia => {
            document.getElementById(`pp-${dia}-t1`).value = appConfig.plantaPrincipal[dia].turno1;
            document.getElementById(`pp-${dia}-t2`).value = appConfig.plantaPrincipal[dia].turno2;
            document.getElementById(`pp-${dia}-t3`).value = appConfig.plantaPrincipal[dia].turno3 || 0;

            document.getElementById(`tp-${dia}-t1`).value = appConfig.tallerPintura[dia].turno1;
            document.getElementById(`tp-${dia}-t2`).value = appConfig.tallerPintura[dia].turno2;
            document.getElementById(`tp-${dia}-t3`).value = appConfig.tallerPintura[dia].turno3 || 0;
        });

        // Generar dinámicamente campos de cantidad de estaciones y capacidades manuales
        const manualContainer = document.getElementById('manualCapacitiesContainer');
        manualContainer.innerHTML = '';
        Object.keys(globalData.estaciones).forEach(est => {
            const idSafe = est.replace(/\s+/g, '-');
            const val = (appConfig.manualCapacities && appConfig.manualCapacities[est] !== undefined) 
                        ? appConfig.manualCapacities[est] 
                        : '';
            const cantVal = getNumeroEstaciones(est);
                        
            manualContainer.innerHTML += `
                <div class="config-group" style="justify-content: space-between; display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <label style="flex: 1; font-weight: bold; font-size: 0.9em;">${est.toUpperCase()}:</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="number" min="1" step="1" id="cant-est-${idSafe}" class="input-cant-estacion" style="width: 65px; text-align: center;" value="${cantVal}" title="Número de estaciones disponibles">
                        <span style="font-size: 0.85em; color: #555;">est.</span>
                        <input type="number" step="0.5" id="cap-man-${idSafe}" class="input-cap-manual" style="width: 140px; text-align: center;" value="${val}">
                    </div>
                </div>
            `;
        });

        actualizarPlaceholdersAutomaticos();
        actualizarEstadoInputsManuales();
        modal.style.display = 'block';
    });

    const actualizarEstadoInputsManuales = () => {
        const manualActivo = switchModoManual.checked;
        // Únicamente deshabilita las horas manuales, dejando la cantidad de estaciones siempre activa
        document.querySelectorAll('.input-cap-manual').forEach(input => {
            input.disabled = !manualActivo;
            input.style.opacity = manualActivo ? '1' : '0.5';
        });
    };

    switchModoManual.addEventListener('change', actualizarEstadoInputsManuales);

    let notificadoT3 = false;
    modal.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
            actualizarPlaceholdersAutomaticos();

            if (e.target.classList.contains('input-turno3')) {
                const val = parseFloat(e.target.value) || 0;
                if (val > 0 && !notificadoT3) {
                    alert("Se ha configurado un 3er turno. Si deseas que las estaciones se calculen con estas nuevas horas, asegúrate de apagar el switch de capacidades manuales o dejar los campos en automático.");
                    notificadoT3 = true;
                }
            }
        }
    });

    const cerrarModal = () => { 
        modal.style.display = 'none'; 
        notificadoT3 = false;
    };
    btnCerrar.addEventListener('click', cerrarModal);
    window.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

    btnGuardar.addEventListener('click', () => {
        appConfig.eficienciaGlobal = parseFloat(document.getElementById('inEffGlobal').value) || 1;
        appConfig.usarCapacidadesManuales = switchModoManual.checked;

        dias.forEach(dia => {
            appConfig.plantaPrincipal[dia].turno1 = parseFloat(document.getElementById(`pp-${dia}-t1`).value) || 0;
            appConfig.plantaPrincipal[dia].turno2 = parseFloat(document.getElementById(`pp-${dia}-t2`).value) || 0;
            appConfig.plantaPrincipal[dia].turno3 = parseFloat(document.getElementById(`pp-${dia}-t3`).value) || 0;

            appConfig.tallerPintura[dia].turno1 = parseFloat(document.getElementById(`tp-${dia}-t1`).value) || 0;
            appConfig.tallerPintura[dia].turno2 = parseFloat(document.getElementById(`tp-${dia}-t2`).value) || 0;
            appConfig.tallerPintura[dia].turno3 = parseFloat(document.getElementById(`tp-${dia}-t3`).value) || 0;
        });

        appConfig.manualCapacities = {};
        appConfig.stationCounts = {};

        Object.keys(globalData.estaciones).forEach(est => {
            const idSafe = est.replace(/\s+/g, '-');
            
            // Guardar Cantidad de Estaciones
            const cantVal = document.getElementById(`cant-est-${idSafe}`).value;
            if (cantVal !== '' && !isNaN(cantVal)) {
                appConfig.stationCounts[est] = parseInt(cantVal) || 1;
            }

            // Guardar Capacidad Manual
            const inputVal = document.getElementById(`cap-man-${idSafe}`).value;
            if (inputVal !== '' && !isNaN(inputVal)) {
                appConfig.manualCapacities[est] = parseFloat(inputVal);
            }
        });

        localStorage.setItem('industrialConfig', JSON.stringify(appConfig));
        cerrarModal();
        renderizarTodo();
    });
}
