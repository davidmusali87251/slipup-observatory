# Informe canary 72 h — señal atmosférica

Plantilla para revisar métricas tras 72 h de canary al 10 % y decidir valores finales antes del rollout completo.

---

## 1. Telemetría recibida

| Evento                    | Total 72 h | Media/día | Notas |
|---------------------------|------------|-----------|--------|
| atmosphere.reading_shown  |            |           |       |
| atmosphere.pulse_fired   |            |           |       |
| atmosphere.bumped        |            |           |       |

---

## 2. KPIs primarios y secundarios

| Métrica                               | Valor canary | Objetivo / comparativa |
|---------------------------------------|--------------|-------------------------|
| CTR a Contribute (tras reading_shown)  |              |                         |
| Visitas recurrentes 7d                |              |                         |
| Tiempo medio en página                |              |                         |
| Rebote en hero                        |              |                         |

---

## 3. Operacionales

| Métrica                          | Valor |
|----------------------------------|--------|
| Pulses disparados por día (media) |       |
| Bumps por contribución (media)    |       |
| Latencia contribución → pulse (mediana, s) |  |

---

## 4. Decisión A/B (post canary)

- **Half-life:** ¿mantener 12 h, probar 8 h o 16 h? ___________
- **pulseDelay:** ¿mantener 5–10 s, probar 3–7 s o 7–12 s? ___________
- **T1/T2:** ¿mantener 3/8, ajustar según distribución de scores? ___________

---

## 5. Checklist pre–full rollout

- [ ] Telemetría conectada y validada.
- [ ] Canary 10 % monitorizado 72 h sin incidencias.
- [ ] Contraste y prefers-reduced-motion verificados.
- [ ] Panel ?atm_tune=1 desactivado o protegido en producción.
- [ ] Parámetros de tuning fijados según informe.
