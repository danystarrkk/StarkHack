---
title: VirtualBox to VMware
date: '2026-10-09'
group: herramientas
image: /projects/convertmachines/media/cover.webp
tags:
  - Linux
  - Automation
  - Virtualization
description: >-
  Herramienta para preparar máquinas virtuales Linux y adaptar su configuración
  de red entre entornos de virtualización.
githubUrl: https://github.com/danystarrkk/virtualbox-to-vmware
draft: false
---

## Objetivo

Desarrollar una herramienta que facilite la preparación de máquinas virtuales Linux para su utilización en distintos entornos de virtualización, reduciendo las tareas manuales necesarias para adaptar sus discos y configuraciones de red.

## Problema

La migración de máquinas virtuales entre plataformas puede presentar inconvenientes relacionados con los formatos de disco y la configuración de red del sistema invitado. En particular, los cambios en los nombres de las interfaces de red pueden impedir que una máquina obtenga conectividad después de su importación.

## Resolución

Desarrollé un script en Bash que automatiza la extracción de archivos OVA, la localización y conversión de discos virtuales VMDK y la inspección de sus particiones para identificar el sistema de archivos raíz de Linux.

Una vez identificada la partición correspondiente, la herramienta permite incorporar configuraciones basadas en DHCP para distintos gestores de red. El proceso incluye una confirmación previa a la modificación del disco, permitiendo verificar el objetivo antes de aplicar los cambios.

## Conocimientos aplicados

- Automatización de tareas mediante Bash.
- Administración y conversión de discos virtuales.
- Inspección de sistemas de archivos Linux.
- Configuración de redes y asignación dinámica de direcciones IP.
- Integración de herramientas de virtualización y sistemas Linux.

## Resultado

Una herramienta orientada a simplificar la preparación de máquinas virtuales para laboratorios de ciberseguridad y entornos CTF, reduciendo la intervención manual necesaria para adaptar sus configuraciones antes de utilizarlas en otra plataforma.
