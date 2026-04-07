#!/usr/bin/env python3
import os
from PIL import Image
from pathlib import Path

def procesar_imagenes(directorio_origen, directorio_destino):
    # 1. Aseguramos que los directorios existan
    Path(directorio_origen).mkdir(parents=True, exist_ok=True)
    Path(directorio_destino).mkdir(parents=True, exist_ok=True)

    extensiones_validas = {'.png', '.jpg', '.jpeg'}

    # 2. Leer el directorio destino e identificar lo ya procesado
    # Usamos un 'set' (conjunto) para búsquedas instantáneas
    imagenes_procesadas = set()
    for archivo in os.listdir(directorio_destino):
        if archivo.lower().endswith('.webp'):
            nombre_base = os.path.splitext(archivo)[0]
            imagenes_procesadas.add(nombre_base)

    print(f"[*] Imágenes ya en formato WEBP encontradas: {len(imagenes_procesadas)}")

    # 3. Leer el directorio origen y filtrar lo que falta
    imagenes_pendientes = []
    for archivo in os.listdir(directorio_origen):
        nombre_base, extension = os.path.splitext(archivo)
        if extension.lower() in extensiones_validas:
            if nombre_base not in imagenes_procesadas:
                imagenes_pendientes.append(archivo)

    if not imagenes_pendientes:
        print("[+] Todas las imágenes ya están convertidas y sincronizadas.")
        return

    print(f"[*] Imágenes pendientes por procesar: {len(imagenes_pendientes)}")

    # 4. Procesar y convertir las imágenes pendientes
    for archivo in imagenes_pendientes:
        ruta_origen = os.path.join(directorio_origen, archivo)
        nombre_base = os.path.splitext(archivo)[0]
        ruta_destino = os.path.join(directorio_destino, f"{nombre_base}.webp")

        try:
            # Abrimos la imagen
            with Image.open(ruta_origen) as img:
                # Convertimos a formato WEBP (soporta RGBA de los PNG y RGB de los JPG)
                # quality=80 es un buen balance entre compresión y calidad visual
                img.save(ruta_destino, 'webp', quality=80)
            
            print(f"[+] Convertido: {archivo} -> {nombre_base}.webp")
            
        except Exception as e:
            print(f"[!] Error al procesar {archivo}: {e}")

if __name__ == '__main__':
    # Define aquí las rutas de tus directorios
    DIR_ORIGEN = "../temp"
    DIR_DESTINO = "../public/images"
    
    print("\n\t Iniciando conversor a WEBP \n")
    procesar_imagenes(DIR_ORIGEN, DIR_DESTINO)
