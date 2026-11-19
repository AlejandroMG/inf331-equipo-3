import { AiProvider, SpaceDescriptionInput } from './ai-provider';

export class MockAiProvider extends AiProvider {
  readonly source = 'mock' as const;

  async generateSpaceDescription(
    input: SpaceDescriptionInput,
    _signal: AbortSignal,
  ): Promise<string> {
    const location = [input.address, input.commune, input.region]
      .filter(Boolean)
      .join(', ');
    const opening = `Se arrienda ${input.type ?? 'el espacio'} "${input.name}"${location ? ` en ${location}` : ''}${input.capacity ? `, con capacidad para ${input.capacity} personas` : ''}.`;
    const details = [
      input.amenities?.length &&
        `Cuenta con ${joinNaturally(input.amenities)}.`,
      input.rules && `Entre las reglas del espacio se indica: ${input.rules}.`,
      (input.pricePerHour !== undefined ||
        input.pricePerDay !== undefined) &&
        `El valor es ${[
          input.pricePerHour !== undefined &&
            `$${input.pricePerHour.toLocaleString('es-CL')} por hora`,
          input.pricePerDay !== undefined &&
            `$${input.pricePerDay.toLocaleString('es-CL')} por día`,
        ]
          .filter(Boolean)
          .join(' y ')}.`,
      input.schedule?.length &&
        `Está disponible ${joinNaturally(
          input.schedule.map(
            ({ weekday, startTime, endTime }) =>
              `los ${WEEKDAYS[weekday]} de ${startTime} a ${endTime}`,
          ),
        )}.`,
    ].filter((detail): detail is string => Boolean(detail));
    return [opening, ...details].join(' ');
  }
}

function joinNaturally(values: string[]): string {
  if (values.length < 2) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;
