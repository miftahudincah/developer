// Konfigurasi Firebase
const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Ambil data relay
const relayRef = db.ref("relay");

relayRef.on("value", (snapshot) => {
  const data = snapshot.val();
  const relayTable = document.getElementById("relayTable");
  relayTable.innerHTML = "";

  Object.keys(data).forEach((key) => {
    let inputField;

    if (key.toLowerCase() === "history") {
      // history = textarea auto-expand
      inputField = `<textarea id="input-${key}" class="histori" 
        oninput="autoExpand(this)">${data[key]}</textarea>`;
    } else {
      // status & lock = input biasa
      inputField = `<input type="text" id="input-${key}" class="${key.toLowerCase()}" value="${data[key]}">`;
    }

    relayTable.innerHTML += `
      <tr>
        <td>${key}</td>
        <td>${inputField}</td>
        <td>
          <button class="update-btn" onclick="updateValue('${key}')">Update</button>
        </td>
      </tr>
    `;
  });

  // auto expand setelah load
  document.querySelectorAll("textarea").forEach(autoExpand);
});

// Fungsi update
function updateValue(key) {
  const newValue = document.getElementById(`input-${key}`).value;
  db.ref("relay/" + key).set(newValue)
    .then(() => alert(`Data ${key} berhasil diperbarui!`))
    .catch((err) => alert("Error: " + err));
}

// Auto expand textarea
function autoExpand(el) {
  el.style.height = "auto"; 
  el.style.height = (el.scrollHeight) + "px";
}