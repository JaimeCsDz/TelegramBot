const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const natural = require('natural');
require('dotenv').config();

// Configuración del bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN no está definido en el archivo .env');
}
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Cargar las guías desde los archivos JSON
const guiasVentas = JSON.parse(fs.readFileSync('guia_ventas.json', 'utf8'));
const guiasApertura = JSON.parse(fs.readFileSync('guiaApertura.json', 'utf8'));

const categorias = {
  'abrir jornada': {
    descripcion: 'Opciones relacionadas con la apertura de jornada.',
    guias: guiasApertura
  },
  ventas: {
    descripcion: 'Opciones relacionadas con ventas.',
    guias: guiasVentas
  },
  cancelaciones: {
    descripcion: 'Opciones relacionadas con cancelaciones.',	
  },
  'Cambios fisicos':{
    descripcion: 'Opciones relacionadas con cambios fisicos.',
  }
};

// Estado temporal para manejar la categoría seleccionada por cada usuario
const userState = {};

// Enviar mensaje de bienvenida cuando el usuario envía el comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  mostrarMensajeBienvenida(chatId);
});

// Manejar el callback del botón "Comenzar"
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const callbackData = callbackQuery.data;

  if (callbackData === 'comenzar') {
    const categoriasKeys = Object.keys(categorias);
    const opcionesCategorias = categoriasKeys
      .map((key, index) => `${index + 1}. ${key.charAt(0).toUpperCase() + key.slice(1)}`)
      .join('\n');

    bot.sendMessage(
      chatId,
      `¡Hola! Estas son las categorías principales disponibles:📋\n\n${opcionesCategorias}\n\nEscribe el número o el nombre de la categoría para ver las opciones dentro de ella.🤓`
    );

    // Guardar las claves para validar la selección por número
    userState[chatId] = { categoriasKeys };
  }
});

// Manejar mensajes del usuario
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text ? msg.text.toLowerCase() : '';

  // Ignorar comandos como /start
  if (userMessage.startsWith('/')) {
    return;
  }

  // Manejar saludos genéricos
  const saludosGenericos = ['hola', 'buenos días', 'buenas tardes', 'buenas noches'];
  if (saludosGenericos.includes(userMessage)) {
    mostrarMensajeBienvenida(chatId);
    return;
  }

  // Obtener estado del usuario
  const estado = userState[chatId];

  // Si el usuario está en un estado de selección de categoría
  if (estado && estado.seleccion) {
    const categoriaSeleccionada = estado.seleccion;
    const guias = categorias[categoriaSeleccionada].guias;

    // Buscar por similitud dentro del submenú
    let guiaSeleccionada = null;

    // Validar si el usuario ingresó un número
    if (/^\d+$/.test(userMessage)) {
      const opcionIndex = parseInt(userMessage) - 1;
      const opciones = Object.keys(guias);
      if (opcionIndex >= 0 && opcionIndex < opciones.length) {
        guiaSeleccionada = guias[opciones[opcionIndex]];
      }
    }

    // Validar si el usuario ingresó el nombre de la opción
    if (!guiaSeleccionada) {
      guiaSeleccionada = buscarEnGuias(guias, userMessage);
    }

    if (guiaSeleccionada) {
      let respuesta = `${guiaSeleccionada.descripcion}`;
      if (guiaSeleccionada.pdf) {
      respuesta += `\n\nConsulta el PDF: ${guiaSeleccionada.pdf}`;
      }
      bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });	

      // Reiniciar el estado del usuario
      delete userState[chatId];
      mostrarMensajeBienvenida(chatId);
    } else {
      bot.sendMessage(chatId, 'Opción no válida ⚠️. Por favor, ingresa el número o el nombre correcto de la opción 🙄.');
    }
    return;
  }

  // Si el usuario selecciona una categoría principal
  if (estado && estado.categoriasKeys) {
    const categoriasKeys = estado.categoriasKeys;

    let categoriaSeleccionada = null;

    // Validar si el usuario ingresó un número
    if (/^\d+$/.test(userMessage)) {
      const opcionIndex = parseInt(userMessage) - 1;
      if (opcionIndex >= 0 && opcionIndex < categoriasKeys.length) {
        categoriaSeleccionada = categoriasKeys[opcionIndex];
      }
    }

    // Validar si el usuario ingresó el nombre de la categoría
    if (!categoriaSeleccionada && categoriasKeys.includes(userMessage)) {
      categoriaSeleccionada = userMessage;
    }

    if (categoriaSeleccionada) {
      const categoria = categorias[categoriaSeleccionada];
      userState[chatId] = { seleccion: categoriaSeleccionada }; // Actualizar estado

      const opcionesSubmenu = Object.keys(categoria.guias)
        .map((key, index) => `${index + 1}. ${key.charAt(0).toUpperCase() + key.slice(1)}`)
        .join('\n');

      bot.sendMessage(
        chatId,
        `Has seleccionado la categoría: ${categoriaSeleccionada.charAt(0).toUpperCase() + categoriaSeleccionada.slice(1)} 😀.\n\n${categoria.descripcion}\n\nAquí están las opciones disponibles: 🤔\n\n${opcionesSubmenu}\n\nEscribe el número o el nombre de la opción para obtener más detalles 🤓.`
      );
    } else {
      bot.sendMessage(chatId, 'Categoría no válida ⚠️. Por favor, ingresa el número o el nombre correcto 🙄.');
    }
    return;
  }

  // Si el usuario envía algo que no es categoría ni opción, buscar en todas las guías
  const guiaEncontrada = buscarEnTodasLasGuias(userMessage);
  if (guiaEncontrada) {
    const respuesta = guiaEncontrada;
    let respuestaMensaje = `${respuesta.descripcion}`;
    if (respuesta.pdf) {
      respuestaMensaje += `\n\nConsulta el PDF: ${respuesta.pdf}`;
    }
    bot.sendMessage(chatId, respuestaMensaje, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, 'No encontré información relacionada. Intenta con otra pregunta o selección.');
  }
});

// Función para mostrar el mensaje de bienvenida
function mostrarMensajeBienvenida(chatId) {
  const welcomeMessage = `¡Hola, soy un asistente virtual!🤖 Pulsa sobre el botón "Comenzar" para ver las opciones disponibles 📝 o ingresa palabras clave para una búsqueda específica 🔍. ¡Estoy aquí para ayudarte!😊`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Comenzar', // Texto del botón
            callback_data: 'comenzar' // Acción del botón
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeMessage, options);
}

// Función para buscar en todas las guías
function buscarEnTodasLasGuias(mensaje) {
  return buscarEnGuias(Object.assign({}, ...Object.values(categorias).map(c => c.guias)), mensaje);
}

// Función para buscar en guías de una categoría específica
function buscarEnGuias(guias, mensaje) {
  const mensajeLower = mensaje.toLowerCase();
  const threshold = 0.6; // Ajusta el umbral de similitud según lo necesites
  let mejoresCoincidencias = [];

  for (const clave in guias) {
    const similitud = natural.JaroWinklerDistance(mensajeLower, clave.toLowerCase());
    if (similitud >= threshold) {
      mejoresCoincidencias.push({ guia: guias[clave], similitud });
    }
  }

  // Ordenar por la similitud más alta
  mejoresCoincidencias.sort((a, b) => b.similitud - a.similitud);

  // Devolver la guía con la similitud más alta si existe
  return mejoresCoincidencias.length > 0 ? mejoresCoincidencias[0].guia : null;
}
