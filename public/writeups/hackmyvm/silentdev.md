---
title: "SilentDev"
date: 2025-11-03
draft: false
description: "Writeup de la máquina SilentDev en HackMyVM."
categories: ["HackMyVM"]
tags: ["Unrestricted File Upload", "Content-Type Bypass", "Remote Command Execution", "Wildcard Injection", "Cron Job Abuse", "Sudo Misconfiguration", "Privilege Escalation"]
image: "/images/silentdev.png"
level: Medium
---

# Enumeración

Bueno, vamos a comenzar identificando la IP de la máquina con ayuda de **Arp-Scan** de la siguiente manera:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251026184304.png)

Como podemos observar nuestra máquina víctima tiene la IP `192.168.1.70`, ahora vamos con ayuda del comando ping a tratar de identificar el sistema operativo:

```bash
ping -c 1 192.168.1.70
```

![img2](images/Pasted%20image%2020251026184555.png)

Como podemos observar tenemos un `ttl=64` donde intuimos un sistema operativo Linux.

En este momento ya vamos a realizar un escaneo con **Nmap** con el objetivo de identificar puertos abiertos primero:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.70 -oG allPorts
```

![img3](images/Pasted%20image%2020251026184836.png)

Como podemos observar detectamos los puertos 80 y 22 abiertos, ahora mediante otro escaneo de **Nmap** vamos a intentar identificar versiones lanzando algunos scripts básicos de reconocimiento un poco de información:

```bash
nmap -p22,80 -sCV 192.168.1.70 -oN target
```

![img4](images/Pasted%20image%2020251026185155.png)

Podemos observar que nos da las versiones de los servicios y mediante la misma ya nos dice que es un Debian, también con esta versión y una búsqueda con `launchpad` podríamos determinar el `codename`:
![img5](images/Pasted%20image%2020251026185853.png)

En este caso no logramos identificarlo, pero abra casos en los que sí.

Continuando con la máquina podemos visitar la web alojada en el puerto 80 para ver que podemos encontrar:

![img6](images/{77EBF70A-1AD8-4388-B847-2352DA5F991C}.png)

Vemos que solo tiene ese apartado para subir archivos, Podemos utilizar diferentes herramientas para identificar las tecnologías de la web, en este caso vamos a hacer los **Whatweb** y la extensión de Wappalizer:

```bash
whatweb http://192.168.1.70
```

![img7](images/{FC9089B9-42B0-41E7-A8E0-DA1AB0B315D7}.png)

![img8](images/{F9959BE8-04F7-4ACA-B5D5-310686143167}.png)

En sentido de tecnologías no vemos nada en especial.

Bueno para probar vamos a subir una imagen y ver que sucede:

![img9](images/{C2627CF3-0B6C-4143-886D-E36EBB3208E2}.png)

Vemos que al subir nos da una especie de error que nos dice que solo podemos subir imágenes, aunque lo que subimos sí lo fue. Algo que podemos notar en la URL es que tiene la extensión `.php` esto ya nos dice que la web puede interpretar este código.

Si revisamos nuevamente el wappalizer vamos a ver que ya nos detecta `php` como lenguaje:
![img10](images/{3007F2A9-D99A-4C7C-A34F-4EE4D85F83C7}.png)

Ahora que conocemos esto, vamos a enviar un archivo malicioso que contenga código para ejecutar comandos con `php`.

# Explotación

Vamos a crear el archivo `cmd.php` con el siguiente contenido:

![img11](images/{C6FF9407-4C80-4632-9465-C0B83608DE45}.png)

Lo que vamos a hacer es subirlo, pero esa petición la vamos a capturar con ayuda de Burp Suite y la vamos a mandar al repeater para poder analizarla:

![img12](images/{DB272997-2AA6-4AA8-8D17-9FA8A3B9E0AC}.png)

![img13](images/Pasted%20image%2020251026191338.png)

![img14](images/Pasted%20image%2020251026191430.png)

![img15](images/{CF2EA671-5399-41C4-854A-C092C03FC9D4}.png)

Como podemos observar ya con la petición en el repeater y enviada vemos que nos da un mensaje de que solo son permitidas las imágenes, en esta ocasión al parecer la verificación del archivo se usa el contenido de la cabecera `Content-Type` por lo que vamos a modificarlo para que aparente una imagen y ver si nos permite subir el archivo:

![img16](images/Pasted%20image%2020251026191753.png)

Podemos observar como modificamos la cabecera y en la respuesta ya nos dice que se subió y se encuentra en `uploads/cmd.php`, recordemos que este es un archivo malicioso el cual se le debe pasar un parámetro por lo que para ingresar correctamente tenemos que hacerlos de la siguiente manera `/uploads/cmd.php?cmd=<comando>`:

![img17](images/Pasted%20image%2020251026191954.png)

Como podemos observar logramos la ejecución del comando `whoami` por lo que ya tenemos una forma de ejecutar comandos en el servidor.

Ahora que podemos ejecutar comandos, lo que vamos a hacer es ejecutar una reverse shell para controlar todo desde consola.

Primero vamos a dejar el puerto 443 de nuestra máquina atacante en escucha:

```bash
nc -nlvp 443
```

![img18](images/{09C8F528-B912-4DB0-A944-8685A5EB20EB}.png)

Ya con el puerto en escucha vamos a enviar la revese shell de la siguiente manera:

![img19](images/{9B736C15-9264-45E4-93AE-FDF7085B2F96}.png)

Como vemos enviamos la reverse shell y ya deberíamos ver la conexión en nuestra consola:

![img20](images/Pasted%20image%2020251026193917.png)

# Escalada de Privilegios

Podemos observar ya solo vamos a encargarnos de dar el tratamiento a la consola:

```bash
scrip /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img21](images/{8FFFC902-87FF-45A1-86D9-E080F31C1A19}.png)

