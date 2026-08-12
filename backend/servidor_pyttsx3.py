from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import pyttsx3
import os
import time
import uuid
import threading
import pythoncom


# ============================================================
# CONFIGURAÇÃO DO SERVIDOR
# ============================================================

app = Flask(__name__)
CORS(app)

# Impede duas gerações de voz ao mesmo tempo
tts_lock = threading.Lock()

# Pasta onde os arquivos de áudio serão armazenados
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)


# ============================================================
# FUNÇÃO PARA ENCONTRAR A VOZ EM PORTUGUÊS
# ============================================================

def configurar_engine():
    """
    Cria um novo engine pyttsx3 para cada requisição.
    Isso evita problemas de reutilização do engine no Windows.
    """

    engine = pyttsx3.init('sapi5')

    engine.setProperty('rate', 150)
    engine.setProperty('volume', 1.0)

    voices = engine.getProperty('voices')

    voz_selecionada = False

    for voice in voices:
        nome = voice.name.lower()

        if 'portuguese' in nome or 'brazil' in nome or 'maria' in nome:
            engine.setProperty('voice', voice.id)
            voz_selecionada = True
            break

    if not voz_selecionada:
        print("⚠️ Voz em português não encontrada. Usando a voz padrão.")

    return engine


# ============================================================
# INICIALIZAÇÃO
# ============================================================

print("🚀 Inicializando servidor TTS...")

try:
    teste_engine = configurar_engine()
    teste_voices = teste_engine.getProperty('voices')

    voz_encontrada = False

    for voice in teste_voices:
        nome = voice.name.lower()

        if 'portuguese' in nome or 'brazil' in nome or 'maria' in nome:
            print(f"✅ Voz selecionada: {voice.name}")
            voz_encontrada = True
            break

    teste_engine.stop()

    if not voz_encontrada:
        print("⚠️ Nenhuma voz portuguesa encontrada.")

except Exception as e:
    print(f"⚠️ Aviso durante inicialização do TTS: {e}")

print("✅ TTS pronto!")


# ============================================================
# ROTA PRINCIPAL
# ============================================================

@app.route('/')
def home():

    return jsonify({
        "status": "online",
        "mensagem": "Servidor TTS funcionando!",
        "endpoint": "/tts"
    })


# ============================================================
# ROTA DE TEXT-TO-SPEECH
# ============================================================

@app.route('/tts', methods=['POST'])
def gerar_audio():

    try:

        # --------------------------------------------------------
        # RECEBER DADOS
        # --------------------------------------------------------

        dados = request.get_json(silent=True)

        if not dados:
            return jsonify({
                "erro": "Nenhum JSON foi enviado."
            }), 400

        texto = dados.get('texto', '')

        if not isinstance(texto, str):
            return jsonify({
                "erro": "O campo texto precisa ser uma string."
            }), 400

        texto = texto.strip()

        if not texto:
            return jsonify({
                "erro": "Texto vazio."
            }), 400


        print()
        print("=" * 60)
        print(f"📝 Texto recebido: {texto[:80]}...")
        print("🎤 Gerando áudio...")
        print("=" * 60)


        # --------------------------------------------------------
        # CRIAR NOME DO ARQUIVO
        # --------------------------------------------------------

        nome_arquivo = f"tts_{uuid.uuid4().hex}.wav"

        caminho_arquivo = os.path.abspath(
            os.path.join(CACHE_DIR, nome_arquivo)
        )

        inicio = time.time()


        # --------------------------------------------------------
        # GERAR ÁUDIO
        # --------------------------------------------------------

        with tts_lock:

            # Inicializa o COM do Windows para esta thread
            pythoncom.CoInitialize()

            engine = None

            try:

                # Cria um NOVO engine para esta requisição
                engine = configurar_engine()

                # Solicita a geração do WAV
                engine.save_to_file(
                    texto,
                    caminho_arquivo
                )

                # Aguarda a geração terminar
                engine.runAndWait()

                # Encerra o engine
                engine.stop()

            finally:

                # Libera o COM do Windows
                pythoncom.CoUninitialize()


        # --------------------------------------------------------
        # VERIFICAR ARQUIVO
        # --------------------------------------------------------

        if not os.path.exists(caminho_arquivo):

            raise Exception(
                "O arquivo WAV não foi criado."
            )


        tamanho = os.path.getsize(caminho_arquivo)

        print(f"📦 Tamanho do áudio: {tamanho:,} bytes")


        if tamanho == 0:

            raise Exception(
                "O pyttsx3 criou um arquivo WAV vazio."
            )


        # --------------------------------------------------------
        # FINALIZAÇÃO
        # --------------------------------------------------------

        fim = time.time()

        tempo = fim - inicio

        print(
            f"✅ Áudio gerado em {tempo:.2f} segundos!"
        )

        print(
            f"📁 Arquivo: {caminho_arquivo}"
        )

        print("=" * 60)
        print()


        # --------------------------------------------------------
        # ENVIAR WAV PARA O CLIENTE
        # --------------------------------------------------------

        return send_file(
            caminho_arquivo,
            mimetype='audio/wav',
            as_attachment=False,
            download_name=nome_arquivo
        )


    # ------------------------------------------------------------
    # TRATAMENTO DE ERROS
    # ------------------------------------------------------------

    except Exception as e:

        print()
        print("❌ ERRO NO TTS")
        print(f"❌ {type(e).__name__}: {e}")
        print()

        return jsonify({
            "erro": str(e),
            "tipo": type(e).__name__
        }), 500


# ============================================================
# INICIAR SERVIDOR
# ============================================================

if __name__ == '__main__':

    print()
    print("🌐 Servidor TTS iniciado!")
    print("📍 Local: http://127.0.0.1:5000")
    print("📍 Rede:  http://192.168.1.70:5000")
    print("🔊 Endpoint: POST /tts")
    print()
    print("Pressione CTRL+C para parar o servidor.")
    print()

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )