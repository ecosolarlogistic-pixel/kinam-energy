# KINAM Energy | Sitio web

Sitio estático de **KINAM Digital Power**, publicado con GitHub Pages en https://www.kinamenergy.com.

Construido a partir del brief maestro de desarrollo web, el Manual Corporativo (paleta Deep Navy `#07172A`, Cian Neón `#00E5FF`, Verde Hoja `#28A745`, Blanco `#FFFFFF`), el logotipo y la presentación *KINAM Digital Power*.

## Estructura

```
index.html            Página principal (brief completo + información técnica de la presentación)
404.html              Página de error
CNAME                 Dominio personalizado para GitHub Pages
assets/css/styles.css Sistema visual
assets/js/main.js     Menú, pestañas, calculadora, formulario
assets/img/           Logo, banner e imágenes de la presentación
```

## Publicar cambios

Cualquier `git push` a la rama `main` se publica automáticamente en GitHub Pages.

## Pendientes antes de lanzar

- Confirmar correo, WhatsApp y enlace de agenda en `assets/js/main.js` (`CONTACT`).
- El formulario abre el correo del visitante (`mailto`). Para recibir envíos directos, conectar un servicio de formularios (Formspree, Basin, etc.).
- Validar con el equipo técnico y jurídico todas las cifras (capacidad, buffer de 40 h, 10,000 RPM, 95%, 69 kV, rango térmico, escalamiento) antes de difundir el sitio.
- Sustituir los módulos de certificaciones y casos de éxito cuando haya información verificada.

## DNS (en el proveedor del dominio)

| Tipo  | Nombre | Valor                             |
|-------|--------|-----------------------------------|
| CNAME | www    | ecosolarlogistic-pixel.github.io  |
| A     | @      | 185.199.108.153                   |
| A     | @      | 185.199.109.153                   |
| A     | @      | 185.199.110.153                   |
| A     | @      | 185.199.111.153                   |
