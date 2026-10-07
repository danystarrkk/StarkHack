---
title: "SilentDev"
date: 2025-11-03
draft: false
description: "Writeup de la máquina SilentDev en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Access Control Bypass",
    "File Upload",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/writeups/hackmyvm/silentdev/media/cover.webp"
level: Medium
---

# Enumeración

Bueno, vamos a comenzar identificando la IP de la máquina con ayuda de **Arp-Scan** de la siguiente manera:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/silentdev/media/01.webp)

Como podemos observar nuestra máquina víctima tiene la IP `192.168.1.70`, ahora vamos con ayuda del comando ping a tratar de identificar el sistema operativo:

```bash
ping -c 1 192.168.1.70
```

![img2](/writeups/hackmyvm/silentdev/media/02.webp)

Como podemos observar tenemos un `ttl=64` donde intuimos un sistema operativo Linux.

En este momento ya vamos a realizar un escaneo con **Nmap** con el objetivo de identificar puertos abiertos primero:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.70 -oG allPorts
```

![img3](/writeups/hackmyvm/silentdev/media/03.webp)

Como podemos observar detectamos los puertos 80 y 22 abiertos, ahora mediante otro escaneo de **Nmap** vamos a intentar identificar versiones lanzando algunos scripts básicos de reconocimiento un poco de información:

```bash
nmap -p22,80 -sCV 192.168.1.70 -oN target
```

![img4](/writeups/hackmyvm/silentdev/media/04.webp)

Podemos observar que nos da las versiones de los servicios y mediante la misma ya nos dice que es un Debian, también con esta versión y una búsqueda con `launchpad` podríamos determinar el `codename`:
![img5](/writeups/hackmyvm/silentdev/media/05.webp)

En este caso no logramos identificarlo, pero abra casos en los que sí.

Continuando con la máquina podemos visitar la web alojada en el puerto 80 para ver que podemos encontrar:

![img6](/writeups/hackmyvm/silentdev/media/06.webp)

Vemos que solo tiene ese apartado para subir archivos, Podemos utilizar diferentes herramientas para identificar las tecnologías de la web, en este caso vamos a hacer los **Whatweb** y la extensión de Wappalizer:

```bash
whatweb http://192.168.1.70
```

![img7](/writeups/hackmyvm/silentdev/media/07.webp)

![img8](/writeups/hackmyvm/silentdev/media/08.webp)

En sentido de tecnologías no vemos nada en especial.

Bueno para probar vamos a subir una imagen y ver que sucede:

![img9](/writeups/hackmyvm/silentdev/media/09.webp)

Vemos que al subir nos da una especie de error que nos dice que solo podemos subir imágenes, aunque lo que subimos sí lo fue. Algo que podemos notar en la URL es que tiene la extensión `.php` esto ya nos dice que la web puede interpretar este código.

Si revisamos nuevamente el wappalizer vamos a ver que ya nos detecta `php` como lenguaje:
![img10](/writeups/hackmyvm/silentdev/media/10.webp)

Ahora que conocemos esto, vamos a enviar un archivo malicioso que contenga código para ejecutar comandos con `php`.

# Explotación

Vamos a crear el archivo `cmd.php` con el siguiente contenido:

![img11](/writeups/hackmyvm/silentdev/media/11.webp)

Lo que vamos a hacer es subirlo, pero esa petición la vamos a capturar con ayuda de Burp Suite y la vamos a mandar al repeater para poder analizarla:

![img12](/writeups/hackmyvm/silentdev/media/12.webp)

![img13](/writeups/hackmyvm/silentdev/media/13.webp)

![img14](/writeups/hackmyvm/silentdev/media/14.webp)

![img15](/writeups/hackmyvm/silentdev/media/15.webp)

Como podemos observar ya con la petición en el repeater y enviada vemos que nos da un mensaje de que solo son permitidas las imágenes, en esta ocasión al parecer la verificación del archivo se usa el contenido de la cabecera `Content-Type` por lo que vamos a modificarlo para que aparente una imagen y ver si nos permite subir el archivo:

![img16](/writeups/hackmyvm/silentdev/media/16.webp)

Podemos observar como modificamos la cabecera y en la respuesta ya nos dice que se subió y se encuentra en `uploads/cmd.php`, recordemos que este es un archivo malicioso el cual se le debe pasar un parámetro por lo que para ingresar correctamente tenemos que hacerlos de la siguiente manera `/uploads/cmd.php?cmd=<comando>`:

![img17](/writeups/hackmyvm/silentdev/media/17.webp)

Como podemos observar logramos la ejecución del comando `whoami` por lo que ya tenemos una forma de ejecutar comandos en el servidor.

Ahora que podemos ejecutar comandos, lo que vamos a hacer es ejecutar una reverse shell para controlar todo desde consola.

Primero vamos a dejar el puerto 443 de nuestra máquina atacante en escucha:

```bash
nc -nlvp 443
```

![img18](/writeups/hackmyvm/silentdev/media/18.webp)

Ya con el puerto en escucha vamos a enviar la revese shell de la siguiente manera:

![img19](/writeups/hackmyvm/silentdev/media/19.webp)

Como vemos enviamos la reverse shell y ya deberíamos ver la conexión en nuestra consola:

![img20](/writeups/hackmyvm/silentdev/media/20.webp)

# Escalada de Privilegios

Podemos observar ya solo vamos a encargarnos de dar el tratamiento a la consola:

```bash
scrip /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img21](/writeups/hackmyvm/silentdev/media/21.webp)

