---
title: "Wave"
date: 2026-09-15
draft: false
description: "Writeup de la máquina Wave en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "File Upload",
    "Information Disclosure",
    "Misconfiguration",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/images/wave.webp"
level: Medium
---

# Enumeración

Comenzamos identificando la máquina vulnerable en la red con ayuda de `arp-scan`:

```bash
sudo arp-scan -I vboxnet0 --localnet --ignoredups
```

![img1](/images/Pasted%20image%2020260906094118.webp)

Observamos que la IP de la máquina es la `192.168.56.102`.

Conociendo la IP vamos a realizar un ping a la misma con el objetivo de identificar el valor de su TTL:

```bash
ping -c 1 192.168.56.102
```

![img2](/images/Pasted%20image%2020260906094401.webp)

Cuenta con un `TTL=64`, donde si este no ha sido alterado claramente estamos frente a un sistema de base Unix.

Con esta información previa comenzamos con la enumeración de puertos mediante `nmap`:

```bash
sudo nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.56.102 -oG allPorts
```

![img3](/images/Pasted%20image%2020260906094728.webp)

Como resultado tenemos que el puerto 22 y el puerto 80 están abiertos corriendo respectivamente los servicios de SSH y HTTP.

Ahora sobre estos puertos abiertos vamos a realizar un escaneo más exhaustivo para descubrir sus versiones e información extra:

```bash
nmap -p22,80 -sVC 192.168.56.102 -oN target
```

![img4](/images/Pasted%20image%2020260906095036.webp)

En cuanto al puerto 22 no tenemos mucho que hacer, pero, en cambio observamos que en el puerto 80 el servicio de HTTP está realizando mediante un nginx 1.22.1, además de que gracias a algunos scripts básicos de reconocimiento que lanza nmap podemos observar que ha detectado la ruta de `robots.txt`.

Con la detección de `robots.txt` procedemos a revisarlo:

![img5](/images/Pasted%20image%2020260906095535.webp)

Podemos ver que nos describe a `/backup`. Recordemos que la ruta de `robots.txt` se utiliza para indicar a los rastreadores de motores de búsqueda lo que no se quiere indexar en la web, no es un estándar ni mucho menos una forma de ocultar rutas debido a que como vemos un atacante podría en realidad a través del mismo enumerar rutas que el desarrollador no quiere que sean del todo públicas.

Ahora procedemos a revisar `/backup`:

![img6](/images/Pasted%20image%2020260906095838.webp)

Se nos listan algunos backups de varios archivos cuyo contenido se intentará verificar, pero para esto los descargamos de forma recursiva con ayuda de `wget`:

```bash
wget -r http://192.168.56.102/backup/
```

![img7](/images/Pasted%20image%2020260906100011.webp)

Al terminar como observamos contamos con una carpeta donde dentro encontraremos todos los archivos:

![img8](/images/Pasted%20image%2020260906100048.webp)

En este punto voy a pasar cada uno de los archivos por el comando file, esto nos ayuda a identificar el tipo de archivo con base en su contenido:

```bash
ls | while read file; do file $file; done
```

![img9](/images/Pasted%20image%2020260906100214.webp)

Como podemos observar, contamos con varios archivos simplemente de texto donde solo 2 parecen relevantes y son `phptest.bck` y `weevely.bck`, en este punto es lógico si se están realizando backups de estos archivos posiblemente hablamos de que existen y están expuestos.

Si revisamos a `phptest.bck` en su contenido encontramos lo siguiente:

![img10](/images/Pasted%20image%2020260906100436.webp)

Como observamos simplemente es un print y si verificamos su existencia como `phptest.php` en la web pues vemos lo siguiente:
![img11](/images/Pasted%20image%2020260906100515.webp)

Listo esto no tiene mayor misterio.

Siguiendo esta lógica con el archivo `weevely.bck`, su contenido es el siguiente:

![img12](/images/Pasted%20image%2020260906100621.webp)

En este caso como observamos no es legible, pero aquí entra un concepto importante y es que este archivo mediante el comando `file` figuró como un archivo `phar` que es un formato para empaquetar en un solo archivo varios script PHP, por lo tanto vamos mediante el comando `phar` a desempaquetarlo:

```bash
mv weevely.bck weevely.phar
phar extract -f weevely.phar
```

