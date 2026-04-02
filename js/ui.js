function limpiarContenedores() {
    document.getElementById('processGrid').innerHTML = "";
    document.querySelector("#analisisTable tbody").innerHTML = "";
    document.querySelector("#modelosTable tbody").innerHTML = "";
    document.querySelector("#omitidosTable tbody").innerHTML = "";
}

function renderizarTablaModelos(resumenModelos, estacionesOriginales, estacionesKeys) {
    const theadTr = document.getElementById("modelosTableHeader");
    const tbody = document.querySelector("#modelosTable tbody");

    // 1. Generar encabezados de la tabla dinámicamente
    let theadHTML = `<th>Modelo</th><th>Cant. Total</th>`;
    estacionesOriginales.forEach(est => {
        theadHTML += `<th>${est.toUpperCase()}</th>`;
    });
    theadTr.innerHTML = theadHTML;

    // 2. Generar filas
    tbody.innerHTML = "";
    Object.entries(resumenModelos).forEach(([name, data]) => {
        let rowHTML = `<tr>
            <td><small><b>${name}</b></small></td>
            <td>${data.cant}</td>`;

        // Agregar celda por cada proceso existente en el orden correcto
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
        const numEst = globalData.estaciones[est].cantidad;
        const cap = getCapacidadSemanalProceso(est, numEst);
        const capSemanal = cap.totalSemanal;

        // CORRECCIÓN CRÍTICA: Buscar siempre la llave en minúsculas
        const targetKey = est.toLowerCase().trim();
        const dataReqNums = listaSem.map(s => carga[targetKey] ? (carga[targetKey][s] || 0) : 0);

        const overload = dataReqNums.some(v => v > capSemanal);

        // Crear Card para la gráfica
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

        // Generar Gráfica
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

        // Fila para la Tabla de Análisis General
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

// Función Principal (Orquestador)
function renderizarTodo() {
    // 1. Obtener mes seleccionado
    const selector = document.getElementById('filtroMes');
    const mesSeleccionado = selector ? selector.value : "todos";

    // 2. Filtrar los datos
    const ordenesAProcesar = filtrarOrdenesPorMes(globalData.ordenes_compra, mesSeleccionado);

    // 3. Procesar los cálculos matemáticos (Llama a funciones de engine.js)
    // Ahora capturamos también las estaciones detectadas dinámicamente
    const { carga, listaSem } = calcularCargaProcesos(ordenesAProcesar);

    const {
        resumenModelos,
        omitidos,
        estacionesOriginales,
        estacionesKeys
    } = procesarDesgloseModelos(ordenesAProcesar);

    // 4. Renderizar la UI limpia
    limpiarContenedores();

    // Pasamos las estaciones detectadas a la tabla de modelos para que cree las columnas correctas
    renderizarTablaModelos(resumenModelos, estacionesOriginales, estacionesKeys);

    renderizarTablaOmitidos(omitidos);

    // Renderizamos gráficas y análisis
    renderizarGraficasYAnalisis(carga, listaSem);
}

function inicializarModal() {
    const modal = document.getElementById('configModal');
    const btnAbrir = document.getElementById('btnConfig');
    const btnCerrar = document.getElementById('closeModal');
    const btnGuardar = document.getElementById('btnGuardarConfig');

    const dias = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

    btnAbrir.addEventListener('click', () => {
        // 1. Cargar eficiencia global
        document.getElementById('inEffGlobal').value = appConfig.eficienciaGlobal;

        // 2. Iterar sobre los días para llenar los inputs de Planta Principal y Taller
        dias.forEach(dia => {
            document.getElementById(`pp-${dia}-t1`).value = appConfig.plantaPrincipal[dia].turno1;
            document.getElementById(`pp-${dia}-t2`).value = appConfig.plantaPrincipal[dia].turno2;

            document.getElementById(`tp-${dia}-t1`).value = appConfig.tallerPintura[dia].turno1;
            document.getElementById(`tp-${dia}-t2`).value = appConfig.tallerPintura[dia].turno2;
        });

        modal.style.display = 'block';
    });

    const cerrarModal = () => { modal.style.display = 'none'; };
    btnCerrar.addEventListener('click', cerrarModal);
    window.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

    btnGuardar.addEventListener('click', () => {
        // 1. Guardar eficiencia global
        appConfig.eficienciaGlobal = parseFloat(document.getElementById('inEffGlobal').value) || 1;

        // 2. Iterar sobre los días para extraer los valores y guardarlos en appConfig
        dias.forEach(dia => {
            appConfig.plantaPrincipal[dia].turno1 = parseFloat(document.getElementById(`pp-${dia}-t1`).value) || 0;
            appConfig.plantaPrincipal[dia].turno2 = parseFloat(document.getElementById(`pp-${dia}-t2`).value) || 0;

            appConfig.tallerPintura[dia].turno1 = parseFloat(document.getElementById(`tp-${dia}-t1`).value) || 0;
            appConfig.tallerPintura[dia].turno2 = parseFloat(document.getElementById(`tp-${dia}-t2`).value) || 0;
        });

        // 3. Persistir y Redibujar
        localStorage.setItem('industrialConfig', JSON.stringify(appConfig));
        cerrarModal();
        renderizarTodo();
    });
}