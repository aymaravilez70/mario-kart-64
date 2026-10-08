# 🏎️ Mario Kart 64 Web - Multijugador Online (P2P Netplay)

Port web completo de **Mario Kart 64** corriendo en **WebAssembly (WASM)** y **WebGL2** a 60 FPS estables, con soporte para **multijugador online en tiempo real** directamente en el navegador sin descargas ni instalaciones.

---

## 🌟 Características

- **Zero-Download para Invitados**: Tu amigo solo abre el enlace en su navegador (Chrome, Edge, Safari, celular) y juega al instante. No descarga emuladores, ni ROMs, ni archivos pesados.
- **Multijugador Online P2P**: Streaming de video y audio a 60 FPS con canal de datos WebRTC (<20ms de latencia) a través de PeerJS y servidores STUN globales gratuitos.
- **Sin Desincronización (Desync-Proof)**: La simulación canónica se ejecuta en el anfitrión (Host), garantizando que las partidas en pantalla dividida (2 Players) nunca se desincronicen.
- **Compatibilidad con Mandos**: Soporte nativo para controles USB y Bluetooth (Xbox, PlayStation, Nintendo Switch Pro, mandos genéricos) y teclado.
- **Modo 2 Jugadores Local**: Permite que dos personas jueguen en el mismo teclado o con dos mandos conectados a la misma PC.
- **Despliegue Inmediato en Vercel**: Incluye configuración de encabezados MIME para `.wasm` y `.v64`.

---

## 🎮 Controles por Defecto

### Jugador 1 (Anfitrión / Host)
| Acción | Teclado | Mando (Xbox / PS) |
|---|---|---|
| **Acelerar (A)** | `X` o `Espacio` | Botón `A` / `✕` |
| **Frenar / Reversa (B)** | `Z` o `C` | Botón `B` / `⭘` |
| **Usar Objeto (Z)** | `Shift Izquierdo` o `Q` | Gatillo `LB` / `LT` |
| **Salto / Derrape (R)** | `D` o `E` | Gatillo `RB` / `RT` |
| **Pausa / Menú** | `Enter` | Botón `Start` |
| **Dirección** | Flechas o `W, A, S, D` | Stick Izquierdo o D-Pad |

### Jugador 2 (Invitado Online o Local)
| Acción | Teclado | Mando (Xbox / PS) |
|---|---|---|
| **Acelerar (A)** | `Espacio` o `1` (Numpad) / `I` | Botón `A` / `✕` |
| **Frenar / Reversa (B)** | `C` o `3` (Numpad) / `O` | Botón `B` / `⭘` |
| **Usar Objeto (Z)** | `Shift` o `0` (Numpad) / `U` | Gatillo `LB` / `LT` |
| **Salto / Derrape (R)** | `E` o `5` (Numpad) / `P` | Gatillo `RB` / `RT` |
| **Pausa / Menú** | `Enter` o `]` | Botón `Start` |
| **Dirección** | Flechas o `A, D` | Stick Izquierdo o D-Pad |

---

## 🚀 Cómo Jugar Online

1. El **Jugador 1** abre el juego y hace clic en **"🌐 Iniciar y Crear Sala Online"**.
2. Se genera un código de sala y un enlace directo (ejemplo: `https://tusitio.vercel.app/?join=XYZ1`).
3. El Jugador 1 le pasa ese enlace al **Jugador 2**.
4. El Jugador 2 abre el enlace en su navegador e ingresa automáticamente como Jugador 2.
5. En la pantalla del juego, elijan **"2 PLAYER GAME"** para competir en Grand Prix, Versus o Modo Batalla.

---

## 📦 Ejecución Local

Para probar localmente en tu computadora:

```bash
# Iniciar servidor HTTP en la carpeta site
python -m http.server 8080 --directory site
```

Abre en tu navegador:
`http://localhost:8080`
