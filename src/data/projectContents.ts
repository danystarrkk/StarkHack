import { Project, RichProjectData, ProjectLink, ToolLink } from '../types';

export const SAMPLE_PROJECTS_CONTENT: Record<string, RichProjectData> = {
  'autorecon-ng': {
    projectLinks: [
      {
        title: 'GitHub // starkhack/autorecon-ng',
        url: 'https://github.com/starkhack/autorecon-ng',
        badge: 'REPOSITORIO OFICIAL',
        type: 'github',
      },
    ],
    toolLinks: [
      {
        name: 'stark-recon-suite',
        url: 'https://github.com/danystark/stark-recon-suite',
        description: 'Orquestador complementario para piping automático de resultados hacia subfinder y httpx.',
        category: 'CUSTOM_TOOL',
        developedByAuthor: true,
        githubStars: '89 ★',
      },
      {
        name: 'Scapy Packet Crafting',
        url: 'https://scapy.net/',
        description: 'Biblioteca interactiva para manipulación de paquetes de red de bajo nivel en capas 2, 3 y 4.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
      {
        name: 'Nmap Scripting Engine (NSE)',
        url: 'https://nmap.org/book/nse.html',
        description: 'Motor de scripts Lua para detección de vulnerabilidades y fingerprinting de servicios.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
    ],
    technicalSpecs: {
      language: 'Python 3.11 / AsyncIO',
      license: 'MIT License',
      architecture: 'x86_64 / aarch64 (Raw Sockets)',
      buildStatus: 'Passing (100% tests)',
      requirements: 'Linux Kernel >= 5.4, CAP_NET_RAW',
    },
    markdown: `# Documentación Técnica: AutoRecon-NG (v1.4.0)

> [!NOTE] Resumen de Arquitectura
> **AutoRecon-NG** es un framework asíncrono y distribuido para reconocimiento perimetral ofensivo y auditorías de infraestructura. Diseñado desde cero para resolver el cuello de botella de latencia I/O de los escáneres síncronos tradicionales, combina la potencia de **AsyncIO** con sockets crudos (**Raw Sockets**) mediante Scapy y parsing reactivo de trazas XML de Nmap.

---

## 1. Arquitectura del Motor y Flujo Operativo

El motor opera bajo un modelo de productor-consumidor asíncrono que canaliza los objetivos en cuatro fases continuas de inspección:

\`\`\`
+-----------------------+      +---------------------------+      +--------------------------+
|  Input Targets (CIDR) | ---> |  Async DNS Resolv Pool    | ---> |  SYN Stealth Probe       |
+-----------------------+      +---------------------------+      +--------------------------+
                                                                                |
                                                                                v
+-----------------------+      +---------------------------+      +--------------------------+
| JSON / SQLite Report  | <--- |  HTTP Fingerprint Engine  | <--- |  Dynamic Service Scan    |
+-----------------------+      +---------------------------+      +--------------------------+
\`\`\`

### 1.1 Resolución DNS Concurrente de Alto Rendimiento
- Resolución paralela de dominios y subdominios a través de un pool rotativo de servidores DNS públicos y locales.
- Tasa de rendimiento de hasta **50,000 resoluciones por minuto** en conexiones estándar gigabit sin saturar la tabla de conexiones NAT.

### 1.2 Sondeo Sigiloso SYN con Sockets Crudos
- Fabricación directa de cabeceras IP y TCP evitando el handshake tridireccional del sistema operativo.
- Aleatorización de números de secuencia (ISN) y fragmentación de paquetes para evadir IDS/IPS basados en umbrales estáticos.

---

## 2. Instalación y Puesta en Marcha

Se requiere **Python 3.10+** y privilegios suficientes para apertura de sockets en modo crudo (\`CAP_NET_RAW\` o ejecución como superusuario).

### 2.1 Clonar el Repositorio e Instalar Dependencias

\`\`\`bash:install.sh
# Clonación del repositorio oficial
git clone https://github.com/starkhack/autorecon-ng.git
cd autorecon-ng

# Creación de entorno virtual aislado
python3 -m venv venv
source venv/bin/activate

# Instalación de librerías nativas requeridas
pip install -r requirements.txt
\`\`\`

### 2.2 Asignación de Capacidades en Linux (Sin necesidad de Sudo total)

Para evitar ejecutar todo el intérprete como root, es posible otorgar la capacidad de red únicamente al binario de Python:

\`\`\`bash:setup_caps.sh
sudo setcap cap_net_raw,cap_net_admin+eip $(readlink -f $(which python3))
\`\`\`

---

## 3. Guía de Uso y Comandos CLI

### 3.1 Escaneo Rápido de Rango de Red

\`\`\`bash:quick_scan.sh
python3 autorecon.py -t 192.168.1.0/24 --threads 50 --ports top-1000 -o ./scan_results
\`\`\`

### 3.2 Escaneo Completo Agresivo con Detección de Vulnerabilidades

\`\`\`bash:aggressive_audit.sh
python3 autorecon.py -t client-infrastructure.corp \\
    --all-ports \\
    --syn-stealth \\
    --http-probe \\
    --service-detection \\
    --rate 2500 \\
    --format json,sqlite,markdown \\
    --output ./audit_final
\`\`\`

### 3.3 Tabla de Parámetros Principales

| Flag CLI | Tipo | Descripción | Valor por Defecto |
| :--- | :--- | :--- | :--- |
| \`-t, --target\` | String | IP individual, FQDN o notación CIDR | **Requerido** |
| \`-p, --ports\` | String | Rango de puertos (\`1-65535\`, \`top-1000\`, \`custom\`) | \`top-1000\` |
| \`--syn-stealth\` | Flag | Envío de paquetes TCP SYN crudos sin completar conexión | \`True\` |
| \`--rate\` | Integer | Límite de paquetes por segundo (PPS) | \`1000\` |
| \`--threads\` | Integer | Cantidad de trabajadores asíncronos concurrentes | \`40\` |
| \`-o, --output\` | Path | Directorio destino para exportar informes generados | \`./results\` |

---

## 4. Implementación del Núcleo Asíncrono

A continuación se expone la rutina central encargada del dispatch de paquetes TCP SYN asíncronos:

\`\`\`python:engine/scanner.py
import asyncio
from scapy.all import IP, TCP, sr1

async def async_port_scan(target_ip: str, port: int, timeout: float = 0.8) -> dict | None:
    """
    Envía un sondeo TCP SYN forjado y evalúa la bandera de retorno SYN-ACK (0x12).
    """
    pkt = IP(dst=target_ip) / TCP(dport=port, flags="S", seq=1000)
    
    # Delegamos la llamada bloqueante I/O al threadpool de asyncio
    response = await asyncio.to_thread(sr1, pkt, timeout=timeout, verbose=0)
    
    if response and response.haslayer(TCP):
        tcp_flags = response.getlayer(TCP).flags
        if tcp_flags == 0x12:  # SYN + ACK recibido: Puerto ABIERTO
            # Enviamos RST de cortesía para no saturar la cola de conexiones del target
            rst_pkt = IP(dst=target_ip) / TCP(dport=port, flags="R")
            await asyncio.to_thread(sr1, rst_pkt, timeout=0.2, verbose=0)
            return {
                "port": port,
                "state": "OPEN",
                "service": "analyzing"
            }
        elif tcp_flags == 0x14:  # RST + ACK: Puerto CERRADO
            return None
            
    return None
\`\`\`

> [!TIP] Optimización de Rendimiento
> Al utilizar \`asyncio.to_thread\` en conjunción con Scapy, se minimiza la sobrecarga de context-switch permitiendo procesar cientos de miles de paquetes con una huella de memoria inferior a **65 MB**.

---

## 5. Medición de Rendimiento y Comparativa

Prueba de escaneo sobre segmento \`/24\` (256 hosts activos, top 1000 puertos):

| Herramienta | Tiempo Total | Consumo de RAM | Paquetes Perdidos |
| :--- | :--- | :--- | :--- |
| **AutoRecon-NG (v1.4.0)** | **1m 14s** | **62 MB** | **< 0.05%** |
| Nmap (T4 SYN) | 3m 48s | 85 MB | < 0.1% |
| Masscan (10k pps) | 0m 45s | 48 MB | ~ 2.4% |

---

## 6. Licencia y Responsabilidad

Este software ha sido creado para **auditorías de seguridad autorizadas, ejercicios de red teaming y pruebas de penetración éticas**. Queda terminantemente prohibido su uso sobre infraestructura sin previo consentimiento explícito y por escrito. Distribuido bajo licencia **MIT**.
`,
  },

  'k-injector': {
    projectLinks: [
      {
        title: 'GitHub // starkhack/k-injector',
        url: 'https://github.com/starkhack/k-injector',
        badge: 'REPOSITORIO OFICIAL',
        type: 'github',
      },
    ],
    toolLinks: [
      {
        name: 'SysWhispers3',
        url: 'https://github.com/klezVirus/SysWhispers3',
        badge: 'REFERENCIA',
        description: 'Generador de llamadas directas al sistema Windows (Direct Syscalls) compatible con WoW64 y x64.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
      {
        name: 'stark-jwt-forge',
        url: 'https://github.com/danystark/stark-jwt-forge',
        description: 'Herramienta de forja criptográfica y manipulador de tokens.',
        category: 'CUSTOM_TOOL',
        developedByAuthor: true,
        githubStars: '142 ★',
      },
    ],
    technicalSpecs: {
      language: 'Rust 2021 Edition / Inline Assembly',
      license: 'GPL-3.0 License',
      architecture: 'x86_64 Windows (PE32+)',
      buildStatus: 'Passing (Clang / MSVC)',
      requirements: 'Windows 10 / 11, Server 2016-2022',
    },
    markdown: `# Documentación Técnica: K-Injector (v2.1.0)

> [!WARNING] Advertencia de Seguridad Ofensiva
> **K-Injector** es una herramienta de simulación de adversarios desarrollada en **Rust** para pruebas de evasión ante soluciones EDR/XDR de última generación. Emplea técnicas de invocación directa de Syscalls (\`Halo's Gate\`), desenlazado de DLLs en memoria (\`Dynamic Unhooking\`) y ofuscación de pila (\`Call Stack Spoofing\`).

---

## 1. Fundamentos de Evasión EDR

Las soluciones de Endpoint Detection & Response (EDR) modernas monitorizan las APIs de usuario mediante la colocación de instrucciones \`JMP\` (hooks) en funciones críticas de \`ntdll.dll\`.

\`\`\`
[Normal API Call]      Win32 API ---> NTDLL.dll (Clean) ---> SYSCALL (Ring 0 Kernel)
[EDR Hooked Call]      Win32 API ---> NTDLL.dll (HOOK JMP) -> EDR Engine (Inspection) -> SYSCALL
[K-Injector Syscall]   Win32 App ---> Halo's Gate (Direct) ---------------------------> SYSCALL (Ring 0 Kernel)
\`\`\`

### 1.1 Resolución Dinámica mediante Halo's Gate
K-Injector lee el encabezado de exportaciones de la copia en memoria de \`ntdll.dll\`. Si detecta un opcode \`0xE9\` (JMP) en el prólogo de la función requerida (\`NtAllocateVirtualMemory\`, \`NtWriteVirtualMemory\`, etc.), busca en los vecinos adyacentes para calcular aritméticamente el **System Service Number (SSN)** correcto sin tocar el gancho del sensor.

---

## 2. Compilación del Proyecto

Para garantizar compatibilidad binaria estricta con Windows x86_64, se recomienda compilar utilizando el target nativo de Rust con optimización agresiva:

\`\`\`bash:build.sh
# Clonación de fuentes
git clone https://github.com/starkhack/k-injector.git
cd k-injector

# Compilación con perfil de Release y stripped de símbolos
cargo build --release --target x86_64-pc-windows-msvc
\`\`\`

---

## 3. Implementación Central en Rust con ASM Inline

\`\`\`rust:src/syscalls/mod.rs
use std::ffi::c_void;
use windows_sys::Win32::Foundation::NTSTATUS;

#[no_mangle]
#[inline(never)]
pub unsafe fn direct_syscall_invoke(ssn: u32, args: *const c_void) -> NTSTATUS {
    let mut status: NTSTATUS;
    
    // Invocación a nivel de ensamblador directo evitando el paso por ntdll.dll hookeada
    std::arch::asm!(
        "mov r10, rcx",
        "mov eax, edx",
        "syscall",
        in("rcx") args,
        in("edx") ssn,
        lateout("rax") status,
        options(nostack)
    );
    
    status
}
\`\`\`

---

## 4. Características de Seguridad Ofensiva

- **Unhooking de NTDLL en Caliente:** Remapeo limpio de la sección \`.text\` desde \`\\KnownDlls\\ntdll.dll\` en espacio de usuario.
- **Sleep Obfuscation:** Cifrado completo del payload en memoria (AES-128 / ChaCha20) durante los periodos de suspensión \`NtDelayExecution\`.
- **Zero Raw Syscall Indicators:** Utiliza retorno indirecto (\`jmp qword ptr [ntdll_syscall_ret]\`) para que los registros de telemetría ETW apunten al espacio de direcciones oficial de Windows.
`,
  },

  'htb-toolkit': {
    projectLinks: [
      {
        title: 'GitHub // starkhack/htb-toolkit',
        url: 'https://github.com/starkhack/htb-toolkit',
        badge: 'REPOSITORIO OFICIAL',
        type: 'github',
      },
    ],
    toolLinks: [
      {
        name: 'WireGuard Kernel Module',
        url: 'https://www.wireguard.com/',
        description: 'Túnel VPN criptográfico de alto rendimiento para interconexión de laboratorios.',
        category: 'REFERENCE',
        developedByAuthor: false,
      },
      {
        name: 'stark-recon-suite',
        url: 'https://github.com/danystark/stark-recon-suite',
        description: 'Suite automatizada de reconocimiento y generación de plantillas.',
        category: 'CUSTOM_TOOL',
        developedByAuthor: true,
        githubStars: '89 ★',
      },
    ],
    technicalSpecs: {
      language: 'Go 1.22 / Bash / Docker Engine',
      license: 'MIT License',
      architecture: 'Multi-platform (Linux / macOS / WSL)',
      buildStatus: 'Passing (CI Pipeline)',
      requirements: 'Docker 24+, WireGuard CLI, curl',
    },
    markdown: `# Documentación Técnica: HTB-Toolkit (v1.2.0)

> [!NOTE] Propósito del Framework
> **HTB-Toolkit** es una navaja suiza de automatización y orquestación para analistas de ciberseguridad, jugadores de CTF y estudiantes en plataformas como Hack The Box y HackMyVM. Gestiona túneles VPN aislados, aprovisiona espacios de trabajo por máquina y genera plantillas estructuradas de documentación para Obsidian y Markdown.

---

## 1. Módulos y Capacidades

- **VPN-Keeper:** Mantiene el túnel VPN activo reconectando en milisegundos si detecta pérdida de paquetes ICMP.
- **Auto-Workspace:** Al iniciar una máquina (\`htb-toolkit spawn\`), crea la estructura de carpetas estándar: \`nmap/\`, \`exploits/\`, \`loot/\`, \`credentials/\` y un \`README.md\` pre-rellenado con metadatos.
- **Note-Sync:** Sincroniza evidencias capturadas con Obsidian Vault mediante formato Markdown estandarizado.

---

## 2. Instalación Rápida

\`\`\`bash:install.sh
curl -fsSL https://starkhack.dev/install.sh | bash

# Comprobación de binario
htb-toolkit --version
\`\`\`

---

## 3. Ejemplo de Uso en Laboratorio

\`\`\`bash:usage.sh
# Conectar al perfil de VPN seleccionado
htb-toolkit vpn connect --profile lab-vip.conf

# Crear el entorno para una nueva máquina
htb-toolkit spawn --ip 10.10.11.234 --name TargetLab --os linux

# Iniciar escaneo inicial de puertos en segundo plano
htb-toolkit scan --fast 10.10.11.234
\`\`\`
`,
  },
};

/**
 * Retorna la información completa de documentación técnica, links y metadatos
 * para cualquier proyecto de la plataforma.
 */
export function getProjectContent(project: Project): RichProjectData {
  if (SAMPLE_PROJECTS_CONTENT[project.id]) {
    return SAMPLE_PROJECTS_CONTENT[project.id];
  }

  // Generación dinámica estructurada para proyectos del archivo
  const officialGithubUrl =
    project.githubUrl || `https://github.com/starkhack/${project.id}`;

  const defaultToolLinks: ToolLink[] = [
    {
      name: 'stark-recon-suite',
      url: 'https://github.com/danystark/stark-recon-suite',
      description: 'Orquestador complementario y conjunto de scripts para auditorías ofensivas.',
      category: 'CUSTOM_TOOL',
      developedByAuthor: true,
      githubStars: '89 ★',
    },
    {
      name: 'SecLists / Discovery Wordlists',
      url: 'https://github.com/danielmiessler/SecLists',
      description: 'Colección de diccionarios para pruebas de penetración y fuzzing.',
      category: 'WORDLIST',
      developedByAuthor: false,
    },
  ];

  const projectLinks: ProjectLink[] = [
    {
      title: `GitHub // starkhack/${project.id}`,
      url: officialGithubUrl,
      badge: 'REPOSITORIO OFICIAL',
      type: 'github',
    },
  ];

  const generatedMarkdown = `# Documentación Oficial: ${project.title} (${project.version})

> [!NOTE] Ficha del Proyecto
> **${project.title}** (${project.subBadge}) es un desarrollo categorizado como **${project.tagCategory}**.
> ${project.description}

---

## 1. Arquitectura y Objetivos Técnicos

El proyecto fue desarrollado para resolver requerimientos de rendimiento, fiabilidad y evasión en entornos de ciberseguridad y pentesting profesional.

### 1.1 Pila Tecnológica y Dependencias
- **Tecnologías Principales:** ${project.tags.join(', ')}
- **Versión de Release:** \`${project.version}\`
- **Estado Actual:** \`${project.statusBadge || '• • ACTIVE'}\`

---

## 2. Instalación y Despliegue

Para utilizar este proyecto en tu entorno de auditoría:

\`\`\`bash:install.sh
# 1. Clonar el repositorio oficial
git clone ${officialGithubUrl}.git
cd ${project.id}

# 2. Configurar entorno de dependencias
${
  project.tags.includes('Rust')
    ? 'cargo build --release'
    : project.tags.includes('Go')
    ? 'go build -o ' + project.id + ' main.go'
    : project.tags.includes('Python') || project.tags.includes('Python 3')
    ? 'pip install -r requirements.txt'
    : 'make setup'
}
\`\`\`

---

## 3. Ejemplo de Uso e Interfaz CLI

\`\`\`bash:run_example.sh
# Ejecución básica con parámetros recomendados
./${project.id} --help

# Modo de inspección estándar
./${project.id} --target 10.10.11.100 --verbose
\`\`\`

${
  project.codeSnippet
    ? `### 3.1 Extracto de Código Central

\`\`\`${project.tags[0]?.toLowerCase().includes('rust') ? 'rust' : project.tags[0]?.toLowerCase().includes('python') ? 'python' : 'bash'}:core_logic
${project.codeSnippet}
\`\`\`
`
    : ''
}

---

## 4. Capacidades Destacadas

- Ejecución optimizada para bajo consumo de recursos en auditorías prolongadas.
- Integración nativa con formatos de exportación estándar (JSON, CSV, Markdown).
- Compatibilidad multiplataforma y portabilidad.

---

## 5. Licencia y Uso Ético

Este software se proporciona bajo la licencia de código abierto correspondiente para investigación y evaluaciones de seguridad autorizadas.
`;

  return {
    markdown: project.readme || generatedMarkdown,
    projectLinks,
    toolLinks: defaultToolLinks,
    technicalSpecs: {
      language: project.tags[0] || 'Assembly / C / Python',
      license: 'MIT / GPL-3.0 License',
      architecture: 'x86_64 Multiplatform',
      buildStatus: 'Passing (CI Pipeline)',
      requirements: 'Linux / POSIX Environment',
    },
  };
}
