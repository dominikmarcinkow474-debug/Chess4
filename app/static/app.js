
const game = new Chess();
let board;
let bestMove = null;

const result = document.getElementById("result");
const historyBox = document.getElementById("history");
const turn = document.getElementById("turn");
const analyzeButton = document.getElementById("analyze");
const playButton = document.getElementById("play-best");

function clearBestMove() {
  document.querySelectorAll(".best-from, .best-to").forEach(el => {
    el.classList.remove("best-from", "best-to");
  });
  bestMove = null;
  playButton.disabled = true;
}

function update() {
  board.position(game.fen());

  turn.textContent = game.turn() === "w"
    ? "Weiß ist am Zug"
    : "Schwarz ist am Zug";

  const moves = game.history();
  historyBox.textContent = moves.length
    ? moves.map((m, i) =>
        (i % 2 === 0 ? (Math.floor(i / 2) + 1) + ". " : "") + m
      ).join(" ")
    : "Noch keine Züge.";

  clearBestMove();

  if (game.game_over()) {
    result.textContent = "Spiel beendet.";
  }
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;

  if (game.turn() === "w" && piece.startsWith("b")) return false;
  if (game.turn() === "b" && piece.startsWith("w")) return false;
}

function onDrop(source, target) {
  clearBestMove();

  const move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (!move) return "snapback";

  result.textContent = "Zug gespielt. Nächster Spieler ist am Zug.";
  update();
}

function onSnapEnd() {
  board.position(game.fen());
}

board = Chessboard("board", {
  position: "start",
  draggable: true,
  pieceTheme:
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
  onDragStart,
  onDrop,
  onSnapEnd
});

document.getElementById("flip").onclick = () => board.flip();

document.getElementById("undo").onclick = () => {
  game.undo();
  result.textContent = "Zug zurückgenommen.";
  update();
};

document.getElementById("reset").onclick = () => {
  game.reset();
  result.textContent = "Neues Spiel gestartet.";
  update();
};

analyzeButton.onclick = async () => {
  if (game.game_over()) {
    result.textContent = "Das Spiel ist beendet.";
    return;
  }

  analyzeButton.disabled = true;
  result.textContent = "Stockfish analysiert ...";

  try {
    const moves = game.history({ verbose: true }).map(m =>
      m.from + m.to + (m.promotion || "")
    );

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analyse fehlgeschlagen");
    }

    // Stockfish liefert einen UCI-Zug, z. B. e2e4 oder e7e8q.
    const uci = data.best_move;

    if (!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      throw new Error("Ungültiger Zug von Stockfish: " + uci);
    }

    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q"
    });

    if (!move) {
      throw new Error("Stockfish-Zug ist in dieser Stellung nicht legal.");
    }

    game.undo();

    bestMove = {
      from: move.from,
      to: move.to,
      promotion: uci[4] || "q"
    };

    const from = document.querySelector(".square-" + move.from);
    const to = document.querySelector(".square-" + move.to);

    if (from) from.classList.add("best-from");
    if (to) to.classList.add("best-to");

    playButton.disabled = false;

    result.innerHTML =
      "<strong>BESTER ZUG: " + move.san + "</strong><br>" +
      "Von: " + move.from + "<br>" +
      "Nach: " + move.to +
      "<br>Bewertung: " + (data.evaluation ?? "Nicht verfügbar");

  } catch (error) {
    result.textContent = "Fehler: " + error.message;
  } finally {
    analyzeButton.disabled = false;
  }
};

playButton.onclick = () => {
  if (!bestMove) return;

  const move = game.move(bestMove);

  if (move) {
    result.textContent = "Bester Zug ausgeführt: " + move.san;
    update();
  }
};

window.addEventListener("resize", () => board.resize());

update();
