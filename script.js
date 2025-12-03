// --- GEMINI API CONFIGURATION ---
const apiKey = "ISI_KUNCI_API_ANDA_DI_SINI"; // !!! PENTING: Ganti dengan kunci API Gemini Anda
// Menggunakan model yang mendukung multimodal (text dan gambar)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// Kunci Intruksi (System Prompt) yang Anda minta
const systemPrompt = "Anda adalah prompt engineering profesional tingkat dunia. Tugas Anda adalah mengubah ide mentah pengguna menjadi SATU prompt yang sangat jelas, berkualitas tinggi, dan siap pakai untuk SEMUA model AI. Hasilkan HANYA 5 prompt profesional final yang terpisah. JANGAN sertakan penjelasan atau teks tambahan di luar 5 prompt tersebut. Format output Anda sebagai daftar berpoin. Berikan label pada setiap prompt secara eksplisit seperti 'Prompt ke-1: [isi prompt]', 'Prompt ke-2: [isi prompt]', dst. Jika ada gambar, gunakan gambar tersebut sebagai konteks utama untuk rekayasa prompt.";

// --- GLOBAL STATE ---
let currentSessionId = localStorage.getItem('xnarraCurrentSession') || null;
let isSending = false;
let selectedFiles = []; // Array of File objects
const MAX_FILES = 2; // BATAS MAKSIMUM UPLOAD FOTO

// Fungsi utilitas untuk mendapatkan ID Pengguna unik untuk localStorage
function getUserId() {
    let id = localStorage.getItem('xnarraUserId');
    if (!id) {
        id = 'user-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        localStorage.setItem('xnarraUserId', id);
    }
    return id;
}
const userId = getUserId(); 

// --- UTILITY FUNCTIONS ---

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    // Hapus kelas dark theme dari toast, gunakan default terang
    toast.style.backgroundColor = '#333';
    toast.style.color = '#fff';
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fungsi untuk mengkonversi File object menjadi Base64
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            data: reader.result.split(',')[1], // Base64 data part
            mimeType: file.type
        });
        reader.onerror = error => reject(error);
    });
}

function autoResizeTextarea() {
    const textarea = document.getElementById('chat-textarea');
    // Batasi pertumbuhan tinggi maksimum
    const maxHeight = 192; // max-h-48 (48 * 4px = 192px)
    
    textarea.style.height = 'auto';
    let newHeight = textarea.scrollHeight;

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        textarea.style.overflowY = 'auto';
    } else {
         textarea.style.overflowY = 'hidden';
    }
    
    textarea.style.height = newHeight + 'px';
}

function updateSendButton() {
    const textarea = document.getElementById('chat-textarea');
    const sendBtn = document.getElementById('send-btn');
    const hasText = textarea.value.trim() !== '';
    const hasImages = selectedFiles.length > 0; // Cek keberadaan gambar

    const isDisabled = (!hasText && !hasImages) || isSending;
    
    sendBtn.disabled = isDisabled;
    // Gunakan opacity untuk feedback visual yang lebih baik
    sendBtn.style.opacity = isDisabled ? '0.5' : '1';
}

/**
 * Fungsi untuk menyalin teks prompt ke clipboard.
 */
