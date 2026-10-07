export const MAX_PHOTOS = 10
export const MAX_PHOTO_MB = 5
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface PhotoSelection {
  /** Archivos que se pueden subir, en el orden elegido. */
  accepted: File[]
  /** Un mensaje por cada archivo que no se sube o aviso de que no caben. */
  problems: string[]
}

/**
 * Separa lo que se puede subir de lo que no, antes de pedírselo al servidor: formato (JPG, PNG o WebP),
 * peso (hasta 5 MB) y espacio disponible (hasta 10 fotos por espacio). El servidor vuelve a comprobar todo.
 */
export function selectPhotos(files: File[], alreadyUploaded: number): PhotoSelection {
  const accepted: File[] = []
  const problems: string[] = []
  let free = MAX_PHOTOS - alreadyUploaded
  let omitted = 0

  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      problems.push(`${file.name}: usa una foto JPG, PNG o WebP.`)
    } else if (file.size > MAX_PHOTO_BYTES) {
      problems.push(`${file.name}: pesa más de ${MAX_PHOTO_MB} MB.`)
    } else if (free <= 0) {
      omitted += 1
    } else {
      accepted.push(file)
      free -= 1
    }
  }

  if (omitted > 0) {
    problems.push(
      `Un espacio puede tener hasta ${MAX_PHOTOS} fotos: ${omitted === 1 ? 'no se subió 1 foto' : `no se subieron ${omitted} fotos`} por falta de lugar.`,
    )
  }
  return { accepted, problems }
}

/** Nueva lista de ids al mover la foto `from` a la posición `to` (por ejemplo, a 0 para hacerla portada). */
export function moveItem(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
