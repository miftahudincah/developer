#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_PCF8574.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <time.h> 
#include <RTClib.h>

// ================= KONFIGURASI =================
// GANTI DENGAN SSID DAN PASSWORD WIFI ANDA
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"

// Konfigurasi Firebase
#define API_KEY "AIzaSyBZg9NpbBAg8dKHkCbYf4J_2bpHH2ZJWWI"
#define DATABASE_URL "https://absensi-4389a-default-rtdb.firebaseio.com/"

// ================= PIN CONFIGURATION =================
#define MUX_S0 26
#define MUX_S1 27
#define MUX_S2 14
#define MUX_S3 12

#define FP_RX 16
#define FP_TX 17

#define SD_CS   5
#define SD_MOSI 23
#define SD_MISO 19
#define SD_SCK  18

#define PCF_ADDR 0x20
#define ENROLL_BTN_PIN 0

// ================= STRUKTUR DATA (DITAMBAHKAN) =================
struct UserData {
  int id;
  String nama;
  String kelas;
  String jurusan;
  int delayOut;
};

// ================= VARIABEL GLOBAL =================
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger(&mySerial);
Adafruit_PCF8574 pcf;
RTC_DS3231 rtc;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

const long gmtOffset_sec = 25200;
const int daylightOffset_sec = 0;

int minDelayMinutes = 60;
int currentID = 1;
bool deviceConnected = false;
bool isOnline = false;
bool isEnrolling = false;

// BLE
BLEServer *pServer;
BLECharacteristic *pTxCharacteristic;

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

// Queue
QueueHandle_t xQueueFingerprint;
SemaphoreHandle_t xIDMutex;

// ================= FUNGSI WAKTU =================
String getCurrentDateRTC() {
  DateTime now = rtc.now();
  char buffer[11];
  sprintf(buffer, "%04d-%02d-%02d", now.year(), now.month(), now.day());
  return String(buffer);
}

String getCurrentTimeRTC() {
  DateTime now = rtc.now();
  char buffer[9];
  sprintf(buffer, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
  return String(buffer);
}

int getCurrentMinutesRTC() {
  DateTime now = rtc.now();
  return (now.hour() * 60) + now.minute();
}

int stringToMinutes(String timeStr) {
  if (timeStr.length() < 5) return 0;
  int h = timeStr.substring(0, 2).toInt();
  int m = timeStr.substring(3, 5).toInt();
  return (h * 60) + m;
}

void initRTC() {
  if (!rtc.begin()) {
    Serial.println("❌ RTC tidak ditemukan!");
    while (1);
  }
  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.println("✅ RTC Siap");
}

void syncRTCwithNTP() {
  configTime(gmtOffset_sec, daylightOffset_sec, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 5000)) {
    Serial.println("❌ Gagal sync NTP");
    return;
  }
  rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                      timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
  Serial.println("✅ RTC sync dengan NTP");
}

// ================= SD CARD =================
void initSD() {
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (!SD.begin(SD_CS)) {
    Serial.println("❌ SD Card gagal!");
  } else {
    Serial.println("✅ SD Card siap");
    loadSettings();
  }
}

void loadSettings() {
  File file = SD.open("/settings.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith("delay=")) {
        minDelayMinutes = line.substring(6).toInt();
        if (minDelayMinutes < 1) minDelayMinutes = 60;
      }
      if (line.startsWith("lastID=")) {
        currentID = line.substring(7).toInt();
      }
    }
    file.close();
    Serial.printf("📁 Delay: %d menit, Last ID: %d\n", minDelayMinutes, currentID);
  } else {
    saveSettings();
  }
}

void saveSettings() {
  File file = SD.open("/settings.txt", FILE_WRITE);
  if (file) {
    file.println("delay=" + String(minDelayMinutes));
    file.println("lastID=" + String(currentID));
    file.close();
    Serial.println("✅ Settings tersimpan");
  }
}

bool isUserRegistered(int id) {
  File file = SD.open("/users.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      if (file.readStringUntil('\n').startsWith(String(id) + ",")) {
        file.close();
        return true;
      }
    }
    file.close();
  }
  return false;
}

void saveUserToSD(int id, String nama, String kelas, String jurusan) {
  if (isUserRegistered(id)) return;
  File file = SD.open("/users.txt", FILE_APPEND);
  if (file) {
    file.println(String(id) + "," + nama + "," + kelas + "," + jurusan);
    file.close();
    Serial.printf("✅ User %d (%s) tersimpan di SD\n", id, nama.c_str());
  }
}

