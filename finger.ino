// finger.ino - VERSION 3.0 FIXED (Compile Ready)
// Fitur Lengkap: Delay Per Siswa, Sync dari Firebase, Hapus FP via BLE, WiFi via BLE

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
#include <Preferences.h>

// ================= KONFIGURASI =================
// GANTI DENGAN SSID DAN PASSWORD WIFI ANDA (atau biarkan kosong untuk BLE config)
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

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

// ================= STRUKTUR DATA =================
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

int globalDelayMinutes = 60;
int currentID = 1;
bool deviceConnected = false;
bool isOnline = false;
bool isEnrolling = false;
bool syncInProgress = false;

// WiFi credentials dari Preferences
String wifiSSID = "";
String wifiPassword = "";
Preferences preferences;

// BLE
BLEServer *pServer;
BLECharacteristic *pTxCharacteristic;
BLECharacteristic *pRxCharacteristic;

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

// Queue
QueueHandle_t xQueueFingerprint;

// Cache user di RAM
#define MAX_USERS 500
UserData userCache[MAX_USERS];
int userCacheCount = 0;

// Timing
unsigned long lastCommandCheck = 0;
unsigned long lastUserSync = 0;
unsigned long lastSettings = 0;
unsigned long lastPing = 0;
unsigned long lastReconnect = 0;

const unsigned long COMMAND_CHECK_INTERVAL = 2000;
const unsigned long USER_SYNC_INTERVAL = 300000;  // 5 menit
const unsigned long SETTINGS_INTERVAL = 30000;    // 30 detik
const unsigned long PING_INTERVAL = 60000;        // 60 detik
const unsigned long RECONNECT_INTERVAL = 30000;   // 30 detik

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
  if (!isOnline) return;
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

// ================= WIFI CONFIG VIA BLE =================

void saveWiFiCredentials(String ssid, String password) {
  preferences.begin("wifi", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
  Serial.println("✅ WiFi credentials saved to NVS");
}

void loadWiFiCredentials() {
  preferences.begin("wifi", true);
  wifiSSID = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  preferences.end();
  
  if (wifiSSID.length() > 0) {
    Serial.printf("📡 Loaded WiFi: %s\n", wifiSSID.c_str());
  } else {
    Serial.println("⚠️ No WiFi credentials. Use BLE: SET_WIFI:SSID,PASS");
  }
}

void clearWiFiCredentials() {
  preferences.begin("wifi", false);
  preferences.clear();
  preferences.end();
  wifiSSID = "";
  wifiPassword = "";
  Serial.println("🗑️ WiFi credentials cleared");
}

void connectToWiFi() {
  if (wifiSSID.length() == 0) {
    Serial.println("⚠️ No WiFi credentials");
    return;
  }
  
  Serial.printf("📡 Connecting to: %s\n", wifiSSID.c_str());
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected");
    Serial.print("📡 IP: ");
    Serial.println(WiFi.localIP());
    isOnline = true;
    syncRTCwithNTP();
    initFirebase();
    syncOfflineData();
    checkFirebaseSettings();
    syncAllUsersFromFirebase();
    sendBLEMessage("✅ WiFi: " + wifiSSID);
  } else {
    Serial.println("\n❌ WiFi failed!");
    isOnline = false;
    sendBLEMessage("❌ WiFi failed! Check password");
  }
}

// ================= SD CARD =================
void initSD() {
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (!SD.begin(SD_CS)) {
    Serial.println("❌ SD Card failed!");
  } else {
    Serial.println("✅ SD Card ready");
    loadSettings();
    loadUserCacheFromSD();
  }
}

void loadSettings() {
  File file = SD.open("/settings.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith("delay=")) {
        globalDelayMinutes = line.substring(6).toInt();
        if (globalDelayMinutes < 1) globalDelayMinutes = 60;
      }
      if (line.startsWith("lastID=")) {
        currentID = line.substring(7).toInt();
      }
    }
    file.close();
    Serial.printf("📁 Global Delay: %d menit, Last ID: %d\n", globalDelayMinutes, currentID);
  } else {
    saveSettings();
  }
}

