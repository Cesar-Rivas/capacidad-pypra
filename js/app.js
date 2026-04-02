let globalData = null;

fetch('js/db.json')
    .then(r => r.json())
    .then(data => {
        globalData = data;

        // Escuchar cambios en el filtro
        document.getElementById('filtroMes').addEventListener('change', renderizarTodo);

        // Activar el Modal
        inicializarModal();

        renderizarTodo();
    })
    .catch(error => console.error("Error cargando el JSON:", error));