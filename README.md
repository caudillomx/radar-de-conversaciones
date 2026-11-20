# Radar de Conversaciones

Quiero crear una aplicación web independiente de social listening y análisis de tendencias para KiMedia Digital, inspirada en las capacidades y el diseño editorial de Wizr pero como herramienta satélite separada.

El flujo principal consiste en:
1. Ingesta de URLs: Un panel central donde puedo pegar una o múltiples URLs de publicaciones de redes sociales (Instagram, TikTok, YouTube, Facebook y X/Twitter) sobre un tema de coyuntura o interés. Debe detectar automáticamente la plataforma por el dominio, validar el enlace y organizar las fuentes por estudio o tema de investigación.
2. Extracción de comentarios: Integración preparada con Apify para extraer comentarios y respuestas públicas de esos posts específicos bajo demanda.
3. Motor de análisis con IA: Procesamiento de comentarios para clasificar sentimiento, agrupar narrativas dominantes, inferir arquetipos conversacionales y seleccionar citas textuales de alto impacto.
4. Entregables y salidas:
- Modo Presentación interactivo en pantalla completa para proyectar y exponer insights (con la estética visual y tipográfica de Wizr).
- Reporte PDF ejecutivo estructurado (formato A4 editorial listo para compartir con prospectos).
- Social Lead Pack: Generación de carruseles de diapositivas, ganchos (hooks) y citas formateadas para redes sociales para captar leads y posicionar la autoridad de KiMedia.

Para esta primera versión, montemos la arquitectura del proyecto independiente, el dashboard de estudios y la pantalla de ingesta y gestión de URLs multi-plataforma (Instagram, TikTok, YouTube, X y Facebook) con validación, previsualización de enlaces y panel de preparación para la extracción.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/584242da-bdf2-4e62-ae9b-b0beba4f4d46).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