const copyPromptContent = async (buttonElement, targetId) => {
    const promptElement = document.getElementById(targetId);
    if (!promptElement) {
        showToast("Error: Konten prompt tidak ditemukan.");
        return;
    }
    
    const text = promptElement.textContent.trim();
    
    // Simpan HTML asli (Ikon Copy dan teks)
    const originalIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
    `;
     const originalHTML = `${originalIcon}<span class="copy-text">Copy</span>`;
    
    // Ikon Ceklis Centang (Perubahan visual yang diminta)
    const successIcon = `
         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
         </svg>
    `;
    
    buttonElement.focus();
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed'; 
            textarea.style.opacity = 0;
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Gagal menyalin menggunakan execCommand:', err);
                throw new Error('Gagal menyalin ke clipboard.');
            } finally {
                document.body.removeChild(textarea);
            }
        }
        
        // Feedback visual Sukses: Ubah tombol menjadi 'Tersalin!' dengan ikon centang
        buttonElement.classList.remove('text-black', 'bg-white', 'border-gray-300', 'hover:bg-gray-100');
        buttonElement.classList.add('bg-green-500', 'hover:bg-green-600', 'text-white', 'border-green-600');
        buttonElement.innerHTML = `${successIcon}<span class="copy-text">Tersalin!</span>`;

    } catch (err) {
        console.error('Gagal menyalin:', err);
        // Feedback visual Gagal
        buttonElement.classList.remove('text-black', 'bg-white', 'border-gray-300', 'hover:bg-gray-100');
        buttonElement.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'border-red-600');
        buttonElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            <span class="copy-text">Gagal!</span>
        `;
    }

    // Kembalikan tombol ke keadaan semula setelah 2 detik
    setTimeout(() => {
        buttonElement.classList.remove('bg-green-500', 'hover:bg-green-600', 'text-white', 'border-green-600', 'bg-red-500', 'hover:bg-red-600', 'border-red-600');
        buttonElement.classList.add('text-black', 'bg-white', 'border-gray-300', 'hover:bg-gray-100');
        buttonElement.innerHTML = originalHTML; 
    }, 2000);
};
window.copyPromptContent = copyPromptContent;


// --- FILE UPLOAD LOGIC (DIUBAH UNTUK BATAS 2 FILE) ---

function handleFileChange(input) {
    const newFiles = Array.from(input.files);
    
    // Hitung total file setelah penambahan
    const totalFilesAfterAddition = newFiles.length + selectedFiles.length;
    
    // Cek Batas Maksimum 2 Foto
    if (totalFilesAfterAddition > MAX_FILES) {
        // Tampilkan pesan kesalahan yang spesifik
        showToast(`Maksimum ${MAX_FILES} foto diperbolehkan. Hapus yang lama atau pilih lebih sedikit file.`);
        input.value = ''; // Reset input file
        return;
    }

    // Tambahkan file baru ke state, pastikan tidak melebihi batas
    newFiles.forEach(file => {
        if (file.type.startsWith('image/') && selectedFiles.length < MAX_FILES) {
            selectedFiles.push(file);
        }
    });

    input.value = ''; // Reset input file
    
    renderImagePreviews();
    updateSendButton();
    updateAttachButton(); // Panggil fungsi untuk update status tombol attach
}

window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    renderImagePreviews();
    updateSendButton();
    updateAttachButton(); // Panggil fungsi untuk update status tombol attach
}

function updateAttachButton() {
    const attachBtn = document.getElementById('attach-btn');
    const canAttach = selectedFiles.length < MAX_FILES;
    
    attachBtn.disabled = !canAttach;
    attachBtn.title = canAttach ? "Tambahkan foto" : `Batas maksimum ${MAX_FILES} foto tercapai.`;
}


function renderImagePreviews() {
    const container = document.getElementById('image-preview-container');
    container.innerHTML = '';

    if (selectedFiles.length === 0) {
        container.classList.add('hidden');
        container.classList.remove('border-b', 'border-gray-100');
        return;
    }
    
    container.classList.remove('hidden');
    container.classList.add('border-b', 'border-gray-100');

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewEl = document.createElement('div');
            // Styling Grok: kecil, rounded, dengan tombol hapus kecil
            previewEl.className = 'relative inline-block border border-gray-200 rounded-lg overflow-hidden flex-shrink-0';
            
            previewEl.innerHTML = `
                <img src="${e.target.result}" alt="Preview" class="h-16 w-16 object-cover rounded-md shadow-sm">
                <button onclick="removeFile(${index})" 
                        class="absolute top-0 right-0 p-1 bg-black/50 hover:bg-black/70 rounded-bl-lg text-white transition leading-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm3.71 7.29a1 1 0 0 0-1.42 0L12 10.59l-2.29-2.3a1 1 0 0 0-1.42 1.42L10.59 12l-2.3 2.29a1 1 0 0 0 1.42 1.42L12 13.41l2.29 2.3a1 1 0 0 0 1.42-1.42L13.41 12l2.3-2.29a1 1 0 0 0 0-1.42z"/></svg>
                </button>
            `;
            container.appendChild(previewEl);
        };
        reader.readAsDataURL(file);
    });
}


