// DO-06 · El plugin de cobertura de Jenkins falla si una clase tiene dos métodos con el mismo nombre
// (pasa en JavaScript con funciones internas que se llaman igual, p. ej. addDays en ganttController.js).
// Este script renombra los repetidos a "nombre#2", "nombre#3"... sin cambiar ningún número de cobertura.
const fs = require('fs');
const archivo = process.argv[2] || 'reports/coverage/cobertura-coverage.xml';
const xml = fs.readFileSync(archivo, 'utf8');
let cambios = 0;
const salida = xml.replace(/<class\b[\s\S]*?<\/class>/g, (clase) => {
  const vistos = new Map();
  return clase.replace(/<method name="([^"]*)"([^>]*?)signature="([^"]*)"/g, (todo, nombre, medio, firma) => {
    const clave = `${nombre}|${firma}`;
    const n = (vistos.get(clave) || 0) + 1;
    vistos.set(clave, n);
    if (n === 1) return todo;
    cambios++;
    return `<method name="${nombre}#${n}"${medio}signature="${firma}"`;
  });
});
fs.writeFileSync(archivo, salida);
console.log(`Reporte de cobertura listo para Jenkins (${cambios} métodos repetidos renombrados).`);
