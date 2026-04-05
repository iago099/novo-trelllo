/**
 * NEXUS CONTROL FRONTEND - V11.7
 */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwsUbrhtjUczeAUGblxNZkTt7fXsjyfIu2tHIfBjyNZG0hF2QAWohqS5QNPQ4VK7I/exec";

// Proxy obrigatório para LEITURA (GET) no GitHub Pages
const _px = (u) => "https://corsproxy.io/?" + encodeURIComponent(u);

function updateStatus(msg) {
    const el = document.getElementById('statusMsg');
    if(el) el.innerText = "STATUS: > " + msg;
}

// ── CARREGAR TAREFAS (CORRIGIDO) ─────────────────────────────────────────────
async function loadTasks() {
    updateStatus("Sincronizando...");
    try {
        // Usamos o Proxy para evitar erro de CORS no GET
        const res = await fetch(_px(SCRIPT_URL), { redirect: 'follow' });
        if (!res.ok) throw new Error("Erro na rede");
        
        const tasks = await res.json();
        
        // Limpa as listas
        ['todo-list', 'doing-list', 'done-list'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = '';
        });

        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) {
        updateStatus("ERRO DE CONEXÃO ❌ - Verifique o Script");
        console.error("Erro ao carregar:", e);
    }
}

// ── UPLOAD (ESTABILIZADO) ────────────────────────────────────────────────────
async function uploadComChunks(base64, name, type, taskId) {
    const CHUNK = 1024 * 1024; // 1MB
    const total = Math.ceil(base64.length / CHUNK);
    const uid = "up-" + Date.now();

    for (let i = 0; i < total; i++) {
        const chunk = base64.slice(i * CHUNK, (i + 1) * CHUNK);
        const isLast = i === total - 1;
        updateStatus(`Upload: ${Math.round(((i+1)/total)*100)}%`);

        // No POST de upload, enviamos DIRETO sem proxy
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: "uploadChunk",
                uploadId: uid,
                id: taskId,
                name, type, chunk,
                index: i, total, isLast
            })
        });
        
        if (isLast) {
            updateStatus("Finalizando arquivo...");
            setTimeout(() => location.reload(), 3500);
        }
    }
}

// ── SALVAR TAREFA ────────────────────────────────────────────────────────────
async function createNewTask() {
    const editor = document.getElementById('editor');
    const text = editor.innerText.trim();
    const id = currentEditingId || "card-" + Date.now();

    if (!text && !selectedFile.base64) return;

    try {
        if (selectedFile.base64) {
            await uploadComChunks(selectedFile.base64, selectedFile.name, selectedFile.type, id);
            return;
        }

        updateStatus("Salvando...");
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "saveTask", id, text, status: "todo" })
        });

        updateStatus("Salvo com sucesso ✅");
        setTimeout(loadTasks, 1000);
        resetInputs();
    } catch (e) {
        updateStatus("ERRO AO SALVAR ❌");
    }
}

// Inicializa o sistema
window.onload = loadTasks;
