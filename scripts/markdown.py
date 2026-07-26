#!/usr/bin/env python3
import sys
import os
import re
import shutil
import urllib.parse

def procesar_markdown(archivo_md, dir_origen, dir_destino):
    # 1. Validar que el archivo Markdown existe
    if not os.path.exists(archivo_md):
        print(f"[!] Error: El archivo '{archivo_md}' no existe.")
        return

    # 2. Asegurar que el directorio de destino existe
    os.makedirs(dir_destino, exist_ok=True)

    # 3. Leer el contenido del Markdown
    with open(archivo_md, 'r', encoding='utf-8') as f:
        contenido = f.read()

    # 4. Regex para cazar las imágenes tipo Obsidian: [[nombre.png/jpg]]
    # Captura todo lo que esté dentro de los corchetes y termine en una extensión gráfica
    patron = r'\[\[(.*?\.(?:png|jpg|jpeg))\]\]'
    
    # Comprobar si hay imágenes antes de procesar
    imagenes_encontradas = re.findall(patron, contenido, flags=re.IGNORECASE)
    if not imagenes_encontradas:
        print("[-] No se detectaron imágenes con formato [[...]] en este archivo.")
        return

    print(f"[*] Se detectaron {len(imagenes_encontradas)} etiquetas de imagen en el archivo.")

    contador = 1

    # 5. Función de reemplazo dinámico
    def reemplazar_y_mover(match):
        nonlocal contador
        nombre_original = match.group(1)
        
        # Rutas para mover el archivo físico
        ruta_src = os.path.join(dir_origen, nombre_original)
        ruta_dst = os.path.join(dir_destino, nombre_original)
        
        # Mover la imagen si existe en el origen
        if os.path.exists(ruta_src):
            try:
                shutil.move(ruta_src, ruta_dst)
                print(f"[+] Movida: {nombre_original} -> {dir_destino}")
            except Exception as e:
                print(f"[!] Error al mover '{nombre_original}': {e}")
        else:
            # Si ya se movió antes o no existe, solo lanzamos un aviso pero seguimos actualizando el texto
            print(f"[-] Aviso: La imagen '{nombre_original}' no se encontró en la carpeta origen (¿ya fue movida?).")

        # 6. Preparar el nuevo formato de texto
        # Le quitamos la extensión original y le ponemos .webp
        nombre_sin_ext = os.path.splitext(nombre_original)[0]
        nuevo_nombre = f"{nombre_sin_ext}.webp"
        
        # Codificar espacios a %20 para la URL (ej. "Pasted image 1.webp" -> "Pasted%20image%201.webp")
        nombre_url = urllib.parse.quote(nuevo_nombre)
        
        # Formato final: ![img1](/images/Pasted%20image....webp)
        nuevo_texto = f"![img{contador}](/images/{nombre_url})"
        
        contador += 1
        return nuevo_texto

    # 7. Ejecutar el reemplazo en todo el texto
    nuevo_contenido = re.sub(patron, reemplazar_y_mover, contenido, flags=re.IGNORECASE)

    # 8. Sobrescribir el archivo .md con los cambios
    with open(archivo_md, 'w', encoding='utf-8') as f:
        f.write(nuevo_contenido)
        
    print(f"[+] ¡Archivo '{archivo_md}' actualizado con éxito!")

if __name__ == '__main__':
    # Validar que se pase el archivo por consola
    if len(sys.argv) != 2:
        print("Uso correcto: python3 markdown.py archivo.md")
        sys.exit(1)
        
    archivo_entrada = sys.argv[1]
    
    # ====== CONFIGURACIÓN DE RUTAS ======
    # Modifica estas rutas según cómo tengas organizada tu carpeta
    DIR_ORIGEN = "/home/stark/Documents/Brain/99 - Plantillas y Recursos/Capturas"  # Donde Obsidian/tu editor guarda las imágenes por defecto
    DIR_DESTINO = "/home/stark/Documents/StarkHack/temp/" # La carpeta de donde el Script 1 (conversor) tomará las imágenes
    
    print("\n\t Procesador de Markdown a formato Web \n")
    procesar_markdown(archivo_entrada, DIR_ORIGEN, DIR_DESTINO)