Por último ya con la nueva consola exportamos `xterm` para el funcionamiento de comandos básicos como `ctrl + c o ctrl + l`:
![img22](images/{2FDA6AA8-CDDB-483C-9712-25AC3AAA4CF5}.png)

En este punto vamos a realizar un reconocimiento para archivos SUI:

```bash
find / -perm -4000 2>/dev/null
```

![img23](images/Pasted%20image%2020251026194942.png)

No vemos nada especial en realidad por lo que vamos a revisar por tareas cron:

```bash
cat /etc/crontab
```

![img24](images/{66F4048E-240F-4B8F-9A6E-A61B1F91B6AE}.png)

Tampoco vemos nada, podemos revisar otra ruta también:

```bash
ls /var/spool/cron/
```

![img25](images/{0B133606-6E4C-4415-973E-2766AEBFB6BA}.png)

Vemos una carpeta `crontabs`, pero no logramos acceder, ya que no tenemos permisos.

Podemos también buscar por capabilities en el sistema:

```
find / -type f -exec getcat {} \; 2>/dev/null
```

![img26](images/Pasted%20image%2020251026195828.png)

Bueno tampoco podemos observar nada, en este punto lo que vamos a hacer es crearnos un archivo para poder identificar comandos ejecutados en el sistema,vamos a crear el archivo `procmon.sh` y va a contener lo siguiente:

![img27](images/Pasted%20image%2020251026200427.png)

Bueno, con esto lo que hacemos es ver las diferencias entre en los comandos ejecutados en un bucle infinito, el propósito es ver si el comando se ejecutan en cierto tiempo.

Vamos a ejecutar nuestro script y a dejarlo corriendo hasta ver algo:

![img28](images/Pasted%20image%2020251026200816.png)

Vemos comandos que se están ejecutando, en este caso algo que llama nuestra atención es que al momento de ejecutar el binario `tar` está usando `*` en seco donde podemos hacer una `wildcard injection`, la base de esta vulnerabilidad es sencilla, se tiene que tener mucho cuidado con como se ejecuta estos comandos, como podemos ver el no asignar un `--` para que se ejecuten opciones extras puede llevar a que si tenemos permisos en este caso dentro de `/opt/project` para crear archivos podríamos crear archivos que como nombre lleven indicaciones esto haciendo que el binario no los interprete como archivos, sino como opciones de comando.

Bueno, lo primero que tenemos que tener en cuenta es si tenemos permisos de crear archivos dentro de `/opt/project`:

![img29](images/Pasted%20image%2020251026201418.png)

Podemos ver que pertenecemos al grupo `developers` el cual tiene todos los permisos dentro de `/opt/project` por lo que vamos primero a crear nuestro script malicioso donde se ejecutara un comando como el usuario propietario de los archivos y como no sabemos cual es este usuario ni que permisos tiene preferible vamos a generar otra reverse shell dentro del archivo `shell.sh` y no olvidemos darle permisos:

![img30](images/Pasted%20image%2020251026201757.png)

