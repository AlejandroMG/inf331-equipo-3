-- ES-07: punto del espacio en el mapa. Opcional, y siempre los dos juntos o ninguno.
ALTER TABLE "Space" ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "Space" ADD CONSTRAINT "Space_coordinates_together"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
