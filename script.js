// ATENÇÃO: Substitua pelo IP EXTERNO que aparece no painel do Google Cloud
const API_URL = "http://34.168.251.50"; 

function updateStatus(msg) {
    document.getElementById('statusMsg').innerText = "STATUS: > " + msg;
}

// ── CARREGAR TAREFAS ──
async function loadTasks() {
    updateStatus("Sincronizando VM...");
    try {
        const res = await fetch(`${API_URL}/tasks`);
        const tasks = await res.json();
        ['todo-list', 'doing-list', 'done-list'].forEach(id => document.getElementById(id).innerHTML = '');
        
        tasks.forEach(t => {
            renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType);
        });
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) {
        updateStatus("FALHA NA VM ❌");
    }
}

// ── REGISTRAR MISSÃO ──
async function createNewTask() {
    const editor = document.getElementById('editor');
    const fileInput = document.getElementById('fileInput');
    const text = editor.innerHTML.trim();
    
    if (!text && !fileInput.files[0]) return;

    updateStatus("Enviando para Python...");
    const formData = new FormData();
    formData.append('id', "card-" + Date.now());
    formData.append('text', text);
    formData.append('status', 'todo');
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    try {
        await fetch(`${API_URL}/save-task`, { method: 'POST', body: formData });
        updateStatus("MISSÃO GRAVADA ✅");
        editor.innerHTML = "";
        fileInput.value = "";
        document.getElementById('fileNameDisplay').innerText = "Sem anexo";
        loadTasks();
    } catch (e) {
        updateStatus("ERRO NO BACKEND ❌");
    }
}

// ── RENDERIZAR CARD (Mantendo seu estilo CSS) ──
function renderCard(id, text, status, url, name, type) {
    const list = document.getElementById(`${status}-list`);
    if (!list) return;

    const card = document.createElement('div');
    card.className = 'card hoverable';
    card.id = id;
    card.draggable = true;
    card.innerHTML = `
        <div class="card-actions">
            <button class="action-btn" onclick="deleteTask('${id}')"><span class="material-icons-round" style="font-size:14px;color:#ef4444">delete</span></button>
        </div>
        <div class="card-text">${text}</div>
        ${url ? `<div class="card-media-box"><div class="card-file-row"><div class="card-file-info"><div class="card-file-name">${name}</div></div><a href="${url}" target="_blank" class="card-download-btn">ABRIR</a></div></div>` : ''}
    `;
    list.appendChild(card);
}

// ── DELETAR ──
async function deleteTask(id) {
    if (!confirm("Excluir definitivamente?")) return;
    const formData = new FormData();
    formData.append('id', id);
    await fetch(`${API_URL}/delete-task`, { method: 'POST', body: formData });
    loadTasks();
}

// Helpers do seu editor
function execCmd(cmd, val) { document.execCommand(cmd, false, val); }
function handleFileSelection(input) {
    document.getElementById('fileNameDisplay').innerText = input.files[0] ? input.files[0].name : "Sem anexo";
}
