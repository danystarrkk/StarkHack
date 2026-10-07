---
title: "Griffin"
date: 2025-11-05
draft: false
description: "Writeup de la máquina Griffin en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Broken Authentication",
    "Credential Exposure",
    "Information Disclosure",
    "Privilege Escalation",
    "Remote Code Execution",
  ]
image: "/writeups/hackmyvm/griffin/media/cover.webp"
level: Medium
---

# Reconocimiento

Vamos a comenzar con un escaneo en red con el objetivo de identificar la máquina vulnerable con ayuda de **Arp-Scan**:

```bash
arp-scan -I enss33 --localnet --ignoredups
```

![img1](/writeups/hackmyvm/griffin/media/01.webp)

Como podemos observar ya tenemos la IP de la máquina víctima que es `192.168.1.67` por lo que intuiremos sistema operativo con ayuda del comando ping:

```bash
ping -c 1 192.168.1.67
```

![img2](/writeups/hackmyvm/griffin/media/02.webp)

Como podemos observar tenemos un `ttl=64` por lo que podemos intuir el sistema operativo `Linux`.

Bueno, con esto podemos continuar realizando un pequeño escaneo con ayuda de **Nmap** con el objetivo primero de obtener los puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.67 -oG allPorts
```

![img3](/writeups/hackmyvm/griffin/media/03.webp)

Como podemos observar tenemos los puertos `8080` y `22` abiertos. Vamos a realizar un segundo escaneo directamente a estos dos puertos para intentar obtener información sobre los mismos:

```bash
nmap -p22,8080 -sVC 192.168.1.67 -oN target
```

![img4](/writeups/hackmyvm/griffin/media/04.webp)

Vemos que en la versión del puerto `22-SSH` nos habla de ser un Debian, por lo que podemos igualmente intuir un sistema operativo `Linux -> Debian`.

La verdad en el escaneo no logramos observar nada más por lo que podemos directamente intentar ver la web que corre en el puerto `8080`:

![img5](/writeups/hackmyvm/griffin/media/05.webp)

No encontramos nada absolutamente aquí y de igual forma wappalyzer no detecta nada, por lo que intentamos un escaneo con whatweb solo para ver que información extra podemos obtener:

```bash
whatweb http://192.168.1.67:8080
```

![img6](/writeups/hackmyvm/griffin/media/06.webp)

Podemos observar como es que por detrás se puede estar implementando **Werkzeug** en su versión 3.1.3 y la versión de **Python** 3.9.2.

Bueno, como no podemos encontrar nada concreto por el momento lo que vamos a hacer es con ayuda de **Gobuster** ver qué rutas tiene esta web:

```bash
gobuster dir -u 'http://192.168.1.67:8080' -w <diccionario> -t20 -xl 164
```

![img7](/writeups/hackmyvm/griffin/media/07.webp)

Como podemos observar tenemos dos rutas donde a la de `/info` si podemos acceder por lo que veamos su contenido:

![img8](/writeups/hackmyvm/griffin/media/08.webp)

Nos indica que podemos usar `token=AlphaToken123`, podemos intentarlo en `/info` a ver si funciona:

![img9](/writeups/hackmyvm/griffin/media/09.webp)

Vemos otro token vamos a intentar ahora con ese:

![img10](/writeups/hackmyvm/griffin/media/10.webp)

Otro más veamos que sucede:

![img11](/writeups/hackmyvm/griffin/media/11.webp)

Se repiten, en este punto podemos intentar lo mismo en `/debug` y veamos que obtenemos:

![img12](/writeups/hackmyvm/griffin/media/12.webp)

# Explotación

Los otros `tokens` no fueron validos, pero en este vemos que nos dice que usemos `run`, veamos que es lo que hace:

![img13](/writeups/hackmyvm/griffin/media/13.webp)

Algo a tener en cuenta es que no funciona ninguno de los parámetros de primeras, vamos a tener que recargar la web varias veces y luego funciona.

Entonces, lo que podemos hacer en este punto es generar una reverse shell de la siguiente manera:

![img14](/writeups/hackmyvm/griffin/media/14.webp)

Ya con el puerto en escucha vamos a generar la reverse shell desde el navegador:

![img15](/writeups/hackmyvm/griffin/media/15.webp)

Excelente ya deberíamos tener la reverse shell:

![img16](/writeups/hackmyvm/griffin/media/16.webp)

Podemos ejecutar el tratamiento a la `TTY` para podernos mover con la mayor soltura posible:

```bash
script /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img17](/writeups/hackmyvm/griffin/media/17.webp)

