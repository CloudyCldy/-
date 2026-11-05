// Express 4 no atrapa los errores de las funciones async: si una ruta lanza un error
// dentro de un await, la promesa rechazada queda sin atender y Node cierra todo el servidor
// (en Render eso significa reinicio y casi un minuto sin servicio para todos).
// Este parche manda esos errores al manejador de errores de app.js, igual que los síncronos.
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__haitaniAsyncPatch) {
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };

  Layer.prototype.handle_error = function handleError(error, req, res, next) {
    const fn = this.handle;
    if (fn.length !== 4) return next(error);
    try {
      const result = fn(error, req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };

  Layer.prototype.__haitaniAsyncPatch = true;
}

module.exports = Layer;
