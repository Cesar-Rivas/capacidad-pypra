import pandas as pd
import json
import os

def convertir_num(valor):
    if pd.isna(valor) or valor == "" or valor == "nan": return 0
    try:
        if isinstance(valor, str):
            valor = valor.replace('$', '').replace(',', '').strip()
            if " " in valor: valor = valor.split(" ")[0]
        return float(valor)
    except: return 0

def generar_base_datos():
    archivo = 'tiempos.xlsx'
    if not os.path.exists(archivo):
        print(f"Error: No se encuentra {archivo}")
        return

    xls = pd.ExcelFile(archivo)
    
    # ESTRUCTURA REQUERIDA POR EL DASHBOARD
    db = {
        "modelos": {},
        "ordenes_compra": [],
        "estaciones": {}
    }

    # 1. TIEMPOS (Pestaña 'tiempos')
    df_t = pd.read_excel(xls, 'tiempos')
    for _, r in df_t.iterrows():
        # Usamos 'Numero de Parte' como llave principal (el HTML lo normaliza a Mayúsculas)
        mod = str(r.get('Numero de Parte', '')).strip().upper()
        if mod == "" or mod == "NAN": continue
        
        # IMPORTANTE: La llave debe ser "tasas" (plural) para que el JS no la ignore
        db["modelos"][mod] = {
            "corte_tipo": str(r.get('Corte_Tipo', 'Torreta')).strip(),
            "tasas": {
                "Corte": convertir_num(r.get('Pzas_hr_Corte')),
                "Rebabeo": convertir_num(r.get('Pzas_hr_Rebabeo')),
                "Doblez": convertir_num(r.get('Pzas_hr_Doblez')),
                "Insercion": convertir_num(r.get('Pzas_hr_Insercion')),
                "Empaque": convertir_num(r.get('Pzas_hr_Empaque')),
                "Lavado": convertir_num(r.get('Pzas_hr_Lavado')),
                "Masking": convertir_num(r.get('Pzas_hr_Masking')),
                "Pintura": convertir_num(r.get('Pzas_hr_Pintura')),
                "Soldadura": convertir_num(r.get('Pzas_hr_Soldadura')),
                "Ensamble": convertir_num(r.get('Pzas_hr_Ensamble')),
                "Pulido": convertir_num(r.get('Pzas_hr_Pulido'))
            }
        }

    # 2. ÓRDENES (Pestaña 'ordenes')
    df_o = pd.read_excel(xls, 'ordenes')
    for _, r in df_o.iterrows():
        mod = str(r.get('Numero De Parte', '')).strip().upper()
        cant = convertir_num(r.get('Cantidad'))
        fecha = r.get('Fecha')
        
        if mod == "" or mod == "NAN" or cant <= 0: continue

        # Formatear fecha a ISO (YYYY-MM-DD) para getWeekNumber del JS
        f_str = "S/F"
        if pd.notna(fecha):
            try:
                if hasattr(fecha, 'strftime'):
                    f_str = fecha.strftime('%Y-%m-%d')
                else:
                    f_str = pd.to_datetime(fecha).strftime('%Y-%m-%d')
            except:
                f_str = str(fecha)

        db["ordenes_compra"].append({
            "modelo": mod,
            "cantidad": int(cant),
            "fecha_entrega": f_str
        })

    # 3. ESTACIONES (Pestaña 'estaciones')
    # El Dashboard usa estas llaves para crear las gráficas
    try:
        df_e = pd.read_excel(xls, 'estaciones')
        for _, r in df_e.iterrows():
            est = str(r.get('Estacion', '')).strip()
            if est:
                db["estaciones"][est] = {
                    "cantidad": int(convertir_num(r.get('Cantidad', 1)))
                }
    except:
        # Si la pestaña falla, el dashboard necesita al menos los nombres correctos:
        procesos = ["Corte Torreta", "Corte Láser", "Rebabeo", "Doblez", 
                    "Insercion", "Empaque", "Lavado", "Masking", 
                    "Pintura", "Soldadura", "Ensamble", "Pulido"]
        db["estaciones"] = {p: {"cantidad": 1} for p in procesos}

    # Guardar con encoding correcto para eñes y acentos
    with open('db.json', 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=4, ensure_ascii=False)
    
    print(f"Éxito: {len(db['modelos'])} modelos y {len(db['ordenes_compra'])} órdenes listas.")

if __name__ == "__main__":
    generar_base_datos()



    # "estaciones": {
    #     "corte torreta": {
    #         "cantidad": 3
    #     },
    #     "corte láser": {
    #         "cantidad": 3
    #     },
    #     "rebabeo": {
    #         "cantidad": 3
    #     },
    #     "doblez": {
    #         "cantidad": 4
    #     },
    #     "inserción": {
    #         "cantidad": 2
    #     },
    #     "soldadura": {
    #         "cantidad": 2
    #     },
    #     "pulido": {
    #         "cantidad": 1
    #     },
    #     "lavado": {
    #         "cantidad": 1
    #     },
    #     "masking": {
    #         "cantidad": 1
    #     },
    #     "pintura": {
    #         "cantidad": 1
    #     },
    #     "ensamble": {
    #         "cantidad": 1
    #     },
    #     "empaque": {
    #         "cantidad": 1
    #     }
    # }
    # #