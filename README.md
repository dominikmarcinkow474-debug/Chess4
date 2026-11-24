# Chess Best Move

Eine Web-App mit interaktivem Schachbrett. Züge können per Drag-and-drop gespielt oder als PGN/SAN eingegeben werden. Der Button **Besten Zug anzeigen** sendet die Zugfolge an eine FastAPI-API, validiert die Stellung und lässt Stockfish den stärksten Zug berechnen.

## Architektur

```text
Browser (chessboard.js + chess.js)
  ├─ Schachbrett / PGN-Eingabe / Zugliste
  └─ POST /api/analyze { moves: ["e2e4", ...] }
                 │
                 ▼
        FastAPI (app/main.py)
          ├─ Validierung mit python-chess
          └─ StockfishEngine (app/engine.py)
                 │
                 ▼
             Stockfish
```

## Schnellstart mit Docker (empfohlen)

Voraussetzung: Docker mit Docker Compose.

```bash
docker compose up --build
```

Öffne danach http://localhost:8000. API-Dokumentation: http://localhost:8000/docs.

## Lokale Installation

Voraussetzungen: Python 3.11+ und Stockfish installiert und im PATH.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Falls Stockfish nicht im PATH liegt, setze `STOCKFISH_EXECUTABLE` auf den vollständigen Pfad zur Engine.

Optionale Einstellungen:
- `ENGINE_DEPTH=18`: Suchtiefe; höhere Werte brauchen deutlich mehr Zeit.
- `ENGINE_THREADS=2`: Anzahl der Engine-Threads.
- `STOCKFISH_EXECUTABLE`: Pfad zur Stockfish-Binärdatei.

## Bedienung

1. Züge auf dem Brett ziehen oder im PGN-Feld eingeben, z. B. `1. e4 e5 2. Nf3 Nc6`.
2. **Zugfolge laden** anklicken, wenn PGN eingegeben wurde.
3. **Besten Zug anzeigen** anklicken.
4. Die API liefert den Zug in SAN und UCI, eine Stellungsbewertung, Suchtiefe und Hauptvariante.

Promotionen werden im Brett standardmäßig zur Dame ausgeführt. Die Engine bewertet aus Sicht der Seite am Zug.

## API

`POST /api/analyze`

```json
{
  "moves": ["e2e4", "e7e5", "g1f3", "b8c6"]
}
```

Erfolgsantwort (Beispielwerte; der konkrete Zug hängt von Engine-Version und Tiefe ab):

```json
{
  "best_move": "f1b5",
  "best_move_san": "Bb5",
  "evaluation_cp": 30,
  "depth": 18,
  "principal_variation": ["f1b5", "a7a6"],
  "fen": "...",
  "turn": "white",
  "game_status": "in_progress"
}
```

`moves` ist eine chronologische Liste legaler UCI-Züge. Alternativ kann eine Startstellung als `fen` übergeben werden. Fehlerhafte oder illegale Züge ergeben HTTP 422; beendete Partien HTTP 409; Engine-Probleme HTTP 503.

Weitere Endpunkte:
- `GET /api/health`
- `GET /docs` — interaktive OpenAPI-Dokumentation

## Tests

```bash
pytest -q
```

Die Tests verwenden eine Fake-Engine, benötigen also keine installierte Stockfish-Binärdatei.

## Projektstruktur

```text
chess-best-move/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── engine.py
│   └── static/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── tests/
│   └── test_api.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## Hinweise für den Produktivbetrieb

- API hinter HTTPS und einem Reverse Proxy betreiben.
- Rate-Limiting und Authentifizierung ergänzen, wenn die API öffentlich erreichbar ist.
- Engine-Tiefe und Parallelität begrenzen, um CPU-Überlastung zu verhindern.
- Für mehrere Worker je Worker einen eigenen Engine-Prozess oder einen dedizierten Engine-Dienst verwenden.
- Frontend-CDNs für Offline-/Produktivbetrieb lokal hosten und Versionen pinnen.


## Online mit Render veröffentlichen

Das Repository enthält eine `render.yaml`-Blueprint-Datei und ein Dockerfile.

1. ZIP entpacken und den gesamten Projektordner in ein neues GitHub-Repository hochladen.
2. Bei https://render.com anmelden und **New → Blueprint** wählen.
3. Das GitHub-Repository verbinden und die erkannte `render.yaml` bestätigen.
4. Render baut das Docker-Image (inklusive Stockfish) und startet den Web-Service.
5. Nach erfolgreichem Deploy die von Render angezeigte `https://…onrender.com`-Adresse öffnen.

Der Health-Check läuft über `/api/health`. Bei einem kostenlosen Render-Service kann der Dienst nach Inaktivität einschlafen; der erste Aufruf danach kann etwas länger dauern. Die Engine-Tiefe ist für den kostenlosen Betrieb auf 16 und einen Thread eingestellt. Für stärkere Analysen kann `ENGINE_DEPTH` in den Render-Environment-Variablen erhöht werden, sofern ausreichend CPU-Leistung vorhanden ist.

**Wichtig:** Ich kann den Render-Service nicht direkt in deinem Konto veröffentlichen oder eine Live-URL erzeugen. Dafür muss das Repository in deinem GitHub-Konto liegen und Render muss den Blueprint deployen.