// --- LOCAL STORAGE DATA HANDLING ---

function loadAllSessions() {
    try {
        const sessions = JSON.parse(localStorage.getItem('xnarraSessions')) || [];
        return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch (e) {
        console.error("Error loading sessions from localStorage", e);
        return []; 
    }
}

function saveAllSessions(sessions) {
    localStorage.setItem('xnarraSessions', JSON.stringify(sessions));
}

function loadMessages(sessionId) {
    if (!sessionId) return [];
    try {
        return JSON.parse(localStorage.getItem(`xnarraMessages_${sessionId}`)) || [];
    } catch (e) {
        console.error(`Error loading messages for session ${sessionId}`, e);
        return [];
    }
}

function saveMessages(sessionId, messages) {
    if (!sessionId) return;
    localStorage.setItem(`xnarraMessages_${sessionId}`, JSON.stringify(messages));
}

// --- THEME LOGIC (DISIMPLIFIKASI HANYA TEMA TERANG) ---

function setTheme(theme) {
    // Memaksa tema menjadi 'light'
    const finalTheme = 'light'; 
    document.body.className = '';
    document.body.classList.add(`theme-${finalTheme}`);
    localStorage.setItem('xnarraTheme', finalTheme);
    
    // Hanya aktifkan opsi 'light' di pengaturan
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.remove('active'); 
        if (el.getAttribute('data-theme') === finalTheme) {
            el.classList.add('active');
        }
    });
}

function loadTheme() {
    // Selalu muat tema terang
    setTheme('light');
}

// --- DRAWER & PROFILE LOGIC ---

function toggleDrawer(open) {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (open) {
        drawer.classList.add('open');
        overlay.classList.remove('hidden');
    } else {
        drawer.classList.remove('open');
        overlay.classList.add('hidden');
    }
}

function openDrawer() { loadHistory(); toggleDrawer(true); } 
function closeDrawer() { toggleDrawer(false); }

function openProfile() {
    document.getElementById('ask-content').classList.add('hidden'); 
    document.getElementById('bottom-bar').classList.add('hidden');

    document.getElementById('profile-page').classList.remove('hidden');
    document.getElementById('profile-header').classList.remove('hidden');
    document.getElementById('main-header').classList.add('hidden');
    
    document.getElementById('current-user-id').textContent = userId;
    loadTheme();
    closeDrawer();
}

function closeProfile() {
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('profile-header').classList.add('hidden');
    
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('bottom-bar').classList.remove('hidden');
    document.getElementById('ask-content').classList.remove('hidden'); 
    
    renderMessages(); 
}

/**
 * Parses the AI response text (expected to be 5 bulleted prompts) into an array of objects.
 */
