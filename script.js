/**
 * NEXUS CONTROL FRONTEND - V11.6
 */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwsUbrhtjUczeAUGblxNZkTt7fXsjyfIu2tHIfBjyNZG0hF2QAWohqS5QNPQ4VK7I/exec";

// Proxy apenas para leitura (GET)
const GURL = () => "https://corsproxy.io/?" + encodeURIComponent(SCRIPT_URL);
// Direto para escrita (POST)
const PURL = () => SCRIPT_URL;

function updateStatus(msg) {
    const el = document.getElementById('statusMsg');
    if(el) el.innerText = "STATUS: > " + msg;
}

async function loadTasks() {
    updateStatus("Sincronizando...");
    try {
        // Tenta com Proxy, se falhar, tenta direto
        const res = await fetch(GURL()).catch(() => fetch(SCRIPT_URL, {mode: 'no-cors'}));
        
        if (!res.ok && res.type !== 'opaque') throw new Error();

        const tasks = await res.json();
        const lists = ['todo-list', 'doing-list', 'done-list'];
        lists.forEach(id => document.getElementById(id).innerHTML = '');
        
        tasks.forEach(t => renderCard(t.id, t.text, t.status, t.fileUrl, t.fileName, t.fileType));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) {
        updateStatus("ERRO DE CONEXÃO ❌ - Verifique o Script");
        console.error(e);
    }
}

async function uploadComChunks(base64, name, type) {
    const CHUNK = 1024 * 1024; // 1MB para máxima estabilidade
    const total = Math.ceil(base64.length / CHUNK);
    const uid = "up-" + Date.now();

    for (let i = 0; i < total; i++) {
        const chunk = base64.slice(i * CHUNK, (i + 1) * CHUNK);
        updateStatus(`Upload: ${Math.round(((i+1)/total)*100)}%`);

        await fetch(PURL(), {
            method: 'POST',
            mode: 'no-cors', // Fundamental para GitHub Pages -> Google
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: "uploadChunk",
                uploadId: uid,
                name, type, chunk,
                index: i, total, isLast: i === total - 1
            })
        });
    }
    return { status: "sent" };
}

async function createNewTask() {
    const text = document.getElementById('editor').innerText.trim();
    const id = currentEditingId || "card-" + Date.now();

    try {
        updateStatus("Enviando...");
        if (selectedFile.base64) {
            await uploadComChunks(selectedFile.base64, selectedFile.name, selectedFile.type);
            updateStatus("Arquivo enviado! Aguarde...");
            setTimeout(() => location.reload(), 3000);
            return;
        }

        await fetch(PURL(), {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: "saveTask",
                id, text, status: "todo"
            })
        });

        updateStatus("Salvo! Atualizando...");
        setTimeout(loadTasks, 1500);
    } catch (e) {
        updateStatus("ERRO AO SALVAR ❌");
    }
}

// Inicialização
window.onload = loadTasks;
