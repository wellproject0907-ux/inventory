const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');
const http = require('http');

const BAUD_RATE = 9600;
const API_URL = process.env.INVENTORY_API_URL || 'https://inventory-two-blue.vercel.app/api/arduino/scan';

console.log('==================================================');
console.log('   INVENTORY APP - ARDUINO RC522 USB BRIDGE       ');
console.log('==================================================');

// ⚡ Local SSE Server for 0ms Instant Local Browser Notification
const sseClients = [];
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.url === '/events') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  } else {
    res.writeHead(204);
    res.end();
  }
});

server.listen(8080, () => {
  console.log('⚡ Local Zero-Delay Listener active on http://localhost:8080/events\n');
});

function notifyLocalBrowser(uid) {
  const data = JSON.stringify({ uid, timestamp: Date.now() });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {}
  });
}

async function startBridge() {
  let portPath = process.env.ARDUINO_PORT;

  try {
    const ports = await SerialPort.List ? await SerialPort.List() : await SerialPort.list();
    console.log('\n🔍 Daftar Port USB/Serial yang tersedia:');
    if (ports.length === 0) {
      console.log('   ❌ Tidak ada port USB yang terdeteksi. Pastikan Arduino sudah dicolok!');
      process.exit(1);
    } else {
      ports.forEach((p, index) => {
        console.log(`   [${index + 1}] ${p.path} (${p.manufacturer || 'Unknown device'})`);
      });

      if (!portPath || portPath === 'COM3') {
        let arduinoPort = ports.find(p =>
          p.path.toLowerCase().includes('usbserial') ||
          p.path.toLowerCase().includes('usbmodem') ||
          p.path.toLowerCase().includes('ttyusb') ||
          p.path.toLowerCase().includes('ttyacm') ||
          p.path.toLowerCase().startsWith('com') ||
          (p.manufacturer && (
            p.manufacturer.toLowerCase().includes('arduino') ||
            p.manufacturer.toLowerCase().includes('ch340') ||
            p.manufacturer.toLowerCase().includes('cp210') ||
            p.manufacturer.toLowerCase().includes('silabs') ||
            p.manufacturer.toLowerCase().includes('ftdi')
          ))
        );

        if (!arduinoPort) {
          console.log('\n❌ Tidak ditemukan port USB Arduino yang valid (COM port / usbserial / usbmodem).');
          console.log('💡 Tips: Jalankan dengan menentukan port manual, contoh: ARDUINO_PORT=COM3 npm start (Windows) atau ARDUINO_PORT=/dev/cu.usbserial-XXXX npm start (Mac)');
          process.exit(1);
        }

        portPath = arduinoPort.path;
        console.log(`\n✅ Otomatis memilih port Arduino: ${portPath}`);
      }
    }
  } catch (err) {
    console.log('⚠️ Gagal mendata port serial:', err.message);
    portPath = portPath || 'COM3';
  }

  console.log(`\nMencoba membuka port USB: ${portPath} pada ${BAUD_RATE} baud...`);
  console.log('⚠️ CATATAN: Pastikan Serial Monitor di Arduino IDE sudah DITUTUP (Close).\n');

  const port = new SerialPort({
    path: portPath,
    baudRate: BAUD_RATE,
  }, (err) => {
    if (err) {
      console.error('❌ Gagal membuka port serial:', err.message);
      console.log('💡 Pastikan Arduino terhubung dan Serial Monitor Arduino IDE tidak sedang terbuka.');
      process.exit(1);
    }
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  port.on('open', () => {
    console.log('✅ Port serial berhasil dibuka! Silakan tempelkan kartu RFID ke RC522...\n');
  });

  parser.on('data', async (data) => {
    const uid = data.trim();
    if (!uid) return;

    console.log(`🏷️  [RFID SCAN] Kartu terdeteksi! UID: ${uid}`);

    // ⚡ 1. INSTANT LOCAL BROWSER NOTIFICATION (0.005 Seconds - Zero Internet Delay)
    notifyLocalBrowser(uid);

    // 🌐 2. Background Cloud Sync to Vercel & Firebase
    try {
      const response = await axios.post(API_URL, {
        uid: uid,
        action: 'LOG'
      });

      if (response.data.success) {
        console.log(`✅ [BERHASIL] Barang: ${response.data.item.nama_barang} (Stok: ${response.data.item.stok})\n`);
      } else {
        console.log(`⚠️ [INFO] ${response.data.message}\n`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ [SERVER ERROR] Status ${error.response.status}:`, error.response.data.message || error.response.data.error, '\n');
      } else {
        console.log(`❌ [KONEKSI ERROR] Tidak dapat menghubungi server (${API_URL}):`, error.message, '\n');
      }
    }
  });

  port.on('error', (err) => {
    console.error('⚠️ Error pada port serial:', err.message);
  });
}

startBridge();