function parsePrompts(responseText) {
    // Memisahkan berdasarkan baris, memfilter baris yang dimulai dengan bullet atau angka, dan membatasi hingga 5
    const promptLines = responseText.split('\n')
        .map(line => line.trim())
        .filter(line => line.match(/^[*-]\s*|^\d+\.\s*|^Prompt\s+ke-\d+:/i)) // Memastikan kita hanya menangkap baris yang terlihat seperti prompt
        .slice(0, 5); 

    if (promptLines.length > 0) {
         // Jika ada setidaknya 1 prompt yang terurai, gunakan mode prompt
        return promptLines.map((line, index) => {
            let content = line.trim();
            let title = `Prompt ke-${index + 1}`;
            
            // Regex untuk membersihkan bullet points atau nomor
            content = content.replace(/^[*-]\s*|^[0-9]+\.\s*/, '').trim();

            // Regex untuk mendeteksi dan membersihkan judul eksplisit (misal: "Prompt ke-1:")
            const titleMatch = content.match(/^(Prompt\s+ke-\d+:\s*)/i);

            if (titleMatch) {
                title = titleMatch[1].trim().replace(':', '');
                content = content.substring(titleMatch[1].length).trim();
            } else if (content.startsWith('Prompt ke-')) {
                // Handle case where it starts with 'Prompt ke-X' but no colon
                const basicTitleMatch = content.match(/^(Prompt\s+ke-\d+)/i);
                if(basicTitleMatch) {
                    title = basicTitleMatch[1];
                    content = content.substring(basicTitleMatch[1].length).trim();
                }
            }

            // Membersihkan tanda kutip di awal dan akhir konten
            content = content.replace(/^["']|["']$/g, '').trim();

            return {
                id: `prompt-${Date.now()}-${index}`,
                title: title,
                content: content
            };
        });
    }

    // Fallback: If parsing fails or is empty, return as a single, unparsed text response.
    return [{
        id: `prompt-single-${Date.now()}`,
        title: "Respons AI",
        content: responseText,
        isSingle: true 
    }];
}

// --- CHAT UI RENDERING (FIXED FOR IMAGE/TEXT USER MESSAGE AND COMPACT PROMPT CARDS) ---

function createMessageElement(message) {
    if (message.role === 'user') {
        // message.data: { text: "...", images: [{data, mimeType}, ...] }
        const { text, images } = message.data; 
        
        const container = document.createElement('div');
        container.className = 'user-message-container'; 
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'user-message-content flex flex-col items-start gap-2'; 
        
        const hasText = text && text.trim().length > 0;
        const hasImages = images && images.length > 0;

        // 1. Render Images
        if (hasImages) {
            const imageContainer = document.createElement('div');
            // Tambahkan border bawah hanya jika ada teks
            imageContainer.className = `flex flex-wrap gap-1 w-full ${hasText ? 'pb-2 border-b border-gray-300' : ''}`;
            
            images.forEach(img => {
                const imgElement = document.createElement('img');
                imgElement.src = `data:${img.mimeType};base64,${img.data}`; 
                imgElement.alt = "User attachment";
                imgElement.className = 'h-16 w-16 object-cover rounded-md shadow-sm'; 
                imageContainer.appendChild(imgElement);
            });
            contentDiv.appendChild(imageContainer);
        }

        // 2. Render Text
        if (hasText) {
            const textElement = document.createElement('span');
            textElement.textContent = text;
            contentDiv.appendChild(textElement);
        } else if (!hasText && hasImages) {
            // Jika hanya ada gambar, tambahkan teks default agar kotak pesan tidak kosong
            const textElement = document.createElement('span');
            textElement.textContent = "Mengirimkan gambar...";
            textElement.classList.add('text-gray-500', 'italic');
            contentDiv.appendChild(textElement);
        }
        
        // Jika tidak ada teks maupun gambar, ini adalah pesan kosong (seharusnya tidak terjadi)
        if (hasText || hasImages) {
             container.appendChild(contentDiv);
             return container;
        }
        return null;


    } else if (message.role === 'ai') {
        // message.data: array of prompt objects
        const prompts = message.data;
        
        const container = document.createElement('div');
        // ai-message-container now uses block flow (vertical stacking)
        container.className = 'ai-message-container'; 

        // FIX: Avatar (X) di baris pertama
        const avatar = document.createElement('div');
        avatar.className = 'x-logo-transparent'; // Uses block flow
        avatar.textContent = 'X';
        
        // FIX: Content Box (Prompts) di baris kedua
        const contentBox = document.createElement('div');
        // FIX: Mengurangi space-y-3 menjadi space-y-2 (dari 12px menjadi 8px gap)
        contentBox.className = 'ai-content-box w-full space-y-2'; 
        
        // --- 2. RENDER PROMPTS ---
        
        // Tambahkan header khusus jika berhasil diurai menjadi 5 prompt
        if (prompts.length === 5 && !prompts[0].isSingle) {
             const header = document.createElement('p');
             header.className = 'text-sm font-semibold text-black text-left py-3 px-4 rounded-xl mb-2 bg-gray-100 w-full shadow-lg';
             header.textContent = "Silakan pilih prompt yang Anda suka untuk dikembangkan lebih lanjut:";
             contentBox.appendChild(header);
        }
        
        prompts.forEach((prompt, index) => {
             const isSingleFallback = prompt.isSingle || prompts.length === 1;
             const uniqueId = prompt.id || `prompt-${Date.now()}-${index}`;

             const card = document.createElement('div');
             // PERUBAHAN KRUSIAL UNTUK UKURAN KARTU YANG LEBIH KECIL: Mengurangi p-3 menjadi p-2 (8px)
             card.className = 'prompt-card bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-md';
             
             const cardTitle = isSingleFallback ? 'Respons AI' : (prompt.title || `Prompt ke-${index + 1}`);

             card.innerHTML = `
                 <div class="flex justify-between items-start mb-2 border-b pb-1.5 border-gray-200">
                     <span class="text-xs font-bold uppercase text-black">${cardTitle}</span>

                     <button onclick="copyPromptContent(this, '${uniqueId}')"
                             class="copy-button flex items-center px-1.5 py-0.5 text-xs font-medium text-black bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition duration-150 ease-in-out whitespace-nowrap">
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                         </svg>
                         <span class="copy-text">Copy</span>
                     </button>
                 </div>

                 <pre id="${uniqueId}" class="prompt-text text-sm whitespace-pre-wrap overflow-x-auto text-black leading-relaxed">
                     ${prompt.content || ''}
                 </pre>
             `;
             contentBox.appendChild(card);
        });
        
        // Tambahkan avatar dan contentBox ke container
        container.appendChild(avatar);
        container.appendChild(contentBox);
        
        return container;
    }
    return null;
}

// --- CHAT SESSION MANAGEMENT ---

function startNewSession() {
    const sessions = loadAllSessions();
    const newSessionId = 'session-' + Date.now();
    const newSession = {
        id: newSessionId,
        title: 'Sesi Baru Tanpa Judul',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
    
    sessions.unshift(newSession); 
    saveAllSessions(sessions);
    saveMessages(newSessionId, []); 
    
    // Clear temporary image state when starting a new session
    selectedFiles = [];
    renderImagePreviews();
    updateAttachButton(); // Update status tombol attach

    loadSession(newSessionId);
    showToast("Sesi baru dimulai!");
    closeDrawer(); 
}

function loadSession(sessionId) {
    if (!sessionId) {
        console.error("Attempted to load null session ID.");
        return;
    }
    
    currentSessionId = sessionId;
    localStorage.setItem('xnarraCurrentSession', sessionId);
    
    // Clear temporary image state when loading a different session
    selectedFiles = [];
    renderImagePreviews();
    updateAttachButton(); // Update status tombol attach

    loadHistory(); 
    renderMessages(); 
    closeDrawer();
}

function updateSessionTitle(sessionId, firstMessageData) {
    let sessions = loadAllSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1 && sessions[sessionIndex].title === 'Sesi Baru Tanpa Judul') {
        let title = firstMessageData.text.trim();
        
        if (!title) {
            // Jika tidak ada teks, gunakan deskripsi gambar (jika ada)
            title = firstMessageData.images.length > 0 ? `Ide dari ${firstMessageData.images.length} Gambar` : "Sesi Kosong";
        }
        
        title = title.substring(0, 50) + (title.length > 50 ? '...' : '');
        sessions[sessionIndex].title = title;
        sessions[sessionIndex].lastUpdated = Date.now();
        saveAllSessions(sessions);
        loadHistory(); 
    }
}

function updateSessionTimestamp(sessionId) {
    let sessions = loadAllSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
        sessions[sessionIndex].lastUpdated = Date.now();
        saveAllSessions(sessions);
        loadHistory();
    }
}

async function addMessageToSession(role, data) {
    if (!currentSessionId) {
        startNewSession(); 
    }
    
    const messages = loadMessages(currentSessionId);
    
    if (role === 'user' && typeof data === 'object' && data.text !== undefined) {
         messages.push({
            role: role,
            data: data, // { text: "...", images: [...] }
            createdAt: Date.now(),
        });
        saveMessages(currentSessionId, messages);
        
        // Cek apakah ini pesan pengguna pertama di sesi ini
        const userMessageCount = messages.filter(m => m.role === 'user').length;
        if (userMessageCount === 1) {
             updateSessionTitle(currentSessionId, data);
        } else {
             updateSessionTimestamp(currentSessionId);
        }
        
    } else if (role === 'ai') {
        messages.push({
            role: role,
            data: data, 
            createdAt: Date.now(),
        });
        saveMessages(currentSessionId, messages);
        updateSessionTimestamp(currentSessionId);
    }
    
    renderMessages();
}

// Memuat riwayat sesi ke dalam drawer
function loadHistory() {
    const sessions = loadAllSessions();
    const list = document.getElementById('history-list');
    list.innerHTML = ''; 

    if (sessions.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-500 p-4">Belum ada riwayat sesi.</p>`;
        return;
    }

    sessions.forEach(session => {
        const item = document.createElement('button');
        item.className = `session-item w-full flex flex-col items-start py-2 px-3 hover:bg-gray-100 transition ${session.id === currentSessionId ? 'active' : ''}`;
        item.setAttribute('data-session-id', session.id);
        item.onclick = () => loadSession(session.id);
        
        const title = document.createElement('span');
        title.className = 'font-medium text-sm text-left truncate w-full';
        title.textContent = session.title;

        const date = new Date(session.lastUpdated).toLocaleString('id-ID', {
            hour: '2-digit', 
            minute: '2-digit', 
            day: 'numeric', 
            month: 'short'
        });
        const dateSpan = document.createElement('span');
        dateSpan.className = 'text-xs text-gray-500';
        dateSpan.textContent = date;

        item.appendChild(title);
        item.appendChild(dateSpan);
        list.appendChild(item);
    });
}

// Merender pesan chat utama
function renderMessages() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    const initialLogo = document.getElementById('initial-logo-state-ask');
    
    let messages = [];
    if (currentSessionId) {
        messages = loadMessages(currentSessionId);
    } else {
        startNewSession();
        messages = loadMessages(currentSessionId);
    }
    
    if (messages.length === 0) {
        initialLogo.classList.remove('hidden');
        chatMessagesContainer.innerHTML = '';
        return;
    }

    initialLogo.classList.add('hidden');
    chatMessagesContainer.innerHTML = '';

    messages.forEach(message => {
        const element = createMessageElement(message);
        if (element) {
            chatMessagesContainer.appendChild(element);
        }
    });

    // Scroll ke bawah
    const mainContent = document.getElementById('ask-content');
    mainContent.scrollTop = mainContent.scrollHeight;
}

