const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function loadUsers() {
  db.ref("users").once("value")
    .then(snapshot => {
      const users = snapshot.val();
      const table = document.getElementById("usersTable");
      table.innerHTML = "";

      if (!users) {
        table.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data</td></tr>`;
        return;
      }

      for (let key in users) {
        if (users.hasOwnProperty(key)) {
          const user = users[key];
          const name = user.name || "";   // ✅ gunakan field "name"
          const role = user.role || "";

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${key}</td>
            <td>${user.email || ""}</td>
            <td>${user.password || ""}</td>
            <td>${name}</td>
            <td>${role}</td>
            <td class="btn-container">
              <button class="edit-btn" onclick="editUser('${key}')">Edit</button>
              <button class="key-btn" onclick="ubahKey('${key}', '${user.email}')">Ubah Key</button>
              <button class="delete-btn" onclick="deleteUser('${key}')">Delete</button>
            </td>
          `;
          table.appendChild(row);
        }
      }
    })
    .catch(error => {
      console.error("Error membaca data:", error);
      const table = document.getElementById("usersTable");
      table.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error: ${error.message}</td></tr>`;
    });
}

function editUser(key) {
  const table = document.getElementById("usersTable");
  const row = [...table.rows].find(r => r.cells[0].innerText === key);
  if (!row) return;

  const email = row.cells[1].innerText;
  const password = row.cells[2].innerText;
  const name = row.cells[3].innerText;   // ✅ ambil dari "name"
  const role = row.cells[4].innerText;

  row.cells[1].innerHTML = `<input type="text" value="${email}" id="email_${key}">`;
  row.cells[2].innerHTML = `<input type="text" value="${password}" id="password_${key}">`;
  row.cells[3].innerHTML = `<input type="text" value="${name}" id="name_${key}">`;
  row.cells[4].innerHTML = `
    <select id="role_${key}">
      <option value="admin" ${role === "admin" ? "selected" : ""}>admin</option>
      <option value="user" ${role === "user" ? "selected" : ""}>user</option>
      <option value="karyawan" ${role === "karyawan" ? "selected" : ""}>karyawan</option>
    </select>
  `;
  row.cells[5].innerHTML = `<button class="edit-btn" onclick="saveUser('${key}')">Simpan</button>`;
}

function saveUser(key) {
  const email = document.getElementById(`email_${key}`).value;
  const password = document.getElementById(`password_${key}`).value;
  const name = document.getElementById(`name_${key}`).value;   // ✅ update ke "name"
  const role = document.getElementById(`role_${key}`).value;

  if (!email || !password) {
    alert("Email dan Password tidak boleh kosong!");
    return;
  }

  db.ref("users/" + key).update({
    email: email,
    password: password,
    name: name,   // ✅ konsisten pakai "name"
    role: role
  }, error => {
    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else {
      alert("Data berhasil diperbarui!");
      loadUsers();
    }
  });
}

function ubahKey(oldKey, email) {
  if (!email) return alert("Email tidak valid!");
  const newKey = email.replace(/\./g, "_");
  if (oldKey === newKey) return alert("Key sudah sesuai email!");

  db.ref("users/" + oldKey).once("value")
    .then(snapshot => {
      const userData = snapshot.val();
      if (!userData) return alert("Data user tidak ditemukan!");

      db.ref("users/" + newKey).set(userData, error => {
        if (error) {
          alert("Gagal mengubah key: " + error.message);
        } else {
          db.ref("users/" + oldKey).remove();
          alert("Key berhasil diubah menjadi: " + newKey);
          loadUsers();
        }
      });
    })
    .catch(error => {
      console.error("Error ubah key:", error);
      alert("Error ubah key: " + error.message);
    });
}

function deleteUser(key) {
  if (!confirm(`Apakah yakin ingin menghapus user dengan key "${key}"?`)) return;

  db.ref("users/" + key).remove(error => {
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      alert("User berhasil dihapus!");
      loadUsers();
    }
  });
}

// Load data awal
loadUsers();