void saveSettings() {
  File file = SD.open("/settings.txt", FILE_WRITE);
  if (file) {
    file.println("delay=" + String(globalDelayMinutes));
    file.println("lastID=" + String(currentID));
    file.close();
    Serial.println("✅ Settings saved");
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

// ================= USER CACHE FUNCTIONS =================

void loadUserCacheFromSD() {
  File file = SD.open("/users.txt", FILE_READ);
  if (!file) {
    Serial.println("⚠️ No users.txt found");
    userCacheCount = 0;
    return;
  }
  
  userCacheCount = 0;
  while (file.available() && userCacheCount < MAX_USERS) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;
    
    int c1 = line.indexOf(',');
    int c2 = line.indexOf(',', c1 + 1);
    int c3 = line.indexOf(',', c2 + 1);
    int c4 = line.indexOf(',', c3 + 1);
    
    if (c1 > 0 && c2 > 0 && c3 > 0) {
      userCache[userCacheCount].id = line.substring(0, c1).toInt();
      userCache[userCacheCount].nama = line.substring(c1 + 1, c2);
      userCache[userCacheCount].kelas = line.substring(c2 + 1, c3);
      
      if (c4 > 0) {
        userCache[userCacheCount].jurusan = line.substring(c3 + 1, c4);
        userCache[userCacheCount].delayOut = line.substring(c4 + 1).toInt();
      } else {
        userCache[userCacheCount].jurusan = line.substring(c3 + 1);
        userCache[userCacheCount].jurusan.trim();
        userCache[userCacheCount].delayOut = globalDelayMinutes;
      }
      
      if (userCache[userCacheCount].delayOut <= 0) {
        userCache[userCacheCount].delayOut = globalDelayMinutes;
      }
      
      userCacheCount++;
    }
  }
  file.close();
  Serial.printf("📚 Loaded %d users from SD cache\n", userCacheCount);
}

void saveUserToSD(int id, String nama, String kelas, String jurusan, int delayOut) {
  File file = SD.open("/users.txt", FILE_READ);
  bool exists = false;
  String existingContent = "";
  
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith(String(id) + ",")) {
        exists = true;
        existingContent += String(id) + "," + nama + "," + kelas + "," + jurusan + "," + String(delayOut) + "\n";
      } else {
        existingContent += line + "\n";
      }
    }
    file.close();
  }
  
  if (!exists) {
    existingContent += String(id) + "," + nama + "," + kelas + "," + jurusan + "," + String(delayOut) + "\n";
  }
  
  File outFile = SD.open("/users.txt", FILE_WRITE);
  if (outFile) {
    outFile.print(existingContent);
    outFile.close();
    Serial.printf("✅ User %d (%s) delay=%d saved\n", id, nama.c_str(), delayOut);
  }
  
  // Update cache
  bool found = false;
  for (int i = 0; i < userCacheCount; i++) {
    if (userCache[i].id == id) {
      userCache[i].nama = nama;
      userCache[i].kelas = kelas;
      userCache[i].jurusan = jurusan;
      userCache[i].delayOut = delayOut;
      found = true;
      break;
    }
  }
  if (!found && userCacheCount < MAX_USERS) {
    userCache[userCacheCount].id = id;
    userCache[userCacheCount].nama = nama;
    userCache[userCacheCount].kelas = kelas;
    userCache[userCacheCount].jurusan = jurusan;
    userCache[userCacheCount].delayOut = delayOut;
    userCacheCount++;
  }
}

