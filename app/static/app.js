
"use strict";

if (typeof Chess === "undefined") {
  alert("Die Schachbibliothek konnte nicht geladen werden.");
  throw new Error("Chess.js nicht geladen");
}

const game = new Chess();

const boardElement = document.getElementById("board");
const turnElement = document.getElementById("turn");
const resultElement = document.getElementById("result");
const historyElement = document.getElementById("history");

const analyzeButton = document.getElementById("analyze");
const playButton = document.getElementById("play-best");

const adOverlay = document.getElementById("ad-overlay");
const closeAdButton = document.getElementById("close-ad");

const pieces = {
  wk: "♔", wq: "♕", wr: "♖",
  wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜",
  bb: "♝", bn: "♞", bp: "♟"
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
        element.textContent = pieces[piece.color + piece.type];
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

  let output = "";

  for (let i = 0; i < history.length; i += 2) {
    output += (Math.floor(i / 2) + 1) + ". " + history[i];

    if (history[i + 1]) {
      output += " " + history[i + 1];
    }

    output += "   ";
  }

  historyElement.textContent = output;
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

  if (!move) return false;

  lastMove = {
    from: move.from,
    to: move.to
  };

  clearSelection();
  clearBestMove();

  resultElement.hidden = false;
  resultElement.textContent = "Zug gespielt: " + move.san;

  renderBoard();

  if (game.game_over()) {
    resultElement.textContent += " – Spiel beendet.";
  }

  return true;
}

// Figuren auf dem Brett bewegen
boardElement.addEventListener("pointerdown", event => {
  const squareElement = event.target.closest(".square");
  if (!squareElement) return;

  const square = squareElement.dataset.square;
  const piece = game.get(square);

  if (piece && piece.color === game.turn()) {
    dragFrom = square;
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

  if (target && target !== from && makeMove(from, target)) {
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 100);
  }
});

boardElement.addEventListener("pointercancel", () => {
  dragFrom = null;
});

// Figuren durch Antippen bewegen
boardElement.addEventListener("click", event => {
  if (suppressClick) return;

  const squareElement = event.target.closest(".square");
  if (!squareElement) return;

  const square = squareElement.dataset.square;

  if (!selectedSquare) {
    selectSquare(square);
    return;
  }

  if (selectedSquare === square) {
    clearSelection();
    renderBoard();
    return;
  }

  if (!makeMove(selectedSquare, square)) {
    if (!selectSquare(square)) {
      clearSelection();
      renderBoard();
    }
  }
});

// Brett drehen
document.getElementById("flip").addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});

// Zug zurücknehmen
document.getElementById("undo").addEventListener("click", () => {
  if (!game.undo()) return;

  lastMove = null;
  clearSelection();
  clearBestMove();

  resultElement.hidden = true;
  renderBoard();
});

// Neues Spiel + Werbeeinblendung
document.getElementById("reset").addEventListener("click", () => {
  game.reset();

  lastMove = null;
  clearSelection();
  clearBestMove();

  resultElement.hidden = true;

  renderBoard();

  // Werbeeinblendung öffnen
  adOverlay.hidden = false;
});

// Werbung schließen
closeAdButton.addEventListener("click", () => {
  adOverlay.hidden = true;
});

// Stockfish analysiert den besten Zug
analyzeButton.addEventListener("click", async () => {
  if (game.game_over()) {
    resultElement.hidden = false;
    resultElement.textContent = "Das Spiel ist beendet.";
    return;
  }

  analyzeButton.disabled = true;
  playButton.disabled = true;

  resultElement.hidden = false;
  resultElement.textContent = "Stockfish analysiert ...";

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
      throw new Error("Ungültiger Zug von Stockfish.");
    }

    const candidate = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q"
    });

    if (!candidate) {
      throw new Error("Der Zug ist nicht legal.");
    }

    game.undo();

    bestMove = {
      from: candidate.from,
      to: candidate.to,
      promotion: uci[4] || "q",
      san: candidate.san
    };

    renderBoard();

    resultElement.innerHTML =
      "<strong>BESTER ZUG: " + candidate.san + "</strong><br>" +
      "Von: " + candidate.from + "<br>" +
      "Nach: " + candidate.to;

    if (typeof data.evaluation === "number") {
      resultElement.innerHTML +=
        "<br>Bewertung: " + (data.evaluation / 100).toFixed(2);
    }

    playButton.disabled = false;

  } catch (error) {
    resultElement.textContent = "Fehler: " + error.message;
  } finally {
    analyzeButton.disabled = false;
  }
});

// Besten Zug automatisch spielen
playButton.addEventListener("click", () => {
  if (!bestMove) return;

  const move = game.move({
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion || "q"
  });

  if (!move) return;

  lastMove = {
    from: move.from,
    to: move.to
  };

  clearSelection();
  clearBestMove();

  resultElement.hidden = false;
  resultElement.textContent = "Bester Zug ausgeführt: " + move.san;

  renderBoard();
});

renderBoard();
