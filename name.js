// Konfigurasi Firebase
const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const namesTable = document.getElementById("namesTable");

// Fungsi ambil data validNames
db.ref("validNames").on("value", (snapshot) => {
  namesTable.innerHTML = ""; // kosongkan tabel

  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const key = child.key;
      const value = child.val(); // boolean true/false

      const row = `
        <tr>
          <td>${key}</td>
          <td>${value === true ? "True" : "False"}</td>
          <td>
            <button class="btn-edit" onclick="editName('${key}', ${value})">Edit</button>
            <button class="btn-delete" onclick="deleteName('${key}')">Delete</button>
          </td>
        </tr>
      `;
      namesTable.innerHTML += row;
    });
  } else {
    namesTable.innerHTML = `<tr><td colspan="3">Belum ada data</td></tr>`;
  }
});

// Fungsi Edit (toggle true/false)
function editName(key, currentValue) {
  const newValue = !currentValue; // toggle true <-> false
  db.ref("validNames/" + key).set(newValue)
    .then(() => alert(`Data ${key} berhasil diubah ke ${newValue}`))
    .catch((err) => alert("Error: " + err));
}

// Fungsi Delete
function deleteName(key) {
  if (confirm("Yakin ingin menghapus data " + key + "?")) {
    db.ref("validNames/" + key).remove()
      .then(() => alert(`Data ${key} berhasil dihapus`))
      .catch((err) => alert("Error: " + err));
  }
}