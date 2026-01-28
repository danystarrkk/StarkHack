---
title: "Console"
date: 2025-12-05
draft: false
description: "Writeup de la máquina Console en HackMyVM."
categories: ["HackMyVM"]
tags: ["Remote Command Execution", "Exposed Source Code", "Credential Disclosure", "SSH Port Forwarding", "Sudo Misconfiguration", "Privilege Escalation"]
image: "/images/console.png"
level: Medium
---

# Enumeración

Vamos a comenzar realizando un escaneo en red para identificar la máquina víctima con ayuda de **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251202171356.png)

Como podemos observar, la IP de la máquina es la `192.168.1.66`.

Ahora, con ayuda del comando `ping` vamos a identificar un poco el sistema operativo:

```bash
ping -c 1 192.168.1.66
```

![img2](images/Pasted%20image%2020251202171603.png)

Podemos observar un `ttl=64` donde asumimos un sistema Linux.

Ya en este punto realizamos un escaneo con ayuda de **Nmap** para detectar puertos abiertos:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.66 -oG allPorts
```

![img3](images/Pasted%20image%2020251202171916.png)

Observamos los puertos `22,80 y 443` abiertos, ahora vamos a intentar extraer la máxima información posible de estos 3 puertos:

```bash
nmap -p22,80,443 -sCV 192.168.1.66 -oN target
```

![img4](images/Pasted%20image%2020251202172406.png)

Podemos observar versiones y en algunas de estas vemos también que parece ser un Debian, esto es útil a final de cuentas, ya que nos asegura si ser un sistema Linux por lo menos.

Bueno vamos a visitar primero la web que está corriendo por el puerto 80 a ver que es lo que logramos encontrar:

![img5](images/Pasted%20image%2020251202172612.png)

Vemos esta web, pero nada más ni en el código fuente.

Recordemos que tenemos en el puerto `443` corriendo el servicio https por lo que vamos a intentar ingresar:

![img6](images/Pasted%20image%2020251202173029.png)

Observamos que no nos carga la web, ahora recordemos que https utiliza el protocolo TLS vamos a intentar inspeccionar dicho certificado en busca de más información con ayuda de **sslscan**:

```bash
sslscan 192.168.1.66
```

![img7](images/Pasted%20image%2020251202173656.png)

Si vemos en el resultado nos lista un dominio, podemos intentar al ser un servicio local integrarlo en el `/etc/hosts` para que mediante el mismo cargue la web mediante el servicio `https`.

Ya con eso editado entramos a la web:
![img8](images/Pasted%20image%2020251202173906.png)

En esta web vemos varias cosas pero, en realidad por el momento nada me sirve, lo que vamos a hacer es verificar los scripts que está cargando, si podemos leer su código fuente vamos a ver alguna forma de aprovecharlo.

![img9](images/Pasted%20image%2020251202174401.png)

Entre todos los scripts el de `hacker.js` es el que nos llama la atención y vamos a analizarlo:

![img10](images/Pasted%20image%2020251202174616.png)

# Explotación

En este pequeño trozo de código podemos ver lo que al parecer es una ruta que sería `supercoool.php`, además de que al parecer podemos pasarle el parámetro `cmd` y darle un valor, vemos que sucede:

![img11](images/Pasted%20image%2020251202174932.png)

Como vemos ejecuta comandos por lo que de forma directa vamos a intentar entablar una reverse shell para tomar control de la máquina:

![img12](images/Pasted%20image%2020251202175159.png)

Ya con la conexión lista vamos a darle tratamiento y a comenzar con la enumeración del sistema.

No encontramos permisos SUID y tampoco tareas cron, lo que si logramos listar gracias a las carpetas del directorio `home` y a la información del archivo `/etc/passwd` es los usuario disponibles:

![img13](images/Pasted%20image%2020251202175534.png)

![img14](images/Pasted%20image%2020251202175623.png)

Podemos ver los usuarios, en este punto vamos a revisar sus directorios en busca de pistas o credenciales:

![img15](images/Pasted%20image%2020251202175722.png)

Vemos dos archivos, uno el `user.txt` que contiene flag del usuario y otro que es el `.viminfo` el cual vemos su contenido:

![img16](images/Pasted%20image%2020251202175828.png)

Observamos las credenciales del usuario welcome `welcome:welcome123` por lo que vamos a cambiar de usuario:

![img17](images/Pasted%20image%2020251202180355.png)

Perfecto ahora también se analizó el uso de tareas cron y permisos SUID, pero no encontramos nada, algo más que encontramos extraño es al revisar los puertos:

```bash
ss -nltp
```

![img18](images/Pasted%20image%2020251202180616.png)

Vemos el puerto `5000` abierto de forma interna. En este punto podemos intentar hacer Port forwarding para poder externalizar el puerto, como tenemos credenciales lo más sencillo es hacerlo con ayuda de ssh de la siguiente manera:

```bash
ssh welcome@192.168.1.66 -L 80:192.168.1.66:5000
```

![img19](images/Pasted%20image%2020251202181105.png)

Ya con esto y conectados si revisamos nuestro puerto `80` vamos a ver que está abierto:

![img20](images/Pasted%20image%2020251202181209.png)

Perfecto, podemos intentar escanear con ayuda de **Nmap** el puerto para ver que encontramos:

![img21](images/Pasted%20image%2020251202181358.png)

Vemos que está corriendo una web y en esta se implementa python.

Veamos la web:

![img22](images/Pasted%20image%2020251202181527.png)

En esta web creamos y publicamos una especie de post y es vulnerable a XSS, pero nada más, lo que podemos hacer en este punto es buscar por más rutas y esto con ayuda de **Gobuster** :

```bash
gobuster dir -u http://127.0.0.1 -w <diccionario>
```

![img23](images/Pasted%20image%2020251202181728.png)

vemos esa ruta `console`:

![img24](images/Pasted%20image%2020251202181806.png)

Vemos el mensaje donde nos dice que necesitamos el ping que se proporcionó al lanzar la web, pero esto no lo tenemos.

Regresando a la terminal encontramos que tenemos una ejecución de comandos con `sudo`:

![img25](images/Pasted%20image%2020251202181935.png)

Podemos ver unos logs, vemos lo que es:

![img26](images/Pasted%20image%2020251202182031.png)

Como podemos observar si son `logs`, pero no sabemos referente a qué web son, podemos intentar enviar cualquier cosa como ping en la web a ver si logramos verlo en los logs:

![img27](images/Pasted%20image%2020251202182133.png)
![img28](images/Pasted%20image%2020251202182156.png)

En efecto, los logs son de esta web.

Ahora si lo pensamos un poco nos habla de que al levantar el servidor nos brinda el pin, podemos intentar filtrar solo las primeras líneas a ver si logramos verlo:

![img29](images/Pasted%20image%2020251202182320.png)

Vemos el pin, vamos a usarlo para desbloquear la terminal:

![img30](images/Pasted%20image%2020251202182406.png)

Lo que tenemos es una consola en python que al parecer no tiene restricciones, pero no le agrandan comandos largos, vamos a hacer uso de `bosybox` para generarnos una reverse shell desde esta consola de la siguiente manera:

![img31](images/Pasted%20image%2020251202183529.png)
![img32](images/Pasted%20image%2020251202183542.png)

Volvemos a hacer un tratamiento a la `tty` para maniobrar mejor y tendríamos:

![img33](images/Pasted%20image%2020251202183654.png)

# Escalada de Privilegios

Listo ya estamos como el usuario `qaq` en este punto volvemos a hacer reconocimiento y al ejecutar el comando `sudo -l` vemos:

![img34](images/Pasted%20image%2020251202183738.png)

Podemos ejecutar el comando `fastfetch` como administrador.

Esto no es algo común, pero tenemos que saber investigar, nosotros podemos moldear un archivo de configuración de `fastfetch` y dentro de este al parecer para dar cierta apariencia o ver cierto resultado, lo que se hace es ejecutar comandos, ya con esto claro entendemos por donde ir.

Vamos primero a generar su archivo de configuración con:

```bash
fastfetch --gen-config
```

![img35](images/Pasted%20image%2020251202184201.png)

Como vemos nos da la ruta donde se generó el archivo, podemos abrir dicho archivo y veremos lo siguiente:

![img36](images/Pasted%20image%2020251202184615.png)

Agregamos un nuevo módulo con el cual ejecutamos comandos, y vemos si funciono:

![img37](images/Pasted%20image%2020251202184739.png)

Vemos que como sudo no funciona y esto es porque tenemos que especificar el archivo de configuración que debe usar:

![img38](images/Pasted%20image%2020251202184848.png)

Ahora ya funciona, en este punto vamos a modificar nuevamente para mandar permisos SUID a la bash y escalar más rápido:

![img39](images/Pasted%20image%2020251202184937.png)

Ahora ejecutamos:
![img40](images/Pasted%20image%2020251202184956.png)

Por último veamos si se asignó permisos a la `bash`:

![img41](images/Pasted%20image%2020251202185028.png)

Perfecto ejecutemos `bash -p` :

![img42](images/Pasted%20image%2020251202185048.png)

Ya estamos como root, vamos a ver la flag de root:

![img43](images/Pasted%20image%2020251202185127.png)

Máquina Terminada.

![img44](images/Pasted%20image%2020251202185250.png)
