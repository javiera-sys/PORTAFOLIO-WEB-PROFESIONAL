[README.md](https://github.com/user-attachments/files/34953752/README.md)
# Portafolio Profesional Interactivo

Web estática (HTML + CSS + JS) compatible con **GitHub Pages**. Los visitantes solo ven el sitio;
tú entras con usuario y contraseña, editas y publicas en GitHub con un clic.

## Archivos
`index.html` · `script.js` · `styles.css` · `projects.json` (todos los datos) · `assets/` (fotos) · `documents/` (PDFs)

## Configuración inicial (una sola vez)
1. Sube todos los archivos a tu repositorio y activa GitHub Pages.
2. En `script.js`, bloque `GH_DEFAULTS`, cambia `TU-USUARIO` y `TU-REPO` (o escríbelos la primera vez en el modal).
3. Crea un token **fine-grained** en GitHub (Settings → Developer settings), solo para este repo, permiso **Contents: Read and write**.

## Uso
1. Abre tu sitio y pulsa **Acceso** (pie de página) o entra a `tu-sitio/#admin`.
2. Edita en las pestañas: Perfil, Proyectos, Galería, Aplicaciones, Habilidades, Experiencia, Contacto y **Sitio** (títulos, pie y secciones).
3. **Ocultar al público:** botón «Ocultar» por elemento, casilla «ocultar» por campo (Perfil/Contacto) y «Ocultar sección» en la pestaña Sitio. Usa **Vista pública** para comprobarlo.
4. **💾 Guardar en GitHub.** La primera vez pega el token; se guarda cifrado solo en tu dispositivo.
5. GitHub Pages publica en 1–3 minutos. Las fotos y PDFs se suben con el botón **📎 Subir** de cada campo (se guardan en `assets/` y `documents/`).

## Seguridad
- Nunca escribas el token ni la contraseña en los archivos del repositorio.
- «Ocultar» quita el contenido de la página, pero sigue dentro de `projects.json`, que es público.
- Para cambiar la contraseña hay que regenerar `AUTH.salt` y `AUTH.hash` en `script.js` (PBKDF2-SHA256, 150 000 iteraciones).
