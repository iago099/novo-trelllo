const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxk7r0yx4rI5NbaCMogd1g4uyK_r7YjnuCJaP_ZKexZwNw_P5VBsoJmiRtIZTjasFuC/exec"; 

let selectedFile = { base64: null, name: "", type: "" };

async function loadTasks() {
    try {
        const res = await fetch(SCRIPT_URL);
        const tasks = await res.json();
        document.querySelectorAll('.task-list').forEach(l => l.innerHTML = '');
        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
    } catch (e) { console.error("Erro ao carregar:", e); }
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
        media = `<div style="margin-top:10px; border-radius:8px; background:#000; overflow:hidden; border:1px solid #333;">`;
        if (type === "image") {
            const thumb = url.replace('file/d/', 'uc?id=').replace('/view?usp=sharing', '');
            media += `<img src="${thumb}" style="width:100%; max-height:180px; object-fit:cover;">`;
        }
        media += `<a href="${url}" target="_blank" style="display:block; padding:10px; color:#3b82f6; text-align:center; font-weight:bold; font-size:12px;">📎 VER ARQUIVO</a></div>`;
    }

    card.innerHTML = `
        <button onclick="deleteTask('${id}')" style="float:right; background:none; border:none; color:red; cursor:pointer;">✖</button>
        <div style="color:#fff; padding-right:20px;">${text}</div>
        ${media}
    `;
    document.getElementById(`${status}-list`).appendChild(card);
}

async function deleteTask(id) {
    if(!confirm("Apagar?")) return;
    await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "deleteTask", id }) });
    document.getElementById(id).remove();
}

function handleFileSelection(i) {
    const f = i.files[0];
    const r = new FileReader();
    r.onload = (e) => {
        selectedFile = { base64: e.target.result.split(',')[1], name: f.name, type: f.type };
        document.getElementById('fileNameDisplay').innerText = "📎 " + f.name;
    };
    r.readAsDataURL(f);
}

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    document.getElementById('fileNameDisplay').innerText = "Sem anexo";
    selectedFile = { base64: null, name: "", type: "" };
}

window.onload = loadTasks;
