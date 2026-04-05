/**
 * NEXUS CONTROL FRONTEND - V11.5
 */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwsUbrhtjUczeAUGblxNZkTt7fXsjyfIu2tHIfBjyNZG0hF2QAWohqS5QNPQ4VK7I/exec";

// O Proxy só deve ser usado no GET (leitura)
const _px  = (u) => "https://corsproxy.io/?" + encodeURIComponent(u);
const GURL = () => _px(SCRIPT_URL); 

// No POST (envio), vamos direto para o Google para evitar que o Proxy bloqueie o arquivo
const PURL = () => SCRIPT_URL;

let selectedFile = { base64: null, name: "", type: "", fileType: "", url: null, downloadUrl: null };
let currentEditingId = null;

function updateStatus(msg) {
    document.getElementById('statusMsg').innerText = "STATUS: > " + msg;
}

async function loadTasks() {
    updateStatus("Sincronizando banco de dados...");
    try {
        const res = await fetch(GURL(), { redirect: 'follow' });
        const tasks = await res.json();
        document.querySelectorAll('.task-list').forEach(l => l.innerHTML = '');
        tasks.forEach(t => renderCard(
            t.id, t.text, t.status,
            t.fileUrl, t.fileName,
            t.fileType,
            t.downloadUrl
        ));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) {
        updateStatus("ERRO DE CONEXÃO ❌");
    }
}

async function uploadComChunks(base64, name, type) {
    const CHUNK  = 2 * 1024 * 1024; // Reduzido para 2MB para estabilidade
    const total  = Math.ceil(base64.length / CHUNK);
    const uid    = "up-" + Date.now();

    for (let i = 0; i < total; i++) {
        const chunk  = base64.slice(i * CHUNK, (i + 1) * CHUNK);
        const isLast = i === total - 1;
        updateStatus(`Enviando ${Math.round(((i+1)/total)*100)}%...`);

        const res = await fetch(PURL(), {
            method: 'POST',
            mode: 'no-cors', // CRÍTICO: Ignora bloqueio de CORS do navegador no POST
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: "uploadChunk",
                uploadId: uid,
                name, type, chunk,
                index: i, total, isLast
            })
        });

        // No modo 'no-cors', o JS não lê a resposta. 
        // Em caso de erro real de rede, o fetch lança exceção.
        if (isLast) {
            updateStatus("Processando arquivo final...");
            await new Promise(r => setTimeout(r, 3000)); // Espera o Google montar o arquivo
            return { status: "pending_check" }; 
        }
    }
}

async function createNewTask() {
    const editor = document.getElementById('editor');
    const text   = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    updateStatus("Iniciando transmissão...");
    const id = currentEditingId || "card-" + Date.now();
    
    let url = selectedFile.url;
    let fileName = selectedFile.name;

    if (selectedFile.base64) {
        await uploadComChunks(selectedFile.base64, selectedFile.name, selectedFile.type);
        // Como o 'no-cors' não volta a URL, o ideal é recarregar após um tempo
        updateStatus("Upload concluído! Sincronizando...");
        setTimeout(() => { location.reload(); }, 2000);
        return;
    }

    // Salvar apenas texto ou mover card
    await fetch(PURL(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: "saveTask",
            text, id, status: 'todo',
            fileUrl: url || "",
            fileName: fileName || ""
        })
    });
    
    updateStatus("Salvo com sucesso ✅");
    setTimeout(loadTasks, 1000);
    resetInputs();
}

// ... (Mantenha as funções renderCard, editTask, deleteTask e helpers iguais às suas, 
// apenas certifique-se de que os botões chamem as funções acima corretamente)
