
const game = new Chess();

let board = null;
let bestMove = null;

const boardElement = document.getElementById("board");
const resultElement = document.getElementById("result");
const historyElement = document.getElementById("history");
const turnElement = document.getElementById("turn");
const analyzeButton = document.getElementById("analyze");
const playBestButton = document.getElementById("play-best");

function clearSuggestion() {
  document.querySelectorAll(".best-from, .best-to")
    .forEach(square => {
      square.classList.remove("best-from", "best-to");
    });

  bestMove = null;
  playBestButton.disabled = true;
}

function markBestMove(move) {
  clearSuggestion();

  if (!move) return;

  bestMove = move;

  const fromSquare = document.querySelector(
    ".square-" + move.from
  );

  const toSquare = document.querySelector(
    ".square-" + move.to
  );

  if (fromSquare) fromSquare.classList.add("best-from");
  if (toSquare) toSquare.classList.add("best-to");

  playBestButton.disabled = false;
}

function updateScreen() {
  board.position(game.fen());

  turnElement.textContent =
    game.turn() === "w"
      ? "Weiß ist am Zug"
      : "Schwarz ist am Zug";

  const history = game.history();

  if (history.length === 0) {
    historyElement.textContent = "Noch keine Züge.";
  } else {
    let output = "";

    for (let i = 0; i < history.length; i += 2) {
      output +=
        (Math.floor(i / 2) + 1) + ". " +
        history[i] + " " +
        (history[i + 1] || "") + "   ";
    }

    historyElement.textContent = output;
  }

  clearSuggestion();

  if (game.game_over()) {
    resultElement.textContent = "Das Spiel ist beendet.";
  }
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;

  if (
    (game.turn() === "w" && piece.startsWith("b")) ||
    (game.turn() === "b" && piece.startsWith("w"))
  ) {
    return false;
  }
}

function onDrop(source, target) {
  clearSuggestion();

  const move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (move === null) {
    return "snapback";
  }

  resultElement.textContent = "Zug gespielt. Du kannst jetzt analysieren.";
  updateScreen();
}

function onSnapEnd() {
  board.position(game.fen());
}

board = Chessboard("board", {
  position: "start",
  draggable: true,
  pieceTheme:
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
});

document.getElementById("flip").addEventListener("click", () => {
  board.flip();
});

document.getElementById("undo").addEventListener("click", () => {
  game.undo();
  resultElement.textContent = "Letzter Zug zurückgenommen.";
  updateScreen();
});

document.getElementById("reset").addEventListener("click", () => {
  game.reset();
  resultElement.textContent = "Neues Spiel gestartet.";
  updateScreen();
});

analyzeButton.addEventListener("click", async () => {
  if (game.game_over()) {
    resultElement.textContent = "Das Spiel ist bereits beendet.";
    return;
  }

  analyzeButton.disabled = true;
  resultElement.textContent = "Stockfish analysiert die Stellung ...";

  try {
    const moves = game.history({ verbose: true })
      .map(move => move.from + move.to + (move.promotion || ""));

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        moves: moves
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analyse fehlgeschlagen.");
    }

    const move = data.best_move;

    if (!move) {
      throw new Error("Die Engine hat keinen Zug zurückgegeben.");
    }

    const parsedMove = game.move(move, { sloppy: true });

    if (!parsedMove) {
      throw new Error("Der beste Zug konnte nicht erkannt werden.");
    }

    game.undo();

    markBestMove({
      from: parsedMove.from,
      to: parsedMove.to,
      san: parsedMove.san
    });

    resultElement.innerHTML =
      "<strong>BESTER ZUG: " + parsedMove.san + "</strong><br>" +
      "Von: " + parsedMove.from + "<br>" +
      "Nach: " + parsedMove.to + "<br>" +
      "Engine: Stockfish";

  } catch (error) {
    resultElement.textContent = "Fehler: " + error.message;
  } finally {
    analyzeButton.disabled = false;
  }
});

playBestButton.addEventListener("click", () => {
  if (!bestMove) return;

  const move = game.move({
    from: bestMove.from,
    to: bestMove.to,
    promotion: "q"
  });

  if (move) {
    resultElement.textContent =
      "Bester Zug gespielt: " + move.san;

    updateScreen();
  }
});

window.addEventListener("resize", () => {
  if (board) board.resize();
});

updateScreen();
