# Academic Presentation AI Coach (Simple)

비영어권 연구자를 위한 학회 발표 스크립트 생성 및 음성 합성 플랫폼

## 프로젝트 개요

프레젠테이션 파일(PPTX/PDF)을 업로드하면 AI가 각 슬라이드를 분석하고, 발표 스크립트를 생성하고, 음성 파일(MP3)까지 만들어주는 올인원 도구입니다.

### 핵심 기능

- **슬라이드 분석**: Ollama VLM(qwen2.5vl:7b)으로 슬라이드 이미지 자동 분석
- **스크립트 생성**: Ollama LLM(gemma3:27b)으로 슬라이드별 발표 스크립트 생성
- **스크립트 편집**: AI 기반 Smart Editing으로 스크립트 개선
- **음성 합성**: Google TTS(gTTS)를 활용한 6가지 음성 옵션 + 속도 조절
- **스크립트 관리**: 서버 자동 저장, 슬라이드별 덮어쓰기, 일괄 생성
- **재생 속도 조절**: 생성된 오디오를 0.5x ~ 2.0x로 실시간 속도 변경

### 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | FastAPI, Python 3.11+ |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| LLM | Ollama - gemma3:27b (스크립트), qwen2.5vl:7b (비전) |
| TTS | gTTS (Google Text-to-Speech) |
| 패키지 관리 | uv (Python), npm (Node.js) |

## 사전 요구사항

- **uv** (Python 패키지 관리자)
- **Node.js 18+** (권장: 20 LTS)
- **Ollama** (로컬 LLM 실행 환경)
- **최소 16GB RAM** (gemma3:27b 모델용)
- **인터넷 연결** (gTTS 사용)
- **ffmpeg** (선택 - 음성 속도 조절용)

### Ollama 모델 설치

```bash
# Ollama 설치 (macOS)
brew install ollama

# Ollama 서비스 시작
ollama serve

# 모델 다운로드 (새 터미널에서)
ollama pull gemma3:27b
ollama pull qwen2.5vl:7b
```

## 시작 방법

### 방법 1: 통합 스크립트 (권장)

```bash
cd ai-speaker-simple
./start.sh
```

첫 실행 시 가상환경 생성, 의존성 설치가 자동으로 진행됩니다.

시작 후 출력:
```
==========================================
  Backend:  http://localhost:8000
  Frontend: http://localhost:3000
  API Docs: http://localhost:8000/docs
==========================================
  Press Ctrl+C to stop both servers
==========================================
```

### 방법 2: 수동 실행

터미널 1 - 백엔드:
```bash
cd backend
uv venv
uv pip install -r requirements.txt
cp .env.example .env   # 최초 1회
uv run python main.py
```

터미널 2 - 프론트엔드:
```bash
cd frontend
npm install             # 최초 1회
npm run dev
```

### 환경변수 설정

`backend/.env` 파일:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=gemma3:27b
OLLAMA_VISION_MODEL=qwen2.5vl:7b
```

## 종료 방법

- **통합 스크립트 사용 시**: `Ctrl+C` 한 번으로 백엔드/프론트엔드 모두 종료
- **수동 실행 시**: 각 터미널에서 `Ctrl+C`

## 사용 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. 좌측 패널에서 PPTX 또는 PDF 파일 업로드
3. 슬라이드 선택 후 우측 패널에서 "Generate Script" 클릭
4. 생성된 스크립트를 편집하고 "Save" 클릭 → 서버에 자동 저장
5. 음성 옵션 선택 후 "Generate Audio"로 MP3 생성 → 서버에 자동 저장
6. 전체 스크립트 일괄 생성: 좌측 패널 "Generate All Scripts"
7. 중앙 하단 스크립트 리스트에서 슬라이드 클릭 → 해당 스크립트 로드 및 수정 가능
8. 재생 시 Speed 슬라이더로 0.5x ~ 2.0x 실시간 속도 조절

## 데이터 저장 구조

모든 데이터는 서버 로컬 디스크에 저장됩니다. 브라우저를 닫아도 프로젝트를 다시 로드하면 스크립트와 오디오가 복원됩니다.

| 동작 | 저장 위치 | 형식 | 비고 |
|------|-----------|------|------|
| **Save** (스크립트) | `backend/data/projects/{id}/scripts/` | .txt + .json | 슬라이드당 1개, 재저장 시 덮어쓰기 |
| **Generate Audio** | `backend/data/projects/{id}/audio/` | .mp3 | 슬라이드당 1개, 재생성 시 덮어쓰기 |

```
backend/data/projects/{project_id}/
├── metadata.json          # 프로젝트 메타데이터
├── slides/
│   ├── slide_001.png      # 슬라이드 이미지
│   ├── slide_002.png
│   └── ...
├── scripts/
│   ├── slide_001.txt      # Save 시 저장
│   ├── slide_001_metadata.json
│   └── ...
└── audio/
    ├── slide_001.mp3      # Generate Audio 시 저장
    └── ...
```

## 프로젝트 구조

```
ai-speaker-simple/
├── start.sh                    # 통합 실행 스크립트
├── backend/
│   ├── main.py                 # FastAPI 앱, WebSocket, 라우터 등록
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── models/
│       │   └── schemas.py      # Pydantic 데이터 모델
│       ├── routers/
│       │   ├── upload.py       # 파일 업로드, 프로젝트 관리
│       │   ├── vlm.py          # VLM 분석 API
│       │   ├── script.py       # 스크립트 생성/편집/저장
│       │   └── voice.py        # 음성 합성, 오디오 관리
│       └── services/
│           ├── llm_service.py  # Ollama LLM 호출 (단일 진입점)
│           ├── tts_service.py  # Google TTS 음성 생성
│           ├── vlm_service.py  # Ollama Vision 모델 분석
│           └── file_service.py # 파일 처리 (PPTX/PDF -> 슬라이드)
├── frontend/
│   └── src/
│       ├── app/
│       │   └── page.tsx        # 메인 페이지
│       └── components/
│           ├── ControlPanel.tsx # 좌측 사이드바 (업로드, 설정)
│           ├── SlideViewer.tsx  # 슬라이드 뷰어 + 스크립트 테이블
│           ├── ScriptEditor.tsx # 스크립트 편집기 + 오디오 생성
│           └── MainLayout.tsx   # 헤더 레이아웃
└── backend/data/               # 런타임 데이터 (gitignore, 상세 구조는 위 참조)
```

## 처리 흐름

```
파일 업로드 (PPTX/PDF)
    │
    ▼
file_service: 슬라이드 이미지 추출
    │
    ▼
vlm_service: 슬라이드 시각 분석 (qwen2.5vl:7b)
    │
    ▼
llm_service: 발표 스크립트 생성 (gemma3:27b)
    │
    ▼
tts_service: 음성 합성 (gTTS → MP3)
```

## FAQ

**Q: Ollama 모델이 느려요.**
A: gemma3:27b는 최소 16GB RAM이 필요합니다. Apple Silicon Mac에서 최적 성능을 발휘합니다.

**Q: 음성 생성이 안 돼요.**
A: gTTS는 인터넷 연결이 필요합니다. 네트워크를 확인하세요.

**Q: 음성 속도 조절이 안 돼요.**
A: ffmpeg가 필요합니다. `brew install ffmpeg`로 설치하세요. ffmpeg 없이도 기본 속도(1.0x)로 생성됩니다.

**Q: 포트가 이미 사용 중이라고 나와요.**
A: `start.sh`가 자동으로 사용 가능한 포트를 찾습니다. 수동 실행 시 `npm run dev -- --port 3001` 등으로 변경하세요.

## 라이선스

MIT License
