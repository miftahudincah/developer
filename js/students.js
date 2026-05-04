// Fungsi Helper untuk mengisi dropdown Filter Kelas & Jurusan
function populateStudentFilters() {
    // Ambil daftar kelas dan jurusan unik dari data
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();

    const kSelect = document.getElementById('filterStudentKelas');
    const jSelect = document.getElementById('filterStudentJurusan');

    // Isi option dropdown Kelas
    kSelect.innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');

    // Isi option dropdown Jurusan
    jSelect.innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
}

function renderStudentsTable() {
    const tbody = document.getElementById('tbody-students');
    const search = document.getElementById('searchStudentName').value.toLowerCase();
    
    // Ambil nilai filter Kelas dan Jurusan
    const fKelas = document.getElementById('filterStudentKelas').value;
    const fJurusan = document.getElementById('filterStudentJurusan').value;

    let data = dbData.users.filter(u => u.nama && u.nama.toLowerCase().includes(search));

    // Terapkan Filter Kelas (Jika tidak pilih 'all')
    if (fKelas !== 'all') {
        data = data.filter(u => u.kelas === fKelas);
    }

    // Terapkan Filter Jurusan (Jika tidak pilih 'all')
    if (fJurusan !== 'all') {
        data = data.filter(u => u.jurusan === fJurusan);
    }

    tbody.innerHTML = '';

    // Cek jika data kosong setelah difilter
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Data siswa tidak ditemukan.</td></tr>';
        return;
    }

    data.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>${s.id}</td><td>${s.nama}</td><td>${s.kelas}</td><td>${s.jurusan}</td><td>${s.delayOut}</td>
                <td><button class="btn-icon edit" onclick="editStudent('${s.id}')">✎</button>
                <button class="btn-icon delete" onclick="deleteStudent('${s.id}')">🗑</button></td>
            </tr>`;
    });
}

function saveStudent() {
    let idStr = document.getElementById('newId').value;
    const nama = document.getElementById('newNama').value;
    const kelas = document.getElementById('newKelas').value;
    const jurusan = document.getElementById('newJurusan').value;
    const delay = document.getElementById('newDelay').value;
    const mode = document.getElementById('editMode').value;

    if(!nama || !idStr) return showToast("ID & Nama wajib!", "error");
    
    const studentData = { nama, kelas, jurusan, delayOut: parseInt(delay) };
    const path = `users/${idStr}`;

    if (mode === 'add' && dbData.users.find(u => u.id == idStr)) return showToast("ID sudah ada!", "error");

    db.ref(path).set(studentData).then(() => {
        showToast("Data Tersimpan di Firebase");
        resetStudentForm();
    });
}

function deleteStudent(id) {
    if(!confirm("Hapus data siswa?")) return;
    db.ref(`users/${id}`).remove().then(() => showToast("Dihapus"));
}

function editStudent(id) {
    const s = dbData.users.find(u => u.id == id);
    if(s) {
        document.getElementById('newId').value = s.id; document.getElementById('newId').disabled = true;
        document.getElementById('newNama').value = s.nama;
        document.getElementById('newKelas').value = s.kelas;
        document.getElementById('newJurusan').value = s.jurusan;
        document.getElementById('newDelay').value = s.delayOut;
        document.getElementById('editMode').value = 'edit';
        document.getElementById('btnSaveStudent').innerHTML = '💾 Update';
        document.getElementById('btnCancelStudent').classList.remove('hidden');
    }
}

function resetStudentForm() {
    document.getElementById('newId').value = ''; document.getElementById('newId').disabled = false;
    document.getElementById('newNama').value = ''; document.getElementById('newKelas').value = '';
    document.getElementById('newJurusan').value = ''; document.getElementById('newDelay').value = '60';
    document.getElementById('editMode').value = 'add';
    document.getElementById('btnSaveStudent').innerHTML = '➕ Simpan Siswa';
    document.getElementById('btnCancelStudent').classList.add('hidden');
}