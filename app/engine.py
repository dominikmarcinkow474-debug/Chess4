
import os
import shutil
import threading

import chess
import chess.engine


class StockfishEngine:

    def __init__(self):
        self.engine = None
        self.ready = False
        self.lock = threading.Lock()

        self.depth = int(os.getenv("ENGINE_DEPTH", "16"))
        self.threads = int(os.getenv("ENGINE_THREADS", "1"))

    def start(self):
        executable = os.getenv("STOCKFISH_EXECUTABLE")

        if not executable:
            executable = shutil.which("stockfish")

        if not executable:
            raise RuntimeError("Stockfish wurde nicht gefunden.")

        self.engine = chess.engine.SimpleEngine.popen_uci(executable)

        self.engine.configure({
            "Threads": self.threads
        })

        self.ready = True

    def analyze(self, board: chess.Board):
        if not self.ready or self.engine is None:
            raise RuntimeError("Stockfish ist nicht gestartet.")

        with self.lock:
            info = self.engine.analyse(
                board,
                chess.engine.Limit(depth=self.depth)
            )

        pv = info.get("pv", [])

        if not pv:
            raise RuntimeError("Stockfish hat keinen Zug gefunden.")

        best_move = pv[0]

        score = info["score"].pov(board.turn).score(
            mate_score=100000
        )

        return {
            "best_move": best_move.uci(),
            "evaluation": score,
            "depth": info.get("depth", self.depth)
        }

    def close(self):
        if self.engine:
            self.engine.quit()
            self.engine = None

        self.ready = False
