---
title: "KrustyKrab"
date: 2026-06-28
draft: false
description: "Writeup de la máquina KrustyKrab en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Access Control Bypass",
    "Information Disclosure",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/writeups/hackmyvm/krustykrab/media/cover.webp"
level: Medium
---

# Enumeración

Comenzaremos identificando la máquina víctima con ayuda de `arp-scan`:

```bash
sudo arp-scan -I vboxnet0 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/krustykrab/media/01.webp)

Como observamos, en este caso la IP es la `192.168.56.132`.

Intentemos intuir el sistema operativo con ayuda del comando `ping`:

```bash
ping -c 1 192.168.56.132
```

![img2](/writeups/hackmyvm/krustykrab/media/02.webp)

Observamos un `ttl=64`, con esto no podemos determinar el sistema de forma exacta, pero posiblemente está basado en Unix, lo que ya es una pista y reduce las opciones.

Bueno, vamos a comenzar con el escaneo general, para identificar puertos abiertos, esto con ayuda de `nmap`:

```bash
sudo nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.56.132 -oG allPorts
```

![img3](/writeups/hackmyvm/krustykrab/media/03.webp)

Obtenemos que los puertos abiertos son: 22 y 80, corriendo los servicios de ssh y http respectivamente.

Ahora realicemos un escaneo directo hacia estos dos puertos de igual forma con `nmap`:

```bash
nmap -p22,80 -sVC 192.168.56.132 -oN target
```

![img4](/writeups/hackmyvm/krustykrab/media/04.webp)

Logramos obtener las versiones de cada uno de los servicios correspondiente, además de que en estas nos habla de **Debian**, aun así esto no podría ser del todo certero.

En este punto me interesa saber qué es lo que corre en la web por el puerto 80 así que vamos a ingresar a la web a ver si encontramos algo:

![img5](/writeups/hackmyvm/krustykrab/media/05.webp)

Tenemos la Web de Apache 2 por defecto y con ayuda de Wappalyzer no logramos detectar mucho más.

Algo rutinario es revisar el código fuente de la web, en busca de algún comentario o algo que llame nuestra atención:

![img6](/writeups/hackmyvm/krustykrab/media/06.webp)

Mirando un poco el código nos topamos con ese comentario, recordando que usualmente la ruta por defecto cuando se trabaja con Apache es la `/var/www/html`, y dentro el contenido de la web, es extraño y llamativo el `/finexo`, así que vamos a intentar ingresar:

![img7](/writeups/hackmyvm/krustykrab/media/07.webp)

Excelente, ya tenemos una web con contenido para analizar, en este caso además de información sobre lo que parece ser la aplicación web, nos exponen a algunos trabajadores:

![img8](/writeups/hackmyvm/krustykrab/media/08.webp)

Esto es interesante, ya que nosotros no sabemos si alguno de los nombres pueda estar siendo usado como usuario.

Con lo anterior en mente, dirijámonos a la pestaña del **Login**:

![img9](/writeups/hackmyvm/krustykrab/media/09.webp)

# Explotación

Tenemos un panel de Login simple que cuenta con un captcha. Lo primero que se me ocurre intentar es con credenciales por defecto como `admin:admin` o `root:tor` lo cual no funciona, así que nuestro siguiente paso es intentar con los posibles nombres de usuario que conseguimos en la web:
![img10](/writeups/hackmyvm/krustykrab/media/10.webp)

Observamos un mensaje interesante, donde se expresa que la contraseña no es válida, esto es muy específico ya que si nosotros intentamos con otro usuario como `admin` el mensaje nos habla de usuario no existente:
![img11](/writeups/hackmyvm/krustykrab/media/11.webp)

Esto ya nos hace pensar en que este panel de login cuenta con una enumeración de usuario. Pero bueno ahora que tenemos un usuario válido mi idea será intentar un ataque de fuerza bruta programada en python para lograr encontrar la contraseña del usuario `spongebob`.

El script que va a ser utilizado lo podrán encontrar [aquí](https://github.com/danystarrkk)

Clonado e instaladas las dependencias necesarias vamos a realizar la ejecución del programa de la siguiente manera:

```bash
python3 bruteForce.py -u spongebob -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt -c qms9k1qcb4ldu761p0i2fk9fk9
```

![img12](/writeups/hackmyvm/krustykrab/media/12.webp)

Ahora nos queda esperar, vemos si logramos obtener credenciales.

![img13](/writeups/hackmyvm/krustykrab/media/13.webp)

Perfecto, encontramos credenciales válidas, vamos a intentar el inicio de sesión con esas credenciales:

![img14](/writeups/hackmyvm/krustykrab/media/14.webp)

Como observamos ya estamos como el usuario `SpongeBob`, exploremos la web.

Explorando la web, nos topamos con la posibilidad de cambiar la información del usuario donde, se incluye el cambio de contraseña:

![img15](/writeups/hackmyvm/krustykrab/media/15.webp)

Podemos intentar un cambio de la misma y ver cómo es que se está tramitando la petición por detrás:

![img16](/writeups/hackmyvm/krustykrab/media/16.webp)

Tenemos dos campos cruciales los cuales podemos ver que son el de usuario y contraseña. Mi pregunta es ¿Y si alteramos el usuario para hacer referencia a otro? Si la contraseña llegara a cambiarse al modificar el username estaríamos delante de un IDOR.

Para poder comprobar esto primero vamos a tener que identificar otro usuario en la web.

![img17](/writeups/hackmyvm/krustykrab/media/17.webp)

Al revisar el apartado de mensajes encontramos a `Cristina Danny` que no parece un nombre de usuario, pero, también nos topamos con `Administratro` el cual podría ser un nombre de usuario por lo tanto por qué no intentamos primero usarlo en el inicio de sesión para comprobarlo.

![img18](/writeups/hackmyvm/krustykrab/media/18.webp)

Excelente, vemos que al intentarlo el mensaje es `Wrong Password` por lo tanto el usuario sí es válido. Ahora conociendo esto vamos a comprobar nuestra teoría de un posible **IDOR**, modifiquemos y enviemos la petición a ver qué logramos conseguir:

![img19](/writeups/hackmyvm/krustykrab/media/19.webp)

Ha funcionado, pero algo importante a tener en cuenta, es que nosotros cerramos la sesión, destruyendo así la cookie de sesión que se estaba empleando y generando una nueva, donde, comprobamos que el usuario `Administratro` existe, por lo que la cookie de sesión de la petición debe cambiarse por la nueva asignada y que es válida.

Ahora intentemos iniciar sesión como el usuario `Administratro`:

![img20](/writeups/hackmyvm/krustykrab/media/20.webp)

Perfecto, vemos si con el nuevo usuario tenemos alguna funcionalidad extra.

![img21](/writeups/hackmyvm/krustykrab/media/21.webp)

Al parecer contamos con la funcionalidad de ejecutar comando, con esto podemos generar una **reverse shell**:

![img22](/writeups/hackmyvm/krustykrab/media/22.webp)![img23](/writeups/hackmyvm/krustykrab/media/23.webp)

Logramos la conexión y nos encontramos como el usuario `www-data`.

En este punto podemos comenzar con una enumeración a ver si podemos escalar privilegios.

# Escalada de Privilegios

### Usuario KrustyKrab

Veamos los permisos de `sudo` con los que contamos mediante `sudo -l`:

![img24](/writeups/hackmyvm/krustykrab/media/24.webp)

Nosotros podemos ejecutar el binario `/usr/bin/split` como el usuario `KrustyKrab`. Lo primero que pienso hacer es buscar si el binario cuenta con alguna vulnerabilidad conocida, y para esto utilizamos la web de GTFOBins:

![img25](/writeups/hackmyvm/krustykrab/media/25.webp)

Ya tenemos el comando exacto para posiblemente escalar como el usuario `krustyKrab`, vamos a intentarlo pero en lugar de usar sh vamos a usar una bash por comodidad:

```bash
sudo -u KrustyKrab /usr/bin/split --filter='/bin/bash -i 0<&2 1>&2' /etc/hosts
```

![img26](/writeups/hackmyvm/krustykrab/media/26.webp)

Ya como el usuario `KrustyKrab` vamos a volver a realizar reconocimiento a ver con qué nos encontramos.

### Usuario Spongebob

Volver a revisar por permisos de sudo con el comando `sudo -l`:

![img27](/writeups/hackmyvm/krustykrab/media/27.webp)

En este caso, podemos ejecutar como el usuario `spongebob` el binario `/usr/bin/ttteeesssttt`. Vamos a ejecutarlo de primeras a ver qué es lo que hace:

![img28](/writeups/hackmyvm/krustykrab/media/28.webp)

Al parecer es un simple juego en el cual tenemos que poner las letras, en un respectivo orden.

Si intentamos un cat al binario, para ver cómo es que este funciona, observaremos que nada es legible:

![img29](/writeups/hackmyvm/krustykrab/media/29.webp)

Si no es legible, listemos por lo poco que sí lo es, para esto usaremos el comando `strings`:

![img30](/writeups/hackmyvm/krustykrab/media/30.webp)

Esto es muy bueno, tenemos la lista de productos ya en un orden y podemos tratar de ordenarlos de esa manera a ver si es válido:

![img31](/writeups/hackmyvm/krustykrab/media/31.webp)

Es correcto y logramos acceder como el usuario `spongebob`.

### Usuario Squidward

Ahora contamos con múltiples archivos en nuestro home:

![img32](/writeups/hackmyvm/krustykrab/media/32.webp)

Veamos el contenido de la nota:

![img33](/writeups/hackmyvm/krustykrab/media/33.webp)

Su contenido trata de decirnos que la contraseña del usuario `squidward` es el valor md5 de los archivos `key1` y `key2`.

El proceso es sencillo de la siguiente manera:
![img34](/writeups/hackmyvm/krustykrab/media/34.webp)

Ya nos encontramos como el usuario Squidward

### Usuario Root

Comencemos revisando que tenemos en nuestra carpeta personal:

![img35](/writeups/hackmyvm/krustykrab/media/35.webp)

Como observamos nos encontramos con un binario el cual por obvias razones no podemos leer.

Observemos los permisos dicho binario:
![img36](/writeups/hackmyvm/krustykrab/media/36.webp)

Identificamos permisos SUID por lo tanto ese binario se ejecuta como su propietario es decir como `root`.

Vemos que es lo que hace:

![img37](/writeups/hackmyvm/krustykrab/media/37.webp)

Vemos que lista lo que parece ser es el archivo `/etc/shadow` por lo tanto vamos a intentar listar sus cadenas legibles para ver de forma superficial que es lo que hace:

![img38](/writeups/hackmyvm/krustykrab/media/38.webp)

Como observamos aquí está lo que identificamos y acertamos. En este punto debemos comprender que el binario hace uso de rutas relativas lo que obliga al binario a confiar en la variable de entorno `PATH` la cual es alterable para cada usuario y allí está el truco, ya que, podemos modificarla para que la primera ruta en la que busca sea el directorio actual así aplicando la vulnerabilidad de tipo Path Hijacking.

Entonces lo que haremos es primero crear un archivo llamado `cat` con el siguiente contenido:

```bash
#!/bin/bash

