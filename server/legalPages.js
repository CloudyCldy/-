// Páginas públicas que pide Google Play: política de privacidad y cómo eliminar la cuenta.
// Se ven en /privacidad y /eliminar-cuenta (no requieren iniciar sesión).
// El correo de contacto se toma de la variable SUPPORT_EMAIL del servidor.
const updated = '21 de octubre de 2026';

function page(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Haitani</title>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0D1117;color:#FEFCEA;font:16px/1.65 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 80px}
h1{font-family:Georgia,'Source Serif 4',serif;font-weight:400;font-size:32px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 8px;color:#ECD88C}
p,li{color:#d6dbe0}
.muted{color:#A0B2C0;font-size:14px}
.brand{color:#C4B5C8;font-weight:700;letter-spacing:.08em;font-size:13px}
.card{background:#1C2630;border:1px solid #24313D;border-radius:16px;padding:16px 20px;margin-top:16px}
a{color:#ECD88C}
</style></head><body><main><div class="brand">HAITANI</div>${body}</main></body></html>`;
}

function contactLine() {
  const email = process.env.SUPPORT_EMAIL;
  return email
    ? `Escríbenos a <a href="mailto:${email}">${email}</a>.`
    : 'Escríbenos desde la sección <strong>Incidencias</strong> de la app o pide ayuda al administrador de tu organización.';
}

function privacy(req, res) {
  res.send(page('Política de privacidad', `
<h1>Política de privacidad</h1>
<p class="muted">Última actualización: ${updated}</p>
<p>Haitani es una plataforma para organizar proyectos y tareas en equipo (tablero Kanban, cronograma Gantt, chat y archivos). Esta política explica qué datos guardamos, para qué y cómo puedes borrarlos.</p>
<h2>Datos que guardamos</h2>
<ul>
<li><strong>Cuenta:</strong> nombre, nombre de usuario, correo electrónico, contraseña (guardada cifrada) y foto de perfil si decides subirla.</li>
<li><strong>Trabajo del equipo:</strong> proyectos, tareas, sprints, incidencias, inasistencias y anuncios que tú o tu equipo crean.</li>
<li><strong>Mensajes y archivos:</strong> los mensajes del chat y los archivos o imágenes que adjuntas.</li>
<li><strong>Seguridad:</strong> la sesión activa y la dirección IP de acceso, para proteger la cuenta y bloquear intentos de acceso no autorizados.</li>
</ul>
<h2>Para qué los usamos</h2>
<p>Solo para que la plataforma funcione: iniciar sesión, mostrar tu trabajo y el de tu equipo, enviar mensajes y proteger las cuentas. No vendemos tus datos ni los usamos para publicidad.</p>
<h2>Con quién se comparten</h2>
<p>Tus datos solo los ven los integrantes de tu misma organización dentro de Haitani. Si el administrador vincula un repositorio de GitHub, la app consulta la información de ese repositorio en GitHub. Si tu organización usa el asistente de IA, las preguntas que escribas se procesan para generar la respuesta.</p>
<h2>Seguridad</h2>
<p>La conexión con el servidor está cifrada (HTTPS), las contraseñas se guardan con cifrado de un solo sentido y la app no guarda tokens de acceso en el teléfono.</p>
<h2>Cuánto tiempo los guardamos</h2>
<p>Mientras tu cuenta exista. Al eliminarla se borran tus datos personales; ver <a href="/eliminar-cuenta">cómo eliminar tu cuenta</a>.</p>
<h2>Contacto</h2>
<p>${contactLine()}</p>`));
}

function deletion(req, res) {
  res.send(page('Eliminar tu cuenta', `
<h1>Eliminar tu cuenta de Haitani</h1>
<p class="muted">Última actualización: ${updated}</p>
<div class="card">
<h2 style="margin-top:0">Desde la app</h2>
<ol>
<li>Abre Haitani e inicia sesión.</li>
<li>Ve a <strong>Más → Mi perfil y ajustes</strong>.</li>
<li>Toca <strong>Eliminar mi cuenta</strong>, escribe tu contraseña y confirma.</li>
</ol>
</div>
<h2>Qué se elimina</h2>
<ul>
<li>Tu usuario, correo, contraseña y foto de perfil.</li>
<li>Tus mensajes directos y tu participación en grupos.</li>
<li>Los archivos que subiste se conservan para tu equipo a nombre del administrador de la organización, porque forman parte del trabajo compartido.</li>
<li>Si eres el <strong>único administrador</strong>, se elimina la organización completa: proyectos, tareas, mensajes, archivos y las cuentas de sus integrantes.</li>
</ul>
<p>La eliminación es inmediata y no se puede deshacer.</p>
<h2>¿No puedes entrar a la app?</h2>
<p>${contactLine()} Indica el correo de tu cuenta y la eliminaremos en un plazo máximo de 30 días.</p>`));
}

module.exports = { privacy, deletion };