String getUserNamaFromSD(int id) {
  File file = SD.open("/users.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith(String(id) + ",")) {
        int c1 = line.indexOf(',');
        int c2 = line.indexOf(',', c1 + 1);
        file.close();
        return line.substring(c1 + 1, c2);
      }
    }
    file.close();
  }
  return "Unknown";
}

// ================= FUNGSI UNTUK MENDAPATKAN DATA USER LENGKAP =================
UserData getUserDataFromSD(int id) {
  UserData user;
  user.id = id;
  user.nama = "Unknown";
  user.kelas = "-";
  user.jurusan = "-";
  user.delayOut = 60;
  
  File file = SD.open("/users.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith(String(id) + ",")) {
        int c1 = line.indexOf(',');
        int c2 = line.indexOf(',', c1 + 1);
        int c3 = line.indexOf(',', c2 + 1);
        user.nama = line.substring(c1 + 1, c2);
        user.kelas = line.substring(c2 + 1, c3);
        user.jurusan = line.substring(c3 + 1);
        user.jurusan.trim();
        break;
      }
    }
    file.close();
  }
  return user;
}

// ================= FIREBASE =================
void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);
  Firebase.begin(&config, &auth);
  Serial.println("✅ Firebase terinisialisasi");
}

void syncOfflineData() {
  if (!Firebase.ready()) return;
  
  File logFile = SD.open("/attendance.txt", FILE_READ);
  if (!logFile) return;

  String unsynced = "";
  int synced = 0;

  while (logFile.available()) {
    String line = logFile.readStringUntil('\n');
    if (line.length() < 10) continue;

    int c1 = line.indexOf(',');
    int c2 = line.indexOf(',', c1 + 1);
    int c3 = line.indexOf(',', c2 + 1);
    int c4 = line.lastIndexOf(',');

    int id = line.substring(0, c1).toInt();
    String date = line.substring(c1 + 1, c2);
    String time = line.substring(c2 + 1, c3);
    String status = line.substring(c4 + 1);
    UserData user = getUserDataFromSD(id);

    String path = "absensi/" + date + "/" + String(id);
    
    if (status == "IN") {
      FirebaseJson json;
      json.set("nama", user.nama);
      json.set("kelas", user.kelas);
      json.set("jurusan", user.jurusan);
      json.set("in", time);
      if (Firebase.RTDB.set(&fbdo, path, &json)) synced++;
      else unsynced += line + "\n";
    } else if (status == "OUT") {
      if (Firebase.RTDB.set(&fbdo, path + "/out", time)) synced++;
      else unsynced += line + "\n";
    }
  }
  logFile.close();

  if (synced > 0) {
    SD.remove("/attendance.txt");
    if (unsynced.length() > 0) {
      File newLog = SD.open("/attendance.txt", FILE_WRITE);
      newLog.print(unsynced);
      newLog.close();
    }
    Serial.printf("✅ Sync offline: %d data\n", synced);
  }
}

void checkFirebaseSettings() {
  if (Firebase.ready() && isOnline) {
    if (Firebase.RTDB.get(&fbdo, "/settings/delayOut")) {
      int fbDelay = fbdo.to<int>();
      if (fbDelay > 0 && fbDelay != minDelayMinutes) {
        minDelayMinutes = fbDelay;
        saveSettings();
        sendBLEMessage("Delay: " + String(minDelayMinutes) + " menit");
        Serial.printf("✅ Delay update dari Firebase: %d\n", minDelayMinutes);
      }
    }
  }
}

// ================= MUX & FINGERPRINT =================
void selectSensor(int id) {
  int val = id - 1;
  digitalWrite(MUX_S0, val & 0x01);
  digitalWrite(MUX_S1, val & 0x02);
  digitalWrite(MUX_S2, val & 0x04);
  digitalWrite(MUX_S3, val & 0x08);
  delay(50);
}

void logAttendanceToSD(int id, String status) {
  File file = SD.open("/attendance.txt", FILE_APPEND);
  if (file) {
    file.println(String(id) + "," + getCurrentDateRTC() + "," + getCurrentTimeRTC() + "," + status);
    file.close();
  }
}

void sendToFirebase(int id, String status, String time, String date, String nama, String kelas, String jurusan) {
  if (!isOnline || !Firebase.ready()) return;
  
  String path = "absensi/" + date + "/" + String(id);
  
  if (status == "IN") {
    FirebaseJson json;
    json.set("nama", nama);
    json.set("kelas", kelas);
    json.set("jurusan", jurusan);
    json.set("in", time);
    Firebase.RTDB.set(&fbdo, path, &json);
    Serial.printf("📤 Firebase IN: %s\n", nama.c_str());
  } else if (status == "OUT") {
    Firebase.RTDB.set(&fbdo, path + "/out", time);
    Serial.printf("📤 Firebase OUT: %s\n", nama.c_str());
  }
}

