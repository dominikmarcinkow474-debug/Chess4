import os
import threading
import chess
import chess.engine


class StockfishEngine:
    """One shared Stockfish process; serialize analysis requests."""
    def __init__(self, path=None, depth=18):
        self.path = path or os.getenv("STOCKFISH_EXECUTABLE", "stockfish")
        self.depth = int(os.getenv("ENGINE_DEPTH", depth))
        self._engine = None
        self._lock = threading.Lock()

    def start(self):
        if self._engine is None:
            self._engine = chess.engine.SimpleEngine.popen_uci(self.path)
            threads = int(os.getenv("ENGINE_THREADS", "2"))
            self._engine.configure({"Threads": threads})
        return self

    def close(self):
        if self._engine is not None:
            self._engine.quit()
            self._engine = None

    def best_move(self, board):
        if self._engine is None:
            self.start()
        with self._lock:
            info = self._engine.analyse(board, chess.engine.Limit(depth=self.depth))
        move = info["pv"][0] if info.get("pv") else None
        if move is None:
            raise RuntimeError("Die Engine konnte keinen Zug bestimmen.")
        score = info.get("score")
        score_cp = score.pov(board.turn).score(mate_score=100000) if score else None
        pv = info.get("pv", [])
        return {
            "best_move": move.uci(),
            "best_move_san": board.san(move),
            "evaluation_cp": score_cp,
            "depth": info.get("depth", self.depth),
            "principal_variation": [board.uci(m) for m in pv],
        }
