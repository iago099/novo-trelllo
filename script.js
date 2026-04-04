const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxz_U78dIZLFXaT0oOpSX99wDFeV39wAXEygD6_gtHArn0AZLeuv8K59f42H5hhovuT/exec"; 

let selectedFile = { base64: null, name: "", type: "" };

async function loadTasks() {
    try {
        const res = await fetch(SCRIPT_URL);
        const tasks = await res.json();
        const lists = ['todo-list', 'doing-list', 'done-list'];
        lists.forEach(id => document.getElementById(id).innerHTML = '');
        
        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
    } catch (e) { console.error("Erro na carga:", e); }
}

async function createNewTask() {
    const editor = document.getElementById('editor');
    const text = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    let fileUrl = "";
    if (selectedFile.base64) {
        const upRes = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "uploadFile", name: selectedFile.name, type: selectedFile.type, base64: selectedFile.base64 })
        });
        const upData = await upRes.json();
        fileUrl = upData.url;
    }

    const id = "card-" + Date.now();
    const type = selectedFile.type.includes("image") ? "image" : "document";
    
    await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "saveTask", text, status: 'todo', fileUrl, fileName: selectedFile.name, fileType: type, id })
    });

    renderCard(id, text, 'todo', fileUrl, selectedFile.name, type);
    resetInputs();
}

function renderCard(id, text, status, url, name, type) {
    const card = document.createElement('div');
    card.className = 'card'; card.id = id; card.draggable = true;
    
    let media = "";
    if (url) {
        media = `<div class="media-container" style="margin-top:12px; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); background:#000;">`;
        if (type === "image") {
            const thumb = url.replace('file/d/', 'uc?id=').replace('/view?usp=sharing', '');
            media += `<img src="${thumb}" style="width:100%; display:block; max-height:200px; object-fit:cover;">`;
        }
        media += `<a href="${url}" target="_blank" style="display:block; padding:10px; background:rgba(59,130,246,0.2); color:#3b82f6; text-decoration:none; font-weight:bold; text-align:center; font-size:0.8rem;">📎 BAIXAR ARQUIVO</a></div>`;
    }

    card.innerHTML = `
        <div class="card-actions" style="float:right;">
            <button onclick="deleteTask('${id}')" style="background:none; border:none; color:red; cursor:pointer;">✖</button>
        </div>
        <div class="card-text" style="color:#eee; font-size:0.95rem;">${text}</div>
        ${media}
    `;
    
    const col = document.getElementById(`${status}-list`);
    if (col) col.appendChild(card);
}

async function deleteTask(id) {
    if(!confirm("Excluir?")) return;
    await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "deleteTask", id }) });
    document.getElementById(id).remove();
}

function handleFileSelection(i) {
    const f = i.files[0];
    const r = new FileReader();
    r.onload = (e) => {
        selectedFile = { base64: e.target.result.split(',')[1], name: f.name, type: f.type };
        document.getElementById('fileNameDisplay').innerText = "📎 " + f.name.substring(0,15);
    };
    r.readAsDataURL(f);
}

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    document.getElementById('fileNameDisplay').innerText = "Sem anexo";
    selectedFile = { base64: null, name: "", type: "" };
}

window.onload = loadTasks;
