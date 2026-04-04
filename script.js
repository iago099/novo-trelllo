const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDvXkCZ22k4KGOj09YWOC5lQH42GF31lvdFed14bb86W0R75WGoNcT-tfxVzHr_jbP/exec";

let selectedFile = { base64: null, name: "", type: "", fileType: "", url: null, downloadUrl: null };
let currentEditingId = null;

// ── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function updateStatus(msg) {
    document.getElementById('statusMsg').innerText = "STATUS: > " + msg;
}

function guessFileType(name, mime) {
    const ext  = (name || "").split(".").pop().toLowerCase();
    const mime_ = (mime || "").toLowerCase();
    if (mime_.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) return "image";
    if (mime_ === "application/pdf" || ext === "pdf") return "pdf";
    if (["doc","docx","odt","rtf","txt","md"].includes(ext)) return "doc";
    if (["xls","xlsx","ods","csv"].includes(ext)) return "spreadsheet";
    return "other";
}

function driveThumb(url) {
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600` : url;
}

function driveDownload(url) {
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

function fileIconSvg(fileType) {
    const icons = {
        pdf:         `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        doc:         `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        spreadsheet: `<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
        other:       `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    };
    return icons[fileType] || icons.other;
}

function fileIconClass(fileType) {
    return { pdf: "pdf", doc: "docx", spreadsheet: "xlsx" }[fileType] || "other";
}

const DOWNLOAD_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const IMG_SVG      = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

// ── CARREGAR TAREFAS ─────────────────────────────────────────────────────────

async function loadTasks() {
    updateStatus("Sincronizando banco de dados...");
    try {
        const res   = await fetch(SCRIPT_URL);
        const tasks = await res.json();
        document.querySelectorAll('.task-list').forEach(l => l.innerHTML = '');
        tasks.forEach(t => renderCard(
            t.id, t.text, t.status,
            t.fileUrl, t.fileName,
            t.fileType || guessFileType(t.fileName),
            t.downloadUrl || (t.fileUrl ? driveDownload(t.fileUrl) : "")
        ));
        updateStatus("SISTEMA ONLINE ✅");
    } catch (e) {
        updateStatus("ERRO DE CONEXÃO ❌");
    }
}

// ── UPLOAD EM CHUNKS ─────────────────────────────────────────────────────────
// Divide o base64 em pedaços de 3MB e envia sequencialmente.
// O Apps Script monta o arquivo no Drive e retorna a URL na última parte.

async function uploadComChunks(base64, name, type) {
    const CHUNK  = 3 * 1024 * 1024; // 3MB por chunk
    const total  = Math.ceil(base64.length / CHUNK);
    const uid    = "up-" + Date.now();

    for (let i = 0; i < total; i++) {
        const chunk  = base64.slice(i * CHUNK, (i + 1) * CHUNK);
        const isLast = i === total - 1;
        const pct    = Math.round(((i + 1) / total) * 100);

        updateStatus(`Enviando ${pct}%… (parte ${i + 1}/${total})`);

        const res = await fetch(SCRIPT_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify({
                action: "uploadChunk",
                uploadId: uid,
                name, type, chunk,
                index: i, total, isLast
            })
        });

        if (!res.ok) throw new Error("Falha na parte " + (i + 1));
        const r = await res.json();
        if (r.status === "error") throw new Error(r.message || "Erro no servidor");

        if (isLast) return r; // retorna { url, downloadUrl, fileType }
    }
}

// ── CRIAR / EDITAR TAREFA ────────────────────────────────────────────────────

async function createNewTask() {
    const editor = document.getElementById('editor');
    const text   = editor.innerHTML.trim();
    if (!text && !selectedFile.name) return;

    updateStatus("Registrando missão...");
    const id = currentEditingId || "card-" + Date.now();
    let url         = selectedFile.url;
    let downloadUrl = selectedFile.downloadUrl;
    let fileType    = selectedFile.fileType;

    if (selectedFile.base64) {
        try {
            const result = await uploadComChunks(
                selectedFile.base64,
                selectedFile.name,
                selectedFile.type
            );
            url         = result.url;
            downloadUrl = result.downloadUrl || driveDownload(result.url);
            fileType    = result.fileType || selectedFile.fileType;
        } catch (err) {
            updateStatus("FALHA NO UPLOAD ❌ — " + err.message);
            return;
        }
    }

    const saveRes  = await fetch(SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({
            action:   "saveTask",
            text, id,
            status:   'todo',
            fileUrl:  url              || "",
            fileName: selectedFile.name || "",
            fileType: fileType         || ""
        })
    });
    const saveData = await saveRes.json();

    if (saveData.status === "success") {
        renderCard(id, text, 'todo', url, selectedFile.name, fileType, downloadUrl);
        resetInputs();
        updateStatus("MENSAGEM GRAVADA ✅");
    } else {
        updateStatus("ERRO AO SALVAR ❌");
    }
}

// ── RENDERIZAR CARD ──────────────────────────────────────────────────────────

function renderCard(id, text, status, url, name, fileType, downloadUrl) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    if (!fileType && name) fileType = guessFileType(name);
    if (!downloadUrl && url) downloadUrl = driveDownload(url);

    let mediaHtml = "";
    if (url && name) {
        if (fileType === "image") {
            const thumb = driveThumb(url);
            mediaHtml = `
            <div class="card-media-box">
                <img src="${thumb}" class="card-img" alt="${name}"
                     onclick="window.open('${url}')" style="cursor:zoom-in">
                <div class="card-img-footer">
                    <span class="card-img-label">${IMG_SVG}&nbsp;${name}</span>
                    <a href="${downloadUrl}" target="_blank" class="card-download-btn">
                        ${DOWNLOAD_SVG}&nbsp;Baixar
                    </a>
                </div>
            </div>`;
        } else {
            const iconClass = fileIconClass(fileType);
            const extLabel  = name.split(".").pop().toUpperCase();
            mediaHtml = `
            <div class="card-media-box">
                <div class="card-file-row">
                    <div class="card-file-icon ${iconClass}">${fileIconSvg(fileType)}</div>
                    <div class="card-file-info">
                        <div class="card-file-name">${name}</div>
                        <div class="card-file-type">${extLabel}</div>
                    </div>
                    <a href="${downloadUrl}" target="_blank" class="card-download-btn">
                        ${DOWNLOAD_SVG}&nbsp;Baixar
                    </a>
                </div>
            </div>`;
        }
    }

    const EDIT_SVG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const DELETE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

    const card = document.createElement('div');
    card.className       = 'card hoverable';
    card.id              = id;
    card.draggable       = true;
    card.dataset.id      = id;
    card.dataset.text    = text;
    card.dataset.url     = url         || "";
    card.dataset.name    = name        || "";
    card.dataset.fileType    = fileType    || "";
    card.dataset.downloadUrl = downloadUrl || "";

    card.ondragstart = (e) => e.dataTransfer.setData("text", id);

    card.innerHTML = `
        <div class="card-actions">
            <button class="action-btn" title="Editar"  onclick="editTask('${id}')">${EDIT_SVG}</button>
            <button class="action-btn" title="Excluir" onclick="deleteTask('${id}')">${DELETE_SVG}</button>
        </div>
        <div class="card-text">${text}</div>
        ${mediaHtml}
    `;

    const col = document.getElementById(`${status}-list`);
    if (col) col.appendChild(card);
}

// ── EDITAR TAREFA ────────────────────────────────────────────────────────────

function editTask(id) {
    const card = document.getElementById(id);
    if (!card) return;

    currentEditingId = id;
    document.getElementById('editor').innerHTML = card.dataset.text;

    if (card.dataset.url) {
        selectedFile = {
            base64: null, name: card.dataset.name, type: "",
            fileType: card.dataset.fileType,
            url: card.dataset.url, downloadUrl: card.dataset.downloadUrl
        };
        updateFileDisplay(card.dataset.name);
    }

    document.getElementById('editor').focus();
    updateStatus("Editando missão... envie para salvar.");
}

// ── DELETAR TAREFA ───────────────────────────────────────────────────────────

async function deleteTask(id) {
    if (!confirm("CONFIRMAR EXCLUSÃO DEFINITIVA?")) return;
    updateStatus("Limpando da nuvem...");

    const el = document.getElementById(id);

    if (el) {
        el.style.maxHeight = el.offsetHeight + "px";
        el.classList.remove('hoverable');
        void el.offsetHeight;
        el.classList.add('removing');
    }

    try {
        const res = await fetch(SCRIPT_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify({ action: "deleteTask", id })
        });
        const r = await res.json();

        if (r.status === "success") {
            setTimeout(() => el && el.remove(), 400);
            updateStatus("DELETADO COM SUCESSO ✅");
        } else {
            if (el) {
                el.classList.remove('removing');
                el.style.maxHeight = "";
                void el.offsetHeight;
                el.classList.add('hoverable');
            }
            updateStatus("ERRO AO APAGAR ❌");
            alert("A planilha não respondeu. Tente novamente.");
        }
    } catch (e) {
        if (el) {
            el.classList.remove('removing');
            el.style.maxHeight = "";
            void el.offsetHeight;
            el.classList.add('hoverable');
        }
        updateStatus("FALHA NA CONEXÃO ❌");
    }
}

// ── SELEÇÃO DE ARQUIVO ───────────────────────────────────────────────────────

function handleFileSelection(input) {
    const f = input.files[0];
    if (!f) return;

    const fileType = guessFileType(f.name, f.type);
    updateFileDisplay(f.name);
    updateStatus("Preparando arquivo...");

    if (fileType === "image") {
        const img = new Image();
        const objectUrl = URL.createObjectURL(f);

        img.onload = () => {
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else       { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            URL.revokeObjectURL(objectUrl);

            selectedFile = {
                base64:   dataUrl.split(',')[1],
                name:     f.name.replace(/\.[^.]+$/, '.jpg'),
                type:     'image/jpeg',
                fileType: 'image',
                url: null, downloadUrl: null
            };
            updateStatus("Imagem comprimida ✅ — pronta para envio.");
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            updateStatus("Erro ao processar imagem ❌");
        };

        img.src = objectUrl;

    } else {
        // Documentos: lê normalmente — uploadComChunks divide automaticamente
        if (f.size > 10 * 1024 * 1024) {
            updateStatus("⚠️ Arquivo acima de 10MB — pode falhar.");
        }
        const r = new FileReader();
        r.onload = (ev) => {
            selectedFile = {
                base64:   ev.target.result.split(',')[1],
                name:     f.name,
                type:     f.type,
                fileType,
                url: null, downloadUrl: null
            };
            const mb = (f.size / 1024 / 1024).toFixed(1);
            updateStatus(`Arquivo pronto ✅ (${mb} MB) — clique em Registrar para enviar.`);
        };
        r.readAsDataURL(f);
    }
}

function updateFileDisplay(name) {
    const el = document.getElementById('fileNameDisplay');
    if (!el) return;
    const ft   = guessFileType(name);
    const icon = ft === "image" ? "🖼️" : ft === "pdf" ? "📄" : ft === "spreadsheet" ? "📊" : "📎";
    el.innerText = icon + " " + (name.length > 20 ? name.substring(0, 18) + "…" : name);
}

// ── RESET ────────────────────────────────────────────────────────────────────

function resetInputs() {
    document.getElementById('editor').innerHTML = "";
    const el = document.getElementById('fileNameDisplay');
    if (el) el.innerText = "Sem anexo";
    currentEditingId = null;
    selectedFile = { base64: null, name: "", type: "", fileType: "", url: null, downloadUrl: null };
}

// ── DRAG & DROP ──────────────────────────────────────────────────────────────

function allowDrop(e) { e.preventDefault(); }

async function drop(e) {
    e.preventDefault();
    const id   = e.dataTransfer.getData("text");
    const card = document.getElementById(id);
    let col    = e.target;
    while (col && !col.classList.contains('column')) col = col.parentElement;

    if (col) {
        col.querySelector('.task-list').appendChild(card);
        updateStatus("Movendo diretiva...");
        await fetch(SCRIPT_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify({
                action:   "saveTask",
                text:     card.dataset.text,
                status:   col.id,
                fileUrl:  card.dataset.url,
                fileName: card.dataset.name,
                fileType: card.dataset.fileType,
                id
            })
        });
        updateStatus("MOVIDO ✅");
    }
}
