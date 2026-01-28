---
title: "Griffin"
date: 2025-11-05
draft: false
description: "Writeup de la máquina Griffin en HackMyVM."
categories: ["HackMyVM"]
tags: ["Exposed Debug Endpoint", "Remote Command Execution", "User Enumeration", "Credential Disclosure", "Token Decoding", "Sudo Misconfiguration", "Privilege Escalation"]
image: "/images/Griffin.png"
level: Medium
---

# Reconocimiento

Vamos a comenzar con un escaneo en red con el objetivo de identificar la máquina vulnerable con ayuda de **Arp-Scan**:

```bash
arp-scan -I enss33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251104163301.png)

Como podemos observar ya tenemos la IP de la máquina víctima que es `192.168.1.67` por lo que intuiremos sistema operativo con ayuda del comando ping:

```bash
ping -c 1 192.168.1.67
```

![img2](images/Pasted%20image%2020251104184850.png)

Como podemos observar tenemos un `ttl=64` por lo que podemos intuir el sistema operativo `Linux`.

Bueno, con esto podemos continuar realizando un pequeño escaneo con ayuda de **Nmap** con el objetivo primero de obtener los puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.67 -oG allPorts
```

![img3](images/Pasted%20image%2020251104185227.png)

Como podemos observar tenemos los puertos `8080` y `22` abiertos. Vamos a realizar un segundo escaneo directamente a estos dos puertos para intentar obtener información sobre los mismos:

```bash
nmap -p22,8080 -sVC 192.168.1.67 -oN target
```

![img4](images/Pasted%20image%2020251104185603.png)

Vemos que en la versión del puerto `22-SSH` nos habla de ser un Debian, por lo que podemos igualmente intuir un sistema operativo `Linux -> Debian`.

La verdad en el escaneo no logramos observar nada más por lo que podemos directamente intentar ver la web que corre en el puerto `8080`:

![img5](images/Pasted%20image%2020251104185920.png)

No encontramos nada absolutamente aquí y de igual forma wappalyzer no detecta nada, por lo que intentamos un escaneo con whatweb solo para ver que información extra podemos obtener:

```bash
whatweb http://192.168.1.67:8080
```

![img6](images/Pasted%20image%2020251104190202.png)

Podemos observar como es que por detrás se puede estar implementando **Werkzeug** en su versión 3.1.3 y la versión de **Python** 3.9.2.

Bueno, como no podemos encontrar nada concreto por el momento lo que vamos a hacer es con ayuda de **Gobuster** ver qué rutas tiene esta web:

```bash
gobuster dir -u 'http://192.168.1.67:8080' -w <diccionario> -t20 -xl 164
```

![img7](images/Pasted%20image%2020251104193339.png)

Como podemos observar tenemos dos rutas donde a la de `/info` si podemos acceder por lo que veamos su contenido:

![img8](images/Pasted%20image%2020251104193538.png)

Nos indica que podemos usar `token=AlphaToken123`, podemos intentarlo en `/info` a ver si funciona:

![img9](images/Pasted%20image%2020251104193813.png)

Vemos otro token vamos a intentar ahora con ese:

![img10](images/Pasted%20image%2020251104193840.png)

Otro más veamos que sucede:

![img11](images/Pasted%20image%2020251104193915.png)

Se repiten, en este punto podemos intentar lo mismo en `/debug` y veamos que obtenemos:

![img12](images/Pasted%20image%2020251104194025.png)

# Explotación

Los otros `tokens` no fueron validos, pero en este vemos que nos dice que usemos `run`, veamos que es lo que hace:

![img13](images/Pasted%20image%2020251104194501.png)

Algo a tener en cuenta es que no funciona ninguno de los parámetros de primeras, vamos a tener que recargar la web varias veces y luego funciona.

Entonces, lo que podemos hacer en este punto es generar una reverse shell de la siguiente manera:

![img14](images/Pasted%20image%2020251105133503.png)

Ya con el puerto en escucha vamos a generar la reverse shell desde el navegador:

![img15](images/Pasted%20image%2020251105133656.png)

Excelente ya deberíamos tener la reverse shell:

![img16](images/Pasted%20image%2020251105133735.png)

Podemos ejecutar el tratamiento a la `TTY` para podernos mover con la mayor soltura posible:

```bash
script /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img17](images/Pasted%20image%2020251105133912.png)

# Escalada de Privilegios

Bueno ya como el usuario `lois` ya tenemos la flag de usuario que está en su home:

![img18](images/Pasted%20image%2020251105135228.png)

En este punto podemos comenzar a buscar una forma de elevar privilegios.

Vamos a ver los puertos abiertos en el sistema:

```bash
ss -ntlp
```

![img19](images/Pasted%20image%2020251105134306.png)

Observamos que tenemos de forma interna el puerto 80 abierto.

Bueno, lo que vamos a hacer en este punto es jugar con la herramienta de chisel, esta nos permitirá realizar un `Port Fortwarding` para convertir este puerto 80 que tiene la máquina de forma interna en nuestro puerto 80 y así ver su contenido, esto lo vamos a hacer con ayuda de **Chisel**

Una vez descargado el binario vamos a tener que enviarlo a la máquina víctima, en este caso yo lo realize levantando un servidor con python3 y descargando con ayuda del comando `curl`, también podríamos usar el comando `wget`, pero la máquina no lo tiene:

![img20](images/Pasted%20image%2020251105135607.png)

Ya con el archivo en las dos máquinas procederemos a ejecutar chisel primero en la máquina atacante de la siguiente manera:

```bash
./chisel server --reverse -p 1234
```

![img21](images/Pasted%20image%2020251105135952.png)

Ahora en la máquina víctima vamos a tener que ejecutar chisel como cliente de la siguiente manera:

```bash
./chisel client 192.168.1.130:1234 R:80:127.0.0.1:80
```

![img22](images/Pasted%20image%2020251105140048.png)

Perfecto con esto ya nuestro puerto 80 es el puerto 80 de la máquina víctima por lo que vamos a ver que tenemos en el puerto 80:

![img23](images/Pasted%20image%2020251105140251.png)

Vemos que tenemos otra web, pero si investigamos no vamos a obtener nada más, así que con ayuda de **Gobuster** vamos a volver a buscar otras rutas dentro de la web:

![img24](images/Pasted%20image%2020251105140528.png)

Podemos observar una ruta `/family` vemos cual es su contenido:

![img25](images/Pasted%20image%2020251105140608.png)

Vemos este panel para iniciar sección. Si regresamos a la web anterior nos lista algunos nombres como `peter, lois, brian` donde a diferencia de cuando usamos `lois` y nos sale:

![img26](images/Pasted%20image%2020251105140850.png)

Con el usuario `brian` esto cambia y nos dice:

![img27](images/Pasted%20image%2020251105140928.png)

Esto ya nos indica que el usuario es válido, pero su contraseña NO.

Lo que vamos a hacer es realizar un ataque de fuerza bruta a la contraseña y para esto usare la herramienta que diseñe con python3 para este apartado y la pueden encontrar en el siguiente repo de [**GitHub**<svg xmlns="http://www.w3.org/2000/svg" height="30" width="30" viewBox="0 0 640 440"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="#ffffff" d="M237.9 461.4C237.9 463.4 235.6 465 232.7 465C229.4 465.3 227.1 463.7 227.1 461.4C227.1 459.4 229.4 457.8 232.3 457.8C235.3 457.5 237.9 459.1 237.9 461.4zM206.8 456.9C206.1 458.9 208.1 461.2 211.1 461.8C213.7 462.8 216.7 461.8 217.3 459.8C217.9 457.8 216 455.5 213 454.6C210.4 453.9 207.5 454.9 206.8 456.9zM251 455.2C248.1 455.9 246.1 457.8 246.4 460.1C246.7 462.1 249.3 463.4 252.3 462.7C255.2 462 257.2 460.1 256.9 458.1C256.6 456.2 253.9 454.9 251 455.2zM316.8 72C178.1 72 72 177.3 72 316C72 426.9 141.8 521.8 241.5 555.2C254.3 557.5 258.8 549.6 258.8 543.1C258.8 536.9 258.5 502.7 258.5 481.7C258.5 481.7 188.5 496.7 173.8 451.9C173.8 451.9 162.4 422.8 146 415.3C146 415.3 123.1 399.6 147.6 399.9C147.6 399.9 172.5 401.9 186.2 425.7C208.1 464.3 244.8 453.2 259.1 446.6C261.4 430.6 267.9 419.5 275.1 412.9C219.2 406.7 162.8 398.6 162.8 302.4C162.8 274.9 170.4 261.1 186.4 243.5C183.8 237 175.3 210.2 189 175.6C209.9 169.1 258 202.6 258 202.6C278 197 299.5 194.1 320.8 194.1C342.1 194.1 363.6 197 383.6 202.6C383.6 202.6 431.7 169 452.6 175.6C466.3 210.3 457.8 237 455.2 243.5C471.2 261.2 481 275 481 302.4C481 398.9 422.1 406.6 366.2 412.9C375.4 420.8 383.2 435.8 383.2 459.3C383.2 493 382.9 534.7 382.9 542.9C382.9 549.4 387.5 557.3 400.2 555C500.2 521.8 568 426.9 568 316C568 177.3 455.5 72 316.8 72zM169.2 416.9C167.9 417.9 168.2 420.2 169.9 422.1C171.5 423.7 173.8 424.4 175.1 423.1C176.4 422.1 176.1 419.8 174.4 417.9C172.8 416.3 170.5 415.6 169.2 416.9zM158.4 408.8C157.7 410.1 158.7 411.7 160.7 412.7C162.3 413.7 164.3 413.4 165 412C165.7 410.7 164.7 409.1 162.7 408.1C160.7 407.5 159.1 407.8 158.4 408.8zM190.8 444.4C189.2 445.7 189.8 448.7 192.1 450.6C194.4 452.9 197.3 453.2 198.6 451.6C199.9 450.3 199.3 447.3 197.3 445.4C195.1 443.1 192.1 442.8 190.8 444.4zM179.4 429.7C177.8 430.7 177.8 433.3 179.4 435.6C181 437.9 183.7 438.9 185 437.9C186.6 436.6 186.6 434 185 431.7C183.6 429.4 181 428.4 179.4 429.7z"/></svg>](<https://github.com/danystarrkk/Hacknig-Tools/tree/main/Tools/Web%20Brute%20Force%20(Griffin)>).
Algo que tenemos que hacer de forma extra es extraer la cookie que tenemos asignada en ese momento y lo podemos hacer con `ctrl + shift + c` y se desplegara:

![img28](images/Pasted%20image%2020251105180223.png)

Como vemos en la parte de Storage encontraremos el `PHPSESSID` del cual necesitamos su valor, ya con esto continuemos.

El uso de la herramienta ya está descrito en el repositorio por lo que directamente ejecutaré el script de la siguiente manera:

```bash
python3 Bruteforce.py -u http://192.168.1.130 -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt -U brian -c gnrou14ivh0tqme7il8h7aqihk
```

![img29](images/Pasted%20image%2020251105180420.png)

Una vez que la herramienta entre en ejecución será cuestión de esperar para poder ver la contraseña correcta, recomiendo usar el diccionario de `rockyou.txt` debido a que este cuenta con la contraseña:

![img30](images/Pasted%20image%2020251105142055.png)

Si este script te ha gustado y a sido de utilidad podrías dejar una estrellita en el repositorio.

Perfecto ya tenemos la contraseña de `brian` que es `savannah`. Vamos a iniciar sesión y esto lo vamos a capturar también con BurpSuite para ver que se tramita por detrás:

![img31](images/Pasted%20image%2020251105142420.png)

Vemos que se nos asigna un Token, este tiene una forma algo extraña por lo que vamos a pasarle a un decode a ver que nos dice:

![img32](images/Pasted%20image%2020251105142605.png)

Vemos que nos da algunas opciones pero la válida es la que tiene `Base 58` por lo que vamos a intentar ver que es lo que contiene:

![img33](images/Pasted%20image%2020251105142716.png)

Esto es excelente, lo que estoy viendo es una cadena en `Base64` el cómo lo identifico es sencillo y es que casi siempre si no es siempre vamos a encontrar que las cadenas en `Base64` llevan ese `==` por lo que vamos a ver que contiene esa cadena:

```bash
echo 'bWVnOmxvdmVseWZhbWlseQ==' | base64 -d ;echo
```

![img34](images/{DDF02666-EE84-4C6C-9D6D-7D2AF6E5C9C1}.png)

! Perfecto ya tenemos la contraseña del usuario `meg` por lo que en este punto podemos intentar conectarnos a la máquina como este usuario mediante `SSH` recordemos que tenemos el servicio activo:

```bash
ssh meg@192.168.1.67
```

![img35](images/Pasted%20image%2020251105143101.png)

Ya estamos como el usuario `meg` podemos comenzar a analizar con el comando `sudo -l` si tenemos algún comando que podamos ejecutar como sudo:

![img36](images/Pasted%20image%2020251105143229.png)

vemos que el usuario `meg` puede ejecutar el comando `/usr/bin/python3 /root/game.py`, vemos que es lo que hace:

![img37](images/Pasted%20image%2020251105143318.png)

Se queda un puerto en escucha podemos intentar conectarnos a ver que es:

![img38](images/Pasted%20image%2020251105143354.png)

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

![img39](images/Pasted%20image%2020251105143621.png)

en este caso vemos una flag que en realidad es la contraseña del usuario peter solo lo que se encuentra dentro de los `{}`:

![img40](images/Pasted%20image%2020251105143743.png)

Ya estamos cerca, podemos ver de igual forma si tenemos algún comando con `sudo -l` :

![img41](images/Pasted%20image%2020251105143829.png)

Al parecer podemos ejecutar un editor llamado `meg` como usuario administrador por lo que vamos a editar el archivo de `/etc/sudoers` el objetivo es que nos permite la ejecución de sudo sin contraseña y lo vamos a editar de la siguiente manera:

![img42](images/Pasted%20image%2020251105144158.png)

Agregamos la línea que vemos en la imagen, guardamos y salimos.
Para que funcione vamos a salir del usuario peter y luego volvemos a ingresar y ya con eso podemos hacer un `sudo su`:

![img43](images/Pasted%20image%2020251105144629.png)

Listo ya estamos como root y en su ruta encontraremos la flag:

![img44](images/Pasted%20image%2020251105144707.png)

Ya con esto terminamos la Máquina:

![img45](images/{1CA373A4-ECAB-4BBE-A247-41B9B188B21B}.png)
