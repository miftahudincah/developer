const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Elements
const loginPage = document.getElementById("loginPage");
const adminPage = document.getElementById("adminPage");
const tableBody = document.querySelector("#dataTable tbody");
const validNameTableBody = document.querySelector("#validNameTable tbody");
const errorMsg = document.getElementById("errorMsg");

// Auto-login
if(localStorage.getItem("adminLoggedIn") === "true") {
  showDashboard();
} else {
  loginPage.classList.remove("hidden");
}

// Login Admin
function loginAdmin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  errorMsg.textContent = "";

  if(!email || !password) {
    errorMsg.textContent = "Email dan Password wajib diisi!";
    return;
  }

  db.ref("/users").orderByChild("email").equalTo(email).once("value", snapshot => {
    if(!snapshot.exists()) {
      errorMsg.textContent = "Email tidak ditemukan!";
      return;
    }

    let userData;
    snapshot.forEach(child => userData = child.val());

    if(userData.password !== password) {
      errorMsg.textContent = "Password salah!";
      return;
    }

    if(userData.role !== "admin") {
      errorMsg.textContent = "Hanya admin yang bisa masuk!";
      return;
    }

    localStorage.setItem("adminLoggedIn", "true");
    showDashboard();
  });
}

// Logout
function logout() {
  localStorage.removeItem("adminLoggedIn");
  adminPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
}

// Tampilkan Dashboard
function showDashboard() {
  loginPage.classList.add("hidden");
  adminPage.classList.remove("hidden");
  tampilkanDataRealtime();
  tampilkanValidNameRealtime();
}

// CRUD Pengguna
function tampilkanDataRealtime() {
  db.ref("/users").on("value", snapshot => {
    tableBody.innerHTML = "";
    snapshot.forEach(childSnapshot => {
      const key = childSnapshot.key;
      const { name, email, password, role } = childSnapshot.val();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input class="editable" type="text" value="${name}" onchange="ubahNama('${key}', this.value)" /></td>
        <td>${email}</td>
        <td>${password}</td>
        <td>
          <select onchange="ubahRole('${key}', this.value)">
            <option value="user" ${role === "user" ? "selected" : ""}>User</option>
            <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </td>
        <td>
          <button class="btn-delete" onclick="hapusPengguna('${key}')">Hapus</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  });
}

function tambahPengguna() {
  const name = document.getElementById("newName").value.trim();
  const email = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPassword").value.trim();
  const role = document.getElementById("newRole").value;

  if(!name || !email || !password) return alert("Semua field wajib diisi!");

  db.ref("/validNames").orderByChild("name").equalTo(name).once("value", snapshot => {
    let valid = false;
    snapshot.forEach(child => { if(child.val().active) valid = true; });

    if(!valid) {
      alert("Nama tidak valid atau tidak aktif.");
      return;
    }

    const newKey = db.ref("/users").push().key;
    db.ref("/users/" + newKey).set({ name, email, password, role })
      .then(() => {
        document.getElementById("newName").value = "";
        document.getElementById("newEmail").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("newRole").value = "user";
      });
  });
}

function ubahNama(key, newName) {
  db.ref("/users/" + key + "/name").set(newName)
    .catch(err => alert("Gagal ubah nama: " + err));
}

function ubahRole(key, newRole) {
  db.ref("/users/" + key + "/role").set(newRole)
    .catch(err => alert("Gagal ubah role: " + err));
}

function hapusPengguna(key) {
  if(confirm("Yakin ingin menghapus pengguna ini?")) {
    db.ref("/users/" + key).remove()
      .catch(err => alert("Gagal hapus pengguna: " + err));
  }
}

// CRUD Valid Names
function tampilkanValidNameRealtime() {
  db.ref("/validNames").on("value", snapshot => {
    validNameTableBody.innerHTML = "";
    snapshot.forEach(childSnapshot => {
      const key = childSnapshot.key;
      const { name, active } = childSnapshot.val();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input class="editable" type="text" value="${name}" onchange="ubahValidName('${key}', this.value)" /></td>
        <td>
          <button class="toggle-active ${active ? 'active' : ''}" onclick="toggleActive('${key}', ${active})">
            ${active ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td><button class="btn-delete" onclick="hapusValidName('${key}')">Hapus</button></td>
      `;
      if(active) validNameTableBody.appendChild(row); // tampilkan hanya active
    });
  });
}

function tambahValidName() {
  const name = document.getElementById("newValidName").value.trim();
  if(!name) return alert("Nama Valid wajib diisi!");
  const newKey = db.ref("/validNames").push().key;
  db.ref("/validNames/" + newKey).set({ name, active: true })
    .then(() => document.getElementById("newValidName").value = "")
    .catch(err => alert("Gagal tambah valid name: " + err));
}

function ubahValidName(key, newName) {
  db.ref("/validNames/" + key + "/name").set(newName)
    .catch(err => alert("Gagal ubah valid name: " + err));
}

function hapusValidName(key) {
  if(confirm("Yakin ingin menghapus valid name ini?")) {
    db.ref("/validNames/" + key).remove()
      .catch(err => alert("Gagal hapus valid name: " + err));
  }
}

function toggleActive(key, current) {
  db.ref("/validNames/" + key + "/active").set(!current)
    .catch(err => alert("Gagal toggle active: " + err));
}
