// Web Serial API Driver for direct USB RFID scanning in Chrome/Edge (Windows/Mac/Linux)
let activePort = null;
let activeReader = null;
let isReading = false;

export async function connectWebSerial(onScanCallback, onErrorCallback) {
  if (typeof window === 'undefined' || !('serial' in navigator)) {
    if (onErrorCallback) onErrorCallback('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    return false;
  }

  try {
    // Request COM port permission from user
    activePort = await navigator.serial.requestPort();
    await activePort.open({ baudRate: 9600 });

    isReading = true;

    // Start reading line by line from USB Serial port
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = activePort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    activeReader = reader;

    let buffer = '';

    (async () => {
      try {
        while (isReading) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += value;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop(); // Keep remaining incomplete line

            for (const line of lines) {
              const uid = line.trim();
              if (uid && /^[0-9A-Fa-f]{4,16}$/.test(uid)) {
                if (onScanCallback) onScanCallback(uid.toUpperCase());
              }
            }
          }
        }
      } catch (err) {
        console.error('Web Serial read error:', err);
        if (onErrorCallback) onErrorCallback(err.message);
      } finally {
        reader.releaseLock();
      }
    })();

    return true;
  } catch (err) {
    console.error('Web Serial connect error:', err);
    if (onErrorCallback) onErrorCallback(err.message);
    return false;
  }
}

export async function disconnectWebSerial() {
  isReading = false;
  try {
    if (activeReader) {
      await activeReader.cancel();
    }
    if (activePort) {
      await activePort.close();
      activePort = null;
    }
  } catch (e) {}
}

export function isWebSerialSupported() {
  return typeof window !== 'undefined' && 'serial' in navigator;
}
