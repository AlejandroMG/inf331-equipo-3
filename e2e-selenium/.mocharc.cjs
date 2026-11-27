// Mocha: un archivo por dominio, ejecución en serie (un solo navegador a la vez) y reportes para el CI.
module.exports = {
  spec: ['test/**/*.test.js'],
  require: ['./lib/hooks.js'],
  timeout: 60000,
  slow: 8000,
  // Una prueba que falla no debe frenar el resto: así el reporte muestra todas las fallas juntas.
  bail: false,
  reporter: 'mocha-multi-reporters',
  reporterOptions: ['configFile=reporter-config.json'],
};
