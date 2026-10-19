// ============================================
// KONFIGURASI
// ============================================
const SUPABASE_URL = "https://gipuosbszwhqhaozljqr.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHVvc2JzendnaHFhb3psanFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ5NjMsImV4cCI6MjEwNzk5MDk2M30.XvaP7AYoVzPUQqvAl34OgkLWk5yF4ReFDLMWoHp0q_I";
const BUCKET = "memories";
// ============================================
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
openUploadBtn.addEventListener("click", () => {
  uploadModal.classList.add("active");
});
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

// --- UPLOAD FOTO KE SUPABASE ---
function generateFileName(file) {
  const ext = file.name.split(".").pop();
  return `memory-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
}

async function uploadPhoto(file) {
  const fileName = generateFileName(file);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": file.type
    },
    body: file
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload foto gagal: ${errorText}`);
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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Simpan ke database gagal: ${errorText}`);
  }
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
  submitBtn.querySelector("span").textContent = "⏳ Mengupload...";
  showStatus("Sedang upload foto & menyimpan...", "");

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
      gallery.innerHTML = '<p class="loading">Belum ada kenangan. Yuk klik tombol Tambah di atas! 💕</p>';
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
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("active");
});

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

// --- JALANKAN ---
createHearts();
loadMemories();
