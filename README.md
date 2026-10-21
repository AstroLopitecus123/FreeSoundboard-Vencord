<div align="center">

<p>
  <b><a href="README.md">ESPAÑOL</a></b> &nbsp;•&nbsp; <b><a href="README.en.md">ENGLISH</a></b>
</p>

<img src="assets/banner.png" alt="FreeSoundboard for Vencord" width="100%" />

<br/>
<br/>

**Reproduce sonidos del Soundboard de cualquier servidor en tus llamadas de Discord sin suscripción a Nitro ni cables virtuales.**

*Plugin para Vencord compatible con Discord Desktop. Adaptado a partir del concepto de [YashRajCodes](https://github.com/YashRajCodes/soundboardPermissionsBypass.web).*

<br/>

[![Vencord UserPlugin](https://img.shields.io/badge/Platform-Vencord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://vencord.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vistas](https://img.shields.io/endpoint?url=https%3A%2F%2Fhits.dwyl.com%2FAstroLopitecus123%2FFreeSoundboard-Vencord.json&style=for-the-badge&label=VISTAS&color=5865F2)](https://github.com/AstroLopitecus123/FreeSoundboard-Vencord)

</div>

---

## Características

| Módulo / Función | Descripción |
| :--- | :--- |
| **Bypass de Soundboard sin Nitro** | Desbloquea y reproduce sonidos de cualquier servidor o con candado sin necesidad de pagar Discord Nitro. |
| **Mezclador Nativo (Web Audio API)** | Inyecta y mezcla los sonidos directamente en el flujo de audio de tu micrófono en tiempo real sin latencia ni distorsión. |
| **Controles Rápidos (Clic Derecho)** | Sliders accesibles con clic derecho sobre tu perfil en llamada para regular la ganancia del micrófono (hasta 300%) y el volumen de salida de los sonidos (0% a 200%). |
| **Transmisión de Pantalla y Apps** | Soporte de loopback de audio estéreo y captura de pantalla optimizada en Electron sin congelamientos ni pantallas negras. |
| **Cero Cables Virtuales** | No necesitas configurar VB-Audio Cable, VoiceMeeter ni dispositivos virtuales secundarios en Windows/Linux/macOS. |
| **Gestión Automática de Memoria** | Liberación inmediata de nodos de audio, streams y timers al finalizar cada sonido (*zero memory leaks*). |

---

## Estructura del Plugin

```text
FreeSoundboard/
├── assets/
│   └── banner.png  # Banner del plugin
├── index.tsx       # Interfaz, parches WebRTC/Audio, menú contextual y eventos Flux
├── native.ts       # Soporte Electron para captura de pantalla y loopback de audio nativo
├── README.md       # Documentación en español
└── README.en.md    # Documentación en inglés
```

---

## Instalación

### Paso 1: Copiar a Vencord
Copia la carpeta `FreeSoundboard` dentro del directorio `src/userplugins/` de tu instalación de Vencord:
```text
Vencord/
 └── src/
      └── userplugins/
           └── FreeSoundboard/
```

### Paso 2: Compilar e Inyectar
Abre una terminal en la raíz de la carpeta de Vencord y ejecuta:
```bash
pnpm build
pnpm inject
```

### Paso 3: Habilitar el Plugin
1. Abre Discord.
2. Dirígete a **Ajustes de Usuario** > sección **Vencord** > **Plugins**.
3. Activa el interruptor de **`FreeSoundboard`**.

---

## Modo de Uso

1. **Reproducir Sonidos:** Únete a cualquier canal de voz o llamada grupal y abre el panel habitual de Soundboard de Discord. Todos los sonidos (incluso los bloqueados o de otros servidores) estarán disponibles para reproducirse.
2. **Ajuste de Volumen en Vivo:** Haz clic derecho sobre tu propio nombre o avatar dentro de la llamada de voz para acceder al submenú **Sonidos y Micrófono**:
   - **Volumen de voz (Micrófono):** Aumenta la ganancia de tu micrófono del 50% al 300% (ideal si tu micrófono se escucha bajo).
   - **Volumen de sonidos (Soundboard):** Controla el nivel con el que los demás participantes escucharán tus sonidos (0% a 200%).

---

## Configuración

Desde **Ajustes de Usuario** > **Plugins** > engranaje de **FreeSoundboard**, puedes personalizar:

| Parámetro | Opciones / Rango | Descripción |
| :--- | :--- | :--- |
| **Modo Bypass** | `Automático` (Recomendado) / `Siempre` | En modo automático solo aplica el bypass en servidores donde no tengas permisos o Nitro; en modo siempre procesa todos los sonidos por el mezclador local. |
| **Volumen de voz (Micrófono)** | `50%` a `300%` (Por defecto: 200%) | Nivel de amplificación del micrófono aplicado de forma nativa por Web Audio. |
| **Volumen de transmisión** | `0%` a `200%` (Por defecto: 100%) | Nivel de ganancia con el que se transmiten los efectos de sonido hacia la llamada. |

---

## Créditos

* **Concepto original:** [YashRajCodes](https://github.com/YashRajCodes/soundboardPermissionsBypass.web)
* **Adaptación:** [AstroLopitecus123](https://github.com/AstroLopitecus123).
