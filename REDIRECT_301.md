# Redirect 301: slipup.io → www.slipup.io

Guía para que **slipup.io** (y cualquier ruta bajo el dominio raíz) redirija permanentemente a **www.slipup.io**, consolidando SEO y evitando contenido duplicado.

---

## Opción A: Porkbun (tu registrador)

Si tienes el dominio en **Porkbun**:

### 1. Entra en Porkbun
- [porkbun.com](https://porkbun.com) → inicia sesión.
- Arriba a la derecha: **ACCOUNT** → **Domain Management**.

### 2. Abre la configuración del dominio
- Localiza **slipup.io** en la lista.
- A la derecha del dominio, clic en **Details** (el último botón).
- En la página de detalles, busca **URL Forwarding** y clic en el **icono de editar** (lápiz) al lado.

### 3. Configura el redirect
- **Hostname**: déjalo **en blanco** (así se redirige el dominio raíz `slipup.io`).
- **Forward Traffic To**: escribe `https://www.slipup.io` (con `https://`).
- Clic en **Toggle advanced settings** (opciones avanzadas).

### 4. Opciones avanzadas (importante)
- **Tipo de redirect**: elige **301 Permanent Redirect** (no dejes el 302/307 por defecto).
- Activa la casilla **Include the requested URI path in the redirection** para que `slipup.io/contribute.html` vaya a `www.slipup.io/contribute.html`.

### 5. Guardar
- Clic en **Submit**.
- Puede tardar **10–15 minutos** en aplicarse.

### Si sale un mensaje de error
Porkbun a veces avisa de “conflictos” con otros registros DNS. Si tienes un registro **A** o **AAAA** para el dominio raíz (apex) apuntando a GitHub Pages, puede chocar con el forwarding. En ese caso:
- Mantén solo el **CNAME** de `www` → `tu-usuario.github.io` (o el que uses).
- Quita los registros A/AAAA del apex si los tienes; el redirect de Porkbun se encargará del tráfico a `slipup.io`.

### Probar
- Abre `https://slipup.io` y `https://slipup.io/contribute.html`.
- Deberías terminar en `https://www.slipup.io` y `https://www.slipup.io/contribute.html`.

---

## Opción B: Cloudflare

Si el dominio **slipup.io** usa los nameservers de Cloudflare (o si puedes apuntar el dominio a Cloudflare):

### 1. Entra en Cloudflare Dashboard
- [dash.cloudflare.com](https://dash.cloudflare.com) → selecciona el sitio **slipup.io** (o añade el dominio si aún no está).

### 2. Comprueba DNS
- **DNS** → **Records**.
- Debe existir un registro **CNAME** para `www` apuntando a tu hosting (ej. `username.github.io` si usas GitHub Pages).
- El dominio raíz (**slipup.io**, “apex”) puede estar como **A** o **CNAME** (o “Proxied”); da igual para la regla.

### 3. Crear la regla de redirección
- Menú **Rules** → **Redirect Rules** (o **Page Rules** en planes antiguos).
- **Create rule** / **Add rule**.

Configuración:

| Campo | Valor |
|-------|--------|
| **Name** | `Redirect apex to www` |
| **When** (si aplica) | *If* → “Hostname” “equals” `slipup.io` |
| **Then** | “Dynamic redirect” o “Redirect” |
| **URL** | `https://www.slipup.io/${uri.path}${uri.query}` |
| **Status code** | **301** (Permanent) |

En la interfaz nueva de **Redirect Rules** suele ser:
- **Custom filter expression**:  
  `(http.host eq "slipup.io")`
- **Then**: **Dynamic redirect**  
  - **Expression**: `concat("https://www.slipup.io", http.request.uri.path)`  
  - O en modo simple: **URL** = `https://www.slipup.io/$1` si el sistema usa `$1` para la ruta.
- **Status code**: **301 - Permanent Redirect**.

### 4. Orden y activación
- La regla de redirect debe estar **por encima** de cualquier otra que pueda capturar el mismo tráfico.
- **Save** y espera 1–2 minutos.

### 5. Probar
- Abre `https://slipup.io` (y `https://slipup.io/contribute.html`).
- Debes terminar en `https://www.slipup.io` y `https://www.slipup.io/contribute.html` con **301** (en DevTools → pestaña Network, la respuesta del primer request debe ser “301 Moved Permanently”).

---

## Opción C: Otro registrador (Namecheap, GoDaddy, etc.)

### 1. Busca “URL Redirect” / “Domain Forwarding” / “Redirect”
- Suele estar en la ficha del dominio, apartado tipo “Redirect” o “Forwarding”.

### 2. Configura
- **Origen**: dominio raíz `slipup.io` (a veces llamado “@” o “apex”).
- **Destino**: `https://www.slipup.io`
- **Tipo**: **301 Permanent** (no 302).
- Guarda.

### 3. Limitación habitual
- Muchos registradores solo redirigen la **raíz** (`slipup.io` → `www.slipup.io`).
- Rutas como `slipup.io/contribute.html` a veces **no** se redirigen bien (siguen en apex o dan 404).
- Si necesitas que **todas** las rutas redirijan, la opción más fiable es usar **Cloudflare** (Opción A) delante del mismo DNS/hosting.

---

## Opción D: Solo GitHub Pages, sin redirect en el dominio

**GitHub Pages no hace redirect 301** del dominio raíz al subdominio. Solo sirve el sitio en la URL que configures (por ejemplo `www.slipup.io` si el CNAME es `www`).

Si apuntas el apex con registros **A** a las IP de GitHub, tanto `slipup.io` como `www.slipup.io` pueden mostrar lo mismo, pero serán **dos URLs distintas** para Google (con canonical ayudas, pero es mejor una sola URL con 301). Para un 301 real del apex → www necesitas un servicio que haga la redirección (Cloudflare o el redirect del registrador, como arriba).

---

## Resumen

| Dónde | Qué hacer |
|-------|-----------|
| **Porkbun** | Domain Management → Details → URL Forwarding → Hostname vacío, destino `https://www.slipup.io`, 301, incluir path. |
| **Cloudflare** | Rules → Redirect Rules → 301 de `slipup.io` a `https://www.slipup.io` + path. |
| **Otro registrador** | Buscar “URL Redirect” / “Forwarding” 301 de `slipup.io` a `https://www.slipup.io`. |

Después del 301, conviene volver a enviar el sitemap en **Google Search Console** con la URL canónica `https://www.slipup.io/sitemap.xml`.
