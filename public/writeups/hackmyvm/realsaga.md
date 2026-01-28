---
title: "RealSaga"
date: 2026-01-25
draft: false
description: "Writeup de la máquina SilentDev en HackMyVM."
categories: ["HackMyVM"]
tags: ["CVE-2020-35234","Exposed Debug Logs","User Enumeration","Authenticated Remote Code Execution","SUID Privilege Escalation","Docker Socket Misconfiguration","Container Escape"]
image: "/images/realsaga.webp"
level: Medium
---

# Reconocimiento

Comenzamos identificando la máquina en red, esto con ayuda de [[Arp-Scan]]:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020260124112349.webp)

Como podemos observar, la IP de la máquina víctima es `192.168.1.99`. A continuación vamos a intentar intuir el sistema operativo a partir de su `ttl`, esto con ayuda del comando ping:

```bash
ping -c 1 192.168.1.99
```

![img2](images/Pasted%20image%2020260124112524.webp)

Tenemos un `ttl=64`, esto nos permite intuir un sistema basado en Linux.

Comenzamos con un escaneo activo inicial, solo para identificar en su mayoría los puertos expuestos, esto con ayuda de [[Nmap]]:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.99 -oG allPorts
```

![img3](images/Pasted%20image%2020260124112906.webp)

Se identifican los puertos 25 y 80 abiertos, y ya podemos ver que corren los servicios de `smtp` y `http`, respectivamente.

Centrándonos en estos dos puertos, vamos a realizar un escaneo más agresivo para intentar obtener información de estos servicios de la siguiente manera:

```bash
nmap -p80,25 -sVC 192.168.1.99 -oN target
```

![img4](images/Pasted%20image%2020260124115216.webp)

Como podemos observar, tenemos cierta información extra sobre la máquina víctima. En este caso específico, lo que podemos observar es que el servicio del puerto 25 es un `Postfix smtp`, además tenemos el puerto 80 donde logramos ver dos cosas interesantes: la versión de Apache, que es la 2.4.29, y el `http-title`, donde lo que logro observar es un `saga.local`, lo que me intenta decir que tiene ese dominio asociado. Con esto en mente, procedo a configurar el dominio perteneciente a la IP de la máquina víctima para evitar problemas.

Ahora vamos a identificar las tecnologías con ayuda de [[Whatweb]] y Wappalyzer para tener una idea de lo que tenemos corriendo:

![img5](images/Pasted%20image%2020260124120652.webp)

![img6](images/Pasted%20image%2020260124120731.webp)

De entre todo lo que podemos observar, nos vamos a fijar directamente en `WordPress`, y vamos a volver a utilizar [[Nmap]] con uno de sus scripts, que es `http-enum`, para ver si logramos encontrar algo:

```bash
nmap --script='http-enum' -p80 192.168.1.99 -oN WebScan
```

![img7](images/Pasted%20image%2020260124122432.webp)

De todo lo que podemos observar, vemos una ruta de un `backup` el cual no contiene nada, luego vemos un panel de login el cual sí nos puede servir. Por último, no es toda la ruta, pero algo interesante es que se puede ver dentro de `wp-includes`, esto nos puede llevar a hacer una hipótesis donde quizás también logremos ver lo que es la carpeta de `wp-content`:

![img8](images/Pasted%20image%2020260124122708.webp)

Pues sí, logramos acceder, pero no vemos nada. En este punto, y tomando en cuenta que tenemos varios recursos expuestos, vamos a intentar enumerar con ayuda de [[Gobuster]] las rutas de la web de la siguiente manera:

```bash
gobuster dir -u http://saga.local -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img9](images/Pasted%20image%2020260124122933.webp)

Vemos algunas rutas que ya nos reportó [[Nmap]], pero vamos a intentar ver dentro de `wp-content`. Recordemos que dentro de esta ruta usualmente se almacena mucha información y complementos de WordPress, por lo que es una buena idea enumerarla:

```bash
gobuster dir -u http://saga.local/wp-content -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img10](images/Pasted%20image%2020260124123125.webp)

Perfecto, vemos algunas rutas que pueden servir de mucho, como son `logs` y `plugins`. Esto es porque, si tenemos logs, podríamos de diversas maneras aprovecharnos de estos para intentar conectarnos a la máquina víctima, pero en este caso la ruta apenas contiene información y no es nada relevante. Con respecto a los `plugins`, muchas veces los administradores los gestionan mal o no les dan el debido mantenimiento, como son las actualizaciones, lo que provoca que alguno de estos pueda tener una vulnerabilidad conocida o tenga algo expuesto, por lo que vamos a ver si la ruta tiene permisos de _directory listing_ para poder verlos:

![img11](images/Pasted%20image%2020260124123549.webp)

Perfecto, sí nos permite ver los diferentes plugins instalados. Ahora nosotros, de forma manual, podríamos analizar esto desde la web, pero muchas veces, como en este caso que tenemos una cantidad grande de plugins, es mejor descargarlos de forma recursiva con ayuda de `wget`:

```bash
wget -r http://saga.local/wp-content/plugins
```

![img12](images/Pasted%20image%2020260124123841.webp)

Podemos observar ya la carpeta. Algo que personalmente me gusta mucho es jugar con `tree` para ver primero de forma general qué es lo que tiene el proyecto y luego elimino resultados del tipo .webp, index, jepg, jpg, svg, gif, css`, con el objetivo de reducir la carga visual y analizar lo que nos queda:

