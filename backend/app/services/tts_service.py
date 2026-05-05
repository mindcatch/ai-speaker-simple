import subprocess
import re
from pathlib import Path
from gtts import gTTS

# Voice configurations for Google TTS
VOICE_CONFIGS = {
    'us_standard': {
        'tld': 'com', 'slow': False,
        'name': 'US English (Standard)', 'description': 'Presentation Default',
        'region': 'US', 'tone': 'Standard'
    },
    'uk_formal': {
        'tld': 'co.uk', 'slow': False,
        'name': 'British English', 'description': 'Formal Presentation',
        'region': 'UK', 'tone': 'Formal'
    },
    'au_friendly': {
        'tld': 'com.au', 'slow': False,
        'name': 'Australian English', 'description': 'Friendly Tone',
        'region': 'AU', 'tone': 'Friendly'
    },
    'us_deep': {
        'tld': 'com', 'slow': True,
        'name': 'US English (Deep)', 'description': 'Serious Presentation',
        'region': 'US', 'tone': 'Serious'
    },
    'ca_neutral': {
        'tld': 'ca', 'slow': False,
        'name': 'Canadian English', 'description': 'Neutral Tone',
        'region': 'CA', 'tone': 'Neutral'
    },
    'us_energetic': {
        'tld': 'com', 'slow': False,
        'name': 'US English (Energetic)', 'description': 'Dynamic Presentation',
        'region': 'US', 'tone': 'Energetic'
    }
}


def get_voice_config(voice_name: str) -> dict:
    return VOICE_CONFIGS.get(voice_name, VOICE_CONFIGS['us_standard'])


def get_all_voice_options() -> list:
    """Return voice options formatted for frontend"""
    flag_map = {'US': '\U0001f1fa\U0001f1f8', 'UK': '\U0001f1ec\U0001f1e7', 'AU': '\U0001f1e6\U0001f1fa', 'CA': '\U0001f1e8\U0001f1e6'}
    options = []
    for key, config in VOICE_CONFIGS.items():
        options.append({
            "value": key,
            "label": config['name'],
            "description": config['description'],
            "region": config['region'],
            "tone": config['tone'],
            "flag": flag_map.get(config['region'], '\U0001f30d'),
            "recommended": key == 'us_standard'
        })
    return options


def _preprocess_text(text: str) -> str:
    """Preprocess text for natural TTS pronunciation"""
    text = re.sub(r'^(Good morning|Hello|Hi),?\s*', r'\1, ', text)
    text = re.sub(r'([.!?])\s*([A-Z])', r'\1 \2', text)
    text = text.replace('Dr.', 'Doctor')
    text = text.replace('Prof.', 'Professor')
    text = text.replace('Dept.', 'Department')
    text = text.replace('Univ.', 'University')
    return text


def _detect_language(text: str) -> str:
    """Detect language from script text by counting CJK characters"""
    korean = sum(1 for c in text if '가' <= c <= '힣')
    japanese = sum(1 for c in text if '぀' <= c <= 'ゟ' or '゠' <= c <= 'ヿ')
    chinese_or_kanji = sum(1 for c in text if '一' <= c <= '鿿')

    if korean > 5:
        return 'ko'
    if japanese > 5:
        return 'ja'
    if chinese_or_kanji > 10:
        return 'ja'  # Treat as Japanese (kanji); use 'zh-CN' if pure Chinese is needed
    return 'en'


def _generate_gtts(text: str, voice: str, output_path: Path) -> bool:
    """Generate audio using Google TTS with auto language detection"""
    config = get_voice_config(voice)
    lang = _detect_language(text)
    # Voice region (tld) only applies to English; other languages use default
    tld = config['tld'] if lang == 'en' else 'com'
    tts = gTTS(text=text, lang=lang, tld=tld, slow=config['slow'])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tts.save(str(output_path))
    return True


def _apply_speed(text: str, voice: str, speed: float, output_path: Path) -> bool:
    """Generate gTTS audio with speed control via ffmpeg"""
    speed = max(0.5, min(2.0, speed))

    if abs(speed - 1.0) < 0.1:
        return _generate_gtts(text, voice, output_path)

    temp_path = output_path.parent / (output_path.stem + '_temp.mp3')
    _generate_gtts(text, voice, temp_path)

    try:
        subprocess.run(
            ['ffmpeg', '-i', str(temp_path), '-filter:a', f'atempo={speed}',
             '-acodec', 'libmp3lame', '-b:a', '192k', str(output_path), '-y'],
            check=True, capture_output=True
        )
        temp_path.unlink()
        return True
    except subprocess.CalledProcessError:
        # ffmpeg not available - use original without speed adjustment
        if temp_path.exists():
            temp_path.rename(output_path)
        return True


def generate_audio(text: str, output_path: Path, voice: str = "us_standard", speed: float = 1.0) -> bool:
    """
    Generate presentation audio using Google TTS.
    Requires internet connection.
    """
    processed_text = _preprocess_text(text)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _apply_speed(processed_text, voice, speed, output_path)
