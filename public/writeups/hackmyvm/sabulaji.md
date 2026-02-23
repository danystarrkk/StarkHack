---
title: "Sabulaji"
date: 2026-02-23
draft: false
description: "Writeup de la máquina Sabulaji en HackMyVM."
categories: ["HackMyVM"]
tags: ["Exposed Rsync Service", "Rsync Weak Credentials", "Credential Disclosure in Document", "Password Reuse", "Insecure Sudo Script", "Path Traversal Logic Bypass", "Mlocate Database Information Disclosure", "Sudo Rsync Privilege Escalation"]
image: "/images/sabulaji.webp"
level: Medium
---

Iniciamos con un escaneo en red, esto con ayuda de **Arp-Scan**:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/images/Pasted%20image%2020260216212321.webp)

Observamos la IP de la máquina víctima, la cual es `192.168.1.71`.

Intentemos mediante el comando `ping` intuir de cierta forma el sistema operativo:

```bash
ping -c 1 192.168.1.71
```

![img2](/images/Pasted%20image%2020260216212555.webp)

Identificamos que tenemos un `ttl=64`, por defecto suele pertenecer al sistema Unix-like, donde entran sistemas como (Linux, BSD, etc.).

Ya podemos comenzar con un escaneo de puertos general, para observar primero puertos abiertos con ayuda de **Nmap**:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.71 -oG allPorts
```

![img3](/images/Pasted%20image%2020260217215031.webp)

Observamos los puertos `22,80,873` abiertos. Intentemos obtener mas información sobre los puertos abiertos, esto, nuevamente con **Nmap**:

```bash
nmap -p22,80,873 -sVC 192.168.1.71 -oN target
```

![img4](/images/Pasted%20image%2020260217215400.webp)

Tenemos los servicios: SSH puerto `22`, http puerto `80` y rsync puerto `873` corriendo en la máquina víctima.

Comencemos revisando la web alojada en el puerto `80`

![img5](/images/Pasted%20image%2020260217215903.webp)

Tenemos un texto, el cual nos explica el origen de la palabra `sabulaji` y cómo esta es usada, a parte de eso, no vamos a ver nada mas.

Se realizó fuzzing mediante herramientas como **Gobuster** y **FFUF**, con ayuda de diccionarios pertenecientes a `seclists` pero no logramos encontrar nada nuevo.

Al no encontrar nada, comenzamos a enumerar el servicio de `rsync`, recalcando que este servicio es usado especialmente para sincronizar archivos y directorios en de forma local o remota, en este caso es de forma remota. Veamos que recursos tenemos:

```bash
rsync --list-only 192.168.1.71::
```

![img6](/images/Pasted%20image%2020260217221059.webp)

Observamos lo que, al parecer, son dos directorios. Veamos primero el contenido de `public`:

```bash
rsync -av rsync://192.168.1.71/public
```

![img7](/images/Pasted%20image%2020260217221409.webp)

Bajemos el archivo a local para observar su contenido:

```bash
rsync -avz rsync://192.168.1.71/public/todo.list .
```

![img8](/images/Pasted%20image%2020260217222130.webp)

El contenido de `todo.list` es:

![img9](/images/Pasted%20image%2020260217222159.webp)

Tenemos una lista de tareas, exclusivamente tenemos tareas pertenecientes a `sabulaji`. Tomando en cuenta que la lista de Tareas especifican a `sabulaji` podemos pensar en este como usuario.

Bueno, vamos ahora a intentar listar lo perteneciente a `epages`:

```bash
rsync --list-only rsync://192.168.1.71/epages
```

![img10](/images/Pasted%20image%2020260217222411.webp)

El modulo `epages` requiere autenticación. Dado que anteriormente en las notas encontradas en el modulo `public` se asignan a `sabulaji` las tareas, este podría tratarse de un usuario asociado a rsync. Mediante ese usuario y utilizando contraseñas por defecto se intenta la autenticación.

```bash
rsync --list-only rsync://sabulaji@192.168.1.71/epages
```

![img11](/images/Pasted%20image%2020260217222540.webp)

No se logró con contraseñas por defecto, por lo que el siguiente paso será automatizar un script que nos permita realizar fuerza bruta, y el script me quedó de la siguiente manera:

```bash
#!/bin/bash

function ctrl_c() {
  echo -e "\n\n[!] Saliendo....\n\n"
  exit 1
  tput cnorm
}

trap ctrl_c SIGINT

clear

echo -e "\n=========== Information ============\n"

echo -n "IP: " && read ip
echo -n "Port: " && read port
echo -n "file or folder name: " && read file
echo -n "Dictionary: " && read dic_file
echo -n "User: " && read user

echo -e "\n===================================="

tput civis

declare -a dictionary=($(cat $dic_file | xargs))

echo -e "\n========== Result ==============\n"