Ahora vamos con los siguientes comandos a crear los archivos que funcionaran como parámetros:

```bash
touch -- '--checkpoint=1'
touch -- '--checkpoint-action=exec=sh shell.sh'
```

![img31](images/{80CDFC1A-C163-4653-8866-5C8DEA181400}.png)

Ya con esto listo vamos a dejar por el puerto `555` en espera de una conexión:

```bash
nc -nlvp 555
```

![img32](images/Pasted%20image%2020251026202532.png)

Luego de un momento, si todo está correcto vamos a recibir la rever shell como el usuario `development`:

![img33](images/Pasted%20image%2020251026202614.png)

Como hicimos con el anterior usuario vamos a darle tratamiento a la shell para que se pueda utilizar mucho mejor:

```bash
scrip /dev/null -c bash
ctrl + z
stty raw -echo;fg
reset xterm
```

![img34](images/Pasted%20image%2020251026202758.png)

Por último exportamos `xterm`:
![img35](images/Pasted%20image%2020251026202827.png)

Ya con esto podemos intentar ver con `sudo -l` que comandos podemos usar sin necesidad de pasarle contraseña:

![img36](images/Pasted%20image%2020251026202957.png)

Vemos que podemos ejecutar un script como el usuario `alfonso` sin necesidad de pasarle contraseña de la siguiente manera:

```bash
sudo -u alfonso /usr/bin/sysinfo.sh
```

![img37](images/{EECC81F8-22C4-48FA-92CA-F1C1145D7D44}.png)

como podemos observar es que al parecer nos da la opción de ejecutar los comandos `df` y `ps` el problema radica en que nos permite pasarle parámetros extra, esto nos puede permitir inyectar un segundo comando de la siguiente manera:

```bash
; /bin/bash
```

![img38](images/Pasted%20image%2020251026203358.png)

Como podemos observar al inyectarle ese segundo comando lo que sucede es que nos da una bash pero ahora como `alfonso`.

En este punto ya podemos ver la flag de usuario:

![img39](images/{6095B2DC-50C9-44E0-B55F-4D44B24FF004}.png)

Perfecto ahora podemos verificar que se puede hacer de igual forma como super usuario con `sudo -l`:

![img40](images/{C1A4E963-B147-4BD5-96BD-5C348A9F50E8}.png)

Vemos que tenemos en este caso un `binario` el cual podemos ejecutarlo con sudo (permisos de administrador):

![img41](images/{4A145BBB-9EF4-4243-B5BD-A00F69DBF434}.png)

En este caso al script le pasamos un usuario y al parecer nos da la línea que le corresponde del `/etc/passwd`.

En este caso es un binario y por como hace esto podemos intentar ver si está ejecutando alguno de los comandos como `cat` para el archivo o `grep` para filtrar, para esto vamos a usar el comando `strings`:

```bash
strings /user/bin/silentgets
```

![img42](images/Pasted%20image%2020251026204243.png)

Al parecer el comando no lo tenemos. Vamos a traernos el binario a nuestra máquina para poder verlo:

![img43](images/{9ACA1B3A-2DB8-423D-A0D0-86A833BD4FE2}.png)

Ya con esto le damos permisos de ejecución:

![img44](images/{7C02ACAF-101A-4EBA-9F68-52B8E43AA0EF}%201.png)

Vamos a ver ahora si con `string` las cadenas que se pueden leer y vamos a filtrar por concepto sobre `cat`:

```bash
strings binario | grep 'cat'
```

![img45](images/{6C7BFDC8-93B6-4270-8A8F-1A6F0EFBAF8F}.png)

vemos que al parecer si se usa `cat` pero esos `@@` como que es extraño, veamos que pasa con el comando `grep`:

```bash
strings binario | grep 'grep'
```

![img46](images/{C69502AA-4EB4-4D48-9B8C-EA3257F2B39E}.png)

Como podemos observar al parecer lo que le pasamos se inserta en `%s` por lo que podemos intentar ingresar un comando en caso de no estar bien sanitizado:
![img47](images/{BA5B8E0D-260B-4154-BB30-6478FD64FE8E}.png)

!Perfecto ya estamos como root, con esto ya podemos ver la flag del usuario root:

![img48](images/{1E5DF19B-2FD9-443A-B7C3-57F22F1B4310}.png)

Con esto tenemos terminada la máquina.

![img49](images/{75D15725-A61A-46A5-B518-70391913AF43}.png)
