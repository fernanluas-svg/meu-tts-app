# servidor.py
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from TTS.api import TTS
import tempfile
import os
import hashlib
import time

app = Flask(__name__)
CORS(app)

print("🚀 Carregando o modelo TTS...")
tts = TTS("tts_models/pt/cv/vits")
print("✅ Modelo pronto!")

CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "mensagem": "Servidor TTS funcionando! Use /tts para gerar áudio."
    })

@app.route('/tts', methods=['POST'])
def gerar_audio():
    try:
        dados = request.json
        texto = dados.get('texto', '')
        
        if not texto:
            return jsonify({"erro": "Texto vazio"}), 400
        
        print(f"📝 Texto recebido: {texto[:50]}...")
        
        hash_texto = hashlib.md5(texto.encode()).hexdigest()
        caminho_cache = os.path.join(CACHE_DIR, f"{hash_texto}.wav")
        
        if os.path.exists(caminho_cache):
            print("📦 Áudio do cache!")
            return send_file(caminho_cache, as_attachment=True)
        
        print("🎤 Gerando áudio...")
        inicio = time.time()
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tts.tts_to_file(text=texto, file_path=tmp.name)
            
            import shutil
            shutil.copy2(tmp.name, caminho_cache)
            
            fim = time.time()
            print(f"✅ Áudio gerado em {fim - inicio:.2f} segundos!")
            
            return send_file(tmp.name, as_attachment=True)
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        return jsonify({"erro": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)