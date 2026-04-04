const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySFayMOBpulPQXjbu1dnK5TsLDtsoEuJuZVPj-GXLN-lFD2O6DvKTVckGjqkEe11kD/exec"; 

let selectedFile = { base64: null, name: "", type: "" };
let currentEditingId = null;

function updateStatus(msg) { document.getElementById('statusMsg').innerText = "STATUS: > " + msg; }

// CARREGA DO GOOGLE E MOSTRA NO FRONT
async function loadTasks() {
    updateStatus("Sincronizando...");
    try {
        const res = await fetch(SCRIPT_URL);
        const tasks = await res.json();
        document.querySelectorAll('.task-list').forEach(l => l.innerHTML = '');
        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) { updateStatus("ERRO DE CONEXÃO ❌"); }
}

// CRIA NOVA TAREFA (FRONT-END DOMINANTE)
async function createNewTask() {
    const editor = document.getElementById('editor');
    const text = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    updateStatus("Registrando...");
    const id = currentEditingId || "card-" + Date.now();
    let fileUrl = "";
    let fileType = "";

    // Se tiver arquivo, sobe primeiro
    if (selectedFile.base64) {
        updateStatus("Fazendo upload...");
        const upRes = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "uploadFile", name: selectedFile.name, type: selectedFile.type, base64: selectedFile.base64 })
        });
        const upData = await upRes.json();
        if (upData.status === "error") { alert("Acesso Negado no Drive! Autorize o script."); return; }
        fileUrl = upData.url;
        fileType = selectedFile.type.includes("image") ? "image" : "document";
    }

    // Salva na planilha e mostra no Front
    updateStatus("Salvando...");
    const saveRes = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "saveTask", text, status: 'todo', fileUrl, fileName: selectedFile.name, fileType, id })
    });
    
    const saveData = await saveRes.json();
    if (saveData.status === "success") {
        renderCard(id, text, 'todo', fileUrl, selectedFile.name, fileType);
        resetInputs();
        updateStatus("CONCLUÍDO ✅");
    }
}

// RENDERIZAÇÃO DO BALÃO ÚNICO (TEXTO + MÍDIA)
function renderCard(id, text, status, url, name, type) {
    const existing = document.getElementById(id);
    if(existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'card'; card.id = id; card.draggable = true;
    card.dataset.id = id; card.dataset.text = text; card.dataset.url = url; card.dataset.name = name;

    let mediaHtml = "";
    if (url) {
        mediaHtml = `<div class="media-container" style="margin-top:12px; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); background:#000;">`;
        if (type === "image" || name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const thumb = url.replace('file/d/', 'uc?id=').replace('/view?usp=sharing', '');
            mediaHtml += `<img src="${thumb}" style="width:100%; display:block; max-height:200px; object-fit:cover;" onclick="window.open('${url}')">`;
        }
        mediaHtml += `
            <a href="${url}" target="_blank" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(59, 130, 246, 0.2); color:#3b82f6; text-decoration:none; font-weight:bold; font-size:0.8rem;">
                <span>📎 ${name.substring(0,12)}...</span>
                <span style="background:#3b82f6; color:#fff; padding:2px 8px; border-radius:4px;">VER</span>
            </a>
        </div>`;
    }

    card.innerHTML = `
        <div class="card-actions" style="position:absolute; top:8px; right:8px;">
            <button onclick="deleteTask('${id}')" style="background:rgba(0,0,0,0.5); border:none; color:red; cursor:pointer; padding:5px; border-radius:5px;">✖</button>
        </div>
        <div class="card-text" style="color:#eee; font-size:0.95rem;">${text}</div>
        ${mediaHtml}
    `;
    
    document.getElementById(`${status}-list`).appendChild(card);
}

// SELEÇÃO DE ARQUIVO NO FRONT
function handleFileSelection(i) {
    const f = i.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
        selectedFile = { base64: e.target.result.split(',')[1], name: f.name, type: f.type };
        document.getElementById('fileNameDisplay').innerText = "📎 " + f.name.substring(0,15);
    };
    r.readAsDataURL(f);
}

// EXCLUSÃO SINCRONIZADA
async function deleteTask(id) {
    if(!confirm("Excluir definitivamente?")) return;
    updateStatus("Apagando...");
    const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "deleteTask", id: id }) });
    const r = await res.json();
    if(r.status === "success") {
        document.getElementById(id).remove();
        updateStatus("EXCLUÍDO ✅");
    }
}

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    document.getElementById('fileNameDisplay').innerText = "Sem anexo";
    currentEditingId = null;
    selectedFile = { base64: null, name: "", type: "" };
}

function allowDrop(e) { e.preventDefault(); }
async function drop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    const card = document.getElementById(id);
    let col = e.target;
    while(col && !col.classList.contains('column')) col = col.parentElement;
    if(col) {
        col.querySelector('.task-list').appendChild(card);
        await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "saveTask", text: card.dataset.text, status: col.id, fileUrl: card.dataset.url, fileName: card.dataset.name, id: id }) });
    }
}
