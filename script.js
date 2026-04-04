const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKbxJ0yV0CoX8e3nS9ex7SfeVVxueGbDkeA3ugQqdQ6dGjZFOJ5vE3xAyRN32xflH1/exec"; 

let selectedFile = { base64: null, name: "", type: "" };

function updateStatus(msg) { document.getElementById('statusMsg').innerText = "STATUS: > " + msg; }

async function createNewTask() {
    const editor = document.getElementById('editor');
    const text = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    updateStatus("ENVIANDO...");
    const id = "card-" + Date.now();
    let fileUrl = "";

    // Upload do arquivo
    if (selectedFile.base64) {
        updateStatus("SUBINDO PARA O DRIVE...");
        try {
            const upRes = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: "uploadFile", name: selectedFile.name, type: selectedFile.type, base64: selectedFile.base64 })
            });
            const upData = await upRes.json();
            if (upData.status === "error") throw new Error(upData.message);
            fileUrl = upData.url;
        } catch (e) {
            alert("ERRO DE ACESSO: Você precisa executar a função 'FORCAR_AUTORIZACAO' no Apps Script!");
            updateStatus("FALHA DE ACESSO ❌");
            return;
        }
    }

    // Salva na planilha
    updateStatus("SALVANDO...");
    const saveRes = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "saveTask", text, status: 'todo', fileUrl, fileName: selectedFile.name, fileType: selectedFile.type.includes("image") ? "image" : "document", id })
    });
    
    if (saveRes.ok) {
        renderCard(id, text, 'todo', fileUrl, selectedFile.name, selectedFile.type.includes("image") ? "image" : "document");
        resetInputs();
        updateStatus("CONCLUÍDO ✅");
    }
}

// FUNÇÃO DO BALÃO ÚNICO (TEXTO + ARQUIVO)
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
            mediaHtml += `<img src="${thumb}" style="width:100%; display:block; max-height:220px; object-fit:cover;" onclick="window.open('${url}')">`;
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
        <div class="card-text" style="color:#eee; font-size:0.95rem; line-height:1.5;">${text}</div>
        ${mediaHtml}
    `;
    document.getElementById(`${status}-list`).appendChild(card);
}

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

async function deleteTask(id) {
    if(!confirm("Excluir?")) return;
    updateStatus("Apagando...");
    const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "deleteTask", id: id }) });
    const r = await res.json();
    if(r.status === "success") { document.getElementById(id).remove(); updateStatus("EXCLUÍDO ✅"); }
}

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    document.getElementById('fileNameDisplay').innerText = "Sem anexo";
    selectedFile = { base64: null, name: "", type: "" };
}

// Funções allowDrop, drop e loadTasks permanecem conforme v17.0