// ================= FUNGSI HANDLE ATTENDANCE (DIPERBAIKI) =================
void handleAttendance(int id) {
  String date = getCurrentDateRTC();
  String time = getCurrentTimeRTC();
  UserData user = getUserDataFromSD(id);  // ← Gunakan fungsi ini
  
  String lastStatus = "NONE";
  String inTime = "";

  // Baca status terakhir dari SD
  File file = SD.open("/attendance.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.indexOf(String(id) + "," + date) != -1) {
        int c4 = line.lastIndexOf(',');
        lastStatus = line.substring(c4 + 1);
        if (lastStatus == "IN") {
          int c2 = line.indexOf(',', line.indexOf(',') + 1);
          int c3 = line.indexOf(',', c2 + 1);
          inTime = line.substring(c2 + 1, c3);
        }
      }
    }
    file.close();
  }

  if (lastStatus == "NONE") {
    // ABSEN MASUK
    logAttendanceToSD(id, "IN");
    sendToFirebase(id, "IN", time, date, user.nama, user.kelas, user.jurusan);
    sendBLEMessage("✅ " + user.nama + " - MASUK " + time);
    Serial.printf("✅ MASUK: %s (%d) jam %s\n", user.nama.c_str(), id, time.c_str());
    
  } else if (lastStatus == "IN") {
    // ABSEN PULANG - cek delay
    int timeDiff = getCurrentMinutesRTC() - stringToMinutes(inTime);
    if (timeDiff < minDelayMinutes) {
      int wait = minDelayMinutes - timeDiff;
      sendBLEMessage("⏰ Tunggu " + String(wait) + " menit untuk pulang");
      Serial.printf("⚠️ PULANG DITOLAK: %s, tunggu %d menit\n", user.nama.c_str(), wait);
      return;
    }
    logAttendanceToSD(id, "OUT");
    sendToFirebase(id, "OUT", time, date, user.nama, user.kelas, user.jurusan);
    sendBLEMessage("✅ " + user.nama + " - PULANG " + time);
    Serial.printf("✅ PULANG: %s (%d) jam %s\n", user.nama.c_str(), id, time.c_str());
    
  } else {
    sendBLEMessage("⚠️ " + user.nama + " sudah absen hari ini");
  }
}

// ================= ENROLL FINGERPRINT =================
int enrollFingerprint(int id) {
  selectSensor(1);
  sendBLEMessage("📌 Tempelkan jari...");
  
  int p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    delay(100);
  }
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) return p;

  sendBLEMessage("📌 Lepaskan jari...");
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(100);

  sendBLEMessage("📌 Tempelkan lagi...");
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    delay(100);
  }
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) return p;

  p = finger.createModel();
  if (p != FINGERPRINT_OK) return p;

  p = finger.storeModel(id);
  if (p != FINGERPRINT_OK) return p;

  // Sync ke semua sensor (1-16)
  sendBLEMessage("🔄 Sinkronisasi ke 16 sensor...");
  for (int i = 1; i <= 16; i++) {
    selectSensor(i);
    delay(30);
    finger.loadModel(id);
    finger.storeModel(id);
    delay(30);
  }
  selectSensor(1);
  
  return FINGERPRINT_OK;
}

// ================= BLE (DIPERBAIKI) =================
void sendBLEMessage(String msg) {
  if (deviceConnected && pTxCharacteristic) {
    pTxCharacteristic->setValue(msg.c_str());
    pTxCharacteristic->notify();
    Serial.println("📱 BLE: " + msg);
  }
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) { deviceConnected = true; }
  void onDisconnect(BLEServer* pServer) { deviceConnected = false; }
};

class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String rxValue = pCharacteristic->getValue().c_str();  // ← DIPERBAIKI
    if (rxValue.length() > 0) {
      
      if (rxValue.startsWith("SET_DELAY:")) {
        minDelayMinutes = rxValue.substring(10).toInt();
        saveSettings();
        sendBLEMessage("✅ Delay: " + String(minDelayMinutes) + " menit");
      } else if (rxValue.startsWith("GET_STATUS")) {
        sendBLEMessage("STATUS|Delay:" + String(minDelayMinutes) + "|Online:" + String(isOnline));
      }
    }
  }
};

void initBLE() {
  BLEDevice::init("ESP32_Absensi");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService* pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);
  BLECharacteristic* pRxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);
  pRxCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("✅ BLE siap");
}