for password in ${dictionary[@]}; do
  (echo "${password}" | rsync --password-file=- rsync://${user}@${ip}:${port}/${file}) &>/dev/null && echo -e "[+] Password -> ${password}" && break
done

tput cnorm

echo -e "\n================================\n"

```

![img12](/images/Pasted%20image%2020260219213826.webp)

Observamos que la contraseña es `admin123`. Con esto vamos a intentar ver el contenido de `epages`:

```bash
rsync -av rsync://sabulaji@192.168.1.71:873/epages
```

![img13](/images/Pasted%20image%2020260219214241.webp)

Como logramos observar, tenemos el archivo `secrets.doc`, un documento el cual vamos a traerlo a local para ver su contenido:

```bash
rsync -avz rsync://sabulaji@192.168.1.71:873/epages/secrets.doc .
```

![img14](/images/Pasted%20image%2020260219215954.webp)

Ya con el archivo en local, procedemos a verlo en cualquier lector de documentos, en mi caso con OnlyOffice:

![img15](/images/Pasted%20image%2020260219220346.webp)

Tenemos un texto algo extenso, pero en este se describe una cuenta por defecto, `welcome`, donde se usa una contraseña que es `P@ssw0rd123!`. Con estas credenciales vamos directamente a intentar conectarnos mediante `ssh`:

```bash
ssh welcome@192.168.1.71
```

![img16](/images/Pasted%20image%2020260219221330.webp)

![img17](/images/Pasted%20image%2020260219221600.webp)

Como observamos, dentro del directorio personal de `welcome` vamos a lograr encontrar la flag de usuario.

Comenzamos el reconocimiento ejecutando `sudo -l` para ver si nos permite ejecutar binarios como otro usuario o directamente como `root`:

![img18](/images/Pasted%20image%2020260221222445.webp)

El código del script es el siguiente:

![img19](/images/Pasted%20image%2020260222095315.webp)

En lo que nos fijamos del script son 3 puntos fundamentales:
- En el primer condicional observamos cómo filtra la ruta que se le pasa no contenga `sabulaji`, esto haciendo referencia a la ruta personal del usuario (Si nos lo impide, puede haber algo dentro).
- Utiliza el comando `diff` para almacenar todo cambio entre el archivo `notes.txt` dentro del directorio personal del usuario `sabulaji` y el archivo que le indiquemos.
- En el siguiente condicional verifica si la variable `difference` tiene contenido, y esta solo tendrá contenido en caso de que se encuentren diferencias. Si no tiene contenido pues cierra el script.

Comprendiendo eso, y debajo de lo mismo, vemos que las diferencias se imprimen por consola algo interesante que se puede usar a nuestro favor, pero solo se ejecuta si no entra en ninguno de los condicionales anteriores, por eso la importancia de comprender, para así evitarlos.

Veamos un poco dentro del directorio personal de `sabulaji` :

![img20](/images/Pasted%20image%2020260222102806.webp)

Observamos como dentro de la carpeta `/home/sabulaji` tenemos una carpeta `personal`, la cual, gracias al código del script sabemos que tiene `notes.txt`, pero no logramos entrar ni listar dentro de la misma por sus permisos.

Si verificamos nuestro usuario actual mediante `id` y `groups` para obtener más información veremos lo siguiente:
![img21](/images/Pasted%20image%2020260222103010.webp)

Pertenecemos al grupo `mlocate`. Al pertenecer a este grupo se nos permite acceder a la base de datos que el comando `locate` consulta y que contiene indexadas todas las rutas del sistema, siempre y cuando `root` lo haya actualizado. De este concepto es del cual vamos a intentar aprovecharnos para encontrar cualquier cosa en el sistema.

Primero identificamos la base de datos mediante el comando:

```bash
locate --help
```

![img22](/images/Pasted%20image%2020260222111027.webp)

Vemos cómo nos da un parámetro para la base de datos y, además nos indica la ruta usual, que seria `/var/lib/mlocate/mlocate.db`.

Con la ruta de la base de datos podemos, mediante `strings`, listar toda cadena legible de la misma y ver si encontramos algo:
```bash
strings /var/lib/mlocate/mlocate.db | grep -A 5 "/home"
```

![img23](/images/Pasted%20image%2020260222123916.webp)

Vemos una lista grande aún de archivos, pero entre ellos encontramos las `flags`, el a archivo `notes.txt` y el archivo `creds.txt`. Aquí entra un concepto clave: cuando el usuario `root` hace un `updatedb` y se actualiza esta base de datos, lo hace de manera recursiva y si no ha sido alterado, por defecto lo hará desde la raíz . Al usar el comando `strings`, frecuentemente se puede encontrar rutas agrupadas por prefijos en común, y buscando correctamente, podemos ver que nos lista con detalle dentro de que directorios podríamos encontrar algunos archivos. En este caso, vemos que dentro de `/home/sabulaji/personal/` se listan `creds.txt` y `notes.txt`.

Pensando un poco, podemos deducir que el script `/opt/sync.sh` puede comparar con el contenido de `notes.txt`, que esta en un directorio al cual no podemos acceder. También debe poder con el contenido de `creds.txt`, además como lista las diferencias, deberíamos poder ver el contenido de `creds.txt`. Ahora tomemos en cuenta los bloques que analizamos y, para que esto funcione, tenemos que evitar el `if` que filtra por `sabulaji`, por lo que tenemos que estar dentro de dicha carpeta para no pasarlo de forma absoluta, si no a partir del directorio actual, de la siguiente manera:

```bash
sudo -u sabulaji /opt/sync.sh personal/creds.txt
```

![img24](/images/Pasted%20image%2020260222124835.webp)

Tenemos las posibles credenciales de `sabulaji`. Vamos a intentar ingresar:

![img25](/images/Pasted%20image%2020260222124947.webp)

Vamos a volver a realizar reconocimiento con `sudo -l` :

![img26](/images/Pasted%20image%2020260222125122.webp)

Como observamos, tenemos la posibilidad de ejecutar `rsync` como usuario `root`. Busquemos si este comando, al tener privilegios de sudo, podemos escalar privilegios, en este caso, a mi me gusta verificarlo primero en [gtfobins](https://gtfobins.org/gtfobins/rsync/#shell) y, al parecer si tenemos forma:

![img27](/images/Pasted%20image%2020260222125336.webp)

Lo intentamos y logramos ingresar como usuario `root`:

![img28](/images/Pasted%20image%2020260222125432.webp)

Ya podemos ver la Flag:

![img29](/images/Pasted%20image%2020260222125459.webp)

Con esto Terminamos la máquina.

![img30](/images/Pasted%20image%2020260222131524.webp)