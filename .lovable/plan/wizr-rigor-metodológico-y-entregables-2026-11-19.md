# Wizr: rigor metodológico y entregables

## 1. Escalar extracción y análisis
- Análisis por lotes: dividir todos los comentarios (no solo 400) en bloques de ~300, analizar cada bloque con el mismo modelo y luego un paso final que consolida en un informe único.
- Muestreo estratificado transparente cuando haya más de ~5,000: por plataforma, likes y fecha, con la cobertura declarada en el informe.
- Barra de progreso del análisis basada en lotes reales completados (no en pasos simulados).

## 2. Perfil demográfico inferido (con cautela)
- Inferencia por comentario de: género probable, rango de edad aproximado, región/idioma y tipo de cuenta (persona, marca, medio), a partir del nombre de usuario, idioma y forma de escribir.
- Siempre con nivel de confianza y categoría "no determinable"; etiquetado como estimación, nunca como dato.

## 3. Más gráficas
- Volumen de comentarios en el tiempo, sentimiento por plataforma, mapa narrativas x sentimiento, distribución de likes (concentración de la conversación), barras de arquetipos, pirámide de edad / género inferido, idiomas y regiones.

## 4. Quitar marcas de herramientas
- Eliminar "Apify", nombres de modelos y proveedores de todos los textos visibles y mensajes de error ("motor de extracción", "motor de análisis").

## 5. Pulsos recientes más informativos
- Al analizar, la IA genera un título temático corto; la tarjeta muestra tema, plataformas, nº de comentarios, sentimiento dominante y titular.

## 6. Metodología explícita
- Sección "Metodología" en cada informe: fuentes y fechas de corte, comentarios extraídos vs. reportados, cobertura, criterio de muestreo, procedimiento de análisis, limitaciones y sesgos, nivel de confianza.
- Página pública "/metodologia" que describe el marco general (netnografía, codificación temática, inferencia demográfica) para citarla como referente.
- Citas siempre trazables al comentario original (ya existe).

## 7. Quitar hooks para redes
- Eliminar la sección de hooks del análisis, del informe y del prompt.

## 8. PDF de Escucha Rápida en formato presentación
- Botón "Descargar presentación (PDF)": diapositivas horizontales 16:9 con el look and feel de las presentaciones de Wizr, co-marca WIZR · KiMedia.
- Una idea por diapositiva: portada, titular y resumen, sentimiento y temperatura, gráficas, una por narrativa, arquetipos, citas destacadas, perfil demográfico, metodología y cierre.
- Mismo formato reutilizable para Estudio Profundo y para el Modo Presentación en pantalla.

## Sugerencias adicionales (lo que podría faltar)
- Comparar dos pulsos o un mismo tema en el tiempo.
- Filtrar spam/bots antes de analizar (se reporta cuántos se excluyeron).
- Exportar los comentarios a Excel/CSV como anexo verificable.

## Detalles técnicos
- Nuevas columnas en `analyses` (topic_label, methodology jsonb, demographics jsonb, batches_done/total).
- Análisis por lotes en servidor con guardado incremental; la expiración de 2 min pasa a ser por lote.
- Diapositivas 1920x1080 renderizadas en una vista de impresión y exportadas a PDF en el navegador.
