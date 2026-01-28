---
title: "Espo"
date: 2026-01-09
description: "Writeup de la máquina Espo en HackMyVM."
categories: ["HackMyVM"]
tags: ["Path Traversal", "Exposed Backup Files", "Credential Disclosure", "CVE-2023-5965", "Authenticated Remote Code Execution", "Sudo Misconfiguration", "Privilege Escalation"]
image: "/images/espo.png"
level: Medium
---

# Enumeración

Comenzamos identificando la máquina víctima con ayuda de **Arp-Scan**

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020260107004626.png)

Ya con la IP identificada, podemos intentar intuir con ayuda de ping el sistema operativo:

```bash
ping -c 1 192.168.1.87
```

![img2](images/Pasted%20image%2020260107005218.png)

Como podemos observar, el `ttl=64` nos permite intuir que tenemos una máquina Linux.

Vamos a comenzar con un escaneo de puertos para identificar los que se encuentran abiertos, esto con ayuda de **Nmap**:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.87 -oG allPorts
```

![img3](images/Pasted%20image%2020260107005536.png)

Como podemos observar, tenemos los puertos `80 y 22` abiertos, vamos a tratar de con **Nmap**d obtener más información sobre los mismos:

```bash
nmap -p80,22 -sVC 192.168.1.87 -oN target
```

![img4](images/Pasted%20image%2020260107005759.png)

Podemos observar, cómo es que está corriendo los servicios de SSH y HTTP con Nginx.

Lo primero es identificar qué tenemos en HTTP y, mientras se abre la web vamos a ver si logramos identificar algo especial con **Whatweb**:

```bash
whatweb http://192.168.1.87
```

![img5](images/Pasted%20image%2020260107010245.png)

Como podemos observar, corre `php 8.2.7`, tenemos `nginx` y pues nada mas, en este punto veamos qué tenemos en la web:

![img6](images/Pasted%20image%2020260107010434.png)

Con ayuda de `Wappalizer` podemos intentar ver información extra:

![img7](images/Pasted%20image%2020260107010529.png)

Podemos observar que tiene `Frameworks` y `Librerías` de Java Script.

Bueno, en la web se intentó con credenciales por defecto y se intentó comprobar si se podía enumerar usuarios, que no se logró. En este punto vamos a realizar una búsqueda por directorios con ayuda de **Gobuster**:

```bash
gobuster dir -u http://192.168.1.87 -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img8](images/Pasted%20image%2020260107133038.png)

Vemos algunas rutas que, al parecer, no podemos visitar. Ahora, un concepto rápido es que en `nginx` tenemos o se suelen definir **Alias** para algunas rutas donde, si esto no se realizó correctamente, se podrían, mediante un **Path Traversal** exponer archivos y descubrirlos mediante fuzzing.

Entonces, con lo anterior claro, encontramos un error al definir el alias de admin y lo podemos comprobar de la siguiente manera:

- Web `admin`:
  ![img9](images/Pasted%20image%2020260107134633.png)

- Con la inyección logramos recargar la misma web llamando directo al archivo:
  ![img10](images/Pasted%20image%2020260107134740.png)

Esto no es posible en las otras rutas.

Realizando Fuzzing tenemos que hacerlo lo mejor posible y para encontrar el archivo que necesitamos, vamos a usar en la inyección un `_` de la siguiente manera:

```bash
ffuf -c -u http://192.168.1.87/admin../_FUZZ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img11](images/Pasted%20image%2020260107161318.png)

Vemos que acabamos de encontrar una ruta `_oldsite`, veamos qué contiene:

![img12](images/Pasted%20image%2020260107161414.png)

Al parecer nada, veamos si es algún directorio y busquemos archivos dentro de está:

```bash
gobuster dir -u http://192.168.1.87/admin../_oldsite/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img13](images/Pasted%20image%2020260107161540.png)

Encontramos un archivo `info`, veamos su contenido:

![img14](images/Pasted%20image%2020260107161634.png)

Se descarga un archivo con el siguiente contenido:

![img15](images/Pasted%20image%2020260107161811.png)

Lo que en realidad nos sirve es que nos avisa que al parecer tenemos dentro de `/admin/_odsite` un archivo backup con formato zip, busquémoslo:

```bash
gobuster dir -u http://192.168.1.87/admin../_oldsite/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -x zip
```

![img16](images/Pasted%20image%2020260107162036.png)

Encontramos un `backup.zip`, esto es bueno, vamos a descargarlo y descomprimirlo para ver qué contiene:

![img17](images/Pasted%20image%2020260107162458.png)

Observamos, al parecer, una copia de toda la web, vamos a intentar ver si en algunos archivos de configuración encontramos algo.

Para evitar un poco el ruido general, primero filtré por archivos `\*conf\*` con ayuda de find y luego a estas rutas le ejecuté un `cat` donde, por último filtré por todas las coincidencias con las palabras `username|user|pass|password` quedando de la siguiente manera:

```bash
find . -name \*conf\* -exec /bin/cat {} \; | grep -iE 'user|username|password|pass'
```

![img18](images/Pasted%20image%2020260107164644.png)

Podemos ver dos posibles usuarios y sus claves, el cual me interesa es el de `admin` , por lo tanto vamos a probar este a ver si logramos acceder a la web:

![img19](images/Pasted%20image%2020260107171922.png)

Como vemos, logramos entrar como `admin`.

# Explotación

En este punto, lo primero es identificar la versión del EspoCRM para buscar por vulnerabilidades conocidas.

![img20](images/Pasted%20image%2020260107175239.png)

Vemos la versión `7.2.4` vayamos en busca de alguna vulnerabilidad conocida para esta versión:

![img21](images/Pasted%20image%2020260107180331.png)

Encontramos el repositorio de [Github](https://github.com/josemlwdf/CVE-2023-5965) donde vamos a seguir los pasos que nos dice para explotar la vulnerabilidad, donde primero actualizamos y luego subimos la extensión y una vez echo eso, obtendremos lo siguiente en la ruta de `/espocrm/webshell.php`:

![img22](images/Pasted%20image%2020260107181051.png)

Ya podemos ejecutar comandos, por lo tanto, vamos a generar una Reverse Shell de la siguiente manera:

![img23](images/Pasted%20image%2020260107181236.png)

![img24](images/Pasted%20image%2020260107181247.png)

Perfecto, vamos a darle tratamiento y tendremos ya una bash:

![img25](images/Pasted%20image%2020260107181346.png)

# Escalada de Privilegios

Realizamos reconocimiento, pero no encontramos nada, pero vamos a revisar mediante un mini script qué comandos se ejecutan a intervalos de tiempo:

![img26](images/Pasted%20image%2020260107182305.png)

Con este script vamos a intentar detectar alguna cosa.

![img27](images/Pasted%20image%2020260107182528.png)

Detectamos la ejecución del siguiente script dónde si lo revisamos, encontramos lo siguiente:

![img28](images/Pasted%20image%2020260107182954.png)

De forma resumida, el script lo que hace es copiar todo lo de `/var/shared_medias` a el `/home/madie` del usuario, esto nosotros lo podemos aprovechar y es que podemos intentar crear un archivo con el mismo nombre y que contenga el mismo script con un detalle, y es que al final generemos una reverse shell. Al ejecutarse el script, lo que sucederá es que remplazará el script en la carpeta y, al volverse a ejecutar, sin importar si tiene permisos de ejecución, debido a que lo hace con `/bin/sh` se ejecutará obtendremos la reverse shell. Entonces nuestro script malicioso será el siguiente:

![img29](images/Pasted%20image%2020260107184137.png)

Antes de pasar esto al directorio `/var/shared_medias` vamos a dejar ya el puerto 444 en escucha y ahí sí podemos ponerlo en el directorio y esperamos la conexión:

![img30](images/Pasted%20image%2020260107185813.png)

Tenemos ya conexión, al igual que con la anterior, vamos a darle tratamiento:

![img31](images/Pasted%20image%2020260107185944.png)

Ya estamos como el usuario `madie` y volvemos a hacer reconocimiento, donde con el comando `sudo -l` encontramos lo siguiente:

![img32](images/Pasted%20image%2020260108102540.png)

Vemos que mediante el comando `sudo` podemos ejecutar el binario de `savelog` como `root` por lo tanto, vamos a listar la ayuda a ver qué es lo que se puede hacer:

![img33](images/Pasted%20image%2020260108102641.png)

Podemos observar que tenemos una opción que nos permite ejecutar script, vamos a investigar la forma de usarla correctamente para intentar obtener una `bash`.

![img34](images/Pasted%20image%2020260108103809.png)
Podemos observar que se están ejecutando comandos, por lo que podríamos directamente ejecutar una `bash` desde allí de la siguiente manera:

```bash
sudo /usr/bin/savelog -x "bash" test3
```

![img35](images/Pasted%20image%2020260108103913.png)

Máquina terminada.

![img36](images/Pasted%20image%2020260108104134.png)
