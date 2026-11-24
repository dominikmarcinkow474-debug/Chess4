
"use strict";

if (typeof Chess === "undefined") {
  document.getElementById("result").textContent =
    "Fehler: Die Schachbibliothek konnte nicht geladen werden.";
  throw new Error("Chess.js nicht geladen");
}

const game = new Chess();

const boardElement = document.getElementById("board");
const turnElement = document.getElementById("turn");
const resultElement = document.getElementById("result");
const historyElement = document.getElementById("history");

const analyzeButton = document.getElementById("analyze");
const playButton = document.getElementById("play-best");

const pieces = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟"
};

let flipped = false;
let selectedSquare = null;
let legalTargets = [];
let bestMove = null;
let lastMove = null;
let dragFrom = null;
let suppressClick = false;

function squareName(row, col) {
  const files = "abcdefgh";
  const rank = flipped ? row + 1 : 8 - row;
  const file = flipped ? files[7 - col] : files[col];
  return file + rank;
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareName(row, col);
      const piece = game.get(square);

      const element = document.createElement("div");

      element.className =
        "square " +
        ((row + col) % 2 === 0 ? "light" : "dark");

      element.dataset.square = square;

      if (piece) {
        const key = piece.color + piece.type;
        element.textContent = pieces[key];
        element.classList.add(
          piece.color === "w" ? "white-piece" : "black-piece"
        );
      }

      if (selectedSquare === square) {
        element.classList.add("selected");
      }

      if (legalTargets.includes(square)) {
        element.classList.add("legal");
      }

      if (bestMove) {
        if (bestMove.from === square) {
          element.classList.add("best-from");
        }
        if (bestMove.to === square) {
          element.classList.add("best-to");
        }
      }

      if (lastMove &&
          (lastMove.from === square || lastMove.to === square)) {
        element.classList.add("last-move");
      }

      boardElement.appendChild(element);
    }
  }

  turnElement.textContent =
    game.turn() === "w" ? "WEISS AM ZUG" : "SCHWARZ AM ZUG";

  updateHistory();
}

function updateHistory() {
  const history = game.history();

  if (!history.length) {
    historyElement.textContent = "Noch keine Züge.";
    return;
  }

  let text = "";

  for (let i = 0; i < history.length; i += 2) {
    text += (Math.floor(i / 2) + 1) + ". " + history[i];

    if (history[i + 1]) {
      text += " " + history[i + 1];
    }

    text += "   ";
  }

  historyElement.textContent = text;
}

function clearBestMove() {
  bestMove = null;
  playButton.disabled = true;
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
}

function selectSquare(square) {
  const piece = game.get(square);

  if (!piece || piece.color !== game.turn()) {
    return false;
  }

  selectedSquare = square;

  legalTargets = game.moves({
    square: square,
    verbose: true
  }).map(move => move.to);

  renderBoard();
  return true;
}

function makeMove(from, to) {
  const move = game.move({
    from: from,
    to: to,
    promotion: "q"
  });

  if (!move) {
    return false;
  }

  lastMove = {
    from: move.from,
    to: move.to
  };

  clearSelection();
  clearBestMove();

  resultElement.innerHTML =
    "<strong>ZUG GESPIELT</strong><br>" +
    move.san;

  renderBoard();

  if (game.game_over()) {
    resultElement.innerHTML += "<br><strong>SPIEL BEENDET</strong>";
  }

  return true;
}

function handleSquare(square) {
  if (game.game_over()) return;

  if (!selectedSquare) {
    selectSquare(square);
    return;
  }

  if (selectedSquare === square) {
    clearSelection();
    renderBoard();
    return;
  }

  if (makeMove(selectedSquare, square)) {
    return;
  }

  if (!selectSquare(square)) {
    clearSelection();
    renderBoard();
  }
}

// iPad: Antippen und Ziehen.
boardElement.addEventListener("pointerdown", event => {
  const squareElement = event.target.closest(".square");
  if (!squareElement) return;

  const square = squareElement.dataset.square;
  const piece = game.get(square);

  if (piece && piece.color === game.turn()) {
    dragFrom = square;
    try {
      squareElement.setPointerCapture(event.pointerId);
    } catch (_) {}
  }
});

boardElement.addEventListener("pointerup", event => {
  if (!dragFrom) return;

  const targetElement = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const squareElement = targetElement
    ? targetElement.closest(".square")
    : null;

  const target = squareElement
    ? squareElement.dataset.square
    : null;

  const from = dragFrom;
  dragFrom = null;

  if (target && target !== from) {
    if (makeMove(from, target)) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 100);
    }
  }
});

boardElement.addEventListener("pointercancel", () => {
  dragFrom = null;
});

// Funktioniert auch mit einfachem Antippen.
boardElement.addEventListener("click", event => {
  if (suppressClick) return;

  const squareElement = event.target.closest(".square");
  if (!squareElement) return;

  handleSquare(squareElement.dataset.square);
});

// Brett drehen.
document.getElementById("flip").addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});

// Zug zurücknehmen.
document.getElementById("undo").addEventListener("click", () => {
  const undone = game.undo();

  if (!undone) return;

  lastMove = null;
  clearSelection();
  clearBestMove();

  resultElement.textContent = "Zug zurückgenommen.";
  renderBoard();
});

// Neues Spiel.
document.getElementById("reset").addEventListener("click", () => {
  game.reset();

  lastMove = null;
  clearSelection();
  clearBestMove();

  resultElement.textContent = "Neues Spiel gestartet.";
  renderBoard();
});

// Stockfish-Analyse.
analyzeButton.addEventListener("click", async () => {
  if (game.game_over()) {
    resultElement.textContent = "Das Spiel ist beendet.";
    return;
  }

  analyzeButton.disabled = true;
  playButton.disabled = true;

  resultElement.textContent = "Stockfish analysiert die Stellung ...";

  try {
    const moves = game.history({ verbose: true }).map(move =>
      move.from + move.to + (move.promotion || "")
    );

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ moves: moves })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analyse fehlgeschlagen");
    }

    const uci = data.best_move;

    if (!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      throw new Error("Stockfish hat keinen gültigen Zug geliefert.");
    }

    const candidate = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q"
    });

    if (!candidate) {
      throw new Error("Der berechnete Zug ist nicht legal.");
    }

    game.undo();

    bestMove = {
      from: candidate.from,
      to: candidate.to,
      promotion: uci[4] || "q",
      san: candidate.san
    };

    renderBoard();

    const evaluation =
      typeof data.evaluation === "number"
        ? (data.evaluation / 100).toFixed(2)
        : "Nicht verfügbar";

    resultElement.innerHTML =
      "<strong>BESTER ZUG: " + candidate.san + "</strong><br>" +
      "Von: " + candidate.from + "<br>" +
      "Nach: " + candidate.to + "<br>" +
      "Bewertung: " + evaluation;

    playButton.disabled = false;

  } catch (error) {
    resultElement.textContent = "Fehler: " + error.message;
  } finally {
    analyzeButton.disabled = false;
  }
});

// Besten Zug ausführen.
playButton.addEventListener("click", () => {
  if (!bestMove) return;

  const move = game.move({
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion || "q"
  });

  if (!move) {
    resultElement.textContent = "Der Zug kann nicht ausgeführt werden.";
    return;
  }

  lastMove = {
    from: move.from,
    to: move.to
  };

  clearSelection();
  clearBestMove();

  resultElement.innerHTML =
    "<strong>BESTER ZUG AUSGEFÜHRT</strong><br>" + move.san;

  renderBoard();
});

renderBoard();
