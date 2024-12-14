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
// const guiasFinanzas = JSON.parse(fs.readFileSync('guia_finanzas.json', 'utf8'));
// const guiasSoporte = JSON.parse(fs.readFileSync('guia_soporte.json', 'utf8'));

const categorias = {
  ventas: {
    descripcion: 'Opciones relacionadas con ventas.',
    guias: guiasVentas
  },
  // finanzas: {
  //   descripcion: 'Opciones relacionadas con finanzas.',
  //   guias: guiasFinanzas
  // },
  // soporte: {
  //   descripcion: 'Opciones relacionadas con soporte.',
  //   guias: guiasSoporte
  // }
};

// Estado temporal para manejar la categoría seleccionada por cada usuario
const userState = {};

// Enviar mensaje de bienvenida cuando el usuario envía el comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const welcomeMessage = `¡Hola, soy Chatsito! Pulsa sobre el botón "Comenzar" para ver las opciones disponibles o ingresa palabras clave para una búsqueda específica. ¡Estoy aquí para ayudarte!`;

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
});

// Manejar el callback del botón "Comenzar"
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const callbackData = callbackQuery.data;

  if (callbackData === 'comenzar') {
    // Mostrar las categorías principales
    const opcionesCategorias = Object.keys(categorias)
    .map((key, index) => `${index + 1}. ${key.charAt(0).toUpperCase() + key.slice(1)}`)
    .join('\n');

    bot.sendMessage(
      chatId,
      `¡Hola! Estas son las categorías principales disponibles:\n\n${opcionesCategorias}\n\nEscribe el nombre de la categoría para ver las opciones dentro de ella.`
    );
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

  // Si el usuario selecciona una categoría principal
  if (categorias[userMessage]) {
    userState[chatId] = userMessage; // Guardar la categoría seleccionada
    const categoria = categorias[userMessage];

    const opcionesSubmenu = Object.keys(categoria.guias)
      .map((key, index) => `${index + 1}. ${key.charAt(0).toUpperCase() + key.slice(1)}`)
      .join('\n');

    bot.sendMessage(
      chatId,
      `Has seleccionado la categoría: ${userMessage.charAt(0).toUpperCase() + userMessage.slice(1)}.\n\n${categoria.descripcion}\n\nAquí están las opciones disponibles:\n\n${opcionesSubmenu}\n\nEscribe el número de la opción para obtener más detalles.`
    );
  } 
  // Si el usuario selecciona una opción dentro de la categoría
  else if (/^\d+$/.test(userMessage) && userState[chatId]) {
    const categoriaSeleccionada = userState[chatId];
    const guias = categorias[categoriaSeleccionada].guias;
    const opcionIndex = parseInt(userMessage) - 1;
    const claveGuia = Object.keys(guias)[opcionIndex];

    if (claveGuia) {
      const respuesta = guias[claveGuia];
      bot.sendMessage(
        chatId,
        `${respuesta.descripcion}\n\nConsulta el PDF: ${respuesta.pdf}`
      );

      // Reiniciar el estado del usuario y mostrar el mensaje de bienvenida
      delete userState[chatId];
      mostrarMensajeBienvenida(chatId);
    } else {
      bot.sendMessage(chatId, 'Opción no válida. Por favor, intenta nuevamente.');
    }
  } 
  // Si el usuario envía algo que no es categoría ni opción, buscar por palabras clave
  else {
    const claveGuia = buscarEnTodasLasGuias(userMessage);
    if (claveGuia) {
      const respuesta = claveGuia;
      bot.sendMessage(
        chatId,
        `${respuesta.descripcion}\n\nConsulta el PDF: ${respuesta.pdf}`
      );
    } else {
      bot.sendMessage(chatId, 'No encontré información relacionada. Intenta con otra pregunta o selección.');
    }
  }
});

// Función para mostrar el mensaje de bienvenida
function mostrarMensajeBienvenida(chatId) {
  const welcomeMessage = `¡Hola, soy Chatsito! Pulsa sobre el botón "Comenzar" para ver las opciones disponibles o ingresa palabras clave para una búsqueda específica. ¡Estoy aquí para ayudarte!`;

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
  const mensajeLower = mensaje.toLowerCase();
  const threshold = 0.4; // Ajusta el umbral de similitud según lo necesites
  let mejoresCoincidencias = [];

  for (const categoria in categorias) {
    const guias = categorias[categoria].guias;
    for (const clave in guias) {
      const similitud = natural.JaroWinklerDistance(mensajeLower, clave.toLowerCase());
      if (similitud >= threshold) {
        mejoresCoincidencias.push({ guia: guias[clave], similitud });
      }
    }
  }

  // Ordenar por la similitud más alta
  mejoresCoincidencias.sort((a, b) => b.similitud - a.similitud);

  // Devolver la guía con la similitud más alta si existe
  return mejoresCoincidencias.length > 0 ? mejoresCoincidencias[0].guia : null;
}