void removeUserFromSD(int id) {
  File file = SD.open("/users.txt", FILE_READ);
  if (!file) {
    Serial.println("⚠️ users.txt not found");
    return;
  }
  
  String newContent = "";
  bool found = false;
  
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.startsWith(String(id) + ",")) {
      found = true;
      Serial.printf("🗑️ Removing user %d from SD\n", id);
      continue;
    }
    newContent += line + "\n";
  }
  file.close();
  
  if (found) {
    File outFile = SD.open("/users.txt", FILE_WRITE);
    if (outFile) {
      outFile.print(newContent);
      outFile.close();
      Serial.printf("✅ User %d removed from SD\n", id);
      
      // Update cache
      for (int i = 0; i < userCacheCount; i++) {
        if (userCache[i].id == id) {
          for (int j = i; j < userCacheCount - 1; j++) {
            userCache[j] = userCache[j + 1];
          }
          userCacheCount--;
          break;
        }
      }
    }
  }
}

UserData getUserData(int id) {
  // Search cache first
  for (int i = 0; i < userCacheCount; i++) {
    if (userCache[i].id == id) {
      return userCache[i];
    }
  }
  
  // Fallback to SD
  UserData user;
  user.id = id;
  user.nama = "Unknown";
  user.kelas = "-";
  user.jurusan = "-";
  user.delayOut = globalDelayMinutes;
  
  File file = SD.open("/users.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.startsWith(String(id) + ",")) {
        int c1 = line.indexOf(',');
        int c2 = line.indexOf(',', c1 + 1);
        int c3 = line.indexOf(',', c2 + 1);
        int c4 = line.indexOf(',', c3 + 1);
        
        user.nama = line.substring(c1 + 1, c2);
        user.kelas = line.substring(c2 + 1, c3);
        
        if (c4 > 0) {
          user.jurusan = line.substring(c3 + 1, c4);
          user.delayOut = line.substring(c4 + 1).toInt();
        } else {
          user.jurusan = line.substring(c3 + 1);
          user.jurusan.trim();
          user.delayOut = globalDelayMinutes;
        }
        
        if (user.delayOut <= 0) user.delayOut = globalDelayMinutes;
        break;
      }
    }
    file.close();
  }
  return user;
}

// ================= FINGERPRINT DELETE FUNCTIONS =================

bool deleteFingerprintFromAllSensors(int id) {
  int successCount = 0;
  int failCount = 0;
  int notFoundCount = 0;
  
  sendBLEMessage("🗑️ Deleting ID " + String(id) + " from 16 sensors...");
  Serial.printf("🗑️ Deleting fingerprint ID %d from all sensors\n", id);
  
  for (int i = 1; i <= 16; i++) {
    selectSensor(i);
    delay(50);
    
    int loadResult = finger.loadModel(id);
    
    if (loadResult == FINGERPRINT_OK) {
      int deleteResult = finger.deleteModel(id);
      if (deleteResult == FINGERPRINT_OK) {
        successCount++;
        Serial.printf("  ✅ Sensor %d: Deleted\n", i);
      } else {
        failCount++;
        Serial.printf("  ❌ Sensor %d: Delete failed (%d)\n", i, deleteResult);
      }
    } else {
      notFoundCount++;
      Serial.printf("  ℹ️ Sensor %d: ID not found\n", i);
    }
    delay(30);
  }
  
  selectSensor(1);
  
  String resultMsg = "Delete ID " + String(id) + ": " + String(successCount) + " OK, " + 
                     String(failCount) + " fail, " + String(notFoundCount) + " not found";
  sendBLEMessage(resultMsg);
  Serial.println("📱 " + resultMsg);
  
  // Remove from SD
  removeUserFromSD(id);
  
  return (failCount == 0);
}

// ================= FIREBASE =================

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);
  Firebase.begin(&config, &auth);
  Serial.println("✅ Firebase initialized");
}

