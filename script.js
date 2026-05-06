// Elaborado por Jaziel Robles Angon
const app = {
    toast(mensaje, tipo = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        const icono = tipo === 'success' ? '<i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 18px;"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color: var(--danger); font-size: 18px;"></i>';
        toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
    },

    obtenerIcono(nombreArchivo) {
        const ext = nombreArchivo.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return '<i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 18px;"></i>';
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return '<i class="fa-solid fa-file-image" style="color: #3b82f6; font-size: 18px;"></i>';
        if (['doc', 'docx'].includes(ext)) return '<i class="fa-solid fa-file-word" style="color: #2563eb; font-size: 18px;"></i>';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return '<i class="fa-solid fa-file-excel" style="color: #16a34a; font-size: 18px;"></i>';
        if (['ppt', 'pptx'].includes(ext)) return '<i class="fa-solid fa-file-powerpoint" style="color: #d97706; font-size: 18px;"></i>';
        if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return '<i class="fa-solid fa-file-video" style="color: #8b5cf6; font-size: 18px;"></i>';
        if (['mp3', 'wav'].includes(ext)) return '<i class="fa-solid fa-file-audio" style="color: #f59e0b; font-size: 18px;"></i>';
        if (['txt', 'log'].includes(ext)) return '<i class="fa-solid fa-file-lines" style="color: #64748b; font-size: 18px;"></i>';
        return '<i class="fa-solid fa-file" style="color: #94a3b8; font-size: 18px;"></i>';
    },

    buscarArchivos() {
        const query = document.getElementById('search-input').value.toLowerCase();
        document.querySelectorAll('.folder-card').forEach(carpeta => {
            let mostrar = carpeta.querySelector('.folder-header span').innerText.toLowerCase().includes(query);
            carpeta.querySelectorAll('.file-item').forEach(archivo => {
                const matchea = archivo.querySelector('.file-name').innerText.toLowerCase().includes(query);
                archivo.style.display = matchea ? 'flex' : 'none';
                if (matchea) mostrar = true;
            });
            carpeta.style.display = mostrar ? 'block' : 'none';
        });
    },

    async login() {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
        if (res.ok) {
            const data = await res.json();
            this.rol = data.rol;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('ui-username').innerText = "" + data.username.toUpperCase();
            document.getElementById('ui-rol').innerText = data.rol === 'admin' ? 'Administrador' : 'Usuario';
            document.getElementById('admin-controls').style.display = data.rol === 'admin' ? 'block' : 'none';
            this.toast(`Acceso Autorizado.`, 'success');
            this.cargarExplorador();
        } else { this.toast('Credenciales incorrectas', 'error'); }
    },

    async logout() {
        await fetch('/api/logout', {method: 'POST'});
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-pass').value = '';
    },

    async cargarExplorador() {
        const res = await fetch('/api/explorador');
        if (!res.ok) return this.logout();
        const carpetas = await res.json();
        const contenedor = document.getElementById('explorador');
        contenedor.innerHTML = '';
        
        carpetas.forEach(c => contenedor.innerHTML += this.renderCarpeta(c));
    },

    renderCarpeta(c) {
        const canWrite = c.puede_escribir === 1;
        const badge = canWrite ? `<span class="badge write">Autorizado</span>` : `<span class="badge read">Solo Lectura</span>`;
        const btnEliminar = this.rol === 'admin' ? `<button class="btn" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white;" onclick="app.eliminarCarpeta(${c.id})"><i class="fa-solid fa-trash"></i></button>` : '';
        
        let contenido = '';
        
        if (c.subcarpetas && c.subcarpetas.length > 0) {
            contenido += c.subcarpetas.map(sub => this.renderSubCarpeta(sub)).join('');
        }

        if (c.archivos && c.archivos.length > 0) {
            contenido += c.archivos.map(a => {
                const btnEliminarArchivo = this.rol === 'admin' ? 
                    `<button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; color: #ef4444; border-color: #ef4444;" onclick="app.eliminarArchivo(${a.id})"><i class="fa-solid fa-trash"></i></button>` : '';
                
                const hasComment = a.comentario && a.comentario.trim().length > 0;
                const commentHtml = `
                    <div class="comment-btn ${hasComment ? 'has-comment' : ''}" onclick="app.toggleComentario(event, ${a.id})" style="margin-right: 5px; display: inline-block;">
                        <i class="fa-solid fa-comment-dots" style="font-size: 16px;"></i>
                        <div id="comment-popover-${a.id}" class="comment-popover" onclick="event.stopPropagation()">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <span style="font-weight:600; font-size:15px; color:var(--text);">Nota de Archivo</span>
                                <button onclick="document.getElementById('comment-popover-${a.id}').style.display='none'" style="background:none; border:none; cursor:pointer; color:#94a3b8;"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <textarea id="comment-text-${a.id}" class="comment-textarea" placeholder="Escribir comentarios o notas...">${a.comentario || ''}</textarea>
                            <div style="text-align:right;">
                                <button class="btn btn-primary" onclick="app.guardarComentarioArchivo(${a.id})">Guardar Nota</button>
                            </div>
                        </div>
                    </div>
                `;

                const infoRevisado = a.revisado ? `<span style="color: #10b981; margin-left: 10px;" title="Revisado por: ${a.revisado_por}"><i class="fa-solid fa-check-circle"></i></span>` : '';
                const btnRevisar = `<button class="btn btn-outline" title="${a.revisado ? 'Quitar revisión' : 'Marcar como revisado'}" style="padding: 6px 12px; font-size: 12px; margin-right:5px; color: ${a.revisado ? '#10b981' : '#94a3b8'}; border-color: ${a.revisado ? '#10b981' : '#e2e8f0'};" onclick="app.revisarArchivo(${a.id})"><i class="fa-solid fa-check-double"></i></button>`;

                return `
                <div class="file-item">
                    <span class="file-name" style="display:flex; align-items:center; gap:10px; font-weight: 500;">
                        ${this.obtenerIcono(a.nombre)} ${a.nombre}
                        <small style="color: #94a3b8; font-size: 11px; margin-left: 10px;">${a.fecha || ''} &bull; ${a.usuario || 'Sistema'}</small>
                        ${infoRevisado}
                    </span>
                    <div style="display:flex; gap: 8px; align-items: center;">
                        ${commentHtml}
                        ${btnRevisar}
                        <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="app.previsualizar(${a.id}, '${a.nombre}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.location.href='/api/download/${a.id}'"><i class="fa-solid fa-download"></i></button>
                        ${btnEliminarArchivo}
                    </div>
                </div>`;
            }).join('');
        }

        if (!contenido) contenido = '<div style="color: #94A3B8; font-size: 13px; padding: 10px 0;">Carpeta vacía.</div>';

        const fechaCreacion = c.fecha_creacion ? `<span><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${c.fecha_creacion}</span>` : '';

        return `
            <div class="folder-card" 
                     ondragover="event.preventDefault(); this.classList.add('dragover');" 
                     ondragleave="event.preventDefault(); this.classList.remove('dragover');" 
                     ondrop="app.soltarArchivo(event, ${c.id}, ${canWrite})">
                    <div class="folder-header">
                        <div>
                            <div style="display:flex; align-items:center; gap:10px; color: var(--accent);">
                                <i class="fa-solid fa-folder-open"></i>
                                <span>${c.nombre}</span>
                                ${badge}
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 12px;">
                                ${fechaCreacion}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center;">
                            ${btnEliminar}
                            ${canWrite ? `
                                <input type="file" id="file-${c.id}" style="display:none;" onchange="app.procesarSubida(this.files[0], ${c.id})">
                                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; margin-right:5px;" onclick="app.abrirModalSubcarpeta(${c.id})">
                                    <i class="fa-solid fa-folder-plus"></i>
                                </button>
                                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="document.getElementById('file-${c.id}').click()">
                                    <i class="fa-solid fa-cloud-arrow-up"></i>
                                </button>` : ''}
                        </div>
                    </div>
                    <div class="file-list">
                        ${contenido}
                    </div>
                </div>`;
    },

    renderSubCarpeta(c) {
        const btnEliminar = this.rol === 'admin' ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color:transparent;" onclick="app.eliminarCarpeta(${c.id})"><i class="fa-solid fa-trash"></i></button>` : '';

        let innerContent = '';
        if (c.subcarpetas && c.subcarpetas.length > 0) innerContent += c.subcarpetas.map(sub => this.renderSubCarpeta(sub)).join('');
        if (c.archivos && c.archivos.length > 0) {
            innerContent += c.archivos.map(a => {
                const hasComment = a.comentario && a.comentario.trim().length > 0;
                const commentHtml = `
                    <div class="comment-btn ${hasComment ? 'has-comment' : ''}" onclick="app.toggleComentario(event, ${a.id})" style="margin-right: 5px; display: inline-block;">
                        <i class="fa-solid fa-comment-dots" style="font-size: 14px;"></i>
                        <div id="comment-popover-${a.id}" class="comment-popover" onclick="event.stopPropagation()">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <span style="font-weight:600; font-size:15px; color:var(--text);">Nota de Archivo</span>
                                <button onclick="document.getElementById('comment-popover-${a.id}').style.display='none'" style="background:none; border:none; cursor:pointer; color:#94a3b8;"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <textarea id="comment-text-${a.id}" class="comment-textarea" placeholder="Escribir comentarios o notas importantes...">${a.comentario || ''}</textarea>
                            <div style="text-align:right;">
                                <button class="btn btn-primary" onclick="app.guardarComentarioArchivo(${a.id})">Guardar Nota</button>
                            </div>
                        </div>
                    </div>
                `;
                const infoRevisado = a.revisado ? `<span style="color: #10b981; margin-left: 10px;" title="Revisado por: ${a.revisado_por}"><i class="fa-solid fa-check-circle"></i></span>` : '';
                const btnRevisar = `<button class="btn btn-outline" title="${a.revisado ? 'Quitar revisión' : 'Marcar como revisado'}" style="padding: 4px 8px; font-size: 10px; margin-right:5px; color: ${a.revisado ? '#10b981' : '#94a3b8'}; border-color: ${a.revisado ? '#10b981' : '#e2e8f0'};" onclick="app.revisarArchivo(${a.id})"><i class="fa-solid fa-check-double"></i></button>`;

                return `
                <div class="file-item" style="padding-left: 10px; border-bottom: 1px dashed #eee;">
                    <span class="file-name" style="font-size: 13px; display:flex; align-items:center; gap:10px;">
                        ${this.obtenerIcono(a.nombre)} ${a.nombre}
                        <small style="color: #94a3b8; font-size: 11px;">${a.fecha || ''} &bull; ${a.usuario || 'Sistema'}</small>
                        ${infoRevisado}
                    </span>
                    <div style="display:flex; gap: 5px; align-items: center;">
                        ${commentHtml}
                        ${btnRevisar}
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 10px;" onclick="app.previsualizar(${a.id}, '${a.nombre}')"><i class="fa-solid fa-eye"></i></button>
                        ${this.rol === 'admin' ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 10px; color:#ef4444; border:none;" onclick="app.eliminarArchivo(${a.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </div>
            `;
            }).join('');
        }

        const fechaCreacion = c.fecha_creacion ? `<span><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${c.fecha_creacion}</span>` : '';

        return `
            <div class="subfolder-item" style="flex-direction:column; align-items:stretch; background: rgba(241, 245, 249, 0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:#475569; font-size:14px;">
                            <i class="fa-solid fa-folder" style="color: #fbbf24;"></i> ${c.nombre}
                        </div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 12px;">
                            ${fechaCreacion}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center;">
                        ${c.puede_escribir ? `
                        <input type="file" id="file-${c.id}" style="display:none;" onchange="app.procesarSubida(this.files[0], ${c.id})">
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; margin-right:5px;" onclick="document.getElementById('file-${c.id}').click()"><i class="fa-solid fa-upload"></i></button>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; margin-right:5px;" onclick="app.abrirModalSubcarpeta(${c.id})"><i class="fa-solid fa-folder-plus"></i></button>
                        ` : ''}
                        ${btnEliminar}
                    </div>
                </div>
                <div style="padding-left: 20px; margin-top: 5px;">
                    ${innerContent}
                </div>
            </div>
        `;
    },

    toggleComentario(e, id) {
        e.stopPropagation();
        document.querySelectorAll('.comment-popover').forEach(el => {
            if (el.id !== `comment-popover-${id}`) el.style.display = 'none';
        });
        
        const popover = document.getElementById(`comment-popover-${id}`);
        if (popover.style.display === 'block') {
            popover.style.display = 'none';
        } else {
            popover.style.display = 'block';
        }
    },

    async guardarComentarioArchivo(aid) {
        const texto = document.getElementById(`comment-text-${aid}`).value;
        const res = await fetch(`/api/archivo/${aid}/comentario`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({comentario: texto})
        });
        
        if (res.ok) {
            this.toast('Comentario guardado', 'success');
            document.getElementById(`comment-popover-${aid}`).style.display = 'none';
            const btn = document.getElementById(`comment-popover-${aid}`).parentElement;
            if (texto.trim().length > 0) btn.classList.add('has-comment');
            else btn.classList.remove('has-comment');
        }
    },

    soltarArchivo(e, carpetaId, canWrite) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        if (!canWrite) return this.toast("No tiene privilegios para subir archivos aquí", 'error');
        const file = e.dataTransfer.files[0];
        if (file) this.procesarSubida(file, carpetaId);
    },

    async procesarSubida(file, carpetaId) {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('carpeta_id', carpetaId);

        this.toast(`Procesando archivo...`, 'success');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) { 
            this.toast(`Cargado exitosamente.`, 'success');
            this.cargarExplorador(); 
        } else { this.toast("Error en el servidor.", 'error'); }
    },

    async previsualizar(id, nombre) {
        const ext = nombre.split('.').pop().toLowerCase();
        const url = `/api/view/${id}`;
        const body = document.getElementById('preview-body');
        
        document.getElementById('preview-title').innerHTML = `<i class="fa-solid fa-file"></i> Vista Previa: ${nombre}`;
        
        body.innerHTML = `
            <div style="display:flex; justify-content:center; gap:10px; padding:10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius: 8px 8px 0 0;">
                <button class="btn btn-outline" onclick="app.imprimirVistaPrevia('${ext}', '${url}')" style="padding: 5px 15px; font-size: 12px; background:white;">
                    <i class="fa-solid fa-print"></i> Imprimir
                </button>
                <button class="btn btn-primary" onclick="window.location.href='/api/download/${id}'" style="padding: 5px 15px; font-size: 12px;">
                    <i class="fa-solid fa-download"></i> Descargar
                </button>
            </div>
            <div id="preview-content" style="height: calc(100% - 60px); overflow: auto; background: white; padding: 0;"></div>
        `;
        
        const content = document.getElementById('preview-content');

        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            content.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%;">
                <img src="${url}" id="print-target" style="max-width:100%; max-height:100%; object-fit:contain;">
            </div>`;
            this.abrirModal('modal-preview');
        } else if (['pdf', 'txt', 'log'].includes(ext)) {
            content.innerHTML = `<iframe src="${url}" id="print-target" style="width:100%; height:100%; border:none; background: white;"></iframe>`;
            this.abrirModal('modal-preview');
        } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
            content.innerHTML = `<video controls src="${url}" style="max-width:100%; max-height:100%; border-radius: 8px;"></video>`;
            this.abrirModal('modal-preview');
        } else if (['mp3', 'wav'].includes(ext)) {
            content.innerHTML = `<audio controls src="${url}" style="width:100%; margin-top: 20px;"></audio><div style="text-align:center; margin-top:10px; color:#64748b;"><i class="fa-solid fa-music" style="font-size:48px;"></i><br>${nombre}</div>`;
            this.abrirModal('modal-preview');
        } else if (['docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt'].includes(ext)) {
            const pdfUrl = `/api/preview_pdf/${id}`;
            content.innerHTML = `<iframe src="${pdfUrl}" id="print-target" style="width:100%; height:100%; border:none; background: white;"></iframe>`;
            this.abrirModal('modal-preview');
        } else {
            window.location.href = `/api/download/${id}`;
        }
    },

    imprimirVistaPrevia(ext, url) {
        const fullUrl = window.location.origin + url;
        
        if (['pdf', 'txt', 'log', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt'].includes(ext)) {
            const iframe = document.getElementById('print-target');
            if (iframe) iframe.contentWindow.print();
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
             this.imprimirContenido(`<div style="display:flex;justify-content:center;"><img src="${fullUrl}" style="max-width:100%; max-height:100vh;"></div>`, true);
        }
    },

    imprimirContenido(html, autoPrint = false) {
        let iframe = document.getElementById('print-frame');
        if (iframe) document.body.removeChild(iframe);
        
        iframe = document.createElement('iframe');
        iframe.id = 'print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0.01';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Imprimir Documento</title>
                <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; font-family: sans-serif; }
                    img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 5px; }
                    @media print {
                        @page { margin: 1cm; }
                        body { display: block; text-align: center; }
                        img { max-width: 100%; max-height: 95vh; page-break-inside: avoid; margin: 0 auto; display: block; object-fit: contain; }
                    }
                </style>
            </head>
            <body>
                ${html}
                ${autoPrint ? '<script>setTimeout(() => { window.print(); }, 800);</script>' : ''}
            </body>
            </html>
        `);
        doc.close();
    },

    abrirModal(id) { document.getElementById(id).style.display = 'flex'; },
    cerrarModal(id) { document.getElementById(id).style.display = 'none'; },

    confirmar(titulo, mensaje) {
        return new Promise((resolve) => {
            document.getElementById('confirm-title').innerText = titulo;
            document.getElementById('confirm-message').innerText = mensaje;
            this.abrirModal('modal-confirm');

            const btnOk = document.getElementById('btn-confirm-ok');
            const btnCancel = document.getElementById('btn-confirm-cancel');

            const limpiarEventos = () => {
                btnOk.onclick = null;
                btnCancel.onclick = null;
                this.cerrarModal('modal-confirm');
            };

            btnOk.onclick = () => { limpiarEventos(); resolve(true); };
            btnCancel.onclick = () => { limpiarEventos(); resolve(false); };
        });
    },

    abrirModalSubcarpeta(parentId) {
        this.currentParentId = parentId;
        this.abrirModal('modal-carpeta');
    },

    async crearCarpeta() {
        const nombre = document.getElementById('carpeta-nombre').value;
        if (!nombre) return;
        const parentId = this.currentParentId || null;
        await fetch('/api/carpeta', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nombre, parent_id: parentId})});
        this.cerrarModal('modal-carpeta');
        document.getElementById('carpeta-nombre').value = '';
        this.currentParentId = null;
        this.cargarExplorador();
    },

    async cargarUsuariosForm() { 
        this.abrirModal('modal-usuario'); 
        this.cargarListaUsuarios();
    },

    async crearUsuario() {
        const u = document.getElementById('nuevo-usuario').value;
        const p = document.getElementById('nueva-pass').value;
        if (!u || !p) return;
        const res = await fetch('/api/usuarios', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p})});
        if(res.ok) {
            this.cerrarModal('modal-usuario');
            document.getElementById('nuevo-usuario').value = ''; document.getElementById('nueva-pass').value = '';
            this.toast('Usuario registrado', 'success');
        }
    },

    abrirModalCambiarPassword() {
        this.abrirModal('modal-password');
    },

    async cambiarPassword() {
        const old_password = document.getElementById('old-pass-change').value;
        const new_password = document.getElementById('new-pass-change').value;
        if (!old_password || !new_password) return;
        const res = await fetch('/api/user/password', { 
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ old_password, new_password }) 
        });
        if (res.ok) {
            this.toast('Actualizada correctamente.', 'success');
            this.cerrarModal('modal-password');
            document.getElementById('old-pass-change').value = '';
            document.getElementById('new-pass-change').value = '';
        } else { 
            this.toast('Incorrecta.', 'error'); 
        }
    },

    abrirModalResetPassword(userId, username) {
        document.getElementById('reset-pass-user-id').value = userId;
        document.getElementById('reset-pass-username').innerText = username;
        document.getElementById('reset-pass-new').value = '';
        this.abrirModal('modal-reset-password');
    },

    async resetPasswordAdmin() {
        const userId = document.getElementById('reset-pass-user-id').value;
        const new_password = document.getElementById('reset-pass-new').value;
        if (!new_password) return;
        const res = await fetch(`/api/usuarios/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_password })
        });
        if (res.ok) {
            this.toast(`Actualizada.`, 'success');
            this.cerrarModal('modal-reset-password');
        }
    },

    async cargarListaUsuarios() {
        if (this.rol !== 'admin') return;
        const res = await fetch('/api/lista_usuarios');
        if (!res.ok) return;
        const users = await res.json();
        
        let container = document.getElementById('lista-usuarios-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'lista-usuarios-container';
            container.style.marginTop = '15px';
            container.style.borderTop = '1px solid #e2e8f0';
            container.style.paddingTop = '10px';
            container.style.maxHeight = '250px';
            container.style.overflowY = 'auto';
            document.getElementById('nuevo-usuario').parentNode.appendChild(container);
        }
        
        container.innerHTML = '<div style="font-weight:bold; margin-bottom:10px; font-size:13px;">Usuarios Existentes:</div>';
        users.forEach(u => {
            container.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size:13px;">${u.username}</span>
                    <div>
                        <button onclick="app.abrirModalResetPassword(${u.id}, '${u.username}')" style="background:#f59e0b; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; margin-right: 5px;"><i class="fa-solid fa-key"></i></button>
                        <button onclick="app.eliminarUsuario(${u.id})" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    },

    async eliminarUsuario(id) {
        const confirmado = await this.confirmar(
            'Eliminar Usuario', 
            'El usuario y todos sus privilegios serán borrados permanentemente.'
        );
        if(!confirmado) return;
        
        await fetch(`/api/usuarios/${id}`, {method: 'DELETE'});
        this.toast('Usuario eliminado del sistema', 'success');
        this.cargarListaUsuarios();
    },

    async revisarArchivo(aid) {
        const res = await fetch(`/api/archivo/${aid}/revisar`, { method: 'POST' });
        if (res.ok) {
            this.toast('Estado de revisión actualizado', 'success');
            this.cargarExplorador();
        } else {
            this.toast('Error al actualizar estado', 'error');
        }
    },

    async eliminarCarpeta(id) {
        const confirmado = await this.confirmar(
            'Eliminar Carpeta', 
            'Se borrará la carpeta y TODOS los documentos clínicos que contiene. Esta acción es irreversible.'
        );
        if(!confirmado) return;
        
        await fetch(`/api/carpeta/${id}`, {method: 'DELETE'});
        this.toast('Expediente eliminado', 'success');
        this.cargarExplorador();
    },

    async cargarPermisosForm() {
        const res = await fetch('/api/datos_permisos'); 
        const data = await res.json();
        const select = document.getElementById('permiso-carpeta');
        select.innerHTML = data.carpetas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        
        if (data.carpetas.length > 0) {
            this.cargarPermisosCarpeta(data.carpetas[0].id);
        }
        
        select.onchange = (e) => this.cargarPermisosCarpeta(e.target.value);
        this.abrirModal('modal-permisos');
    },

    async cargarPermisosCarpeta(cid) {
        const res = await fetch(`/api/permisos/${cid}`);
        const users = await res.json();
        this.renderPermisos(users);
    },

    renderPermisos(users) {
        const container = document.getElementById('lista-permisos');
        container.innerHTML = '';
        
        users.forEach(u => {
            const row = document.createElement('div');
            row.className = 'permiso-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.padding = '10px';
            row.style.borderBottom = '1px solid #eee';
            row.style.justifyContent = 'space-between';
            
            row.innerHTML = `
                <div style="flex: 1; font-weight: 500;">${u.username}</div>
                <div style="display: flex; gap: 20px;">
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                        <input type="checkbox" class="perm-check-access" data-uid="${u.id}" ${u.acceso ? 'checked' : ''}>
                        <span style="font-size: 13px;">Ver</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                        <input type="checkbox" class="perm-check-write" data-uid="${u.id}" ${u.escritura ? 'checked' : ''}>
                        <span style="font-size: 13px;">Subir</span>
                    </label>
                </div>
            `;
            container.appendChild(row);
        });
    },

    filtrarUsuariosPermisos() {
        const q = document.getElementById('buscar-usuario-permiso').value.toLowerCase();
        document.querySelectorAll('.permiso-row').forEach(row => {
            const name = row.firstElementChild.innerText.toLowerCase();
            row.style.display = name.includes(q) ? 'flex' : 'none';
        });
    },

    async guardarPermisos() {
        const cid = document.getElementById('permiso-carpeta').value;
        const cambios = [];
        
        document.querySelectorAll('.permiso-row').forEach(row => {
            const accessCheck = row.querySelector('.perm-check-access');
            const writeCheck = row.querySelector('.perm-check-write');
            const uid = accessCheck.getAttribute('data-uid');
            
            cambios.push({
                usuario_id: uid,
                acceso: accessCheck.checked,
                escritura: writeCheck.checked
            });
        });

        await fetch('/api/permisos/bulk', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({carpeta_id: cid, cambios: cambios})
        });
        
        this.toast('Actualizados', 'success');
        this.cerrarModal('modal-permisos');
        this.cargarExplorador();
    },

    async eliminarArchivo(id) {
        const confirmado = await this.confirmar(
            'Eliminar Documento', 
            'El documento será eliminado permanentemente del expediente.'
        );
        if(!confirmado) return;
        
        const res = await fetch(`/api/archivo/${id}`, {method: 'DELETE'});
        if(res.ok) {
            this.toast('Documento eliminado', 'success');
            this.cargarExplorador();
        }
    },

    mostrarInfoSistema() {
        const infoHtml = `
            <div style="text-align: left; font-size: 14px; line-height: 1.6; color: var(--text);">
                <div style="text-align: center; margin-bottom: 15px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 40px; color: var(--accent);"></i>
                    <h3 style="margin: 10px 0 5px; color: var(--accent);">Sistema de Archivero CT Scanner</h3>
                    <div style="height: 2px; background: var(--accent); width: 50px; margin: 0 auto;"></div>
                </div>
                <p><strong>Desarrollado por:</strong> Ing. Jaziel Robles Angon</p>
                <p><strong>Versión:</strong> 1.1</p>
                <p><strong>Fecha de Actualización:</strong> Mayo 2026</p>
                <div style="margin-top: 15px; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <p style="margin-top: 0;"><strong>Características del Sistema:</strong></p>
                    <ul style="margin-bottom: 0; padding-left: 20px;">
                        <li>Gestión y almacenamiento centralizado de documentos clínicos.</li>
                        <li>Previsualización y conversión automática de archivos a PDF.</li>
                        <li>Control de acceso, roles y asignación de permisos por carpeta.</li>
                        <li>Revisión de documentos y anotaciones mediante notas individuales.</li>
                    </ul>
                </div>
                <p style="text-align: center; font-size: 12px; color: #94A3B8; margin-top: 20px;">
                    © 2026 CT Scanner México. Todos los derechos reservados.
                </p>
            </div>
        `;

        let modal = document.getElementById('modal-info');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-info';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <i class="fa-solid fa-circle-info"></i> Información del Sistema
                    </div>
                    <div class="modal-body" id="modal-info-body">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="app.cerrarModal('modal-info')">Entendido</button>
                    </div>
                </div>
            `;
            modal.onclick = () => app.cerrarModal('modal-info');
            document.body.appendChild(modal);
        }
        
        document.getElementById('modal-info-body').innerHTML = infoHtml;
        this.abrirModal('modal-info');
    }
};

document.addEventListener('click', () => document.querySelectorAll('.comment-popover').forEach(el => el.style.display = 'none'));

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn-menu';
        infoBtn.style.marginTop = 'auto';
        infoBtn.innerHTML = '<i class="fa-solid fa-circle-info" style="color: var(--accent);"></i> Información del Sistema';
        infoBtn.onclick = () => app.mostrarInfoSistema();
        
        const sidebarMenu = sidebar.querySelector('.sidebar-menu');
        if (sidebarMenu) {
            sidebarMenu.appendChild(infoBtn);
        } else {
            sidebar.appendChild(infoBtn);
        }
    }
});