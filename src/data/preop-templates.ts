export interface PreopItem {
  id: string;
  label: string;
  critical: boolean;
}

export interface PreopSection {
  name: string;
  items: PreopItem[];
}

export interface PreopTemplate {
  sections: PreopSection[];
}

export const PREOP_TEMPLATES: Record<string, PreopTemplate> = {
  minicargador: { sections: [
    { name: "LUCES", items: [
      { id: "l1", label: "Direccionales delanteras", critical: false },
      { id: "l2", label: "Direccionales traseras", critical: false },
      { id: "l3", label: "De trabajo delanteras", critical: false },
      { id: "l4", label: "De trabajo traseras", critical: false },
      { id: "l5", label: "De frenado", critical: false }]},
    { name: "CABINA", items: [
      { id: "c1", label: "Protección antivuelco (R.O.P.S)", critical: false },
      { id: "c2", label: "Pito", critical: false },
      { id: "c3", label: "Alarma de retroceso", critical: false },
      { id: "c4", label: "Cinturón de seguridad", critical: false },
      { id: "c5", label: "Frenos de servicio", critical: true },
      { id: "c6", label: "Freno de parqueo", critical: true },
      { id: "c7", label: "Indicadores (hidráulicos, refrigerante, corriente, aceite motor, horómetro)", critical: true },
      { id: "c8", label: "Extintor de incendios", critical: false },
      { id: "c9", label: "Silla del operador", critical: false },
      { id: "c10", label: "Espejos laterales", critical: false },
      { id: "c11", label: "Espejo central convexo", critical: false },
      { id: "c12", label: "Pasamanos de acceso", critical: false },
      { id: "c13", label: "Dirección", critical: true }]},
    { name: "LLANTAS", items: [
      { id: "ll1", label: "En buen estado (sin cortaduras profundas y sin abultamientos)", critical: false }]},
    { name: "ESTADO MECÁNICO", items: [
      { id: "m1", label: "Control de fugas hidráulicas", critical: false },
      { id: "m2", label: "Estado pasadores", critical: false },
      { id: "m3", label: "Mecanismo de giro", critical: false },
      { id: "m4", label: "Mandos de avance", critical: false },
      { id: "m5", label: "Guardas", critical: false },
      { id: "m6", label: "Estado del bastidor", critical: false }]}]},

  retroexcavadora: { sections: [
    { name: "LUCES", items: [
      { id: "l1", label: "De trabajo delanteras (altas y bajas)", critical: false },
      { id: "l2", label: "De trabajo traseras", critical: false },
      { id: "l3", label: "Direccionales delanteras", critical: false },
      { id: "l4", label: "Direccionales traseras", critical: false },
      { id: "l5", label: "De Stop y señal trasera", critical: false }]},
    { name: "CABINA", items: [
      { id: "c1", label: "Protección antivuelco (ROPS) certificada", critical: false },
      { id: "c2", label: "Cinturón de seguridad", critical: false },
      { id: "c3", label: "Extintor de incendio 20 Lbs. PQS", critical: false },
      { id: "c4", label: "Asiento en buen estado (dispositivo de giro)", critical: false },
      { id: "c5", label: "Vidrio panorámico en buen estado", critical: false },
      { id: "c6", label: "Indicadores (hidráulicos, refrigerantes, horómetro, corriente, aceite motor)", critical: true },
      { id: "c7", label: "Tubo de escape (Exhosto)", critical: false },
      { id: "c8", label: "Alarma de retroceso / Pito", critical: false },
      { id: "c9", label: "Espejos", critical: false },
      { id: "c10", label: "Escaleras y apoyos de acceso", critical: false },
      { id: "c11", label: "Palancas y pedales en buen estado", critical: false },
      { id: "c12", label: "Batería y cables", critical: false }]},
    { name: "ESTADO MECÁNICO", items: [
      { id: "m1", label: "Control de fugas hidráulicas", critical: true },
      { id: "m2", label: "Estado pasadores (bastidor, desgarrador)", critical: false },
      { id: "m3", label: "Estado pasadores (brazo, balde)", critical: false },
      { id: "m4", label: "Gatos estabilizadores", critical: true },
      { id: "m5", label: "Mecanismo de giro (Brazo excavador)", critical: false },
      { id: "m6", label: "Función Hidráulica en buen estado (mangueras)", critical: true },
      { id: "m7", label: "Freno de servicio", critical: true },
      { id: "m8", label: "Mando de estacionamiento (freno de emergencia)", critical: true },
      { id: "m9", label: "Estado general desgarrador (balde)", critical: false },
      { id: "m10", label: "Mandos de levante del brazo", critical: false },
      { id: "m11", label: "Cilindros en buen estado", critical: true },
      { id: "m12", label: "Compartimiento del motor aseado", critical: false }]},
    { name: "LLANTAS", items: [
      { id: "ll1", label: "En buen estado (sin cortaduras y abultamientos)", critical: false },
      { id: "ll2", label: "Huellas en buen estado", critical: false }]}]},

  telehandler: { sections: [
    { name: "LUCES", items: [
      { id: "l1", label: "Frontales de servicio", critical: false },
      { id: "l2", label: "Traseras de trabajo (reflector)", critical: false },
      { id: "l3", label: "Direccionales delanteras de parqueo", critical: false },
      { id: "l4", label: "Direccionales traseras de parqueo", critical: false },
      { id: "l5", label: "De stop y señal trasera", critical: false }]},
    { name: "CABINA", items: [
      { id: "c1", label: "Escaleras y pasamanos", critical: false },
      { id: "c2", label: "Alarma de retroceso", critical: false },
      { id: "c3", label: "Pito", critical: false },
      { id: "c4", label: "Cinturón de seguridad", critical: false },
      { id: "c5", label: "Pedales y mandos manuales en buen estado", critical: true },
      { id: "c6", label: "Vidrios (frontal, trasero, lateral) buen estado", critical: false },
      { id: "c7", label: "Espejos retrovisores (Laterales)", critical: false },
      { id: "c8", label: "Limpiabrisas", critical: false },
      { id: "c9", label: "Extintor de incendio 10 lbs. PQS", critical: false },
      { id: "c10", label: "Asiento en buena condición", critical: false },
      { id: "c11", label: "Indicadores: presión aceite, temperatura, tacómetro, combustible, ángulo, horómetro", critical: false },
      { id: "c12", label: "Pasador freno cabina-tornamesa", critical: false },
      { id: "c13", label: "Puerta con seguros", critical: false }]},
    { name: "LLANTAS", items: [
      { id: "ll1", label: "Labrado mínimo 4 mm de huella", critical: false },
      { id: "ll2", label: "Sin cortaduras profundas y sin abultamientos", critical: false }]},
    { name: "ESTADO MECÁNICO", items: [
      { id: "m1", label: "Control de fugas hidráulicas (Motor, bombas y mangueras)", critical: true },
      { id: "m2", label: "Funcionamiento del motor (Mínimo/aceleración)", critical: true },
      { id: "m3", label: "Secciones y Gatos Boom en buen estado", critical: false },
      { id: "m4", label: "Soporte estructural 1a. sección del Boom", critical: false },
      { id: "m5", label: "Soporte de los gatos del Boom", critical: false },
      { id: "m6", label: "Punta del Boom y roldadas", critical: true },
      { id: "m7", label: "Gantry o pórtico de soporte del Boom", critical: true },
      { id: "m8", label: "Estado pasadores (gatos/roldanas/bloque)", critical: false },
      { id: "m9", label: "Tanque de Combustible (abrazaderas soportes)", critical: true },
      { id: "m10", label: "Ojos y pasadores de anclaje secciones boom", critical: false },
      { id: "m11", label: "Tornillos de anclaje del contrapeso", critical: false },
      { id: "m12", label: "Secciones del Boom, puntas y roldanas", critical: false },
      { id: "m13", label: "Estado del mástil. Límite de contención superior", critical: false },
      { id: "m14", label: "Aplicación del respaldo de la carga", critical: false },
      { id: "m15", label: "Mandos de avance", critical: false },
      { id: "m16", label: "Levantamiento y descenso de carga", critical: false },
      { id: "m17", label: "Estado de las horquillas", critical: false }]}]},

  manlift: { sections: [
    { name: "LUCES", items: [
      { id: "l1", label: "Delanteras de trabajo (reflector)", critical: false },
      { id: "l2", label: "Luz de alarma", critical: false },
      { id: "l3", label: "Traseras de trabajo (reflector)", critical: false }]},
    { name: "MANDO CENTRAL", items: [
      { id: "mc1", label: "Alarma de retroceso", critical: false },
      { id: "mc2", label: "Pito", critical: false },
      { id: "mc3", label: "Batería y motor en buen estado", critical: false },
      { id: "mc4", label: "Pedales y mandos manuales en buen estado", critical: true },
      { id: "mc5", label: "Extintor de incendio 10 lbs. PQS", critical: false },
      { id: "mc6", label: "Conos", critical: false },
      { id: "mc7", label: "Indicadores: presión aceite, amperímetro, temperatura, tacómetro, combustible, ángulo", critical: false },
      { id: "mc8", label: "Pasador tornamesa", critical: false }]},
    { name: "CANASTA / PLATAFORMA", items: [
      { id: "cp1", label: "Acelerador pie y manual en buen estado", critical: false },
      { id: "cp2", label: "Alarma de retroceso", critical: false },
      { id: "cp3", label: "Pito", critical: false },
      { id: "cp4", label: "Arnés de seguridad y línea vida", critical: false },
      { id: "cp5", label: "Pedales y mandos manuales en buen estado", critical: true },
      { id: "cp6", label: "Extintor de incendio 5 lbs. PQS", critical: false },
      { id: "cp7", label: "Botiquín", critical: false },
      { id: "cp8", label: "Canasta plataforma en buen estado", critical: false },
      { id: "cp9", label: "Herramienta manual en buen estado", critical: false },
      { id: "cp10", label: "Barandas de la canasta en buen estado", critical: false }]},
    { name: "LLANTAS", items: [
      { id: "ll1", label: "Labrado mínimo 4 mm de huella", critical: false },
      { id: "ll2", label: "En buen estado (sin cortaduras y sin abultamientos)", critical: false }]},
    { name: "ESTADO MECÁNICO", items: [
      { id: "m1", label: "Control de fugas hidráulicas (motor, bombas y mangueras)", critical: true },
      { id: "m2", label: "Funcionamiento del motor (Mínimo/aceleración)", critical: true },
      { id: "m3", label: "Secciones y Gatos Boom en buen estado", critical: false },
      { id: "m4", label: "Secciones del boom en buen estado", critical: true },
      { id: "m5", label: "Mecanismo de giro del tornamesa", critical: true },
      { id: "m6", label: "Tanque de combustible (abrazaderas soportes)", critical: true },
      { id: "m7", label: "Kit ambiental", critical: false }]}]},

  camion_grua: { sections: [
    { name: "LUCES", items: [
      { id: "l1", label: "Frontales de servicio", critical: false },
      { id: "l2", label: "Traseras de trabajo (reflector)", critical: false },
      { id: "l3", label: "Direccionales delanteras de parqueo", critical: false },
      { id: "l4", label: "Direccionales traseras de parqueo", critical: false },
      { id: "l5", label: "De stop y señal trasera", critical: false }]},
    { name: "CABINA", items: [
      { id: "c1", label: "Escaleras y pasamanos", critical: false },
      { id: "c2", label: "Alarma de retroceso", critical: false },
      { id: "c3", label: "Pito", critical: false },
      { id: "c4", label: "Cinturones de seguridad", critical: false },
      { id: "c5", label: "Pedales y mandos manuales en buen estado", critical: true },
      { id: "c6", label: "Vidrios buen estado", critical: false },
      { id: "c7", label: "Espejos retrovisores", critical: false },
      { id: "c8", label: "Limpiabrisas", critical: false },
      { id: "c9", label: "Extintor de incendio 10 lbs. PQS", critical: false },
      { id: "c10", label: "Asiento en buena condición", critical: false },
      { id: "c11", label: "Indicadores: presión aceite, amperímetro, temperatura, tacómetro, combustible, horómetro, two block, tabla de carga", critical: false },
      { id: "c12", label: "Prueba de carga máxima, estabilidad, indicador de ángulo", critical: false },
      { id: "c13", label: "Puerta con seguros", critical: false }]},
    { name: "LLANTAS", items: [
      { id: "ll1", label: "Labrado mínimo 4 mm de huella", critical: false },
      { id: "ll2", label: "En buen estado (sin cortaduras y sin abultamientos)", critical: false }]},
    { name: "ESTADO MECÁNICO", items: [
      { id: "m1", label: "Control de fugas hidráulicas (Motor, bombas y mangueras)", critical: true },
      { id: "m2", label: "Funcionamiento del motor (Mínimo/aceleración)", critical: true },
      { id: "m3", label: "Secciones y Gatos Boom en buen estado", critical: false },
      { id: "m4", label: "Estado del bloque (gancho, seguro, roldanas)", critical: true },
      { id: "m5", label: "Gatos y zapatas de estabilización lateral", critical: true },
      { id: "m6", label: "Soporte estructural 1a. sección del Boom", critical: false },
      { id: "m7", label: "Soporte de los gatos del Boom", critical: false },
      { id: "m8", label: "Punta del Boom y roldadas", critical: true },
      { id: "m9", label: "Estado pasadores (gatos/roldanas/bloque)", critical: false },
      { id: "m10", label: "Bombas/rodamientos de dirección", critical: true },
      { id: "m11", label: "Tanque de Combustible (abrazaderas soportes)", critical: true },
      { id: "m12", label: "Ojos y pasadores de anclaje secciones boom", critical: false },
      { id: "m13", label: "Secciones del Boom, puntas y roldanas", critical: false }]}]},

  hincadora: { sections: [
    { name: "LUCES Y SEÑALIZACIÓN", items: [
      { id: "hs_l1", label: "Luces delanteras y traseras operativas", critical: false },
      { id: "hs_l2", label: "Alarma de retroceso y pito", critical: true },
      { id: "hs_l3", label: "Balizas y elementos de señalización", critical: false }]},
    { name: "CABINA Y CONTROLES", items: [
      { id: "hs_c1", label: "Cinturón de seguridad", critical: true },
      { id: "hs_c2", label: "Mandos y pedales en buen estado", critical: true },
      { id: "hs_c3", label: "Indicadores de tablero / horómetro", critical: true },
      { id: "hs_c4", label: "Extintor y botiquín", critical: false }]},
    { name: "SISTEMA MECÁNICO", items: [
      { id: "hs_m1", label: "Fugas hidráulicas o de combustible", critical: true },
      { id: "hs_m2", label: "Estructura de mástil y guías", critical: true },
      { id: "hs_m3", label: "Estado de mangueras y conexiones", critical: true },
      { id: "hs_m4", label: "Anclajes y elementos de fijación", critical: true },
      { id: "hs_m5", label: "Sistema de traslación / llantas u orugas", critical: false }]}]},

  otro: { sections: [
    { name: "SEGURIDAD GENERAL", items: [
      { id: "og_s1", label: "Pito y alarma de retroceso", critical: true },
      { id: "og_s2", label: "Cinturón de seguridad", critical: true },
      { id: "og_s3", label: "Extintor vigente", critical: false }]},
    { name: "INSPECCIÓN VISUAL", items: [
      { id: "og_i1", label: "Sin fugas visibles", critical: true },
      { id: "og_i2", label: "Sin daños estructurales evidentes", critical: true },
      { id: "og_i3", label: "Llantas/orugas en buen estado", critical: false }]},
    { name: "OPERACIÓN", items: [
      { id: "og_o1", label: "Controles responden correctamente", critical: true },
      { id: "og_o2", label: "Sistema hidráulico opera sin fallas", critical: true },
      { id: "og_o3", label: "Equipo apto para iniciar jornada", critical: true }]}]},
};
