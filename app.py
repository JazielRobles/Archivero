#Elaborado por Jaziel Robles Angon
import os
import sys
import sqlite3
import hashlib
import subprocess
import shutil
import uuid
import mimetypes
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, send_file
from werkzeug.utils import secure_filename
from waitress import serve

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

app = Flask(__name__, 
            template_folder=resource_path("templates"),
            static_folder=resource_path("static"))

app.secret_key = 'clave_secreta_ct_scanner_2024'

LIBREOFFICE_PATH = None

BASE_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'CT_Scanner_System')
DB_PATH = os.path.join(BASE_DIR, 'core.db')
VAULT_PATH = os.path.join(BASE_DIR, '.storage')

def buscar_libreoffice():
    soffice = LIBREOFFICE_PATH
    if not soffice:
        soffice = shutil.which('soffice')
        
    if not soffice and os.name == 'nt':
        paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            os.path.expandvars(r"%PROGRAMFILES%\LibreOffice\program\soffice.exe"),
            os.path.expandvars(r"%PROGRAMFILES(X86)%\LibreOffice\program\soffice.exe")
        ]
        for p in paths:
            if os.path.exists(p):
                soffice = p
                break
    return soffice

def convertir_a_pdf(filename, original_name):
    ext = original_name.split('.')[-1].lower()
    if ext not in ['docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt']: return False
    
    original_path = os.path.join(VAULT_PATH, filename)
    pdf_filename = f"{filename}.pdf"
    pdf_path = os.path.join(VAULT_PATH, pdf_filename)
    
    if os.path.exists(pdf_path): return True

    try:
        soffice = buscar_libreoffice()
        if not soffice: return False

        temp_input = os.path.join(VAULT_PATH, f"temp_{filename}.{ext}")
        shutil.copyfile(original_path, temp_input)
        cmd = [soffice, '--headless', '--convert-to', 'pdf', '--outdir', VAULT_PATH, temp_input]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if os.path.exists(temp_input): os.remove(temp_input)
        
        temp_output = os.path.join(VAULT_PATH, f"temp_{filename}.pdf")
        if os.path.exists(temp_output):
            os.rename(temp_output, pdf_path)
            return True
    except Exception as e:
        print(f"Error conversion: {e}")
        if os.path.exists(temp_input): 
            try: os.remove(temp_input)
            except: pass
    return False

