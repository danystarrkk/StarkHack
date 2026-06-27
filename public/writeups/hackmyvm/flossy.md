---
title: "Flossy"
date: 2026-06-27
description: "Writeup de la máquina Flossy en HackMyVM."
categories: ["HackMyVM"]
tags:
  [
    "Insecure Direct Object Reference",
    "GraphQL Introspection Enabled",
    "Server-Side Request Forgery",
    "CVE-2021-4034",
    "Unauthenticated Remote Code Execution",
    "Cron Job Misconfiguration",
    "Local Privilege Escalation",
  ]
image: "/images/flossy.webp"
level: Medium
---

# Enumeración

Comenzamos con un escaneo para identificar la máquina vulnerable, esto con ayuda de la herramienta `arp-scan`:

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](/images/Pasted%20image%2020260622151802.webp)

En esta ocasión la máquina víctima será la `192.168.74.130` y mediante el comando `ping` vamos a intentar identificar qué tipo de sistema operativo está operando:

```bash
ping -c 1 192.168.74.130
```

![img2](/images/Pasted%20image%2020260622152329.webp)

Como podemos observar, tenemos un `ttl=64`, lo que significa que posiblemente nos encontremos frente a un sistema con base Unix.

Ya con lo anterior en mente, podemos proceder a realizar un escaneo de puertos general con ayuda de `nmap`:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.74.130 -oG allPorts
```

![img3](/images/Pasted%20image%2020260622152655.webp)

En el resultado observamos los puertos `22 y 80` abiertos, por lo que vamos a realizar un escaneo mucho más agresivo sobre estos dos puertos de igual forma con ayuda de `nmap`:

```bash
nmap -p22,80 -sVC 192.168.74.130 -oN target
```

![img4](/images/Pasted%20image%2020260622152847.webp)

Listo, podemos observar entonces el servicio de SSH corriendo y de igual forma el servicio de http, es decir, contamos con alguna web corriendo y al parecer utiliza NodeJS.

Lo primero que voy a hacer es analizar la web con ayuda de la herramienta de `Whatweb`:

```bash
whatweb http://192.168.74.130
```

![img5](/images/Pasted%20image%2020260622153059.webp)

No logramos obtener información muy relevante, así que procedemos a ingresar a la web con el objetivo de analizar su contenido:

![img6](/images/Pasted%20image%2020260622153307.webp)

Podemos ver que es una web sencilla en realidad, donde, a partir de un ID, podemos obtener un personaje. Con esto en mente podemos analizar el código fuente en búsqueda de alguna pista:

![img7](/images/Pasted%20image%2020260622153448.webp)

En el código fuente tiene un script que, al parecer, es el encargado de enviar la petición sobre un personaje a partir de su ID y luego insertar dicha información en el HTML. Además, logro observar que esta petición se realiza a la ruta `/graphql`, así que claramente vamos a tener una API de tipo `GraphQL` funcionando.

Lo que vamos a realizar es capturar con ayuda del Burp Suite una petición para analizar cómo se tramita la información:

![img8](/images/Pasted%20image%2020260622153937.webp)

Podemos observar claramente por la estructura que estamos interactuando con una API de tipo GraphQL, por lo tanto, vamos a intentar realizar un introspection:

![img9](/images/Pasted%20image%2020260622154048.webp)

Observando la respuesta podemos ver que fue exitoso. Lo primero que voy a hacer es representarlo de una forma más gráfica con ayuda de GraphQL Voyager:

![img10](/images/Pasted%20image%2020260622154313.webp)

Perfecto, esta estructura nos indica que contamos con un campo `users`, el cual cuenta con `username` y `password`.

Lo que ahora voy a utilizar es de igual forma una utilidad de Burp Suite una vez tenemos la respuesta del introspection, y es la de `Save GraphQL queries to site map` donde vamos a obtener peticiones ya armadas a partir del introspection:

![img11](/images/Pasted%20image%2020260622154537.webp)

Bueno, vamos a observar lo siguiente:

![img12](/images/Pasted%20image%2020260622154757.webp)

Tenemos 3 peticiones armadas, donde vamos a fijarnos en la que al parecer podemos filtrar un `username` y `password` a partir de su ID, por lo que vamos a enviarla a repeater para usarla:

![img13](/images/Pasted%20image%2020260622155005.webp)

# Explotación

Como podemos observar, es válida, y no tendría sentido el usar o dejar un campo `user` si no vamos a tener nada, así que aprovecharé la situación para desarrollar un script básico en Python 3 que nos permita buscar por algún ID válido.

El script lo podemos encontrar en el link del [GitHub](<https://github.com/danystarrkk/Hacknig-Tools/tree/main/Tools/Fuzzing%20ID%20(Flossy)>).

El script, como podemos observar, realiza varias peticiones intentando encontrar un ID válido, de igual forma lo que se hizo fue simplificar la petición para una mejor adaptación en el código. En Burp Suite la petición quedaría de la siguiente manera:

![img14](/images/Pasted%20image%2020260623080441.webp)

El script lo ejecutamos de la siguiente manera:

```bash
python3 fuzzin.py -u http://192.168.74.130/graphql -r 1-100
```

![img15](/images/Pasted%20image%2020260623211805.webp)

Listo, al parecer sí teníamos un ID válido que sería el número 9, y como vemos, tenemos un usuario y una contraseña, pero si recordamos la web no tiene ningún panel de login.

Si recordamos los puertos abiertos, tenemos el puerto 22 corriendo SSH, lo que significa que podemos intentar conectarnos con esas credenciales de la siguiente manera:

```bash
ssh malo@192.168.74.130
```

![img16](/images/Pasted%20image%2020260623212305.webp)

Ya tenemos lo que es un zsh como el usuario malo por el momento.

# Escalada de Privilegios

Ya dentro de la máquina, vamos a intentar buscar por más usuarios aprovechando el archivo `/etc/passwd` de la siguiente manera:

```bash
cat /etc/passwd | grep ".*sh$"
```

![img17](/images/Pasted%20image%2020260623213947.webp)

Como podemos observar, tenemos un usuario extra llamado `sophie`.

Si nos ponemos a investigar un poco dentro de su directorio nos vamos a encontrar con un archivo llamado `SSHKeySync` el cual vamos a analizar:

![img18](/images/Pasted%20image%2020260623214349.webp)

Como podemos observar, en esta captura lo que tenemos es:

1. Definimos el usuario, la ruta de una clave privada para el usuario que se use y `admin_tty` guarda en realidad la ruta de una pseudoterminal. Recordemos que estas se generan para intentar emular las TTY, donde estas trabajan directamente con el hardware pero, al realizar conexiones remotas, no se tiene el hardware directamente, así que se genera una pseudoterminal para simular la TTY.
2. Lo que vemos en el siguiente paso es que al cumplirse una serie de requisitos, estamos enviando el contenido de la clave privada a la pseudoterminal con el identificador 24.
3. Por último, vemos que el usuario que se definió es el de `sophie`, por lo tanto, en realidad estamos enviando ya la clave privada del usuario `sophie` a una pseudoterminal con el identificador 24.

Ahora el problema es que actualmente no tenemos el permiso para ejecutar este script, y además, no tenemos idea de si se está ejecutando, así que voy a crear el siguiente script simple que me ayudará a ver, de forma algo superficial, si algún comando se ejecuta en el sistema:

```bash
#!/bin/bash

