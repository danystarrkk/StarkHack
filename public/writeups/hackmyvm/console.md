---
title: "Console"
date: 2025-12-05
draft: false
description: "Writeup de la máquina Console en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Credential Exposure",
    "Information Disclosure",
    "Pivoting",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/writeups/hackmyvm/console/media/cover.webp"
level: Medium
---

# Enumeración

Vamos a comenzar realizando un escaneo en red para identificar la máquina víctima con ayuda de **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/console/media/01.webp)

Como podemos observar, la IP de la máquina es la `192.168.1.66`.

Ahora, con ayuda del comando `ping` vamos a identificar un poco el sistema operativo:

```bash
ping -c 1 192.168.1.66
```

![img2](/writeups/hackmyvm/console/media/02.webp)

Podemos observar un `ttl=64` donde asumimos un sistema Linux.

Ya en este punto realizamos un escaneo con ayuda de **Nmap** para detectar puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.66 -oG allPorts
```

![img3](/writeups/hackmyvm/console/media/03.webp)

Observamos los puertos `22,80 y 443` abiertos, ahora vamos a intentar extraer la máxima información posible de estos 3 puertos:

```bash
nmap -p22,80,443 -sCV 192.168.1.66 -oN target
```

![img4](/writeups/hackmyvm/console/media/04.webp)

Podemos observar versiones y en algunas de estas vemos también que parece ser un Debian, esto es útil a final de cuentas, ya que nos asegura si ser un sistema Linux por lo menos.

Bueno vamos a visitar primero la web que está corriendo por el puerto 80 a ver que es lo que logramos encontrar:

![img5](/writeups/hackmyvm/console/media/05.webp)

Vemos esta web, pero nada más ni en el código fuente.

Recordemos que tenemos en el puerto `443` corriendo el servicio https por lo que vamos a intentar ingresar:

![img6](/writeups/hackmyvm/console/media/06.webp)

Observamos que no nos carga la web, ahora recordemos que https utiliza el protocolo TLS vamos a intentar inspeccionar dicho certificado en busca de más información con ayuda de **sslscan**:

```bash
sslscan 192.168.1.66
```

![img7](/writeups/hackmyvm/console/media/07.webp)

Si vemos en el resultado nos lista un dominio, podemos intentar al ser un servicio local integrarlo en el `/etc/hosts` para que mediante el mismo cargue la web mediante el servicio `https`.

Ya con eso editado entramos a la web:
![img8](/writeups/hackmyvm/console/media/08.webp)

En esta web vemos varias cosas pero, en realidad por el momento nada me sirve, lo que vamos a hacer es verificar los scripts que está cargando, si podemos leer su código fuente vamos a ver alguna forma de aprovecharlo.

![img9](/writeups/hackmyvm/console/media/09.webp)

Entre todos los scripts el de `hacker.js` es el que nos llama la atención y vamos a analizarlo:

![img10](/writeups/hackmyvm/console/media/10.webp)

# Explotación

En este pequeño trozo de código podemos ver lo que al parecer es una ruta que sería `supercoool.php`, además de que al parecer podemos pasarle el parámetro `cmd` y darle un valor, vemos que sucede:

![img11](/writeups/hackmyvm/console/media/11.webp)

Como vemos ejecuta comandos por lo que de forma directa vamos a intentar entablar una reverse shell para tomar control de la máquina:

![img12](/writeups/hackmyvm/console/media/12.webp)

Ya con la conexión lista vamos a darle tratamiento y a comenzar con la enumeración del sistema.

No encontramos permisos SUID y tampoco tareas cron, lo que si logramos listar gracias a las carpetas del directorio `home` y a la información del archivo `/etc/passwd` es los usuario disponibles:

![img13](/writeups/hackmyvm/console/media/13.webp)

![img14](/writeups/hackmyvm/console/media/14.webp)

Podemos ver los usuarios, en este punto vamos a revisar sus directorios en busca de pistas o credenciales:

![img15](/writeups/hackmyvm/console/media/15.webp)

Vemos dos archivos, uno el `user.txt` que contiene flag del usuario y otro que es el `.viminfo` el cual vemos su contenido:

![img16](/writeups/hackmyvm/console/media/16.webp)

Observamos las credenciales del usuario welcome `welcome:welcome123` por lo que vamos a cambiar de usuario:

![img17](/writeups/hackmyvm/console/media/17.webp)

Perfecto ahora también se analizó el uso de tareas cron y permisos SUID, pero no encontramos nada, algo más que encontramos extraño es al revisar los puertos:

```bash
ss -nltp
```

![img18](/writeups/hackmyvm/console/media/18.webp)

Vemos el puerto `5000` abierto de forma interna. En este punto podemos intentar hacer Port forwarding para poder externalizar el puerto, como tenemos credenciales lo más sencillo es hacerlo con ayuda de ssh de la siguiente manera:

```bash
ssh welcome@192.168.1.66 -L 80:192.168.1.66:5000
```

![img19](/writeups/hackmyvm/console/media/19.webp)

Ya con esto y conectados si revisamos nuestro puerto `80` vamos a ver que está abierto:

![img20](/writeups/hackmyvm/console/media/20.webp)

Perfecto, podemos intentar escanear con ayuda de **Nmap** el puerto para ver que encontramos:

![img21](/writeups/hackmyvm/console/media/21.webp)

Vemos que está corriendo una web y en esta se implementa python.

Veamos la web:

![img22](/writeups/hackmyvm/console/media/22.webp)

En esta web creamos y publicamos una especie de post y es vulnerable a XSS, pero nada más, lo que podemos hacer en este punto es buscar por más rutas y esto con ayuda de **Gobuster** :

```bash
gobuster dir -u http://127.0.0.1 -w <diccionario>
```

![img23](/writeups/hackmyvm/console/media/23.webp)

vemos esa ruta `console`:

![img24](/writeups/hackmyvm/console/media/24.webp)

Vemos el mensaje donde nos dice que necesitamos el ping que se proporcionó al lanzar la web, pero esto no lo tenemos.

Regresando a la terminal encontramos que tenemos una ejecución de comandos con `sudo`:

![img25](/writeups/hackmyvm/console/media/25.webp)

Podemos ver unos logs, vemos lo que es:

![img26](/writeups/hackmyvm/console/media/26.webp)

Como podemos observar si son `logs`, pero no sabemos referente a qué web son, podemos intentar enviar cualquier cosa como ping en la web a ver si logramos verlo en los logs:

![img27](/writeups/hackmyvm/console/media/27.webp)
![img28](/writeups/hackmyvm/console/media/28.webp)

En efecto, los logs son de esta web.

Ahora si lo pensamos un poco nos habla de que al levantar el servidor nos brinda el pin, podemos intentar filtrar solo las primeras líneas a ver si logramos verlo:

![img29](/writeups/hackmyvm/console/media/29.webp)

Vemos el pin, vamos a usarlo para desbloquear la terminal:

![img30](/writeups/hackmyvm/console/media/30.webp)

Lo que tenemos es una consola en python que al parecer no tiene restricciones, pero no le agrandan comandos largos, vamos a hacer uso de `bosybox` para generarnos una reverse shell desde esta consola de la siguiente manera:

![img31](/writeups/hackmyvm/console/media/31.webp)
![img32](/writeups/hackmyvm/console/media/32.webp)

Volvemos a hacer un tratamiento a la `tty` para maniobrar mejor y tendríamos:

![img33](/writeups/hackmyvm/console/media/33.webp)

# Escalada de Privilegios

Listo ya estamos como el usuario `qaq` en este punto volvemos a hacer reconocimiento y al ejecutar el comando `sudo -l` vemos:

![img34](/writeups/hackmyvm/console/media/34.webp)

Podemos ejecutar el comando `fastfetch` como administrador.

Esto no es algo común, pero tenemos que saber investigar, nosotros podemos moldear un archivo de configuración de `fastfetch` y dentro de este al parecer para dar cierta apariencia o ver cierto resultado, lo que se hace es ejecutar comandos, ya con esto claro entendemos por donde ir.

Vamos primero a generar su archivo de configuración con:

```bash
fastfetch --gen-config
```

![img35](/writeups/hackmyvm/console/media/35.webp)

Como vemos nos da la ruta donde se generó el archivo, podemos abrir dicho archivo y veremos lo siguiente:

![img36](/writeups/hackmyvm/console/media/36.webp)

Agregamos un nuevo módulo con el cual ejecutamos comandos, y vemos si funciono:

![img37](/writeups/hackmyvm/console/media/37.webp)

Vemos que como sudo no funciona y esto es porque tenemos que especificar el archivo de configuración que debe usar:

![img38](/writeups/hackmyvm/console/media/38.webp)

Ahora ya funciona, en este punto vamos a modificar nuevamente para mandar permisos SUID a la bash y escalar más rápido:

![img39](/writeups/hackmyvm/console/media/39.webp)

Ahora ejecutamos:
![img40](/writeups/hackmyvm/console/media/40.webp)

Por último veamos si se asignó permisos a la `bash`:

![img41](/writeups/hackmyvm/console/media/41.webp)

Perfecto ejecutemos `bash -p` :

![img42](/writeups/hackmyvm/console/media/42.webp)

Ya estamos como root, vamos a ver la flag de root:

![img43](/writeups/hackmyvm/console/media/43.webp)

Máquina Terminada.

![img44](/writeups/hackmyvm/console/media/44.webp)
