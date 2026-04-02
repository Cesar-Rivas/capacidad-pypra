function getWeekNumber(dStr) {
    if (!dStr || dStr === 'S/F' || dStr === 'nan' || dStr === 'None') return 0;

    // Reemplazar guiones por barras si es necesario para compatibilidad
    let procesada = dStr.replace(/-/g, '/');
    let d = new Date(procesada);

    // Si falla, intentamos limpiar espacios
    if (isNaN(d.getTime())) {
        d = new Date(dStr.trim());
    }

    if (isNaN(d.getTime())) return 0;

    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function acumular(obj, proc, sem, val) {
    const p = proc.toLowerCase().trim();
    if (obj[p]) {
        if (!obj[p][sem]) obj[p][sem] = 0;
        obj[p][sem] += val;
    }
}