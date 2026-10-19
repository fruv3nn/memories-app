// ============================================
// KONFIGURASI
// ============================================
const SUPABASE_URL = "https://gipuosbszwghqaozljqr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHVvc2JzendnaHFhb3psanFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ5NjMsImV4cCI6MjEwNzk5MDk2M30.XvaP7AYoVzPUQqvAl34OgkLWk5yF4ReFDLMWoHp0q_I";
const BUCKET = "memories";
// ============================================

// DOM Elements
const uploadModal = document.getElementById("uploadModal");
const openUploadBtn = document.getElementById("openUploadBtn");
const closeUpload = document.getElementById("closeUpload");
const uploadForm = document.getElementById("uploadForm");
const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");
const gallery = document.getElementById("gallery");
const modal = document.getElementById("modal");

// --- MODAL UPLOAD LOGIC ---
openUploadBtn.addEventListener("click", () => uploadModal.classList.add("active"));
closeUpload.addEventListener("click", () => {
  uploadModal.classList.remove("active");
  statusMsg.textContent = "";
  statusMsg.className = "status";
});

// --- PREVIEW FOTO ---
photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return preview.innerHTML = "";
  const reader = new FileReader();
  reader.onload = (ev) => preview.innerHTML = `<img src="${ev.target.result}" alt="preview" />`;
  reader.readAsDataURL(file);
});

// --- FUNGSI KOMPRES & UBAH KE BASE64 ---
async function compressAndBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800; // Ukuran dikecilin biar ringan
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Ubah ke Data URL (Base64)
        const base64Data = canvas.toDataURL("image/jpeg", 0.6); 
        // Buang awalan "data:image/jpeg;base64,"
        resolve(base64Data.split(',')[1]); 
      };
      img.onerror = () => reject(new Error("File bukan gambar valid"));
    };
    reader.onerror = () => reject(new Error("Gagal baca file"));
  });
}

// --- UPLOAD VIA BASE64 (ANTI BLOKIR) ---
async function uploadPhoto(file) {
  showStatus("Mengompres & mengirim foto...", "");
  
  // 1. Ubah gambar jadi teks Base64
  const base64String = await compressAndBase64(file);
  const fileName = `memory-${Date.now()}.jpg`;
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`;

  // 2. Kirim sebagai Text Biasa (nggak bakal kena blokir browser)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "text/plain", // <--- KUNCI RAHASIANYA DI SINI
      "x-upsert": "true"
    },
    body: base64String // Kirim teksnya
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload gagal: ${errorText}`);
  }
  
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;
}

// --- SIMPAN KE DATABASE ---
async function saveMemory(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error("Gagal simpan ke database");
  return await res.json();
}

// --- SUBMIT FORM ---
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const memoryDate = document.getElementById("memoryDate").value || null;
  const file = photoInput.files[0];

  if (!title || !file) return showStatus("Judul & foto wajib diisi!", "error");

  submitBtn.disabled = true;
  submitBtn.querySelector("span").textContent = "⏳ Memproses...";

  try {
    const photoUrl = await uploadPhoto(file);
    await saveMemory({ title, description, photo_url: photoUrl, memory_date: memoryDate });
    
    showStatus("💕 Kenangan berhasil disimpan!", "success");
    uploadForm.reset();
    preview.innerHTML = "";
    
    setTimeout(() => { 
      uploadModal.classList.remove("active"); 
      statusMsg.textContent = "";
    }, 1500);
    
    await loadMemories();
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "💾 Simpan Kenangan";
  }
});

// --- LOAD GALERI ---
async function loadMemories() {
  gallery.innerHTML = '<p class="loading">Memuat kenangan...</p>';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/memories?select=*&order=created_at.desc`, {
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY
      }
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (!data.length) {
      gallery.innerHTML = '<p class="loading">Belum ada kenangan. Yuk klik Tambah! 💕</p>';
      return;
    }

    gallery.innerHTML = data.map(m => `
      <div class="memory-card" data-img="${m.photo_url}" data-title="${escapeHtml(m.title)}" data-desc="${escapeHtml(m.description || '')}" data-date="${m.memory_date || ''}">
        <img src="${m.photo_url}" alt="${escapeHtml(m.title)}" loading="lazy" />
        <div class="card-body">
          <h3>${escapeHtml(m.title)}</h3>
          <p class="date">${m.memory_date ? formatDate(m.memory_date) : formatDate(m.created_at)}</p>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".memory-card").forEach(card => {
      card.addEventListener("click", () => openDetailModal(card.dataset));
    });
  } catch (err) {
    gallery.innerHTML = `<p class="loading">Gagal memuat: ${escapeHtml(err.message)}</p>`;
  }
}

// --- MODAL DETAIL FOTO ---
function openDetailModal({ img, title, desc, date }) {
  document.getElementById("modalImg").src = img;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalDesc").textContent = desc || "(Tidak ada cerita)";
  document.getElementById("modalDate").textContent = date ? formatDate(date) : "";
  modal.classList.add("active");
}

document.getElementById("closeDetail").addEventListener("click", () => modal.classList.remove("active"));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });

// --- FUNGSI BANTUAN ---
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = "status " + type;
}

// --- FLOATING HEARTS ---
function createHearts() {
  const bg = document.getElementById("heartsBg");
  const hearts = ["💕", "💖", "💗", "💙", "✨", "🩷", "🩵"];
  for (let i = 0; i < 15; i++) {
    const h = document.createElement("div");
    h.className = "heart";
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.left = Math.random() * 100 + "%";
    h.style.animationDuration = (8 + Math.random() * 8) + "s";
    h.style.animationDelay = Math.random() * 8 + "s";
    h.style.fontSize = (1 + Math.random() * 1.5) + "rem";
    bg.appendChild(h);
  }
}

createHearts();
loadMemories();
