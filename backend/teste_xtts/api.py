from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import torch
import os
import re
from unidecode import unidecode
from TTS.api import TTS

app = FastAPI(title="VoxGemini - Coqui XTTS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/vozes", StaticFiles(directory="vozes"), name="vozes")

device = "cpu"
print("Carregando modelo Coqui XTTS-v2...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("Modelo carregado com sucesso!")

import re

def limpar_texto(texto: str) -> str:
    if not texto:
        return ""

    # 1. NORMALIZAÇÃO DE ESPAÇOS E QUEBRAS DE LINHA (PARÁGRAFOS)
    # Transforma quebras de parágrafo/linha em vírgulas com pausa natural
    texto = re.sub(r'[\r\n]+', ', ', texto)

    # 2. TRATAMENTO DE ABREVIAÇÕES COMUNS
    # Impede que o modelo confunda pontos de abreviação com fim de frase
    abrevs = {
        r'\bSr\.\b': 'Senhor',
        r'\bSra\.\b': 'Senhora',
        r'\bDr\.\b': 'Doutor',
        r'\bDra\.\b': 'Doutora',
        r'\bProf\.\b': 'Professor',
        r'\bProfa\.\b': 'Professora',
        r'\bex\.\b': 'exemplo',
        r'\bp\.\b': 'página',
        r'\bvs\.\b': 'verso',
        r'\betc\.\b': 'etcétara',
    }
    for abrev, expansao in abrevs.items():
        texto = re.sub(abrev, expansao, texto, flags=re.IGNORECASE)

    # 3. TRATAMENTO DE NUMERAIS E SÍMBOLOS ESPECIAIS
    # Transforma símbolos gráficos em palavras para o modelo não ignorar ou estalar
    texto = re.sub(r'(\d+)\s*%', r'\1 por cento', texto)
    texto = re.sub(r'R\$\s*(\d+)', r'\1 reais', texto)
    texto = re.sub(r'&', ' e ', texto)

    # 4. NORMALIZAÇÃO DE RETICÊNCIAS E TRAVESSÕES (PAUSAS EXPRESSIVAS)
    # Reticências, hífens duplos ou travessões vira pausa suave (vírgula)
    texto = re.sub(r'\.{2,}', ',', texto)
    texto = re.sub(r'[\—\–\-]{2,}', ',', texto)

    # 5. CONVERSÃO INTELIGENTE DE PONTOS DE FIM DE FRASE/PARÁGRAFO
    # Converte pontos finais seguidos de espaço/fim de texto em vírgulas controladas.
    # Isso impede a leitura literal do caractere "." e força o XTTS a dar a cadência correta.
    texto = re.sub(r'\.(?=\s|$)', ',', texto)

    # 6. LIMPEZA DE PONTUAÇÕES DUPLICADAS OU CONFLITANTES
    # Limpa sequências estranhas como ",," ou ",." ou "?," geradas pelas trocas anteriores
    texto = re.sub(r',\s*,+', ',', texto)
    texto = re.sub(r'([?!]),+', r'\1', texto)

    # 7. ESPAÇAMENTO ISOLADO PARA CADÊNCIA
    # Garante que haja exatamente um espaço após cada vírgula, ponto de interrogação ou exclamação
    texto = re.sub(r'([,?!])(?=[^\s])', r'\1 ', texto)

    # 8. REMOÇÃO DE CARACTERES ESTRANHOS / LIMPEZA FINAL
    # Remove símbolos não pronunciaveis (como asteriscos, aspas soltas, colchetes)
    texto = re.sub(r'[\[\]\(\)\{\}\*\_\"\']', '', texto)
    texto = re.sub(r'\s+', ' ', texto)

    return texto.strip()

class TTSRequest(BaseModel):
    text: str
    voice: str
    temperature: float = 0.75
    speed: float = 1.0

@app.get("/api/preview/{voice}")
async def get_voice_preview(voice: str):
    file_path = os.path.join("vozes", f"{voice.lower().strip()}.wav")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Voz não encontrada")

@app.post("/api/tts")
async def generate_tts(req: TTSRequest):
    voice_name = req.voice.lower().strip()
    caminho_wav = os.path.join("vozes", f"{voice_name}.wav")
    caminho_saida = "output.wav"
    
    if not os.path.exists(caminho_wav):
        raise HTTPException(status_code=404, detail="Voz não encontrada")
    
    texto_limpo = limpar_texto(req.text)
    
    tts.tts_to_file(
        text=texto_limpo,
        speaker_wav=caminho_wav,
        language="pt",
        file_path=caminho_saida,
        temperature=req.temperature,
        speed=req.speed
    )
    
    return FileResponse(caminho_saida, media_type="audio/wav", filename="audio.wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)