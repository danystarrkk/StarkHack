---
title: "Birdeye"
date: 2025-11-03
draft: false
description: "Writeup de la máquina Birdeye en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Credential Exposure",
    "Privilege Escalation",
    "Remote Code Execution",
    "Server-Side Request Forgery",
  ]
image: "/writeups/hackmyvm/birdeye/media/cover.webp"
level: Medium
---

# Enumeración

Vamos a comenzar realizando un reconocimiento en red para encontrar a la maquina con ayuda de **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/birdeye/media/01.webp)

Bueno, como podemos ver ya hemos identificado a la maquina victima por lo que vamos a intentar identificar el Sistema que esta corre con ayuda del comando `ping`:

```bash
ping -c 1 192.168.1.129
```

![img2](/writeups/hackmyvm/birdeye/media/02.webp)

A menos de que por alguna razón este haya sido modificado podríamos intuir un sistema `Linux` debido a su `ttl=64`, la distribución seguimos sin conocerla por el momento.

En este punto vamos a realizar un escaneo con ayuda de **Nmap** para ir mirando los puertos que vemos abiertos por ahora y analizarlos a ver que podemos encontrar:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.129 -oG allPorts
```

![img3](/writeups/hackmyvm/birdeye/media/03.webp)

Podemos observar los puertos abiertos, en este punto lo que vamos a hacer es realizar un escaneo mucho más agresivo para obtener toda la información de estos puertos que figuran como abiertos y de igual forma aremos uso de **Nmap**:

```bash
nmap -p53,80,5000 -sVC 192.168.1.129 -oN target
```

![img4](/writeups/hackmyvm/birdeye/media/04.webp)

Podemos observar de forma mucho más detallada el servicio y la version del mismo que corre en los puertos.

Bueno, vemos en sí los puertos: 80, 53 y 5000 abiertos donde lo que más llama mi atención es el puerto 80 y el puerto 5000, además de que gracias a la versión del servicio `DNS` en el puerto 53 nos da indicios de ser una distribución Ubuntu.

Continuando con lo del puerto 80 y 5000 estos son servicios web, por lo que vamos como primer escaneo a usar **Whatweb** para ver si identificamos las tecnologías usadas:

```bash
whatweb http://192.168.1.129
```

![img5](/writeups/hackmyvm/birdeye/media/05.webp)

Perfecto, vemos que es un Apache, cosa que ya nos describía también en el escaneo con nmap y vemos algunas cabeceras que podrían ser útiles dependiendo de la situación.

Lo que vamos a hacer es lo mismo para el puerto 5000 a ver si encontramos algo:

```bash
whatweb http://192.168.1.129:5000
```

![img6](/writeups/hackmyvm/birdeye/media/06.webp)

Al igual nos habla de `Werkzeug` y su versión, además nos describe la versión de python que está implementando, lo primero que tenemos que hacer es buscar que es so de `Werkzeug` para entender que está pasando primero.

Lo que encontramos es que `Werkzeug` es una biblioteca de Python que nos permite la creación aplicaciones web compatibles con `WSGI` (Web Server Gateway Interface) que es una interfaz estándar entre servidores web y aplicaciones web en Python el cual permite que servidores como `Apache` o Nginx se comuniquen con diferentes frameworks como los Django o Flask.

Bueno con esto ya podemos tener una idea de como puede estar montada la web, porque si tenemos esto corriendo podemos asumir que tenemos algún back-end en python que se esta comunicando con apache para servir la información por el puerto 80.

Vamos a ver que tenemos entonces en el puerto 80:

![img7](/writeups/hackmyvm/birdeye/media/07.webp)

Bueno, vemos varias rutas que ya ingresamos pero, no encontramos nada realmente critico por el momento.

Como no vemos nada por aquí vamos a intentar hacer un poco de fuzzing con `gobuster` para encontrar directorios en la web. Recordemos que en el puerto 5000, aunque vemos la tecnología no se observará nada en absoluto, entonces continuemos con el fuzzing:

```bash
gobuster dir -u http://192.168.1.129 -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt --add-slash -t 20
```

![img8](/writeups/hackmyvm/birdeye/media/08.webp)

Vemos que tenemos una ruta `admin` la cual aunque no es accesible podríamos tener algo dentro, así que vamos a intentar ver dentro de la misma:
![img9](/writeups/hackmyvm/birdeye/media/09.webp)

Vemos un error al intentarlo de primeras, pero si lo leemos vamos a ver que nos habla de que al parecer no nos admite peticiones largas y nos dice que las limitemos directamente a `22` vamos a hacerlo y ahora si el comando sería:

```bash
gobuster dir -u http://192.168.1.129/admin -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt --add-slash -t 20 -xl 22
```

![img10](/writeups/hackmyvm/birdeye/media/10.webp)

Vemos que nos redirige a un `/config`, pero que no es accesible, en este punto vamos a navegar en toda la web y realizar diferentes que tenga la web capturando claro todo el trafico mediante el Burp Suite:
![img11](/writeups/hackmyvm/birdeye/media/11.webp)

Vemos esta petición que es en el apartado de búsqueda y vemos que al parámetro `url` le estamos pasando algo, pero no se comprende que es, vamos a url-decode a eso a ver que es:

![img12](/writeups/hackmyvm/birdeye/media/12.webp)

Perfecto lo que vemos es que estamos haciendo una petición que podría dirigirse también de forma externa, esto no es una buena práctica, vemos que pasa si desde aquí llamamos a google:
![img13](/writeups/hackmyvm/birdeye/media/13.webp)

Nos aplica un redirect:

![img14](/writeups/hackmyvm/birdeye/media/14.webp)

Y pues si logramos pasar a Google por lo que la web realiza peticiones.

# Explotación

Esto ya podemos identificarlo como un **Server-Side Request Forgery (SSRF)** donde vamos a poder tal vez realizar peticiones a webs o servicios internos, en este caso recordemos que tenemos el `/admin` corriendo, pero no tenemos acceso, por concepto debemos pasar debido a que la misma máquina está haciéndose a sí misma la consulta:
![img15](/writeups/hackmyvm/birdeye/media/15.webp)

Vemos que nos aplica un follow redirect:

![img16](/writeups/hackmyvm/birdeye/media/16.webp)

Pero no llegamos a ningún lado.

Recordemos que dentro de `/admin` encontramos otra ruta mas que es `/config` veamos si esto nos da alguna respuesta:
![img17](/writeups/hackmyvm/birdeye/media/17.webp)

!Perfecto el servidor nos acaba de responder y lo que vemos son credenciales de administrador, además de que nos indica que en `/admin/panelloginpage` esta el panel de administración por lo que vamos a intentar entrar y ver que es y las credenciales que nos da las vamos a guardar `superadmin:SuperSecret123!`:

![img18](/writeups/hackmyvm/birdeye/media/18.webp)

Vemos un panel administrativo.

![img19](/writeups/hackmyvm/birdeye/media/19.webp)

De igual forma revisando la respuesta lo que vemos es que podemos emplear 3 tipos de métodos, pero si bajamos y revisamos el código del formulario:
![img20](/writeups/hackmyvm/birdeye/media/20.webp)

Como vemos emplea el método `POST` por lo cual vamos a tener que usarlo de la siguiente manera:

![img21](/writeups/hackmyvm/birdeye/media/21.webp)

Todo lo que vemos en la imagen es lo agregado o modificado que nos ayuda a completar correctamente la petición, en este punto lo que vamos a hacer es llevarnos la cookie de sesión que nos responde la web y dirigirnos directamente a `admin`, pero si observamos bien veremos que el título de la web es `Dashboard` podemos intentar en caso de no funcionar ir a `/admin/Dashboard` a ver que obtenemos:

![img22](/writeups/hackmyvm/birdeye/media/22.webp)

Vemos que el `/admin/dashboard` es el válido, además de que la petición gracias a la cookie que tenemos ya podemos hacerla de forma directa.

En este punto por alguna razón tenemos una ejecución remota de comandos, vamos a realizar en este punto algo sencillo que es generar una reverse shell para mayor comodidad:

![img23](/writeups/hackmyvm/birdeye/media/23.webp)

vemos un pequeño problema en este caso y es que nos está impidiendo algunas ejecuciones de comandos por lo que nos impide en sí cualquier tipo de reverse shell, pero aquí vamos a hacer uso de un binario llamado `busybox` el cual es un software especialmente usado en sistema embebidos que permite la ejecución de ciertos comandos básicos de Unix, el hecho de nosotros mediante este binario podamos realizar una ejecución de comandos es que no hace de intermediario y lanza el binario de `ls`, sino que dentro del binario de `busybox` tiene por decirlo de alguna forma una función propia de ls que hace los mismo y es por eso que permite la ejecución de ciertos comandos y con su ayuda vamos a generar la reverse shell:

![img24](/writeups/hackmyvm/birdeye/media/24.webp)

# Escalada de Privilegios

Perfecto ya estamos dentro, lo que vamos a hacer ahora es un pequeño tratamiento a la terminal para manejarla mejor:

![img25](/writeups/hackmyvm/birdeye/media/25.webp)
![img26](/writeups/hackmyvm/birdeye/media/26.webp)

Perfecto, ahora lo que vamos a hacer es buscar en el sistema por otros usuarios:
![img27](/writeups/hackmyvm/birdeye/media/27.webp)

Vemos en `/home` una carpeta con nombre `sev` esto nos indica un posible usuario, podemos listar también el `/etc/passwd` a ver si lo confirmamos:

![img28](/writeups/hackmyvm/birdeye/media/28.webp)

Efectivamente tenemos al usuario `sev y root` no tenemos nada más, podemos ver con `sudo -l` que permisos de ejecución como sudo tenemos:
![img29](/writeups/hackmyvm/birdeye/media/29.webp)

Perfecto en este punto lo que podemos hacer es intentar ejecutar ese script como sudo como `sev` de la siguiente manera:

```bash
sudo -u se /home/sev/backup_app.sh
```

![img30](/writeups/hackmyvm/birdeye/media/30.webp)

Perfecto, vamos a ver la flag y a volver a listar los permisos de sudo:

![img31](/writeups/hackmyvm/birdeye/media/31.webp)

Volvemos a observar que podemos usar el comando find, este no es algo que sepamos usar, pero podemos ayudarnos de web como GTOBINS a ver que podemos obtener:
![img32](/writeups/hackmyvm/birdeye/media/32.webp)

Si tenemos resultado y además si tenemos forma de aprovecharnos del que tenga permisos de sudo, vamos a ver que podemos hacer:

![img33](/writeups/hackmyvm/birdeye/media/33.webp)

Como vemos ya nos dan directamente el comando, en mi caso solo modificaré una pequeña cosa y es que quiero que sea una `bash` y no una `sh`, por lo tanto vamos a intentarlo:

![img34](/writeups/hackmyvm/birdeye/media/34.webp)

Excelente ya estamos como usuario root, vamos a intentar en este punto ya obtener la flag de root:

![img35](/writeups/hackmyvm/birdeye/media/35.webp)

Excelente, vamos a intentar mandarle ya la última flag a Hackmyvm.

![img36](/writeups/hackmyvm/birdeye/media/36.webp)