![img13](/images/Pasted%20image%2020260906100951.webp)

# Explotación

Como observamos ahora contamos con un nuevo archivo llamado `x` el cual tiene como contenido lo siguiente:

![img14](/images/Pasted%20image%2020260906101210.webp)

Comprender este código es algo complejo de primeras pero vamos a explicarlo lo mejor posible:

1. Contamos con un eval global y dentro varias variables aquí tenemos que entender que gracias a donde está el eval y por cómo funciona es que en realidad convierte a cada una de las declaraciones en variables globales y usables en el código.
2. Contamos con una función que recibe 2 parámetros uno es un texto y el otro no es más que la variable declarada `k` el porqué es que dentro de la misma vamos a utilizarla para realizar una combinación XOR y así cifrar y descifrar el contenido, al final esta función retorna la cadena cifrada o descifrada, recordemos que la combinación o cifrado XOR se cifra de forma sencilla y aplicando la misma operatoria podemos realizar el descifrado.
3. Ahora tenemos una condicional ésta verifica si dentro de la petición que se realiza al recurso, en este caso a `weevely` contiene dos cadenas que son las variables `kh` y `kf`, donde si detecta contenido simplemente ingresa.
4. Dentro del condicional contamos con `@ob_start()` y `@ob_end_clean()`, lo que sucede es que eso crea en realidad un nuevo buffer donde todo lo que se encuentre dentro así en este caso específico ocultando la salidas de los comandos eval en este caso.
5. Tenemos dentro de un `@ob_get_contets()` esta función por defecto nos permitiría recuperar la salida del buffer y en este caso guardarla en una variable
6. Tenemos una operatoria dentro con `@eval` simplemente se esta realizando el proceso inverso al contenido que recibe y aquí entra lo interesante debido a que se puede utilizar para la ejecución remota de comandos y tenemos lo que es un **Backdoor**. Continuando pues al contenido se recibe se decodifica el base64, luego se pasa a la función de XOR por ultimo se descomprime y se evalúa.
7. Ahora esa ejecución vive en el nuevo buffer y se guarda en la variable `o` para posteriormente volver a enviarse con el mismo formato en la respuesta de la web. Al realizar el mismo proceso del lado del atacante ya obtenemos el resultado del comando.

Comprendiendo que tenemos un backdoor ya en la web que podemos utilizar tenemos que encontrar y ver si el archivo se esta ejecutando. Conocemos que su nombre es `weevely` pero su extensión no así que con ayuda de `goobuster` vamos a realizar fuzzing para determinar la extensión de la siguiente manera:

```bash
ffuf -u "http://192.168.56.102/weevelyFUZZ" -w /usr/share/seclists/Discovery/Web-Content/web-extensións.txt
```

![img15](/images/Pasted%20image%2020260906111824.webp)

Como podemos observar con el resultado es que el archivo es `weevely.php7`.

