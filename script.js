const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiX7pjLjz6_AVoUvYLdICa8Ps9sJN7JEo8Xmpck2cmvs5Y2FcxPDxzMcti3aHSfw1R/exec"; 

let selectedFile = { base64: null, name: "", type: "", fileType: "" };
let currentEditingId = null;

function updateStatus(msg) { 
    document.getElementById('statusMsg').innerText = "STATUS: > " + msg; 
}

async function loadTasks() {
    updateStatus("Sincronizando...");
    try {
        const res = await fetch(SCRIPT_URL);
        const tasks = await res.json();
        document.querySelectorAll('.task-list').forEach(l => l.innerHTML = '');
        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) { 
        updateStatus("ERRO DE CONEXÃO ❌"); 
        console.error(e);
    }
}

function handleFileSelection(input) {
    const file = input.files[0];
    if (!file) return;
    updateStatus("Lendo arquivo...");
    
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedFile = { 
            base64: e.target.result.split(',')[1], 
            name: file.name, 
            type: file.type,
            fileType: file.type.startsWith("image/") ? "image" : "document"
        };
        const icon = selectedFile.fileType === "image" ? "🖼️ " : "📄 ";
        document.getElementById('fileNameDisplay').innerText = icon + file.name.substring(0,15);
        updateStatus("Arquivo pronto ✅");
    };
    reader.readAsDataURL(file);
}

async function createNewTask() {
    const editor = document.getElementById('editor');
    const text = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    updateStatus("Iniciando registro...");
    const id = currentEditingId || "card-" + Date.now();
    let fileUrl = "";
    let downloadUrl = "";

    // 1. Upload do Arquivo (se houver)
    if (selectedFile.base64) {
        updateStatus("Subindo para o Drive...");
        try {
            const upRes = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ 
                    action: "uploadFile", 
                    name: selectedFile.name, 
                    type: selectedFile.type, 
                    base64: selectedFile.base64 
                })
            });
            const upData = await upRes.json();
            
            if(upData.status === "error") {
                updateStatus("ERRO NO UPLOAD ❌");
                console.error(upData.message);
                return;
            }
            
            fileUrl = upData.url;
            downloadUrl = upData.downloadUrl;
            
        } catch(error) {
            updateStatus("FALHA NO UPLOAD ❌");
            console.error(error);
            return;
        }
    }

    // 2. Salvar na Planilha
    updateStatus("Salvando diretiva...");
    try {
        const saveRes = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "saveTask", 
                text, 
                status: 'todo', 
                fileUrl: downloadUrl || fileUrl, 
                fileName: selectedFile.name, 
                fileType: selectedFile.fileType, 
                id 
            })
        });
        const saveData = await saveRes.json();

        if (saveData.status === "success") {
            renderCard(id, text, 'todo', downloadUrl || fileUrl, selectedFile.name, selectedFile.fileType);
            resetInputs();
            updateStatus("CONCLUÍDO ✅");
        }
    } catch(error) {
        updateStatus("ERRO AO SALVAR ❌");
        console.error(error);
    }
}

function renderCard(id, text, status, url, name, type) {
    const existing = document.getElementById(id);
    if(existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'card'; 
    card.id = id; 
    card.draggable = true;
    card.dataset.id = id; 
    card.dataset.text = text; 
    card.dataset.url = url; 
    card.dataset.name = name;

    let mediaHtml = "";
    if (url && name) {
        mediaHtml = `<div class="media-container">`;
        
        // Verifica se é imagem
        if (type === "image" || name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            // Extrai ID do Drive para thumbnail
            let imgId = url.match(/\/d\/(.+?)\//);
            if(!imgId) imgId = url.match(/id=(.+?)(&|$)/);
            
            if(imgId && imgId[1]) {
                const thumbUrl = `https://drive.google.com/thumbnail?id=${imgId[1]}&sz=w400`;
                mediaHtml += `<img src="${thumbUrl}" class="card-img" onclick="window.open('${url}')" onerror="this.style.display='none'">`;
            }
        }
        
        // Botão de download sempre presente
        mediaHtml += `<a href="${url}" download="${name}" target="_blank" class="download-bar">📎 BAIXAR: ${name.substring(0,20)}...</a>
        </div>`;
    }

    card.innerHTML = `
        <div class="card-actions">
            <button class="action-btn" onclick="editTask('${id}')">✎</button>
            <button class="action-btn" onclick="deleteTask('${id}')" style="color:red">✖</button>
        </div>
        <div class="card-text">${text}</div>
        ${mediaHtml}
    `;
    
    document.getElementById(`${status}-list`).appendChild(card);
}

function editTask(id) {
    const card = document.getElementById(id);
    document.getElementById('editor').innerHTML = card.dataset.text;
    currentEditingId = id;
    updateStatus("Editando tarefa...");
}

async function deleteTask(id) {
    if(!confirm("Excluir definitivamente?")) return;
    updateStatus("Apagando...");
    
    try {
        const res = await fetch(SCRIPT_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "deleteTask", id: id }) 
        });
        const r = await res.json();
        
        if(r.status === "success") {
            document.getElementById(id).remove();
            updateStatus("DELETADO ✅");
        }
    } catch(error) {
        updateStatus("ERRO AO DELETAR ❌");
        console.error(error);
    }
}

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    document.getElementById('fileNameDisplay').innerText = "Sem anexo";
    document.getElementById('fileInput').value = "";
    currentEditingId = null;
    selectedFile = { base64: null, name: "", type: "", fileType: "" };
}

// Inicializar ao carregar
window.onload = loadTasks;