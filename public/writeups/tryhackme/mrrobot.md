---
title: Mr Robot
date: '2026-11-02'
draft: false
description: Writeup de la máquina Mr Robot en TryHackMe.
categories:
  - TryHackMe
tags:
  - Information Disclosure
  - Broken Authentication
  - Remote Code Execution
  - Credential Exposure
  - Misconfiguration
  - Privilege Escalation
  - Brute Force
  - CMS Exploitation
level: Medium
---

# Enumeración

En este caso vamos directamente a intentar verificar el TTL de la máquina víctima para intentar intuir el sistema operativo:

```bash
ping -c 1 10.65.145.55
```

![img2747](/writeups/tryhackme/mrrobot/media/2747.webp)
Como podemos observar, tenemos un `TTL=62`. Esto quiere decir que posiblemente su valor original era de `64`, claro este se resta por las conexiones intermedias en la VPN de la plataforma, por lo que podemos intuir un sistema de base UNIX.

Vamos a comenzar con el escaneo mediante la herramienta de `nmap` de la siguiente manera:

```bash
 sudo nmap -p- --open -sS --min-rate 5000 -n -v -Pn 10.65.145.55 -oG allPorts
```

![img2748](/writeups/tryhackme/mrrobot/media/2748.webp)
Logramos ver cómo los puertos 22, 80 y 443 se encuentran abiertos con los servicios de SSH, HTTP y HTTPS respectivamente. Con esta información vamos directamente a realizar un escaneo mucho más profundo sobre estos tres puertos de la siguiente forma:

```bash
sudo nmap -p22,80,443 -sVC 10.65.145.55 -oN target
```

![img2749](/writeups/tryhackme/mrrobot/media/2749.webp)
Logramos observar que los servicios de HTTP y HTTPS los proporciona el software de Apache y la versión de SSH también podemos observarla y en esta vemos Ubuntu, esto no asegura ni confirma absolutamente nada, pero con esta información podemos ir construyendo la posibilidad de ser un sistema base UNIX de tipo Linux.

Vamos a comenzar a analizar los servicios, en este caso por el de HTTP y el de HTTPS primero los voy a analizar con `whatweb` para mirar el resultado:

```bash
whatweb http://10.65.145.55
whatweb https://10.65.145.55
```

![img2750](/writeups/tryhackme/mrrobot/media/2750.webp)
Prácticamente, vemos lo mismo así que vamos a verificarlo en un navegador a ver qué encontramos.

![img2751](/writeups/tryhackme/mrrobot/media/2751.webp)

Tanto en HTTP como en HTTPS tenemos exactamente lo mismo así que me voy a quedar con HTTP para analizarlo y vemos la web de la imagen, podemos investigar sobre cada opción y vamos a observar que tiene videos o información extra del ctf, pero si nos fijamos un poco más allá cada opción nos lleva a una nueva ruta interna por ejemplo en `inform`:

![img2752](/writeups/tryhackme/mrrobot/media/2752.webp)
Como observamos eso es lo que llama mi atención y en este caso como observamos múltiples rutas voy a realizar un descubrimiento de directorios mediante la herramienta de `gobuster` de la siguiente manera:

```bash
gobuster dir -u http://10.65.145.55 -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img2753](/writeups/tryhackme/mrrobot/media/2753.webp)

Logramos encontrar mucha información interesante y es que observamos unas rutas de WordPress que me llevan a pensar que por detrás está funcionando, además de que logro observar un `readme` y el mítico `robots` así que vamos a ver el contenido de estos dos:

![img2754](/writeups/tryhackme/mrrobot/media/2754.webp)
Bueno el `readme` la verdad como una especie de pista que nos indica que no vamos mal pero que no nos brindará ayuda.

![img2755](/writeups/tryhackme/mrrobot/media/2755.webp)
Como observamos en el `robots` sí tenemos 2 rutas interesantes que son `fsocity.dic` y también otro que dice `key-1-of-3.txt` por lo que vamos a ver primero el contenido de `key-1-of-3.txt` que puede ser la primera flag:

![img2756](/writeups/tryhackme/mrrobot/media/2756.webp)
Como podemos observar sí tenemos la primera flag.

Ahora tenemos también `fsocity.dic` veamos qué tenemos:

![img2757](/writeups/tryhackme/mrrobot/media/2757.webp)
Observamos lo que parece ser un diccionario, y aquí esto tiene mucho sentido y es que si recordamos por detrás parece ser un WordPress y las rutas revelaban un `wp-login` así que podemos ir a visitar si está activo:

![img2758](/writeups/tryhackme/mrrobot/media/2758.webp)
Perfecto ahora tenemos un diccionario que podemos intentar usar para descubrir credenciales válidas en este panel, por lo tanto, primero será descargar el diccionario:

```bash
wget http://10.65.145.55/fsocity.dic
```

![img2759](/writeups/tryhackme/mrrobot/media/2759.webp)
Listo con el diccionario en local vamos a revisar siempre en caso de diccionarios no tener valores repetidos porque si es así no sirve de nada el hecho de tener más de 2 veces un valor, por lo tanto, juguemos con `sort -u` para verificar:

```bash
cat fsocity.dic | wc -l
cat fsocity.dic | sort -u | wc -l
```

![img2760](/writeups/tryhackme/mrrobot/media/2760.webp)
Lo que observamos es que claramente tenemos múltiples valores repetidos que en realidad no nos interesa usar, por lo tanto, vamos a reducirlo eliminando esos valores duplicados:

```bash
cat fsocity.dic | sort -u | sponge fsocity.dic
```

![img2761](/writeups/tryhackme/mrrobot/media/2761.webp)
Perfecto, ya contamos con un diccionario sin duplicados el cual podemos utilizar.

# Explotación

Ahora vamos a capturar una petición de login de nuestro `wp-login` en BurpSuite y enviarlo al intruder:

![img2762](/writeups/tryhackme/mrrobot/media/2762.webp)
En la imagen observamos el patrón que es seleccionar en este caso el usuario, darle a agregar para poder hacer el ataque sobre ese campo y luego en load vamos a cargar el diccionario:

![img2763](/writeups/tryhackme/mrrobot/media/2763.webp)

Ya con todo listo vamos a realizar el ataque dando clic en `Start Attack` y esperamos.

![img2764](/writeups/tryhackme/mrrobot/media/2764.webp)
Notamos que en la captura lo que hice es filtrar por longitud y aun así se pregunta cómo sabemos exactamente que eso es lo que nos interesa y es que tenemos que saber que lo que buscamos es algo diferente algo no usual y en este caso si observamos esta respuesta sale totalmente del patrón de `4098 y 4147` que son lo común, por lo tanto, la revisamos:

![img2765](/writeups/tryhackme/mrrobot/media/2765.webp)

Listo, encontramos lo que queríamos si observamos en realidad obtenemos que el mensaje de error no es "el usuario y la contraseña no son válidas", sino específicamente "la contraseña para el usuario `elliot` es incorrecta", por lo tanto, ya sabemos que el usuario `elliot` existe y es un usuario válido.

Ahora vamos a repetir el mismo ataque con el mismo diccionario pero orientado a la contraseña para poder ver si se encuentra en el diccionario que tenemos:

![img2766](/writeups/tryhackme/mrrobot/media/2766.webp)

Al terminar tenemos claramente una respuesta con código de estado `302` y esto es lo que se buscaba, ya que al ser válido nos tiene que redireccionar, pero de igual forma vamos a revisarlo:

![img2768](/writeups/tryhackme/mrrobot/media/2768.webp)
![img2769](/writeups/tryhackme/mrrobot/media/2769.webp)

Perfecto ya estamos dentro del panel de administración de WordPress.

En este punto ya vamos a intentar una reverse shell mediante los temas y para esto vamos a ir a la parte de apariencia y editor:

![img2770](/writeups/tryhackme/mrrobot/media/2770.webp)

Una vez allí necesitamos seleccionar cualquier tema en este caso yo voy a seleccionar `Twenty Thirteen`:

![img2771](/writeups/tryhackme/mrrobot/media/2771.webp)
El archivo en este caso a editar será el de `index.php` y lo modificaremos para tener un RCE:

![img2772](/writeups/tryhackme/mrrobot/media/2772.webp)

Con esto listo actualizamos el archivo y probamos ingresando en la ruta `http://10.64.171.149/wp-content/themes/twentythirteen/index.php?cmd=whoami` de esta forma veremos si funciona correctamente:
![img2773](/writeups/tryhackme/mrrobot/media/2773.webp)
Con esto funcional vamos a generar una `reverse shell`:

![img2774](/writeups/tryhackme/mrrobot/media/2774.webp)
Ya con esto tenemos correctamente una conexión así que le damos tratamiento a la terminal.

# Escalada de Privilegios

## Usuario Robot

Ahora comenzamos identificando los usuarios disponibles en el sistema:

```bash
cat /etc/passwd | grep '.*sh$'
```

Con esto podemos observar el usuario `ubuntu` y `root`, pero vamos a inspeccionar igualmente el `/home` a ver qué encontramos:

![img2776](/writeups/tryhackme/mrrobot/media/2776.webp)
Notamos que tenemos un usuario o carpeta de usuario robot así que veamos qué tenemos dentro:

![img2777](/writeups/tryhackme/mrrobot/media/2777.webp)
Como podemos observar al parecer logramos encontrar la segunda flag y lo que dice ser una contraseña en md5, vamos a analizarla:

![img2778](/writeups/tryhackme/mrrobot/media/2778.webp)
Vamos a intentar romper esa contraseña con la web de `https://crackstation.net/`:

![img2779](/writeups/tryhackme/mrrobot/media/2779.webp)

Notamos que la contraseña es `abcdefghijklmnopqrstuvwxyz` donde vamos a intentar ingresar como el usuario `robot`:

![img2780](/writeups/tryhackme/mrrobot/media/2780.webp)

## Usuario Root

Como podemos observar ya estamos como el usuario `robot` así que vamos a realizar un pequeño reconocimiento con este usuario:

![img2781](/writeups/tryhackme/mrrobot/media/2781.webp)
No tiene permisos de sudo así que vamos a verificar por permisos SUID:

```bash
find / -perm -4000 2>/dev/null
```

![img2782](/writeups/tryhackme/mrrobot/media/2782.webp)
Como podemos observar tenemos el binario de `nmap` con permisos SUID así que vamos a revisar qué podemos hacer en [GTFObins](https://gtfobins.org/).

![img2783](/writeups/tryhackme/mrrobot/media/2783.webp)
Sí podemos al parecer obtener un shell así que vamos a intentarlo:

![img2784](/writeups/tryhackme/mrrobot/media/2784.webp)
Listo ya estamos como el usuario `root` y podemos ver la última flag.

![img2785](/writeups/tryhackme/mrrobot/media/2785.webp)
Con esto tenemos el lab terminado:

![img2787](/writeups/tryhackme/mrrobot/media/2787.webp)

# Mitigaciones

Como es claro la ciberseguridad no es solo romper, sino también reconocer y solventar las debilidades de los sistemas es por eso que como parte final de la resolución de esta máquina voy a proponer algunas mitigaciones para este sistema:

## Archivo robots expuesto

El archivo robots.txt está diseñado para guiar a los motores de búsqueda, no para ocultar información sensible. En este escenario, revelaba archivos críticos como diccionarios (fsocity.dic) y flags. La mitigación consiste en no depender de la "seguridad por oscuridad". Los archivos sensibles, diccionarios de la organización o rutas de administración deben estar protegidos mediante controles de acceso a nivel de servidor (por ejemplo, reglas en Apache/Nginx o .htaccess requiriendo autenticación) y nunca deben ser listados en este archivo público.

## Contraseñas a la vista y Fuerza Bruta

Se evidenciaron dos vulnerabilidades críticas en la gestión de credenciales. Primero, WordPress permitía la enumeración de usuarios válidos mediante sus mensajes de error y carecía de protección contra ataques de fuerza bruta. Segundo, el hash de la contraseña del usuario robot estaba en un archivo legible por cualquier usuario del sistema, como mitigación se propone:

- Implementar políticas de contraseñas robustas.
- Instalar herramientas de "Rate Limiting" o plugins de seguridad (como Wordfence o Fail2Ban) para bloquear IPs tras múltiples intentos fallidos.
- Unificar los mensajes de error del login para no confirmar la existencia de usuarios.
- Asegurar que los archivos que contengan credenciales o hashes en el servidor tengan permisos restrictivos (ej. chmod 600), aplicando el principio de menor privilegio.

## Permisos SUID mal gestionados

El sistema contaba con el bit SUID (Set Owner User ID) activado de forma insegura en el binario nmap, lo que permitía a usuarios sin privilegios ejecutar la herramienta como root y aprovechar su modo interactivo para spawnear una shell administrativa.Mitigación:
Se debe aplicar el principio de menor privilegio. Es crucial realizar auditorías periódicas del sistema utilizando comandos como find / -perm -4000 para identificar binarios SUID. Todo binario que no requiera estrictamente estos permisos para el funcionamiento normal del sistema operativo debe ser despojado del bit SUID ejecutando chmod u-s /ruta/al/binario, prestando especial atención a herramientas de red o editores de texto que permitan la ejecución de subcomandos.