Ahora conociendo todo el proceso me di a la tarea de crear un pequeño script en python que nos ayude a hacerlo de forma automática y tener una ejecución de comandos directa, el script lo pueden encontrar en [aquí](<https://github.com/danystarrkk/Hacking-Tools/tree/main/Tools/RCE%20(Wave)>).

Con el script es cuestión de hacer lo siguiente:

```bash
python3 backConect.py whoami
```

![img16](/images/Pasted%20image%2020260906165458.webp)

Como se observa gracias al script podemos ejecutar commandos de forma remota en el servidor.

Con esto simplemente vamos a enviarnos una reverse shell:

![img17](/images/Pasted%20image%2020260906165923.webp)

Ya nos encontramos dentro de la máquina.

# Escalando Privilegios 1

Algo que siempre hago es enumerar usuario en la máquina mediante el archivo `/etc/passwd` de la siguiente manera:

```bash
cat /etc/passwd | grep 'sh$'
```

![img18](/images/Pasted%20image%2020260906204218.webp)

Como podemos observar tenemos 3 usuarios que son `carla`, `angie`, y `root`.

En este caso, se realiza el reconocimiento por permisos SUID y ejecución de comandos configurados por sudo, pero no se encontró.

Se procedió a revisar puertos abiertos de forma interna de la siguiente manera:

```bash
ss -nltp
```

![img19](/images/Pasted%20image%2020260906204559.webp)

En el resultado vemos como el puerto `3923` se encuentra abierto, podemos intentar ver qué proceso se encuentra corriendo y sobre qué usuario lo está haciendo de la siguiente manera:

```bash
ps aux | grep 127.0.0.1
```

![img20](/images/Pasted%20image%2020260906205507.webp)
En los resultados vemos dos que nos interesan, donde, se evidencia que se esta ejecutando como el usuario angie un servicio de python con el nombre de `copyparty-sfx.py`. Buscando de qué se trata encuentro que es un servidor de archivos completo, rápido y ligero, el cual cuenta con servicio web y esto posiblemente es lo que corre por el puerto `3923`.

Para poder analizarlo mucho mejor vamos a realizar port forwarding mediante la herramienta de `chisel`, recordar que necesitamos el binario tanto en la máquina atacante como en la máquina víctima:

![img21](/images/Pasted%20image%2020260906211110.webp)

Con esto tenemos listo el tunel, así que vamos a verificarlo entrando desde el navegador a ver que encontramos:

![img22](/images/Pasted%20image%2020260906211204.webp)

Perfecto ya vemos el portal y es aquí donde tenemos que pensarlo bien, si recordamos el archivo que ejecuta para levantar esto está en el **Home** por lo tanto como vemos el script en realidad queremos suponer que todo lo que subamos llega a home, además de que claro ya tenemos la flag de usuario.

Con lo anterior en mente lo que vamos a hacer es subir una `Authorizedkey` esto con el objetivo de poder simplemente conectarnos mediante ssh, y para esto la vamos a crear de la siguiente manera:

```bash
ssh-keygen
```

![img23](/images/Pasted%20image%2020260906211621.webp)
En este caso no es necesario especificar mucho podemos dejarlo tal y como lo genera y no es necesario establecer una contraseña, con la clave creada lo que vamos a hacer es copiar el contenido de la clave publica dentro de un archivo llamado `authorized_keys` y le asignamos los permisos 600.

```bash
touch authorized_keys
echo "contenido de la clave publica" > authorized_keys
chmod 600 authorized_keys
cat autorized_keys
```

![img24](/images/Pasted%20image%2020260906211931.webp)
Ya con esto vamos a crear una carpeta `.ssh` en el directorio actual y moveremos el archivo dentro:

```bash
mkdir .ssh
mv authorized_keys .ssh
```

![img25](/images/Pasted%20image%2020260906212122.webp)

Listo ya con esto tenemos todo listo, algo que tenemos que tener en cuenta es que para que esto sea válido es que el directorio que contenga la clave de autorización tenga solo permisos de manipulación para el usuario en pocas permisos 700 así que vamos a darle eso permiso a la carpeta `.ssh`:

```bash
chmod 700 .ssh
```

![img26](/images/Pasted%20image%2020260906212325.webp)

En este punto creo que el objetivo es claro subir esto mediante el servicio que contamos, el servidor al almacenarlo directamente en el **home** crearemos directamente la carpeta .ssh y su clave autorizada lo que nos permitirá una conexión legítima por ssh:

![img27](/images/Pasted%20image%2020260906212511.webp)
![img28](/images/Pasted%20image%2020260906212526.webp)

Ya con esto podemos intentar conectarnos como el usuario `angie` a ver si logramos establecer la conexión:

```bash
ssh angie@192.168.56.102
```

![img29](/images/Pasted%20image%2020260906212642.webp)

Ya estamos dentro como el usuario angie.

# Escalada de Privilegios 2

En este punto realizamos el mismo reconocimiento y en este caso ahora vemos algo al revisar las capacidades de `sudo`:

```bash
sudo -l
```

![img30](/images/Pasted%20image%2020260906212819.webp)
Listo, podemos ejecutar el comando `/usr/bin/less -F /opt/secret.txt` sin necesidad de contraseña.

Para esto al ser el binario less podemos buscar en GTFOBINS por vulnerabilidades conocidas:

![img31](/images/Pasted%20image%2020260906213234.webp)

Encontramos y esta vulnerabilidad se basa en el hecho de que archivos extremadamente largos entran en algo parecido a vim donde dentro del mismo podemos llamar una terminal.

Ahora si lo intentamos ejecutando nuestro archivo veremos que no funciona:

![img32](/images/Pasted%20image%2020260906213351.webp)

Esto se debe a que las dimensiones de la terminal son tan grandes que abarca todo el archivo sin problema por lo tanto vamos a forzar a que la TTY solo pueda imprimir máximo 2 lineas:

```bash
stty rows 2 columns 100
```

![img33](/images/Pasted%20image%2020260906213507.webp)

Con esto podemos volver a intentarlo y veremos lo siguiente:

```bash
sudo /usr/bin/less -F /opt/secret.txt
```

![img34](/images/Pasted%20image%2020260906213528.webp)

Entramos donde necesitábamos por lo tanto podemos ejecutar la siguiente linea para invocar una bash:

```bash
!/bin/bash
```

![img35](/images/Pasted%20image%2020260906213649.webp)

Listo como observamos tenemos una terminal como el usuario `root` y podemos obtener ya la última flag.

![img36](/images/Pasted%20image%2020260906213916.webp)

Máquina Terminada.

# Mitigaciones

Tras finalizar los procesos de enumeración y explotación de la máquina, se detallan las vulnerabilidades identificadas y las prácticas de seguridad recomendadas (desde una perspectiva de _Blue Team_) para remediar estos fallos:

## Exposición de información sensible y copias de seguridad

El compromiso inicial fue posible debido a la exposición del directorio `/backup`. Intentar ocultar estas rutas listándolas en el archivo `robots.txt` es una mala práctica conocida como "seguridad por oscuridad", ya que en lugar de proteger el recurso, facilita su descubrimiento por parte de atacantes.

Mitigación: Almacenar las copias de seguridad en directorios externos a la raíz pública del servidor web (fuera de `/var/www/html`). Adicionalmente, se deben configurar reglas en el servidor web (Nginx) para denegar explícitamente el acceso a directorios de respaldo o archivos con extensiones sensibles (como `.bck`, `.bak`, `.sql`).

## Ausencia de control de integridad y detección de _webshells_

El sistema realizaba copias de seguridad automatizadas sobre el directorio web de forma indiscriminada, llegando al extremo de respaldar un _backdoor_ (Weevely) previamente alojado. Esto evidencia una falta crítica de monitoreo sobre los archivos que residen en el servidor.

Mitigación: Implementar soluciones de Monitoreo de Integridad de Archivos (FIM) para generar alertas ante la creación o modificación inesperada de scripts (PHP, en este caso). También se recomienda configurar análisis periódicos con herramientas de detección de malware y desplegar un Firewall de Aplicaciones Web (WAF) que bloquee las firmas y el tráfico generado por _backdoors_ conocidos.

## Configuración insegura de servicios y escritura en directorios críticos

Se detectó un servicio interno de transferencia de archivos (Copyparty) ejecutándose con los privilegios del usuario `angie` y configurado para almacenar las subidas directamente en su directorio `HOME`. Esto originó una vulnerabilidad crítica que permitió escribir la carpeta `.ssh` y el archivo `authorized_keys`, facilitando la conexión remota legítima.

Mitigación: Aplicar el principio de menor privilegio. El servicio debe ejecutarse en un entorno aislado (_sandbox_ o _chroot_) y los archivos subidos deben almacenarse en un directorio temporal o dedicado (ej. `/var/tmp/copyparty_uploads`) sin permisos de ejecución. Además, si la cuenta del usuario se utiliza únicamente para administrar este servicio, se debe deshabilitar su acceso interactivo por SSH (mediante `/sbin/nologin` o directivas en `sshd_config`).

## Configuración permisiva de Sudo

El vector final para comprometer por completo el sistema radicó en una mala gestión de permisos, otorgando privilegios de `sudo` sin contraseña sobre el binario `less`. Al ser un paginador interactivo, `less` permite escapar a una _shell_ del sistema, convirtiéndolo en un vector clásico de escalada de privilegios.

Mitigación: Auditar estrictamente el archivo `/etc/sudoers` para evitar conceder acceso a binarios interactivos que permitan la ejecución secundaria de comandos. Si es indispensable que el usuario utilice `less` mediante `sudo`, se debe aplicar la etiqueta `NOEXEC` en la configuración de _sudoers_ o forzar el uso de la variable de entorno `LESSSECURE=1` para deshabilitar las funciones de escape interactivas.
