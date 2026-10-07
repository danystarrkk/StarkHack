#!/usr/bin/env python3
import os
import re
import shutil
import sys


def procesar_markdown(archivo_md, dir_origen):
    # 1. Validar que el archivo Markdown existe
    if not os.path.exists(archivo_md):
        print(f"[!] Error: El archivo '{archivo_md}' no existe.")
        return

    # 2. Derivar <platform>/<slug> de la ubicación del archivo
    #    (public/writeups/<platform>/<slug>.md) para usar la convención del sitio.
    #    Si no está bajo public/writeups/ fallamos claro: jamás volvemos a
    #    escribir la bóveda plana antigua de imágenes.
    ruta_norm = os.path.normpath(archivo_md).replace("\\", "/")
    m = re.search(r"(?:^|/)public/writeups/([^/]+)/([^/]+)(?:/[^/]+)?\.md$", ruta_norm)
    if not m:
        print(
            f"[!] Error: '{archivo_md}' no está bajo public/writeups/<platform>/<slug>/; "
            "no se puede derivar la carpeta media/ del writeup."
        )
        sys.exit(1)
    plataforma, slug = m.group(1), m.group(2)

    # 3. Carpeta de medios del writeup: public/writeups/<platform>/<slug>/media/
    raiz_writeups = ruta_norm[: m.start(1)]  # termina en 'public/writeups/'
    dir_destino = f"{raiz_writeups}{plataforma}/{slug}/media"
    prefijo_url = f"/writeups/{plataforma}/{slug}/media"

    # 4. Leer el contenido del Markdown
    with open(archivo_md, "r", encoding="utf-8") as f:
        contenido = f.read()

    # 5. Regex para cazar las imágenes tipo Obsidian: [[nombre.png/jpg]]
    # Captura todo lo que esté dentro de los corchetes y termine en una extensión gráfica
    patron = r"\[\[(.*?\.(?:png|jpg|jpeg))\]\]"

    # Comprobar si hay imágenes antes de procesar
    imagenes_encontradas = re.findall(patron, contenido, flags=re.IGNORECASE)
    if not imagenes_encontradas:
        print("[-] No se detectaron imágenes con formato [[...]] en este archivo.")
        return

    print(
        f"[*] Se detectaron {len(imagenes_encontradas)} etiquetas de imagen en el archivo."
    )

    # La carpeta media/ solo se crea cuando hay imágenes que mover
    os.makedirs(dir_destino, exist_ok=True)

    # 6. Numeración secuencial con padding al ancho del mayor índice (01, 02, ...)
    ancho = len(str(len(imagenes_encontradas)))

    contador = 1

    # 7. Función de reemplazo dinámico
    def reemplazar_y_mover(match):
        nonlocal contador
        nombre_original = match.group(1)
        numero = f"{contador:0{ancho}d}"

        # Rutas para mover el archivo físico con nombre secuencial (01, 02, ...)
        ruta_src = os.path.join(dir_origen, nombre_original)
        ruta_dst = os.path.join(dir_destino, f"{numero}{os.path.splitext(nombre_original)[1]}")

        # Mover la imagen si existe en el origen
        if os.path.exists(ruta_src):
            try:
                shutil.move(ruta_src, ruta_dst)
                print(f"[+] Movida: {nombre_original} -> {ruta_dst}")
            except Exception as e:
                print(f"[!] Error al mover '{nombre_original}': {e}")
        else:
            # Si ya se movió antes o no existe, solo lanzamos un aviso pero seguimos actualizando el texto
            print(
                f"[-] Aviso: La imagen '{nombre_original}' no se encontró en la carpeta origen (¿ya fue movida?)."
            )

        # 8. Preparar el nuevo formato de texto
        # La URL sigue la convención del sitio: <NN>.webp dentro de media/
        # (la conversión física a .webp conserva el nombre base numerado)
        nuevo_texto = f"![img{contador}]({prefijo_url}/{numero}.webp)"

        contador += 1
        return nuevo_texto

    # 9. Ejecutar el reemplazo en todo el texto
    nuevo_contenido = re.sub(patron, reemplazar_y_mover, contenido, flags=re.IGNORECASE)

    # 10. Sobrescribir el archivo .md con los cambios
    with open(archivo_md, "w", encoding="utf-8") as f:
        f.write(nuevo_contenido)

    print(f"[+] ¡Archivo '{archivo_md}' actualizado con éxito!")


if __name__ == "__main__":
    # Validar que se pase el archivo por consola
    if len(sys.argv) != 2:
        print("Uso correcto: python3 markdown.py archivo.md")
        sys.exit(1)

    archivo_entrada = sys.argv[1]

    # ====== CONFIGURACIÓN DE RUTAS ======
    # Modifica esta ruta según cómo tengas organizada tu carpeta.
    # El destino ya no se configura: sale de la ubicación del .md en
    # public/writeups/<platform>/<slug>/ y sus imágenes van a su carpeta media/.
    DIR_ORIGEN = "/home/stark/Documents/Brain/99 - Plantillas y Recursos/Capturas"  # Donde Obsidian/tu editor guarda las imágenes por defecto

    print("\n\t Procesador de Markdown a formato Web \n")
    procesar_markdown(archivo_entrada, DIR_ORIGEN)