// ================= TASK CORE 0 =================
void TaskScanSensors(void* pvParameters) {
  for (;;) {
    if (isEnrolling) {
      vTaskDelay(100 / portTICK_PERIOD_MS);
      continue;
    }

    for (int i = 1; i <= 16; i++) {
      selectSensor(i);
      if (finger.getImage() == FINGERPRINT_OK) {
        if (finger.image2Tz() == FINGERPRINT_OK) {
          if (finger.fingerSearch() == FINGERPRINT_OK) {
            int id = finger.fingerID;
            xQueueSend(xQueueFingerprint, &id, 0);
            vTaskDelay(2000 / portTICK_PERIOD_MS);
            break;
          }
        }
      }
    }
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  // Setup MUX
  pinMode(MUX_S0, OUTPUT); pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT); pinMode(MUX_S3, OUTPUT);
  for (int i = 0; i < 16; i++) selectSensor(i + 1);

  // Setup Fingerprint
  mySerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  selectSensor(1);
  finger.begin(57600);
  
  // Setup I2C & RTC
  Wire.begin();
  initRTC();
  
  // Setup SD Card
  initSD();
  
  // Setup PCF8574
  if (!pcf.begin(PCF_ADDR)) {
    Serial.println("❌ PCF8574 error");
  }
  for (int i = 0; i < 8; i++) pcf.pinMode(i, INPUT_PULLUP);

  // Setup Queue
  xQueueFingerprint = xQueueCreate(10, sizeof(int));
  xIDMutex = xSemaphoreCreateMutex();

  // Task Core 0
  xTaskCreatePinnedToCore(TaskScanSensors, "SensorTask", 10000, NULL, 1, NULL, 0);

  // WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("📡 Menghubungkan WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi terhubung");
    isOnline = true;
    syncRTCwithNTP();
    initFirebase();
    syncOfflineData();
    checkFirebaseSettings();
  } else {
    Serial.println("\n⚠️ WiFi gagal, mode offline");
  }

  initBLE();
  Serial.println("🚀 ESP32 SIAP!");
}

// ================= LOOP =================
void loop() {
  int id;
  if (xQueueReceive(xQueueFingerprint, &id, pdMS_TO_TICKS(100)) == pdPASS) {
    handleAttendance(id);
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (!isOnline) {
      isOnline = true;
      syncRTCwithNTP();
      syncOfflineData();
    }
    
    static unsigned long lastSettings = 0;
    if (millis() - lastSettings > 30000) {
      checkFirebaseSettings();
      lastSettings = millis();
    }
    
    static unsigned long lastPing = 0;
    if (millis() - lastPing > 60000) {
      if (Firebase.ready()) {
        Firebase.RTDB.set(&fbdo, "/status/esp32/last_ping", getCurrentTimeRTC());
        Firebase.RTDB.set(&fbdo, "/status/esp32/ip", WiFi.localIP().toString());
      }
      lastPing = millis();
    }
  } else {
    isOnline = false;
  }

  // Tombol enroll
  if (pcf.digitalRead(ENROLL_BTN_PIN) == LOW) {
    delay(500);
    
    while (isUserRegistered(currentID)) {
      currentID++;
      saveSettings();
    }
    
    isEnrolling = true;
    Serial.printf("📝 Enroll ID: %d\n", currentID);
    sendBLEMessage("📝 Registrasi ID: " + String(currentID));
    
    String defaultNama = "Siswa" + String(currentID);
    String defaultKelas = "X";
    String defaultJurusan = "RPL";
    
    int result = enrollFingerprint(currentID);
    
    if (result == FINGERPRINT_OK) {
      saveUserToSD(currentID, defaultNama, defaultKelas, defaultJurusan);
      
      if (isOnline && Firebase.ready()) {
        FirebaseJson json;
        json.set("id", currentID);
        json.set("nama", defaultNama);
        json.set("kelas", defaultKelas);
        json.set("jurusan", defaultJurusan);
        json.set("delayOut", minDelayMinutes);
        Firebase.RTDB.set(&fbdo, "users/" + String(currentID), &json);
      }
      
      sendBLEMessage("✅ Sukses ID " + String(currentID));
      Serial.printf("✅ Enroll sukses ID: %d\n", currentID);
      currentID++;
      saveSettings();
    } else {
      sendBLEMessage("❌ Gagal enroll, coba lagi");
      Serial.printf("❌ Enroll gagal, code: %d\n", result);
    }
    
    isEnrolling = false;
    delay(500);
  }

  delay(10);
}