# Escalada de Privilegios

Bueno ya como el usuario `lois` ya tenemos la flag de usuario que está en su home:

![img18](/writeups/hackmyvm/griffin/media/18.webp)

En este punto podemos comenzar a buscar una forma de elevar privilegios.

Vamos a ver los puertos abiertos en el sistema:

```bash
ss -ntlp
```

![img19](/writeups/hackmyvm/griffin/media/19.webp)

Observamos que tenemos de forma interna el puerto 80 abierto.

Bueno, lo que vamos a hacer en este punto es jugar con la herramienta de chisel, esta nos permitirá realizar un `Port Fortwarding` para convertir este puerto 80 que tiene la máquina de forma interna en nuestro puerto 80 y así ver su contenido, esto lo vamos a hacer con ayuda de **Chisel**

Una vez descargado el binario vamos a tener que enviarlo a la máquina víctima, en este caso yo lo realize levantando un servidor con python3 y descargando con ayuda del comando `curl`, también podríamos usar el comando `wget`, pero la máquina no lo tiene:

![img20](/writeups/hackmyvm/griffin/media/20.webp)

Ya con el archivo en las dos máquinas procederemos a ejecutar chisel primero en la máquina atacante de la siguiente manera:

```bash
./chisel server --reverse -p 1234
```

![img21](/writeups/hackmyvm/griffin/media/21.webp)

Ahora en la máquina víctima vamos a tener que ejecutar chisel como cliente de la siguiente manera:

```bash
./chisel client 192.168.1.130:1234 R:80:127.0.0.1:80
```

![img22](/writeups/hackmyvm/griffin/media/22.webp)

Perfecto con esto ya nuestro puerto 80 es el puerto 80 de la máquina víctima por lo que vamos a ver que tenemos en el puerto 80:

![img23](/writeups/hackmyvm/griffin/media/23.webp)

Vemos que tenemos otra web, pero si investigamos no vamos a obtener nada más, así que con ayuda de **Gobuster** vamos a volver a buscar otras rutas dentro de la web:

![img24](/writeups/hackmyvm/griffin/media/24.webp)

Podemos observar una ruta `/family` vemos cual es su contenido:

![img25](/writeups/hackmyvm/griffin/media/25.webp)

Vemos este panel para iniciar sección. Si regresamos a la web anterior nos lista algunos nombres como `peter, lois, brian` donde a diferencia de cuando usamos `lois` y nos sale:

![img26](/writeups/hackmyvm/griffin/media/26.webp)

Con el usuario `brian` esto cambia y nos dice:

![img27](/writeups/hackmyvm/griffin/media/27.webp)

Esto ya nos indica que el usuario es válido, pero su contraseña NO.

