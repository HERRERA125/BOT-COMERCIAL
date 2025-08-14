const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  MessageType,
  Mimetype,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const path = require("path");

const CONFIG = {
  BOT_NAME: "🌿 Suplementos Naturales Bot",
  ADMIN_NUMBERS: ["573001234567"],
  BUSINESS_HOURS: { start: 8, end: 22 },
  MAX_RETRIES: 3,
  CONTACT_INFO: {
    whatsapp: "573001234567",
    email: "ventas@suplementos.com",
    website: "www.suplementosnaturales.com",
  },
};

let products = {
  ervolt: {
    nombre: "E&RVOLT",
    imagen: "https://enlineaweb.com/wp-content/uploads/2025/04/ervolt.jpeg",
    info: "Suplemento natural para energía y enfoque. Ideal para personas activas o con fatiga.",
    beneficios: [
      "Aumenta la energía",
      "Mejora la concentración",
      "Equilibra hormonas",
      "Fortalece defensas",
      "Reduce el estrés",
    ],
    precio: "Disponible por 127.000.",
    seguridad: "100% natural. Registro INVIMA aprobado.",
    modo: "Tomar una cápsula al día con el desayuno.",
    ingredientes: "Maca, guaraná, noni, chontaduro, avena, vitaminas.",
    envios: "Envío nacional en 1-3 días hábiles.",
    extra: {
      general:
        "No se recomienda en mujeres embarazadas sin consultar al médico.",
    },
  },
  liberfut: {
    nombre: "LIBERFUT",
    imagen:
      "https://enlineaweb.com/wp-content/uploads/2025/04/producto-LIBERFUT.jpeg",
    info: "Refuerza defensas y mejora salud celular. Contiene calostro, huevo liofilizado, chía y amalaki.",
    beneficios: [
      "Aumenta inmunidad",
      "Aumenta energía",
      "Ayuda a regenerar células",
      "Apoya la salud hepática",
    ],
    precio: "Disponible por 127.000.",
    seguridad: "Registro INVIMA. Natural y seguro.",
    modo: "Toma 1 cucharada al día. Mezcla con líquido.",
    ingredientes: "Calostro, huevo de pato, amalaki, chía, quinua, vitamina C.",
    envios: "Envíos nacionales disponibles.",
    extra: {
      general: "Fortalece sistema inmune naturalmente.",
    },
  },
  sysadox: {
    nombre: "SYSADOX",
    imagen: "https://enlineaweb.com/wp-content/uploads/2024/04/2-1.jpg",
    info: "Suplemento articular con colágeno, arándano, magnesio, biotina y vitaminas. Reduce dolor y mejora movilidad.",
    beneficios: [
      "Alivia articulaciones",
      "Regenera colágeno",
      "Fortalece huesos",
      "Fortalece piel",
    ],
    precio: "Disponible por 127.000.",
    seguridad: "Registro INVIMA. Natural y seguro.",
    modo: "Tomar una cucharada diaria con agua o jugo.",
    ingredientes: "Colágeno hidrolizado, arándano, magnesio, biotina, calcio.",
    envios: "Cobertura nacional.",
    extra: {
      general: "Ayuda en casos de dolor, artritis y rigidez.",
    },
  },
  vita: {
    nombre: "VITA SOLUTION",
    imagen:
      "https://enlineaweb.com/wp-content/uploads/2025/04/Vital-solutions.jpeg",
    info: "Mejora la salud visual y celular. Contiene luteína, zeaxantina, clorofila y aloe vera.",
    beneficios: [
      "Protege la visión",
      "Reduce resequedad ocular",
      "Mejora la piel",
      "Es antioxidante",
    ],
    precio: "Disponible por 127.000.",
    seguridad: "Registro INVIMA. Apto para uso diario.",
    modo: "Tomar una cucharada al día en la mañana.",
    ingredientes: "Luteína, zeaxantina, aloe vera, colágeno, vitamina C.",
    envios: "Entregas en todo el país.",
    extra: {
      general: "Ayuda a personas con fatiga ocular o expuestas a pantallas.",
    },
  },
};

let sales = [];
let userSessions = {};

const utils = {
  cleanText: (text) => text?.trim().toLowerCase() || "",
};

function extractMessageText(msg) {
  if (!msg.message) return null;
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: true });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !==
            DisconnectReason.loggedOut
          : true;
      if (shouldReconnect) setTimeout(() => startBot(), 5000);
    }
    if (connection === "open") {
      console.log("✅ Bot conectado con éxito");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const rawText = extractMessageText(msg);
    if (!rawText) return;
    const text = utils.cleanText(rawText);

    if (!userSessions[sender]) {
      userSessions[sender] = { stage: "init", selected: null };
    }

    const session = userSessions[sender];

    if (text.includes("hola") && text.includes("interesado")) {
      session.stage = "init";
      session.selected = null;
      await sock.sendMessage(sender, {
        text: "👋 Hola, soy un bot informativo.\n\nEstos son nuestros productos:\n1. E&RVOLT\n2. LIBERFUT\n3. SYSADOX\n4. VITA SOLUTION\n\nEscribe el número del producto para más info",
      });
      return;
    }

    if (session.stage === "init" && /^[1-4]$/.test(text)) {
      const keys = Object.keys(products);
      const key = keys[parseInt(text) - 1];
      const prod = products[key];
      session.selected = key;
      session.stage = "detail";

      await sock.sendMessage(sender, {
        image: { url: prod.imagen },
        caption:
          `*${prod.nombre}*\n\n${prod.info}\n\n` +
          `✅ *Beneficios:*\n${prod.beneficios
            .map((b) => `• ${b}`)
            .join("\n")}\n\n` +
          `💰 *Precio:* ${prod.precio}\n` +
          `🔒 *Seguridad:* ${prod.seguridad}\n\n` +
          `Si deseas saber más acerca de este producto escribe:\n` +
          `*modo*\n\n` +
          `*ingredientes*\n\n` +
          `*envios*\n\n` +
          `*extra*\n\n` +
          `Escribe "otros productos" para saber más acerca de otros productos.`,
      });
      return;
    }

    if (session.stage === "detail") {
      const prod = products[session.selected];
      if (!prod) return;

      if (["modo", "ingredientes", "envios", "extra"].includes(text)) {
        let response = "";
        if (text === "modo") response = `📋 *Modo de uso:*\n${prod.modo}`;
        else if (text === "ingredientes")
          response = `🧪 *Ingredientes:*\n${prod.ingredientes}`;
        else if (text === "envios") response = `🚚 *Envíos:*\n${prod.envios}`;
        else if (text === "extra")
          response = `ℹ️ *Extra:*\n${
            prod.extra?.[session.selected] ||
            prod.extra?.general ||
            "Sin info adicional"
          }`;

        await sock.sendMessage(sender, { text: response });
        return;
      }

      if (text === "otros productos") {
        session.stage = "init";
        session.selected = null;
        await sock.sendMessage(sender, {
          text: "👋 Hola, soy un bot informativo.\n\nEstos son nuestros productos:\n1. E&RVOLT\n2. LIBERFUT\n3. SYSADOX\n4. VITA SOLUTION\n\nEscribe el número del producto para más info",
        });
        return;
      }
    }
  });
}

startBot();
