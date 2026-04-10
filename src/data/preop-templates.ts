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

/**
 * Plantilla universal de preoperacional.
 * Aplica a TODOS los tipos de máquina.
 * Los ítems marcados critical:true (amarillos en el Excel)
 * inhabilitan la máquina automáticamente si se marcan como "malo".
 * El operario puede marcar "N/A" en los ítems que no apliquen a su máquina.
 */
export const PREOP_UNIVERSAL: PreopTemplate = {
  sections: [
    {
      name: "ESTRUCTURA",
      items: [
        { id: "e1", label: "Estado de la carrocería / chasis", critical: false },
        { id: "e2", label: "Escaleras y pasamanos de acceso", critical: false },
        { id: "e3", label: "Vidrios (panorámico, trasero, laterales)", critical: false },
        { id: "e4", label: "Limpiabrisas", critical: false },
        { id: "e5", label: "Espejos retrovisores (laterales y central)", critical: false },
        { id: "e6", label: "Asiento del operador en buena condición", critical: false },
        { id: "e7", label: "Puertas con seguros (si aplica)", critical: false },
        { id: "e8", label: "Estado de las horquillas (si aplica)", critical: false },
        { id: "e9", label: "Estado del mástil / torre de carga (si aplica)", critical: false },
      ],
    },
    {
      name: "CANASTA / PLATAFORMA",
      items: [
        { id: "cp1", label: "Canasta / plataforma en buen estado (si aplica)", critical: false },
        { id: "cp2", label: "Puntos de anclaje / línea de vida (si aplica)", critical: false },
        { id: "cp3", label: "Barandas de la canasta en buen estado (si aplica)", critical: false },
      ],
    },
    {
      name: "LLANTAS",
      items: [
        { id: "ll1", label: "Llantas en buen estado (sin cortaduras profundas ni abultamientos, labrado mínimo 4 mm)", critical: false },
      ],
    },
    {
      name: "ORUGAS",
      items: [
        { id: "or1", label: "Estado de orugas / cadenas (si aplica)", critical: false },
        { id: "or2", label: "Tren de rodaje en buen estado (si aplica)", critical: false },
        { id: "or3", label: "Barra defensiva de oruga (si aplica)", critical: false },
      ],
    },
    {
      name: "FLUIDOS E INDICADORES",
      items: [
        { id: "fi1", label: "Nivel de aceite (motor / hidráulico)", critical: true },
        { id: "fi2", label: "Nivel de agua / refrigerante", critical: true },
        { id: "fi3", label: "Indicadores del tablero (presión, temperatura, horómetro, combustible, corriente)", critical: true },
        { id: "fi4", label: "Tanque de combustible (nivel, abrazaderas y soportes)", critical: true },
      ],
    },
    {
      name: "SEGURIDAD",
      items: [
        { id: "se1", label: "Cinturón de seguridad", critical: false },
        { id: "se2", label: "Extintor de incendio vigente", critical: false },
        { id: "se3", label: "Botiquín de primeros auxilios", critical: false },
        { id: "se4", label: "Conos y/o elementos de señalización", critical: false },
        { id: "se5", label: "Kit ambiental", critical: false },
        { id: "se6", label: "Protección antivuelco ROPS (si aplica)", critical: false },
        { id: "se7", label: "Frenos (servicio y parqueo)", critical: true },
        { id: "se8", label: "Parada de emergencia", critical: true },
        { id: "se9", label: "Estado de baterías y cables", critical: true },
      ],
    },
    {
      name: "LUCES Y SONIDOS",
      items: [
        { id: "ls1", label: "Luces delanteras de trabajo", critical: false },
        { id: "ls2", label: "Luces traseras de trabajo", critical: false },
        { id: "ls3", label: "Direccionales (delanteras y traseras)", critical: false },
        { id: "ls4", label: "Alarma de retroceso", critical: false },
        { id: "ls5", label: "Pito / bocina", critical: false },
        { id: "ls6", label: "Baliza / luz estroboscópica (si aplica)", critical: false },
      ],
    },
    {
      name: "ESTADO MECÁNICO",
      items: [
        { id: "em1", label: "Equipos sin fugas hidráulicas visibles (motor, bombas, mangueras)", critical: true },
        { id: "em2", label: "Estado de mangueras y conexiones hidráulicas", critical: false },
        { id: "em3", label: "Funcionamiento del motor (mínimo / aceleración)", critical: false },
        { id: "em4", label: "Estado de pasadores (bastidor, brazo, balde, gatos)", critical: false },
        { id: "em5", label: "Gatos estabilizadores (si aplica)", critical: false },
        { id: "em6", label: "Mecanismo de giro / tornamesa (si aplica)", critical: false },
        { id: "em7", label: "Secciones del boom en buen estado (si aplica)", critical: false },
        { id: "em8", label: "Freno de servicio", critical: true },
        { id: "em9", label: "Cilindros en buen estado", critical: true },
        { id: "em10", label: "Estado del bastidor", critical: true },
        { id: "em11", label: "Compartimiento del motor aseado", critical: false },
      ],
    },
    {
      name: "MANDOS Y FUNCIONES",
      items: [
        { id: "mf1", label: "Funciones de control hidráulico", critical: true },
        { id: "mf2", label: "Pedales y/o mandos manuales en buen estado", critical: true },
        { id: "mf3", label: "Dirección (respuesta correcta)", critical: false },
        { id: "mf4", label: "Mandos de avance / traslación", critical: false },
        { id: "mf5", label: "Levantamiento y descenso de carga (si aplica)", critical: false },
      ],
    },
  ],
};

// Keep legacy export for backward compatibility (maps to universal)
export const PREOP_TEMPLATES: Record<string, PreopTemplate> = new Proxy(
  {} as Record<string, PreopTemplate>,
  { get: () => PREOP_UNIVERSAL }
);