old_command="$(ps -eo command)"

while true; do
  new_command="$(ps -eo command)"
  diff <(echo "$new_command") <(echo "$old_command") | grep -vE "command|kworker"
  old_command="$new_command"
done

```

![img19](/images/Pasted%20image%2020260624113408.webp)

Con este pequeño script básico vamos a poder observar los comandos que se están ejecutando en el sistema a niveles irregulares de tiempo, así que vamos a dejarlo corriendo un momento.

![img20](/images/Pasted%20image%2020260624113325.webp)

Luego de un momento logramos observar cómo al parecer se ejecuta un `sleep 1m`. Si nosotros recordamos, el script de `SSHKeySync` ejecuta esto al final de sus sentencias, por lo tanto, el script está ejecutándose cada cierto tiempo. Conociendo la teoría de pseudoterminales, donde se generará una nueva por cada conexión, en este caso por SSH, vamos a intentar llegar al identificador de la pseudoterminal `24` y para esto primero vamos a generar un par de claves para poder usarlas al momento de la conexión sin la necesidad de contraseña de la siguiente manera:

```bash
ssh-keygen
```

![img21](/images/Pasted%20image%2020260624113925.webp)

Por último, tenemos que cambiar el nombre de la clave pública dentro de la máquina víctima, es decir:

```bash
mv id_rsa.pub authorized_keys
```

Ahora, lo que vamos a hacer es copiarla y pasarla a nuestra máquina atacante y darle los permisos `600`:

![img22](/images/Pasted%20image%2020260624114436.webp)

Teniendo la clave lista, podemos intentar realizar nuevamente una conexión:

```bash
ssh malo@192.168.74.130 -i id_rsa
```

![img23](/images/Pasted%20image%2020260624162447.webp)

Perfecto, ahora si revisamos el valor que tiene la tty:

![img24](/images/Pasted%20image%2020260624162515.webp)

Como observamos, tenemos el valor de 1, pero hacerlo de forma manual, es decir, generar estas conexiones de forma continua, nos llevará tiempo y es un trabajo tedioso, por lo que vamos a automatizar la conexión de la siguiente manera:

```bash
for i in {1..23};do ssh -tt 0 "sleep 1000 &"; done
```

![img25](/images/Pasted%20image%2020260624163500.webp)

Cabe aclarar que lo que hace el `0` es una forma de abreviar el `0.0.0.0` o `localhost`

Ya con esto, procedemos a conectarnos con `ssh 0`:

![img26](/images/Pasted%20image%2020260624163538.webp)

Listo, ya nos encontramos en la pseudoterminal 24, por lo tanto es cuestión de esperar y veremos lo siguiente:

![img27](/images/Pasted%20image%2020260624163617.webp)

Ya con esto, nos copiamos esta clave a un archivo de igual forma y le damos los permisos correspondientes:

![img28](/images/Pasted%20image%2020260624164328.webp)

Ya con la clave lista, vamos a intentar conectarnos de la siguiente manera:

```bash
ssh sophie@192.168.74.130 -i sophie
```

![img29](/images/Pasted%20image%2020260624164227.webp)

Perfecto, en este punto ya podemos ver la flag de usuario:

![img30](/images/Pasted%20image%2020260624171203.webp)

Ya en este punto, vamos a volver a revisar la configuración del comando sudo mediante `sudo -l`:

![img31](/images/Pasted%20image%2020260624171326.webp)

Como observamos, podemos ejecutar el archivo `/home/sophie/network*`, pero esto tiene un problema y es el cómo usa la wildcard. Esto le indica al sistema que ejecute todo archivo que tenga como nombre `network` seguido de cualquier cosa, así que por qué no intentar crear un archivo de nombre `networks` con s al final y, de contenido, intentemos asignarle permisos SUID a la `bash` de la siguiente manera:

```bash
chmod +s /bin/bash
```

![img32](/images/Pasted%20image%2020260624171708.webp)

Ahora, con este archivo listo vamos a darle permisos de ejecución `chmod +x networks` y luego a ejecutarlo de la siguiente manera:

```bash
sudo /home/sophie/networks
```

![img33](/images/Pasted%20image%2020260624171921.webp)

Si revisamos los permisos de la `bash`, veamos si ya tenemos los SUID aplicados:

![img34](/images/Pasted%20image%2020260624172009.webp)

Listo, ya tenemos permisos SUID, así que vamos a escalar de privilegios con `/bin/bash -p`:

![img35](/images/Pasted%20image%2020260624172051.webp)

Ya estamos como `root` y podemos verificar la flag:

![img36](/images/Pasted%20image%2020260624172137.webp)

Lab Terminado.

![img37](/images/Pasted%20image%2020260624172312.webp)

# Mitigaciones

Al terminar con la enumeración y explotación de la máquina vulnerada, se proponen las siguientes mitigaciones para fortalecer y mantener la seguridad:

## Exposición de Esquema GraphQL y Datos Sensibles

La API de GraphQL expuesta en el puerto 80 tenía habilitada la característica de _introspection_, lo que permitió descubrir su estructura interna y los campos disponibles. Sumado a esto, la falta de controles de acceso y autorización permitió enumerar identificadores de manera iterativa hasta extraer un usuario y una contraseña en texto plano.

Se propone deshabilitar la introspección (_introspection_) en entornos de producción. Además, se debe implementar una correcta validación de acceso basada en roles o tokens (como JWT) para asegurar que la API no devuelva información sensible a usuarios no autorizados, y evitar a toda costa devolver o almacenar contraseñas en texto claro.

## Almacenamiento Inseguro y Reutilización de Credenciales

Durante la explotación inicial, la contraseña del usuario `malo` obtenida de la API resultó ser válida para establecer una conexión remota directa hacia el servidor a través del servicio SSH, demostrando una reutilización de credenciales entre servicios y un almacenamiento inseguro.

Se propone almacenar las contraseñas utilizando funciones de derivación criptográfica seguras y robustas (como bcrypt o Argon2) junto con un _salt_ único. Adicionalmente, para el acceso a la infraestructura (SSH), se recomienda deshabilitar la autenticación por contraseña (`PasswordAuthentication no`) y utilizar exclusivamente autenticación basada en el intercambio de claves asimétricas.

## Intercepción de Credenciales en Pseudoterminales (TTY)

El script automatizado `SSHKeySync` enviaba directamente el contenido de la clave privada de la usuaria `sophie` hacia una pseudoterminal predecible y estática (identificador 24). Esto permitió saturar las conexiones locales mediante un bucle hasta lograr secuestrar la TTY específica e interceptar el archivo sensible.

Se propone no transferir material criptográfico mediante redirecciones a dispositivos TTY. Si es necesaria la automatización de procesos mediante SSH, se deben utilizar herramientas de gestión seguras como `ssh-agent`, bóvedas de secretos, o en su defecto, implementar validaciones estrictas sobre la propiedad de la terminal receptora.

## Configuración Insegura de Sudo (Uso de Wildcards)

La configuración del archivo `sudoers` permitía a la usuaria `sophie` ejecutar comandos con privilegios elevados (`root`) sobre cualquier archivo que coincidiera con el patrón `/home/sophie/network*`. El uso de este comodín (_wildcard_) permitió crear un archivo ejecutable arbitrario llamado `networks` para asignar permisos SUID a la bash y lograr el compromiso total del sistema.

Se propone aplicar el Principio de Menor Privilegio (PoLP) definiendo rutas absolutas y exactas en la configuración de `sudoers`, eliminando por completo el uso de comodines. Si es estrictamente necesario ejecutar múltiples scripts dentro de una ruta específica, dicho directorio debe pertenecer exclusivamente a `root` y carecer de permisos de escritura para el resto de los usuarios.