Por último ya con la nueva consola exportamos `xterm` para el funcionamiento de comandos básicos como `ctrl + c o ctrl + l`:
![img22](/writeups/hackmyvm/silentdev/media/22.webp)

En este punto vamos a realizar un reconocimiento para archivos SUI:

```bash
find / -perm -4000 2>/dev/null
```

![img23](/writeups/hackmyvm/silentdev/media/23.webp)

No vemos nada especial en realidad por lo que vamos a revisar por tareas cron:

```bash
cat /etc/crontab
```

![img24](/writeups/hackmyvm/silentdev/media/24.webp)

Tampoco vemos nada, podemos revisar otra ruta también:

```bash
ls /var/spool/cron/
```

![img25](/writeups/hackmyvm/silentdev/media/25.webp)

Vemos una carpeta `crontabs`, pero no logramos acceder, ya que no tenemos permisos.

Podemos también buscar por capabilities en el sistema:

```bash
find / -type f -exec getcat {} \; 2>/dev/null
```

![img26](/writeups/hackmyvm/silentdev/media/26.webp)

Bueno tampoco podemos observar nada, en este punto lo que vamos a hacer es crearnos un archivo para poder identificar comandos ejecutados en el sistema,vamos a crear el archivo `procmon.sh` y va a contener lo siguiente:

![img27](/writeups/hackmyvm/silentdev/media/27.webp)

Bueno, con esto lo que hacemos es ver las diferencias entre en los comandos ejecutados en un bucle infinito, el propósito es ver si el comando se ejecutan en cierto tiempo.

Vamos a ejecutar nuestro script y a dejarlo corriendo hasta ver algo:

![img28](/writeups/hackmyvm/silentdev/media/28.webp)

Vemos comandos que se están ejecutando, en este caso algo que llama nuestra atención es que al momento de ejecutar el binario `tar` está usando `*` en seco donde podemos hacer una `wildcard injection`, la base de esta vulnerabilidad es sencilla, se tiene que tener mucho cuidado con como se ejecuta estos comandos, como podemos ver el no asignar un `--` para que se ejecuten opciones extras puede llevar a que si tenemos permisos en este caso dentro de `/opt/project` para crear archivos podríamos crear archivos que como nombre lleven indicaciones esto haciendo que el binario no los interprete como archivos, sino como opciones de comando.

Bueno, lo primero que tenemos que tener en cuenta es si tenemos permisos de crear archivos dentro de `/opt/project`:

![img29](/writeups/hackmyvm/silentdev/media/29.webp)

Podemos ver que pertenecemos al grupo `developers` el cual tiene todos los permisos dentro de `/opt/project` por lo que vamos primero a crear nuestro script malicioso donde se ejecutara un comando como el usuario propietario de los archivos y como no sabemos cual es este usuario ni que permisos tiene preferible vamos a generar otra reverse shell dentro del archivo `shell.sh` y no olvidemos darle permisos:

