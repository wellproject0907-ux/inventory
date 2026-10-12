# Arduino RC522 USB Bridge for Inventory App

Folder ini berisi script jembatan (*bridge*) untuk menghubungkan modul RFID RC522 yang terhubung ke Arduino via kabel USB ke software Inventory Anda.

## Cara Penggunaan

### 1. Upload Kode ke Arduino
Pastikan Arduino Anda sudah di-upload program pembaca RFID RC522 yang mencetak UID kartu ke Serial (9600 baud).

Contoh kode dasar Arduino:
```cpp
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
}

void loop() {
  if ( ! mfrc522.PICC_IsNewCardPresent() || ! mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : ""));
    uid.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  uid.toUpperCase();
  Serial.println(uid);
  delay(1000);
}
```

### 2. Instalasi Dependensi Bridge
Buka terminal pada folder `arduino-bridge/`, lalu jalankan:
```bash
npm install
```

### 3. Konfigurasi Port USB
Buka file `bridge.js` dan sesuaikan variabel `PORT_PATH` dengan port USB Arduino Anda:
- **Windows:** `'COM3'`, `'COM4'`, dll.
- **macOS:** `'/dev/cu.usbmodemXXXX'` atau `'/dev/cu.usbserial-XXXX'`
- **Linux:** `'/dev/ttyUSB0'` atau `'/dev/ttyACM0'`

Anda juga bisa menjalankannya menggunakan environment variable:
```bash
ARDUINO_PORT=COM4 node bridge.js
```

### 4. Jalankan Aplikasi & Bridge
1. Pastikan server aplikasi Inventory Anda sedang menyala (`npm run dev` di root folder project).
2. Jalankan script bridge:
   ```bash
   npm start
   ```
3. Tempelkan kartu/keychain RFID ke modul RC522, dan lihat hasilnya di terminal serta aplikasi inventory!
