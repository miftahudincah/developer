// === Proteksi halaman dengan localStorage ===
if (localStorage.getItem("loggedIn") !== "true") {
  window.location.href = "index.html";
}

// Konfigurasi Firebase
const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const chatTable = document.getElementById("chatTable");

// Fungsi logout
function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "index.html";
}

// Fungsi hapus chat berdasarkan key
function hapusChat(key) {
  if (confirm("Yakin mau hapus chat ini?")) {
    db.ref("chat/" + key).remove();
  }
}

// Load data chat
function loadChat() {
  db.ref("chat").on("value", (snapshot) => {
    chatTable.innerHTML = "";
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const key = child.key;
        const data = child.val();
        const user = data.user || "-";
        const pesan = data.message || "-";
        const waktu = data.time || "-";

        const row = `
          <tr>
            <td>${user}</td>
            <td>${pesan}</td>
            <td>${waktu}</td>
            <td><button class="hapus" onclick="hapusChat('${key}')">Hapus</button></td>
          </tr>
        `;
        chatTable.innerHTML += row;
      });
    } else {
      chatTable.innerHTML = `<tr><td colspan="4">Belum ada chat</td></tr>`;
    }
  });
}

// Jalankan saat halaman dibuka
loadChat();