// --- CHAT CORE LOGIC (FIXED FOR IMAGE/TEXT PAYLOAD) ---

async function generateAiResponse(userQuery, imageParts = []) {
    if (!currentSessionId) {
         console.error("Sesi ID hilang saat mencoba generate AI response.");
         return;
    }
    
    // Tampilkan loading indicator
    document.getElementById('loading-indicator').classList.remove('hidden');
    const mainContent = document.getElementById('ask-content');
    mainContent.scrollTop = mainContent.scrollHeight; // Scroll ke bawah

    // Riwayat pesan (hanya ambil 2 pesan terakhir untuk konteks, jika ada)
    const allMessages = loadMessages(currentSessionId);
    const chatHistory = allMessages.filter(m => m.role !== 'ai')
                                   .map(m => {
                                        const parts = [];
                                        
                                        // Tambahkan gambar dari riwayat, jika ada (penting untuk multimodal)
                                        if (m.data.images && m.data.images.length > 0) {
                                            m.data.images.forEach(img => {
                                                parts.push({
                                                    inlineData: {
                                                        mimeType: img.mimeType,
                                                        data: img.data
                                                    }
                                                });
                                            });
                                        }
                                        
                                        // Tambahkan teks
                                        parts.push({ text: m.data.text || "" }); 
                                        
                                        return {
                                            role: m.role,
                                            parts: parts
                                        };
                                    });

    // Gantikan pesan terakhir di riwayat dengan payload saat ini
    // Jika ada gambar baru, gabungkan dengan teks saat ini.
    const userParts = [];
    
    if (imageParts.length > 0) {
        imageParts.forEach(img => {
            userParts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data
                }
            });
        });
    }
    
    let finalQuery = userQuery;
    if (!finalQuery && imageParts.length > 0) {
         finalQuery = `Berdasarkan ${imageParts.length} gambar yang disediakan, buatkan 5 prompt profesional untuk merekayasa atau menganalisis gambar-gambar ini.`;
    } else if (!finalQuery) {
        finalQuery = "Ide mentah kosong. Hasilkan 5 prompt umum.";
    }
    userParts.push({ text: finalQuery });

    chatHistory.push({ role: 'user', parts: userParts });


    const payload = {
        contents: chatHistory, 
        tools: [{ "google_search": {} }], 
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };
    
    // Logika Retry dengan Exponential Backoff
    const maxRetries = 3;
    let responseText = "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silakan coba lagi. (Gagal Jaringan)";

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                responseText = candidate.content.parts[0].text;
                break; 
            } else {
                throw new Error("Invalid response structure or no text content from AI.");
            }

        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) {
                responseText = `Maaf, terjadi kesalahan koneksi/API berulang kali: ${error.message}`;
            } else {
                // Exponential backoff
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Sembunyikan loading indicator
    document.getElementById('loading-indicator').classList.add('hidden');
    
    const parsedPrompts = parsePrompts(responseText);
    await addMessageToSession('ai', parsedPrompts);
}