// VERSI YANG DIPERBAIKI - menggunakan FirebaseJsonArray
void syncAllUsersFromFirebase() {
  if (!isOnline || !Firebase.ready() || syncInProgress) return;
  
  syncInProgress = true;
  Serial.println("🔄 Syncing users from Firebase...");
  
  if (Firebase.RTDB.get(&fbdo, "/users")) {
    FirebaseJson &json = fbdo.jsonObject();
    String allUserData = "";
    int syncCount = 0;
    
    // Cara yang lebih sederhana dan kompatibel
    // Ambil raw JSON string lalu parse manual
    String rawJson = fbdo.to<FirebaseJson>().raw();
    
    // Parse sederhana untuk format {"id": {"nama":"xxx","kelas":"xx",...}}
    int pos = 0;
    while (pos < rawJson.length()) {
      int startKey = rawJson.indexOf("\"", pos);
      if (startKey == -1) break;
      int endKey = rawJson.indexOf("\"", startKey + 1);
      if (endKey == -1) break;
      
      String key = rawJson.substring(startKey + 1, endKey);
      
      // Cek apakah key adalah angka (ID user)
      if (key.length() > 0 && isDigit(key.charAt(0))) {
        int id = key.toInt();
        
        // Cari object user
        int objStart = rawJson.indexOf("{", endKey);
        int objEnd = rawJson.indexOf("}", objStart);
        String userObj = rawJson.substring(objStart, objEnd + 1);
        
        // Parse field
        String nama = "", kelas = "", jurusan = "";
        int delayOut = globalDelayMinutes;
        
        // Parse nama
        int namaPos = userObj.indexOf("\"nama\"");
        if (namaPos != -1) {
          int valStart = userObj.indexOf("\"", namaPos + 6) + 1;
          int valEnd = userObj.indexOf("\"", valStart);
          nama = userObj.substring(valStart, valEnd);
        }
        
        // Parse kelas
        int kelasPos = userObj.indexOf("\"kelas\"");
        if (kelasPos != -1) {
          int valStart = userObj.indexOf("\"", kelasPos + 7) + 1;
          int valEnd = userObj.indexOf("\"", valStart);
          kelas = userObj.substring(valStart, valEnd);
        }
        
        // Parse jurusan
        int jurusanPos = userObj.indexOf("\"jurusan\"");
        if (jurusanPos != -1) {
          int valStart = userObj.indexOf("\"", jurusanPos + 9) + 1;
          int valEnd = userObj.indexOf("\"", valStart);
          jurusan = userObj.substring(valStart, valEnd);
        }
        
        // Parse delayOut
        int delayPos = userObj.indexOf("\"delayOut\"");
        if (delayPos != -1) {
          int colonPos = userObj.indexOf(":", delayPos);
          int commaPos = userObj.indexOf(",", colonPos);
          int bracePos = userObj.indexOf("}", colonPos);
          int endPos = (commaPos != -1 && commaPos < bracePos) ? commaPos : bracePos;
          String delayStr = userObj.substring(colonPos + 1, endPos);
          delayStr.trim();
          delayOut = delayStr.toInt();
        }
        
        if (delayOut <= 0) delayOut = globalDelayMinutes;
        if (nama.length() == 0) nama = "User" + String(id);
        if (kelas.length() == 0) kelas = "-";
        if (jurusan.length() == 0) jurusan = "-";
        
        allUserData += String(id) + "," + nama + "," + kelas + "," + jurusan + "," + String(delayOut) + "\n";
        syncCount++;
      }
      
      pos = endKey + 1;
    }
    
    if (syncCount > 0) {
      File file = SD.open("/users.txt", FILE_WRITE);
      if (file) {
        file.print(allUserData);
        file.close();
        Serial.printf("✅ Synced %d users from Firebase\n", syncCount);
        loadUserCacheFromSD();
        sendBLEMessage("✅ Synced " + String(syncCount) + " users");
      }
    } else {
      Serial.println("⚠️ No users found in Firebase");
    }
  } else {
    Serial.println("❌ Failed to get /users from Firebase");
  }
  
  syncInProgress = false;
}

void checkFirebaseSettings() {
  if (Firebase.ready() && isOnline) {
    if (Firebase.RTDB.get(&fbdo, "/settings/delayOut")) {
      int fbDelay = fbdo.to<int>();
      if (fbDelay > 0 && fbDelay != globalDelayMinutes) {
        globalDelayMinutes = fbDelay;
        saveSettings();
        sendBLEMessage("Global Delay: " + String(globalDelayMinutes) + " min");
        Serial.printf("✅ Global delay updated: %d\n", globalDelayMinutes);
      }
    }
  }
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
    UserData user = getUserData(id);

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
    Serial.printf("✅ Offline sync: %d data\n", synced);
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
    Serial.printf("📤 IN: %s\n", nama.c_str());
  } else if (status == "OUT") {
    Firebase.RTDB.set(&fbdo, path + "/out", time);
    Serial.printf("📤 OUT: %s\n", nama.c_str());
  }
}

// ================= HANDLE ATTENDANCE (DENGAN DELAY PER SISWA) =================

void handleAttendance(int id) {
  String date = getCurrentDateRTC();
  String time = getCurrentTimeRTC();
  UserData user = getUserData(id);
  
  // Gunakan delay PER SISWA, fallback ke global
  int requiredDelay = (user.delayOut > 0) ? user.delayOut : globalDelayMinutes;
  
  String lastStatus = "NONE";
  String inTime = "";

  File file = SD.open("/attendance.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      if (line.indexOf(String(id) + "," + date) != -1) {
        int c4 = line.lastIndexOf(',');
        lastStatus = line.substring(c4 + 1);
        if (lastStatus == "IN") {
          int c1 = line.indexOf(',');
          int c2 = line.indexOf(',', c1 + 1);
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
    Serial.printf("✅ MASUK: %s (%d) jam %s, delay=%d menit\n", 
                  user.nama.c_str(), id, time.c_str(), requiredDelay);
    
  } else if (lastStatus == "IN") {
    // ABSEN PULANG - cek delay PER SISWA
    int timeDiff = getCurrentMinutesRTC() - stringToMinutes(inTime);
    if (timeDiff < requiredDelay) {
      int wait = requiredDelay - timeDiff;
      sendBLEMessage("⏰ " + user.nama + " tunggu " + String(wait) + " menit (min " + String(requiredDelay) + ")");
      Serial.printf("⚠️ PULANG DITOLAK: %s, sudah %d menit, perlu %d menit\n", 
                    user.nama.c_str(), timeDiff, requiredDelay);
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

// ================= BLE COMMANDS =================

void sendBLEMessage(String msg) {
  if (deviceConnected && pTxCharacteristic) {
    pTxCharacteristic->setValue(msg.c_str());
    pTxCharacteristic->notify();
    Serial.println("📱 BLE: " + msg);
  }
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) { 
    deviceConnected = true; 
    Serial.println("📱 BLE Connected");
    sendBLEMessage("ESP32 Absensi Ready");
    sendBLEMessage("WiFi: " + String(isOnline ? "ONLINE" : "OFFLINE"));
  }
  void onDisconnect(BLEServer* pServer) { 
    deviceConnected = false; 
    Serial.println("📱 BLE Disconnected");
  }
};

class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String rxValue = pCharacteristic->getValue().c_str();
    if (rxValue.length() > 0) {
      Serial.println("📱 BLE RX: " + rxValue);
      
      // ========== WIFI COMMANDS ==========
      if (rxValue.startsWith("SET_WIFI:")) {
        String creds = rxValue.substring(9);
        int commaPos = creds.indexOf(',');
        if (commaPos > 0) {
          String ssid = creds.substring(0, commaPos);
          String password = creds.substring(commaPos + 1);
          ssid.trim();
          password.trim();
          
          if (ssid.length() > 0) {
            sendBLEMessage("📡 Saving WiFi: " + ssid);
            saveWiFiCredentials(ssid, password);
            wifiSSID = ssid;
            wifiPassword = password;
            sendBLEMessage("🔄 Connecting...");
            connectToWiFi();
          } else {
            sendBLEMessage("❌ Invalid! Use: SET_WIFI:SSID,PASS");
          }
        } else {
          sendBLEMessage("❌ Invalid! Use: SET_WIFI:SSID,PASS");
        }
      }
      
      else if (rxValue.startsWith("GET_WIFI")) {
        if (wifiSSID.length() > 0) {
          sendBLEMessage("WiFi: " + wifiSSID);
          sendBLEMessage("Status: " + String(isOnline ? "CONNECTED" : "DISCONNECTED"));
          if (isOnline) sendBLEMessage("IP: " + WiFi.localIP().toString());
        } else {
          sendBLEMessage("⚠️ No WiFi configured");
        }
      }
      
      else if (rxValue.startsWith("CLEAR_WIFI")) {
        clearWiFiCredentials();
        WiFi.disconnect(true);
        isOnline = false;
        sendBLEMessage("🗑️ WiFi cleared");
      }
      
      else if (rxValue.startsWith("SCAN_WIFI")) {
        sendBLEMessage("📡 Scanning...");
        int n = WiFi.scanNetworks();
        if (n == 0) {
          sendBLEMessage("❌ No networks");
        } else {
          sendBLEMessage("📡 Found " + String(n) + " networks:");
          for (int i = 0; i < n && i < 10; i++) {
            sendBLEMessage(String(i+1) + ". " + WiFi.SSID(i));
          }
        }
        WiFi.scanDelete();
      }
      
      // ========== SYSTEM COMMANDS ==========
      else if (rxValue.startsWith("GET_STATUS")) {
        sendBLEMessage("STATUS|Delay:" + String(globalDelayMinutes) + 
                       "|Online:" + String(isOnline) + 
                       "|Users:" + String(userCacheCount) +
                       "|WiFi:" + (wifiSSID.length() > 0 ? wifiSSID : "NONE"));
        if (isOnline) sendBLEMessage("IP: " + WiFi.localIP().toString());
      }
      
      else if (rxValue.startsWith("SET_DELAY:")) {
        globalDelayMinutes = rxValue.substring(10).toInt();
        saveSettings();
        sendBLEMessage("✅ Global Delay: " + String(globalDelayMinutes) + " min");
      }
      
      else if (rxValue.startsWith("SYNC_USERS")) {
        if (isOnline) {
          sendBLEMessage("🔄 Syncing...");
          syncAllUsersFromFirebase();
        } else {
          sendBLEMessage("❌ No WiFi connection");
        }
      }
      
      else if (rxValue.startsWith("DELETE_FP:")) {
        int fid = rxValue.substring(10).toInt();
        deleteFingerprintFromAllSensors(fid);
      }
      
      else if (rxValue.startsWith("REBOOT")) {
        sendBLEMessage("🔄 Rebooting...");
        delay(100);
        ESP.restart();
      }
      
      else if (rxValue.startsWith("HELP")) {
        sendBLEMessage("=== ESP32 Commands ===");
        sendBLEMessage("SET_WIFI:SSID,PASS - Config WiFi");
        sendBLEMessage("GET_WIFI - WiFi status");
        sendBLEMessage("CLEAR_WIFI - Clear WiFi");
        sendBLEMessage("SCAN_WIFI - Scan networks");
        sendBLEMessage("GET_STATUS - System status");
        sendBLEMessage("SET_DELAY:min - Set global delay");
        sendBLEMessage("SYNC_USERS - Sync from Firebase");
        sendBLEMessage("DELETE_FP:id - Delete fingerprint");
        sendBLEMessage("REBOOT - Restart ESP32");
        sendBLEMessage("HELP - This menu");
      }
      
      else {
        sendBLEMessage("❌ Unknown. Send HELP");
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
  pRxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);
  pRxCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("✅ BLE Ready - Name: ESP32_Absensi");
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
  Serial.println("\n🚀 ESP32 Fingerprint System Starting...");

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

  // Task Core 0
  xTaskCreatePinnedToCore(TaskScanSensors, "SensorTask", 10000, NULL, 1, NULL, 0);

  // Load WiFi credentials
  loadWiFiCredentials();
  
  // Connect if credentials exist
  if (wifiSSID.length() > 0) {
    connectToWiFi();
  } else {
    Serial.println("⚠️ No WiFi. Use BLE: SET_WIFI:SSID,PASS");
  }

  // Initialize BLE
  initBLE();
  
  Serial.println("==========================================");
  Serial.println("🚀 ESP32 READY!");
  Serial.println("   BLE Name: ESP32_Absensi");
  Serial.println("   Commands: HELP, GET_STATUS, SET_WIFI:SSID,PASS");
  Serial.println("   Features: Delay PER SISWA | Delete FP | WiFi via BLE");
  Serial.println("==========================================");
  
  sendBLEMessage("ESP32 Absensi Ready");
  if (wifiSSID.length() == 0) {
    sendBLEMessage("⚠️ No WiFi! Send: SET_WIFI:SSID,PASS");
  }
}

// ================= LOOP =================

void loop() {
  int id;
  if (xQueueReceive(xQueueFingerprint, &id, pdMS_TO_TICKS(100)) == pdPASS) {
    handleAttendance(id);
  }

  // WiFi handling
  if (wifiSSID.length() > 0) {
    if (WiFi.status() == WL_CONNECTED) {
      if (!isOnline) {
        isOnline = true;
        Serial.println("✅ WiFi reconnected");
        syncRTCwithNTP();
        initFirebase();
        syncOfflineData();
        checkFirebaseSettings();
        syncAllUsersFromFirebase();
        sendBLEMessage("✅ WiFi Reconnected");
      }
      
      // Periodic tasks
      unsigned long now = millis();
      
      if (now - lastSettings > SETTINGS_INTERVAL) {
        checkFirebaseSettings();
        lastSettings = now;
      }
      
      if (now - lastUserSync > USER_SYNC_INTERVAL) {
        syncAllUsersFromFirebase();
        lastUserSync = now;
      }
      
      if (now - lastPing > PING_INTERVAL) {
        if (Firebase.ready()) {
          Firebase.RTDB.set(&fbdo, "/status/esp32/last_ping", getCurrentTimeRTC());
          Firebase.RTDB.set(&fbdo, "/status/esp32/ip", WiFi.localIP().toString());
        }
        lastPing = now;
      }
    } else {
      if (isOnline) {
        isOnline = false;
        Serial.println("⚠️ WiFi lost");
        sendBLEMessage("⚠️ WiFi lost, reconnecting...");
      }
      
      // Attempt reconnect
      if (millis() - lastReconnect > RECONNECT_INTERVAL) {
        WiFi.disconnect();
        WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
        lastReconnect = millis();
        Serial.println("🔄 Reconnecting...");
      }
    }
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
    sendBLEMessage("📝 Register ID: " + String(currentID));
    
    String defaultNama = "Siswa" + String(currentID);
    String defaultKelas = "X";
    String defaultJurusan = "RPL";
    int defaultDelay = globalDelayMinutes;
    
    int result = enrollFingerprint(currentID);
    
    if (result == FINGERPRINT_OK) {
      saveUserToSD(currentID, defaultNama, defaultKelas, defaultJurusan, defaultDelay);
      
      if (isOnline && Firebase.ready()) {
        FirebaseJson json;
        json.set("id", currentID);
        json.set("nama", defaultNama);
        json.set("kelas", defaultKelas);
        json.set("jurusan", defaultJurusan);
        json.set("delayOut", defaultDelay);
        Firebase.RTDB.set(&fbdo, "users/" + String(currentID), &json);
      }
      
      sendBLEMessage("✅ Success ID " + String(currentID));
      Serial.printf("✅ Enroll success ID: %d, delay=%d min\n", currentID, defaultDelay);
      currentID++;
      saveSettings();
    } else {
      sendBLEMessage("❌ Enroll failed, try again");
      Serial.printf("❌ Enroll failed, code: %d\n", result);
    }
    
    isEnrolling = false;
    delay(500);
  }

  delay(10);
}