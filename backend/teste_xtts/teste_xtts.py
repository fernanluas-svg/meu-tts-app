import torch
from TTS.api import TTS

device = "cpu"
print(f"Rodando no dispositivo: {device}")

print("Carregando modelo XTTS-v2...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

print("Gerando áudio de teste...")
# Passamos um speaker padrão do próprio modelo XTTS-v2
tts.tts_to_file(
    text="Fala Lucão! Este é um teste do Coqui XTTS v2 rodando localmente no nosso projeto.",
    speaker="Ana Florence",
    language="pt",
    file_path="saida_xtts.wav"
)

print("\nSucesso! Áudio gerado e salvo em: saida_xtts.wav")