/** Un rango del horario semanal: día de la semana (0 = domingo) y horas cerradas "HH:mm" en hora de Chile. */
export interface WeeklyRule {
  weekday: number;
  startTime: string;
  endTime: string;
}

/**
 * Las reglas por día y hora de inicio. Las horas son "HH:00" con dos dígitos (el fin llega hasta "24:00"),
 * así que el orden del texto es el orden de las horas.
 */
export function sortRules<T extends WeeklyRule>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  );
}

/**
 * Por qué un horario no vale, o null si vale: cada fin debe ser posterior a su inicio y dos rangos del mismo
 * día no pueden traslaparse. Dos rangos contiguos (09:00 a 13:00 y 13:00 a 18:00) sí valen.
 */
export function scheduleError(rules: WeeklyRule[]): string | null {
  if (rules.some((rule) => rule.endTime <= rule.startTime)) {
    return 'El fin de cada rango debe ser posterior a su inicio';
  }
  const sorted = sortRules(rules);
  const overlap = sorted.some(
    (rule, i) =>
      i > 0 &&
      sorted[i - 1].weekday === rule.weekday &&
      sorted[i - 1].endTime > rule.startTime,
  );
  return overlap ? 'Los rangos de un mismo día no pueden traslaparse' : null;
}