```bash
tree | grep -vE 'index|\.webp|\.gif|\.jpg|\.css|\.svg|\.jepg'
```

![img13](images/Pasted%20image%2020260124124638.webp)

Nuestro árbol visual sigue siendo enorme, aun con los filtros, y no sale todo en la imagen, pero aunque no lo sintamos aún, esto ya nos da una carga visual menor. Ahora, aclaro, no es necesario entender ni analizar cada plugin a profundidad; el propósito es identificar cada uno de los plugins y entender su funcionamiento de forma superficial. A partir de allí es donde este árbol se vuelve importante, y esto es porque ya con una idea de para qué o qué hace el plugin, podemos identificar cosas que nos puedan servir.

Luego del análisis que mencionamos, tenemos dos plugins que de alguna forma conectan con la información que tenemos y son `easy-wp-smtp` y `contact-form-7`, que leyendo un poco descubrimos que pueden llegar a usar el protocolo `smtp`, y recordando que este servicio está activo, son vectores importantes, por lo que podemos centrarnos en estos dos y vamos a ver con atención sus árboles:

- `easy-wp-smtp`

![img14](images/Pasted%20image%2020260124125251.webp)

- `contact-form-7`

![img15](images/Pasted%20image%2020260124125324.webp)

Bueno, lo que más por el momento llama mi atención es que tenemos posibles logs visibles. Aunque el archivo está vacío, no vamos a descartar esta opción. En este punto, lo que vamos a hacer es apoyarnos con la herramienta `nuclei`, recordando y especificando que lo que buscamos es un antes y un después de su ejecución, es decir, ver si algo que nos llama la atención cambia. En mi caso, lo que quiero ver más de cerca es si alguno de los muchos procedimientos que hace `nuclei` afecta a estos logs y logramos obtener algo, por lo tanto vamos a ejecutar la herramienta de la siguiente manera:

# Explotación

```bash
nuclei --target http://saga.local
```

![img16](images/Pasted%20image%2020260124125654.webp)

No es necesario esperar resultados por parte de la ejecución; podemos intentar ver los archivos que nosotros catalogamos como importantes o que podrían cambiarse, alterarse o modificarse. Tenemos que estar pendientes y ver qué tenemos.

En este caso, yo logro ver cómo `nuclei`, mediante algún proceso que ya veremos si nos reportó, logra que algo active el plugin de `easy-wp-smtp` y genere logs, que son los siguientes:

![img17](images/Pasted%20image%2020260124130150.webp)

Podemos observar todo eso, y yo ya remarqué cosas que a mí me sirven, como lo son correos y lo que creo que es el vector que tomó de ataque `nuclei`, que es al parecer un panel de comentarios que nosotros, de forma normal o como usuarios, no logramos observar, pero está allí y está funcionando, por lo que pasemos a ver si nos lo reporta `nuclei`:

![img18](images/Pasted%20image%2020260124131022.webp)

De todo eso y más, lo que logra es detectar que tenemos un `CVE-2020-35234` correspondiente a nuestro plugin `easy-wp-smtp`, donde si leemos un poco de información sobre este plugin nos dice que un atacante puede tomar control de cuentas si se encuentra expuesto el archivo `*_debug_log.txt`, que es el que nosotros detectamos, y al parecer este archivo contiene los enlaces que se envían a los usuarios que intentan restablecer contraseñas, por lo tanto ya tenemos algo significativo.

En este punto tenemos que conectar puntos. Recordemos algo, y es que tenemos un panel para hacer login y ahora tenemos algunos correos que podemos intentar, por lo tanto vamos a ver si alguno es válido:

![img19](images/Pasted%20image%2020260124131654.webp)

Como este panel permite enumerar usuarios y correos mediante el mensaje que emite, podemos observar que este correo de administrador existe. Ahora, si nos fijamos, tenemos la opción de restablecer contraseña en el panel, por lo tanto lo que vamos a hacer es intentar restablecerla y ver si al archivo de logs que la aplicación tiene expuesto llega el código o link para cambiar la contraseña del usuario:

![img20](images/Pasted%20image%2020260124131902.webp)

![img21](images/Pasted%20image%2020260124132024.webp)

Podemos observar que sí está y encontramos el link. Vamos a cambiar la contraseña del administrador, y algo extra es que tenemos hasta su usuario, que es `wpadmin`:

![img22](images/Pasted%20image%2020260124132116.webp)

Listo, ya establecimos una nueva contraseña, así que vamos a intentar ingresar con las credenciales que se establecieron:

![img23](images/Pasted%20image%2020260124132217.webp)

![img24](images/Pasted%20image%2020260124132230.webp)

Como observamos, ya estamos dentro del panel administrativo de WordPress.

Ya en el panel administrativo, tenemos que buscar la forma de lograr una conexión directa al servidor. Para esto, vamos a intentar aprovecharnos de alguno de los plugins instalados; en mi caso voy a usar el de `Hello Dolly` y en su archivo `index.php` voy a agregar una línea que nos permita realizar la reverse shell:

![img25](images/Pasted%20image%2020260125133741.webp)

Como podemos observar, ya está listo el archivo. Vamos a guardarlo y, antes de activarlo, dejamos el puerto 443 en escucha:

![img26](images/Pasted%20image%2020260125133902.webp)

![img27](images/Pasted%20image%2020260125133932.webp)

Al presionar el botón de activar la extensión que modificamos, se debería establecer la reverse shell:

![img28](images/Pasted%20image%2020260125134040.webp)

# Escalada de Privilegios

Perfecto, ya podemos dar tratamiento a la terminal y comenzar con un reconocimiento, donde lo primero que se hace es ver el sistema y la IP. El objetivo es identificar dónde estamos:

![img29](images/Pasted%20image%2020260125134350.webp)

Como podemos observar, mediante un `uname -a` e `ip a` logramos identificar que es un sistema Linux, específicamente un Ubuntu, pero la IP que nos reporta no es la de la máquina principal, lo que nos lleva a pensar en contenedores.

Con lo anterior, cuando es un contenedor del tipo Docker, vamos a poder encontrar en la raíz del sistema un archivo oculto con el nombre de `.dockerenv`:

![img30](images/Pasted%20image%2020260125135022.webp)

Logramos observar que el archivo existe, por lo tanto sabemos con certeza que se trata de un contenedor Docker.

Bueno, en este punto nosotros ya podemos obtener la flag de usuario:

![img31](images/Pasted%20image%2020260125135220.webp)

El objetivo en este punto es escapar, pero para esto lo mejor será poder tener acceso `root` dentro del contenedor, por lo que podemos hacer un pequeño reconocimiento:

![img32](images/Pasted%20image%2020260125135410.webp)

Como podemos observar, con `sudo -l` no logramos observar nada, pero cuando realizamos una búsqueda por archivos SUID con ayuda de `find`, logramos encontrar que este binario tiene asignados los permisos SUID.

Bueno, cuando tenemos este tipo de permisos, la opción más rápida es buscar por documentación la opción de usar el comando para obtener una shell. En este caso, mediante la web de GTFOBins vemos que ya se tiene un comando válido y es el siguiente:

```bash
find . -exec /bin/sh -p \; -quit
```

![img33](images/Pasted%20image%2020260125135712.webp)

Como podemos observar, ya tenemos una shell como `root`.

En este punto tenemos que intentar escapar del contenedor. Uno de los métodos que nos permite esto es el uso del archivo `docker.sock`, el cual solo estará presente si ha sido montado y es accesible desde el contenedor, debido a que a través de este socket es posible interactuar con el daemon de Docker y crear nuevos contenedores. Usualmente este archivo se encontrará dentro de `/var/run/docker.sock`:

![img34](images/Pasted%20image%2020260125140623.webp)

En este caso específico, al parecer no tenemos directamente el archivo `docker.sock`, sino un `docker.saga`, mediante el cual vamos a intentar hacer la interacción de la siguiente manera:

```bash
docker -H unix:///var/run/docker.saga images
```

![img35](images/Pasted%20image%2020260125140847.webp)

Como podemos observar, sí es posible usar de forma remota el daemon de Docker con ayuda del archivo, por lo que en este punto el procedimiento será crear un nuevo contenedor usando la imagen de Ubuntu, que es la que tenemos ya allí, y montar la raíz del host dentro del mismo de la siguiente manera:

```bash
docker -H unix:///var/run/docker.saga run -dit -v /:/host f9a80a55f492
```

![img36](images/Pasted%20image%2020260125141548.webp)

Como podemos observar en la imagen, ya tenemos el contenedor creado y corriendo. En este punto, lo que vamos a hacer es, mediante el `container ID`, conectarnos a él para verificar si se realizó la montura de forma correcta de la siguiente manera:

```bash
docker -H unix:///var/run/docker.saga exec -it 1cb13e2911dd /bin/bash
```

![img37](images/Pasted%20image%2020260125141836.webp)

Como podemos observar, ya estamos dentro del otro contenedor y es cuestión de revisar la montura en `/host`:

![img38](images/Pasted%20image%2020260125141941.webp)

Y con esto terminamos la máquina. Podemos observar cómo sí se montó y ya podemos observar todo el directorio raíz del host dentro del contenedor, por lo cual obtenemos la flag de `root`.

Lab terminado.

![img39](images/Pasted%20image%2020260125142107.webp)
