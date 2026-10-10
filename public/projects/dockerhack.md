---
title: Docker Hack Environment
date: '2026-10-09'
group: automatizaciones
tags:
  - CLI Utilities
  - Integrations
  - Networking
description: >-
  Entorno de pentesting basado en Docker con Kali Linux e integración de
  terminal gráfica.
githubUrl: https://github.com/danystarrkk/DockerHack-Entorno
draft: false
image: /projects/dockerhack/media/cover.webp
---

## Objetivo

Crear un entorno de pentesting contenerizado que permita utilizar herramientas de seguridad de Kali Linux desde el escritorio del sistema anfitrión, simplificando su puesta en marcha y administración.

## Problema

Preparar un entorno de pentesting implica instalar herramientas, configurar dependencias y adaptar el entorno de trabajo para acceder a los recursos necesarios durante las pruebas. Mantener estas herramientas dentro del sistema principal también puede dificultar la separación entre el entorno cotidiano y las actividades de laboratorio.

## Resolución

Desarrollé una solución basada en Docker que utiliza una imagen personalizada de Kali Linux, con herramientas de red, utilidades de administración y una terminal gráfica integrada con el escritorio anfitrión.

Complementé la configuración con funciones de Bash para gestionar el ciclo de ejecución del contenedor, automatizar el despliegue de la terminal y aplicar ajustes de red y del entorno de ejecución. De esta manera, el acceso al entorno de trabajo se simplifica mediante comandos propios, sin tener que repetir manualmente toda la secuencia de inicialización.

## Conocimientos aplicados

- Contenerización y construcción de imágenes con Docker.
- Automatización de tareas mediante Bash.
- Administración de sistemas Linux y herramientas de seguridad.
- Configuración de redes y capacidades del entorno de ejecución.
- Integración de aplicaciones gráficas con un entorno contenerizado.

## Resultado

Un entorno de pentesting basado en Kali Linux que centraliza herramientas de seguridad en un contenedor configurable y facilita su utilización desde el escritorio habitual mediante un flujo de inicio y detención automatizado.