def inicializar_sistema():
    if not os.path.exists(BASE_DIR): os.makedirs(BASE_DIR)
    if not os.path.exists(VAULT_PATH): os.makedirs(VAULT_PATH)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, rol TEXT);
        CREATE TABLE IF NOT EXISTS carpetas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT);
        CREATE TABLE IF NOT EXISTS archivos (id INTEGER PRIMARY KEY AUTOINCREMENT, carpeta_id INTEGER, nombre_original TEXT, nombre_fisico TEXT UNIQUE, usuario_id INTEGER, fecha_subida DATETIME);
        CREATE TABLE IF NOT EXISTS permisos (usuario_id INTEGER, carpeta_id INTEGER, puede_escribir INTEGER DEFAULT 0, PRIMARY KEY (usuario_id, carpeta_id));
    ''')
    if not c.execute("SELECT * FROM usuarios WHERE username = 'admin'").fetchone():
        pwd = hashlib.sha256("admin123".encode()).hexdigest()
        c.execute("INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, 'admin')", ("admin", pwd))
    conn.commit()
    
    try:
        c.execute("ALTER TABLE archivos ADD COLUMN usuario_id INTEGER")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE archivos ADD COLUMN fecha_subida DATETIME")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE archivos ADD COLUMN comentario TEXT")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE archivos ADD COLUMN revisado INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE archivos ADD COLUMN revisado_por TEXT")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE carpetas ADD COLUMN parent_id INTEGER")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE carpetas ADD COLUMN comentario TEXT")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE carpetas ADD COLUMN fecha_creacion DATETIME")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE carpetas ADD COLUMN revisado INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try:
        c.execute("ALTER TABLE carpetas ADD COLUMN revisado_por TEXT")
    except sqlite3.OperationalError: pass
    conn.commit()
    conn.close()

def configurar_inicio_automatico():
    """Agrega el programa al registro de Windows para que inicie automáticamente."""
    if os.name == 'nt':
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
            
            if getattr(sys, 'frozen', False):
                # Si el sistema fue compilado con PyInstaller
                app_path = f'"{sys.executable}"'
            else:
                # Ejecuta en segundo plano (pythonw) si es un script para no dejar la consola abierta
                python_w = sys.executable.replace("python.exe", "pythonw.exe")
                app_path = f'"{python_w}" "{os.path.abspath(__file__)}"'
                
            winreg.SetValueEx(key, "CTScannerArchivero", 0, winreg.REG_SZ, app_path)
            winreg.CloseKey(key)
        except Exception as e:
            print(f"Error al configurar inicio automático: {e}")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    pwd = hashlib.sha256(data['password'].encode()).hexdigest()
    user = get_db().execute("SELECT id, username, rol FROM usuarios WHERE username=? AND password_hash=?", (data['username'], pwd)).fetchone()
    if user:
        session.update({'user_id': user['id'], 'username': user['username'], 'rol': user['rol']})
        return jsonify({"username": user['username'], "rol": user['rol']})
    return jsonify({"error": "Auth failed"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "ok"})

@app.route('/api/explorador', methods=['GET'])
def explorador():
    if 'user_id' not in session: return jsonify([]), 401
    db = get_db()
    
    if session['rol'] == 'admin':
        carpetas_raw = db.execute("SELECT id, nombre, parent_id, comentario, fecha_creacion, revisado, revisado_por, 1 as puede_escribir FROM carpetas").fetchall()
    else:
        carpetas_raw = db.execute('''
            WITH RECURSIVE
            user_folders(id, nombre, parent_id, comentario, fecha_creacion, revisado, revisado_por, puede_escribir) AS (
                SELECT c.id, c.nombre, c.parent_id, c.comentario, c.fecha_creacion, c.revisado, c.revisado_por, p.puede_escribir 
                FROM carpetas c 
                JOIN permisos p ON c.id = p.carpeta_id 
                WHERE p.usuario_id = ?
                
                UNION
                
                SELECT c.id, c.nombre, c.parent_id, c.comentario, c.fecha_creacion, c.revisado, c.revisado_por, uf.puede_escribir
                FROM carpetas c
                JOIN user_folders uf ON c.parent_id = uf.id
            )
            SELECT id, nombre, parent_id, comentario, fecha_creacion, revisado, revisado_por, MAX(puede_escribir) as puede_escribir 
            FROM user_folders
            GROUP BY id
        ''', (session['user_id'],)).fetchall()
    
    carpetas_dict = {}
    folder_ids = []
    for c in carpetas_raw:
        carpetas_dict[c['id']] = {
            "id": c['id'],
            "nombre": c['nombre'],
            "parent_id": c['parent_id'],
            "comentario": c['comentario'] or "",
            "fecha_creacion": c['fecha_creacion'] or "",
            "revisado": c['revisado'] or 0,
            "revisado_por": c['revisado_por'] or "",
            "puede_escribir": c['puede_escribir'],
            "subcarpetas": [],
            "archivos": []
        }
        folder_ids.append(str(c['id']))

    if folder_ids:
        placeholders = ','.join('?' for _ in folder_ids)
        query = f"SELECT a.id, a.carpeta_id, a.nombre_original, a.fecha_subida, a.comentario, a.revisado, a.revisado_por, u.username FROM archivos a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE a.carpeta_id IN ({placeholders})"
        params = list(folder_ids)
        
        query += " ORDER BY a.fecha_subida DESC"
        
        archivos = db.execute(query, params).fetchall()
        for a in archivos:
            cid = a['carpeta_id']
            if cid in carpetas_dict:
                carpetas_dict[cid]['archivos'].append({
                    "id": a['id'], 
                    "nombre": a['nombre_original'], 
                    "fecha": a['fecha_subida'], 
                    "usuario": a['username'],
                    "comentario": a['comentario'],
                    "revisado": a['revisado'],
                    "revisado_por": a['revisado_por']
                })

    root_folders = []
    for cid, carpeta in carpetas_dict.items():
        pid = carpeta['parent_id']
        if pid and pid in carpetas_dict:
            carpetas_dict[pid]['subcarpetas'].append(carpeta)
        else:
            root_folders.append(carpeta)
            
    return jsonify(root_folders)

@app.route('/api/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    cid = request.form.get('carpeta_id')
    if not file or not cid or 'user_id' not in session: return jsonify({"error": "Faltan datos o sesion"}), 400
    
    nf = str(uuid.uuid4())
    file.save(os.path.join(VAULT_PATH, nf))
    db = get_db()
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    nombre_seguro = secure_filename(file.filename)
    db.execute("INSERT INTO archivos (carpeta_id, nombre_original, nombre_fisico, usuario_id, fecha_subida) VALUES (?, ?, ?, ?, ?)", 
               (cid, nombre_seguro, nf, session['user_id'], fecha))
    db.commit()
    threading.Thread(target=convertir_a_pdf, args=(nf, nombre_seguro)).start()
    return jsonify({"status": "ok"})

@app.route('/api/preview_pdf/<int:aid>')
def preview_pdf(aid):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    db = get_db()
    a = db.execute("SELECT nombre_original, nombre_fisico FROM archivos WHERE id=?", (aid,)).fetchone()
    if not a: return "No encontrado", 404
    
    filename = a['nombre_fisico']
    original_name = a['nombre_original']
    pdf_filename = f"{filename}.pdf"
    pdf_path = os.path.join(VAULT_PATH, pdf_filename)
    
    if os.path.exists(pdf_path):
        return send_file(pdf_path, mimetype='application/pdf', as_attachment=False)
        
    if convertir_a_pdf(filename, original_name):
        return send_file(pdf_path, mimetype='application/pdf', as_attachment=False)

    if not buscar_libreoffice():
        return f"""
            <div style="font-family:sans-serif; text-align:center; padding:40px; color:#475569;">
                <h3 style="color:#ef4444;">⚠️ LibreOffice no encontrado</h3>
                <p>Para visualizar este documento, el servidor requiere tener instalado <b>LibreOffice</b>.</p>
                <p style="font-size:13px; color:#64748b;">Si ya lo instaló, verifique la ruta en <code>app.py</code>.</p>
                <a href="/api/download/{aid}" style="display:inline-block; margin-top:10px; padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:6px;">Descargar Archivo</a>
            </div>
            """, 500

    return "Error en conversión.", 500

@app.route('/api/archivo/<int:aid>', methods=['DELETE'])
def eliminar_archivo(aid):
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    db = get_db()
    a = db.execute("SELECT nombre_fisico FROM archivos WHERE id=?", (aid,)).fetchone()
    
    if a:
        ruta_fisica = os.path.join(VAULT_PATH, a['nombre_fisico'])
        if os.path.exists(ruta_fisica):
            os.remove(ruta_fisica)
            
        db.execute("DELETE FROM archivos WHERE id=?", (aid,))
        db.commit()
        return jsonify({"status": "ok"})
        
    return jsonify({"error": "No encontrado"}), 404

@app.route('/api/view/<int:aid>')
def view_file(aid):
    db = get_db()
    a = db.execute("SELECT nombre_original, nombre_fisico FROM archivos WHERE id=?", (aid,)).fetchone()
    if a:
        mime_type, _ = mimetypes.guess_type(a['nombre_original'])
        return send_file(os.path.join(VAULT_PATH, a['nombre_fisico']), 
                         download_name=a['nombre_original'], mimetype=mime_type, as_attachment=False)
    return "No encontrado", 404

@app.route('/api/download/<int:aid>')
def download(aid):
    db = get_db()
    a = db.execute("SELECT nombre_original, nombre_fisico FROM archivos WHERE id=?", (aid,)).fetchone()
    if a:
        return send_file(os.path.join(VAULT_PATH, a['nombre_fisico']), download_name=a['nombre_original'], as_attachment=True)
    return "No encontrado", 404

@app.route('/api/carpeta', methods=['POST'])
def crear_carpeta():
    if 'user_id' not in session: return jsonify({"error": "No session"}), 401
    db = get_db()
    cursor = db.cursor()
    parent_id = request.json.get('parent_id')
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT INTO carpetas (nombre, parent_id, fecha_creacion) VALUES (?, ?, ?)", (request.json['nombre'], parent_id, fecha))
    cid = cursor.lastrowid
    
    if session.get('rol') != 'admin':
        cursor.execute("INSERT INTO permisos (usuario_id, carpeta_id, puede_escribir) VALUES (?, ?, 1)", (session['user_id'], cid))
        
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/archivo/<int:aid>/revisar', methods=['POST'])
def revisar_archivo(aid):
    if 'user_id' not in session: return jsonify({"error": "No session"}), 401
    db = get_db()
    a = db.execute("SELECT revisado FROM archivos WHERE id=?", (aid,)).fetchone()
    if not a: return jsonify({"error": "No encontrado"}), 404
    
    nuevo_estado = 1 if not a['revisado'] else 0
    revisado_por = session.get('username') if nuevo_estado else None
    
    db.execute("UPDATE archivos SET revisado=?, revisado_por=? WHERE id=?", (nuevo_estado, revisado_por, aid))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/carpeta/<int:cid>', methods=['DELETE'])
def eliminar_carpeta(cid):
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    db = get_db()
    db.execute("DELETE FROM archivos WHERE carpeta_id = ?", (cid,))
    db.execute("DELETE FROM permisos WHERE carpeta_id = ?", (cid,))
    db.execute("DELETE FROM carpetas WHERE id = ?", (cid,))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/archivo/<int:aid>/comentario', methods=['POST'])
def guardar_comentario_archivo(aid):
    if 'user_id' not in session: return jsonify({"error": "No session"}), 401
    comentario = request.json.get('comentario', '')
    db = get_db()
    db.execute("UPDATE archivos SET comentario = ? WHERE id = ?", (comentario, aid))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/usuarios', methods=['POST'])
def crear_usuario():
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    pwd = hashlib.sha256(request.json['password'].encode()).hexdigest()
    db = get_db()
    db.execute("INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, 'user')", (request.json['username'], pwd))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/lista_usuarios', methods=['GET'])
def lista_usuarios():
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    db = get_db()
    users = db.execute("SELECT id, username FROM usuarios WHERE rol != 'admin'").fetchall()
    return jsonify([{"id": u['id'], "username": u['username']} for u in users])

@app.route('/api/usuarios/<int:uid>', methods=['DELETE'])
def eliminar_usuario(uid):
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    db = get_db()
    db.execute("DELETE FROM permisos WHERE usuario_id = ?", (uid,))
    db.execute("DELETE FROM usuarios WHERE id = ?", (uid,))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/datos_permisos')
def datos_permisos():
    db = get_db()
    c = [{"id": x['id'], "nombre": x['nombre']} for x in db.execute("SELECT id, nombre FROM carpetas")]
    return jsonify({"carpetas": c})

@app.route('/api/permisos/<int:cid>', methods=['GET'])
def get_permisos_carpeta(cid):
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    db = get_db()
    users = db.execute("SELECT id, username FROM usuarios WHERE rol != 'admin'").fetchall()
    perms = db.execute("SELECT usuario_id, puede_escribir FROM permisos WHERE carpeta_id = ?", (cid,)).fetchall()
    perm_dict = {p['usuario_id']: p['puede_escribir'] for p in perms}
    
    result = []
    for u in users:
        has_access = u['id'] in perm_dict
        can_write = perm_dict.get(u['id'], 0)
        result.append({
            "id": u['id'],
            "username": u['username'],
            "acceso": 1 if has_access else 0,
            "escritura": can_write
        })
    return jsonify(result)

@app.route('/api/permisos/bulk', methods=['POST'])
def set_permisos_bulk():
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    data = request.json
    cid = data['carpeta_id']
    cambios = data['cambios']
    
    db = get_db()
    for c in cambios:
        uid = c['usuario_id']
        if c['acceso']:
            db.execute("INSERT OR REPLACE INTO permisos (usuario_id, carpeta_id, puede_escribir) VALUES (?, ?, ?)", 
                       (uid, cid, 1 if c['escritura'] else 0))
        else:
            db.execute("DELETE FROM permisos WHERE usuario_id = ? AND carpeta_id = ?", (uid, cid))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/user/password', methods=['PUT'])
def change_password():
    if 'user_id' not in session: return jsonify({"error": "No session"}), 401
    data = request.json
    old = hashlib.sha256(data['old_password'].encode()).hexdigest()
    new = hashlib.sha256(data['new_password'].encode()).hexdigest()
    db = get_db()
    user = db.execute("SELECT id FROM usuarios WHERE id=? AND password_hash=?", (session['user_id'], old)).fetchone()
    if not user: return jsonify({"error": "Bad password"}), 400
    db.execute("UPDATE usuarios SET password_hash=? WHERE id=?", (new, session['user_id']))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/api/usuarios/<int:uid>/password', methods=['PUT'])
def admin_reset_password(uid):
    if session.get('rol') != 'admin': return jsonify({"error": "No admin"}), 403
    new = hashlib.sha256(request.json['new_password'].encode()).hexdigest()
    db = get_db()
    db.execute("UPDATE usuarios SET password_hash=? WHERE id=?", (new, uid))
    db.commit()
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    inicializar_sistema()
    configurar_inicio_automatico()
    
    try:
        print("Iniciando servidor CT Scanner en el puerto 80...")
        serve(app, host='0.0.0.0', port=80)
    except OSError as e:
        print(f"El puerto 80 no está disponible ({e}). Intentando en el puerto alternativo 8080...")
        # Respaldo de seguridad en caso de que Windows IIS u otro servicio ocupe el puerto al arrancar
        serve(app, host='0.0.0.0', port=8080)