Lo que vamos a hacer es realizar un ataque de fuerza bruta a la contraseña y para esto usare la herramienta que diseñe con python3 para este apartado y la pueden encontrar en el siguiente repo de [**GitHub**](<https://github.com/danystarrkk/Hacking-Tools/tree/main/Tools/Web%20Brute%20Force%20(Griffin)>).
Algo que tenemos que hacer de forma extra es extraer la cookie que tenemos asignada en ese momento y lo podemos hacer con `ctrl + shift + c` y se desplegara:

![img28](/writeups/hackmyvm/griffin/media/28.webp)

Como vemos en la parte de Storage encontraremos el `PHPSESSID` del cual necesitamos su valor, ya con esto continuemos.

El uso de la herramienta ya está descrito en el repositorio por lo que directamente ejecutaré el script de la siguiente manera:

```bash
python3 Bruteforce.py -u http://192.168.1.130 -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt -U brian -c gnrou14ivh0tqme7il8h7aqihk
```

![img29](/writeups/hackmyvm/griffin/media/29.webp)

Una vez que la herramienta entre en ejecución será cuestión de esperar para poder ver la contraseña correcta, recomiendo usar el diccionario de `rockyou.txt` debido a que este cuenta con la contraseña:

![img30](/writeups/hackmyvm/griffin/media/30.webp)

Si este script te ha gustado y a sido de utilidad podrías dejar una estrellita en el repositorio.

Perfecto ya tenemos la contraseña de `brian` que es `savannah`. Vamos a iniciar sesión y esto lo vamos a capturar también con BurpSuite para ver que se tramita por detrás:

![img31](/writeups/hackmyvm/griffin/media/31.webp)

Vemos que se nos asigna un Token, este tiene una forma algo extraña por lo que vamos a pasarle a un decode a ver que nos dice:

![img32](/writeups/hackmyvm/griffin/media/32.webp)

Vemos que nos da algunas opciones pero la válida es la que tiene `Base 58` por lo que vamos a intentar ver que es lo que contiene:

![img33](/writeups/hackmyvm/griffin/media/33.webp)

Esto es excelente, lo que estoy viendo es una cadena en `Base64` el cómo lo identifico es sencillo y es que casi siempre si no es siempre vamos a encontrar que las cadenas en `Base64` llevan ese `==` por lo que vamos a ver que contiene esa cadena:

```bash
echo 'bWVnOmxvdmVseWZhbWlseQ==' | base64 -d ;echo
```

![img34](/writeups/hackmyvm/griffin/media/34.webp)

! Perfecto ya tenemos la contraseña del usuario `meg` por lo que en este punto podemos intentar conectarnos a la máquina como este usuario mediante `SSH` recordemos que tenemos el servicio activo:

```bash
ssh meg@192.168.1.67
```

![img35](/writeups/hackmyvm/griffin/media/35.webp)

Ya estamos como el usuario `meg` podemos comenzar a analizar con el comando `sudo -l` si tenemos algún comando que podamos ejecutar como sudo:

![img36](/writeups/hackmyvm/griffin/media/36.webp)

vemos que el usuario `meg` puede ejecutar el comando `/usr/bin/python3 /root/game.py`, vemos que es lo que hace:

![img37](/writeups/hackmyvm/griffin/media/37.webp)

Se queda un puerto en escucha podemos intentar conectarnos a ver que es:

![img38](/writeups/hackmyvm/griffin/media/38.webp)

En este caso es una especie de juego, pero vamos a tener que automatizar la resolución de los mismos porque tiene que hacerse de forma rápida y en mi caso el código es el siguiente:

```python
#!/usr/bin/python3

import socket, re, hashlib

def funDecode(text, rot):
    resultado = ""
    for i in range(0, len(text)):

        if 'a' <= text[i] <= 'z':
            valor = chr(ord(text[i]) - int(rot[i]))
            resultado+=valor
        else:
            resultado+=text[i]
    return resultado

def  main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    params = ('192.168.1.67', 6666)

    # 1 Game: Math operation

    s.connect(params)
    data = s.recv(1024)
    match = re.findall("\\(\\d{1,}\\s\\*\\s\\d{1,}\\)\\s\\/\\/\\s\\d{1,}",
                       data.decode())
    result = str(eval(match[0]))
    s.sendall(result.encode())

    data = s.recv(1024)

    # 2 Game: rotation cipher

    match = re.findall("\\w+\\{\\w+\\}", data.decode())
    match2 = str(re.findall("\\d{3}", data.decode())[0]) * 5
    result = funDecode(match[0],match2)
    s.sendall(result.encode())

    data = s.recv(1024)

    # 3 Game: hash md5

    match = re.findall("\\d{4,}", data.decode())
    resultado = match[0] + match[1]
    resultado = str(resultado).encode('utf-8')
    hash = hashlib.md5(resultado)

    s.sendall(hash.hexdigest().encode())

    data = s.recv(1024)

    print(data.decode())



if __name__ == '__main__':
    main()

```

Vamos a explicar un poco los juegos y nuestro código:

- **Primer Juego:** lo que vamos a encontrar no es más que una operación y tenemos que enviar la respuesta en el script es sencillo su proceso, lo que se hace es capturar mediante expresiones regulares con ayuda de la librería `re` donde una vez que las obtenemos vamos a evaluarlas con `eval()` y listo.
- **Segundo Juego:** este me costó un poco más comprenderlo, en este nos dan dos cosas, una cadena cifrada y una key, lo que en realidad tenemos que hacer es asignar cada dígito de la key a cada letra del string donde si el string es `asdk{lfjdlsfj}` y su que es `443` se tendría que hacer:

```
asdk{lfjdlsfj}
44344344344344
```

Como podemos observar asignamos un valor a cada dígito siguiente la key y este dígito nos indica la rotación que tenemos que hacer, esto ya está automatizado en mi script.

- **Tercer Juego:** en este al parecer tenemos que formar un hash md5 con dos valores numéricos que nos da, donde combinamos los strings no sumamos los números y luego convertimos en md5 y lo enviamos.

> Recomendaría si estás aprendiendo replicar el código a tu manera para comprender mucho mejor.

Si lo ejecutamos vamos a ver lo siguiente:

![img39](/writeups/hackmyvm/griffin/media/39.webp)

en este caso vemos una flag que en realidad es la contraseña del usuario peter solo lo que se encuentra dentro de los `{}`:

![img40](/writeups/hackmyvm/griffin/media/40.webp)

Ya estamos cerca, podemos ver de igual forma si tenemos algún comando con `sudo -l` :

![img41](/writeups/hackmyvm/griffin/media/41.webp)

Al parecer podemos ejecutar un editor llamado `meg` como usuario administrador por lo que vamos a editar el archivo de `/etc/sudoers` el objetivo es que nos permite la ejecución de sudo sin contraseña y lo vamos a editar de la siguiente manera:

![img42](/writeups/hackmyvm/griffin/media/42.webp)

Agregamos la línea que vemos en la imagen, guardamos y salimos.
Para que funcione vamos a salir del usuario peter y luego volvemos a ingresar y ya con eso podemos hacer un `sudo su`:

![img43](/writeups/hackmyvm/griffin/media/43.webp)

Listo ya estamos como root y en su ruta encontraremos la flag:

![img44](/writeups/hackmyvm/griffin/media/44.webp)

Ya con esto terminamos la Máquina:

![img45](/writeups/hackmyvm/griffin/media/45.webp)

# Recomendaciones y Mitigaciones

Tras finalizar la explotación de esta máquina, queda en evidencia que la cadena de compromiso fue posible gracias a la suma de malas configuraciones y fallos en la lógica de desarrollo. A continuación, se detallan las vulnerabilidades encontradas y cómo mitigarlas:

## Exposición de Entornos de Depuración (Debug) y RCE

La aplicación web inicial exponía las rutas `/info` y `/debug`. En entornos como Werkzeug o Flask, dejar el modo "Debug" activado en producción permite la ejecución remota de código (RCE) si un atacante obtiene acceso a la consola interactiva (como ocurrió mediante la filtración de tokens).

Se recomienda jamás se debe desplegar una aplicación en producción con el modo "Debug" habilitado. Se deben eliminar o restringir por IP (solo _localhost_ o VPN administrativa) todas las rutas de diagnóstico o pruebas.

## Falta de Protección contra Fuerza Bruta y Contraseñas Débiles

El panel interno ubicado en `/family` permitió un ataque de fuerza bruta ininterrumpido utilizando un diccionario común (`rockyou.txt`), lo que derivó en la obtención de la contraseña del usuario `brian` (`savannah`).

Se recomienda implementar un mecanismo de limitación de tasa (Rate Limiting) y políticas de bloqueo temporal de cuentas (Account Lockout) tras múltiples intentos fallidos. Además, es obligatorio forzar una política de contraseñas seguras y robustas para todos los usuarios.

## Gestión Insegura de Tokens (Codificación vs. Cifrado)

Tras autenticarse como `brian`, la web asigna un Token que simplemente estaba codificado en Base58 y Base64. Al decodificarlo, exponía las credenciales en texto plano del usuario `meg` (`meg:lovelyfamily`). **Codificar no es cifrar**.

Se recomienda nunca almacenar información sensible (y mucho menos contraseñas en texto plano) dentro de las cookies o tokens de sesión. Se debe utilizar un gestor de sesiones del lado del servidor, o en su defecto, implementar tokens firmados criptográficamente (como JWT correctamente configurados). Las contraseñas en bases de datos siempre deben estar hasheadas (ej. Bcrypt o Argon2).

## Fuga de Información en Scripts Críticos

El usuario `meg` podía ejecutar el script `/root/game.py` con privilegios de superusuario. Al interactuar y resolver los retos del script, este devolvía directamente la contraseña del usuario `peter`.

Se recomienda que a cualquier script o binario que se ejecute con privilegios elevados debe ser auditado rigurosamente para evitar fallos lógicos o fugas de información. Los datos sensibles no deben estar _hardcodeados_ (quemados) en el código ni ser devueltos en la salida estándar (_stdout_).

## Mala Configuración de Permisos Sudo (Principio de Menor Privilegio)

El usuario `peter` tenía permisos para ejecutar el editor `meg` como `root` sin proporcionar contraseña. Esto permitió abrir y modificar el archivo `/etc/sudoers`, otorgándose permisos absolutos sobre el sistema.

Se recomienda aplicar estrictamente el Principio de Menor Privilegio (PoLP). Nunca se debe permitir a un usuario común ejecutar programas interactivos (como editores de texto, paginadores o consolas) con privilegios de `root` mediante `sudo`, ya que permiten escapar al sistema (Shell Escaping). Si es necesario que un usuario edite un archivo protegido, se debe utilizar `sudoedit` restringido únicamente a ese archivo en concreto.