async function sendMessage() {
    const textarea = document.getElementById('chat-textarea');
    const userText = textarea.value.trim();
    
    const hasImages = selectedFiles.length > 0;
    
    if ((!userText && !hasImages) || isSending) {
        return;
    }
    
    // --- 1. Prepare Data and UI State ---
    isSending = true;
    updateSendButton();
    
    const tempText = userText;
    const filesToSend = [...selectedFiles]; 

    // Clear UI inputs immediately
    textarea.value = ''; 
    selectedFiles = [];
    renderImagePreviews();
    autoResizeTextarea(); 

    // --- 2. Convert Files to Base64 (for Storage and API) ---
    const imageParts = [];
    if (filesToSend.length > 0) {
        for (const file of filesToSend) {
            try {
                const base64Data = await getBase64(file);
                imageParts.push(base64Data);
            } catch (e) {
                console.error("Gagal mengkonversi file ke Base64:", e);
                showToast(`Gagal memproses gambar: ${file.name}.`);
            }
        }
    }
    
    // Data structure for local storage/display
    const localMessageData = {
        text: tempText,
        images: imageParts // Array of {data, mimeType}
    };

    // --- 3. Store User Message & Render ---
    // Hanya simpan jika ada teks atau gambar yang valid
    if (localMessageData.text || localMessageData.images.length > 0) {
        await addMessageToSession('user', localMessageData);
    }
    
    // --- 4. Call API ---
    try {
        // Kirim teks dan base64 imageParts ke fungsi generate
        await generateAiResponse(tempText, imageParts); 

    } catch (error) {
        console.error("Error in sendMessage process:", error);
        showToast("Gagal mengirim pesan atau menerima respons.");
    } finally {
        isSending = false;
        renderMessages(); 
        updateSendButton(); 
        updateAttachButton(); // Update status tombol attach
    }
}


// --- INITIALIZATION ---

window.onload = function() {
    loadTheme();
    loadHistory(); 
    renderMessages(); 

    const textarea = document.getElementById('chat-textarea');
    const sendBtn = document.getElementById('send-btn');
    
    // Input Listener
    textarea.addEventListener('input', () => {
        autoResizeTextarea();
        updateSendButton();
    });
    textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Button Listeners
    sendBtn.addEventListener('click', sendMessage);
    document.getElementById('open-history-btn').addEventListener('click', openDrawer);
    document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
    
    document.querySelectorAll('.new-session-btn').forEach(btn => {
         btn.addEventListener('click', startNewSession);
    });
    
    document.getElementById('open-profile-btn').addEventListener('click', openProfile);
    document.getElementById('close-profile-btn').addEventListener('click', closeProfile);

    // Theme Selector Listeners
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const theme = e.currentTarget.getAttribute('data-theme');
            // Karena hanya ada 'light', ini akan selalu memanggil setTheme('light')
            setTheme(theme);
        });
    });
    
    updateSendButton();
    updateAttachButton(); // Panggil saat inisialisasi
    autoResizeTextarea(); 
};