![img30](/writeups/hackmyvm/silentdev/media/30.webp)

Ahora vamos con los siguientes comandos a crear los archivos que funcionaran como parámetros:

```bash
touch -- '--checkpoint=1'
touch -- '--checkpoint-action=exec=sh shell.sh'
```

![img31](/writeups/hackmyvm/silentdev/media/31.webp)

Ya con esto listo vamos a dejar por el puerto `555` en espera de una conexión:

```bash
nc -nlvp 555
```

![img32](/writeups/hackmyvm/silentdev/media/32.webp)

Luego de un momento, si todo está correcto vamos a recibir la rever shell como el usuario `development`:

![img33](/writeups/hackmyvm/silentdev/media/33.webp)

Como hicimos con el anterior usuario vamos a darle tratamiento a la shell para que se pueda utilizar mucho mejor:

```bash
scrip /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img34](/writeups/hackmyvm/silentdev/media/34.webp)

Por último exportamos `xterm`:
![img35](/writeups/hackmyvm/silentdev/media/35.webp)

Ya con esto podemos intentar ver con `sudo -l` que comandos podemos usar sin necesidad de pasarle contraseña:

![img36](/writeups/hackmyvm/silentdev/media/36.webp)

Vemos que podemos ejecutar un script como el usuario `alfonso` sin necesidad de pasarle contraseña de la siguiente manera:

```bash
sudo -u alfonso /usr/bin/sysinfo.sh
```

![img37](/writeups/hackmyvm/silentdev/media/37.webp)

como podemos observar es que al parecer nos da la opción de ejecutar los comandos `df` y `ps` el problema radica en que nos permite pasarle parámetros extra, esto nos puede permitir inyectar un segundo comando de la siguiente manera:

```bash
; /bin/bash
```

![img38](/writeups/hackmyvm/silentdev/media/38.webp)

Como podemos observar al inyectarle ese segundo comando lo que sucede es que nos da una bash pero ahora como `alfonso`.

En este punto ya podemos ver la flag de usuario:

![img39](/writeups/hackmyvm/silentdev/media/39.webp)

Perfecto ahora podemos verificar que se puede hacer de igual forma como super usuario con `sudo -l`:

![img40](/writeups/hackmyvm/silentdev/media/40.webp)

Vemos que tenemos en este caso un `binario` el cual podemos ejecutarlo con sudo (permisos de administrador):

![img41](/writeups/hackmyvm/silentdev/media/41.webp)

En este caso al script le pasamos un usuario y al parecer nos da la línea que le corresponde del `/etc/passwd`.

En este caso es un binario y por como hace esto podemos intentar ver si está ejecutando alguno de los comandos como `cat` para el archivo o `grep` para filtrar, para esto vamos a usar el comando `strings`:

```bash
strings /user/bin/silentgets
```

![img42](/writeups/hackmyvm/silentdev/media/42.webp)

Al parecer el comando no lo tenemos. Vamos a traernos el binario a nuestra máquina para poder verlo:

![img43](/writeups/hackmyvm/silentdev/media/43.webp)

Ya con esto le damos permisos de ejecución:

![img44](/writeups/hackmyvm/silentdev/media/44.webp)

Vamos a ver ahora si con `string` las cadenas que se pueden leer y vamos a filtrar por concepto sobre `cat`:

```bash
strings binario | grep 'cat'
```

![img45](/writeups/hackmyvm/silentdev/media/45.webp)

vemos que al parecer si se usa `cat` pero esos `@@` como que es extraño, veamos que pasa con el comando `grep`:

```bash
strings binario | grep 'grep'
```

![img46](/writeups/hackmyvm/silentdev/media/46.webp)

Como podemos observar al parecer lo que le pasamos se inserta en `%s` por lo que podemos intentar ingresar un comando en caso de no estar bien sanitizado:
![img47](/writeups/hackmyvm/silentdev/media/47.webp)

!Perfecto ya estamos como root, con esto ya podemos ver la flag del usuario root:

![img48](/writeups/hackmyvm/silentdev/media/48.webp)

Con esto tenemos terminada la máquina.

![img49](/writeups/hackmyvm/silentdev/media/49.webp)