chmod +s /bin/bash
```

![img39](/writeups/hackmyvm/krustykrab/media/39.webp)

Ya con esto vamos a darle permisos de ejecución:

![img40](/writeups/hackmyvm/krustykrab/media/40.webp)

Ahora vamos a alterar el path, donde la primera ruta que debe revisar para ejecutar un archivo es la actual y lo hacemos de la siguiente manera:

```bash
export PATH=./:$PATH
```

![img41](/writeups/hackmyvm/krustykrab/media/41.webp)

Tenemos de primera ruta el directorio actual así que por qué no ejecutamos ese binario a ver qué logramos:

![img42](/writeups/hackmyvm/krustykrab/media/42.webp)

Logramos el cometido, y ya tenemos el binario de `/bin/bash` como SUID con el cual mediante el comando `bash -p` podremos ingresar como root:

![img43](/writeups/hackmyvm/krustykrab/media/43.webp)

Con esto ya podemos revisar la flag:

![img44](/writeups/hackmyvm/krustykrab/media/44.webp)

Lab Terminado.

![img45](/writeups/hackmyvm/krustykrab/media/45.webp)

# Mitigaciones

Al terminar con los procesos de enumeración y explotación de la máquina, vamos a detallar algunas sugerencias y prácticas que se pudieron aplicar para mejorar la seguridad:

## Comentarios Innecesarios

En la enumeración identificamos un comentario el cual nos guía directamente a la web principal donde comenzamos con el análisis de la misma intentando identificar patrones y puntos de entrada.

Se propone siempre y cuando no sea necesario el no describir subdominios de uso empresarial, esto nos ayuda a evitar exposición innecesaria de estas plataformas donde en cierto grado las mantendríamos más seguras.

## Inicio de sesión con fuga de información y Quiz mal implementado

Al momento de encontrar el login probamos con varios usuarios, un poco enumerando los mismos que en una sección de la web se describe, donde, observamos que la web responde de forma condicional, es decir si el usuario es incorrecto nos lo describe y si el usuario es correcto nos describe de forma clara que el error es la contraseña. Esto genera una falla crítica y es que a partir de este mensaje se puede enumerar usuarios válidos en el sistema.

Otro error es cómo se está manejando el Quiz, donde debido a su sencillez se puede pasar con facilidad además del uso de cookies estáticas las cuales no cambian en cada petición o de forma recurrente permiten que se pueda hacer múltiples consultas reutilizándolas.

Se propone mejorar las alertas de fallos al registrarse generalizándolos para así evitar que se usen en procesos no deseados, además de implementar sistemas de cookies temporales y límite de peticiones para evitar los ataques de fuerza bruta, que en este se realizó.

## Control de Acceso Roto

El problema principal es cómo se están manejando las peticiones donde se valida que la cookie sea correcta y no verifica a qué cuenta está asociada la misma, esto nos permite en la petición de cambio de contraseña referenciar a otro usuario y así permitiendo el cambio de contraseña del mismo.

Se propone cambiar a una arquitectura Zero Trust, para que así en el backend nunca se confíe en identificadores o nombres de usuarios, sino que utilice variables de sesión para la extracción de datos del usuario así garantizando que el usuario tenga acceso exclusivamente a sus datos y a nada más.

## Manejo erróneo de permisos sudo y SUID

La escalada de privilegios en su mayoría es debido a la asignación de permisos `sudo` donde un usuario puede ejecutar binarios específicos como otro usuario, el mal manejo de estos permisos a binarios posiblemente vulnerables no es una práctica correcta. Ahora debido a la configuración de un binario con permisos `SUID` se logra escalar privilegios donde, puntualizando, tenemos un par de fallas que lo permiten siendo la asignación de permisos `SUID` a un binario innecesario y el mal uso de ejecución de comandos dentro del mismo ya que al utilizar rutas relativas nos permitió secuestrar por completo el `PATH`, para ejecutar un archivo malicioso.

Se propone asignar permisos necesarios y específicos, dependiendo de lo que el usuario lo requiera debido a que un exceso de permisos puede llevar a escaladas de privilegios como la que vemos en esta máquina.
