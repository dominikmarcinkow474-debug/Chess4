const game = new Chess();
let board = null;
const $ = (id) => document.getElementById(id);

function refresh() {
  board.position(game.fen());
  $("turn-label").textContent = game.game_over()
    ? "Partie beendet"
    : (game.turn() === "w" ? "Weiß am Zug" : "Schwarz am Zug");
  const history = game.history();
  $("history").innerHTML = "";
  if (!history.length) {
    $("history").innerHTML = '<li class="muted">Noch keine Züge</li>';
  } else {
    for (let i = 0; i < history.length; i += 2) {
      const li = document.createElement("li");
      li.textContent = `${Math.floor(i / 2) + 1}. ${history[i]}${history[i + 1] ? "   " + history[i + 1] : ""}`;
      $("history").appendChild(li);
    }
  }
  $("pgn").value = game.pgn();
}

function onDrop(source, target) {
  const move = game.move({ from: source, to: target, promotion: "q" });
  if (move === null) return "snapback";
  $("result").innerHTML = '<span class="muted">Stellung geändert — bitte neu analysieren.</span>';
  refresh();
}
function onSnapEnd() { board.position(game.fen()); }

board = Chessboard("board", {
  position: "start",
  draggable: true,
  pieceTheme: "https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png",
  onDrop,
  onSnapEnd
});
window.addEventListener("resize", () => board.resize());

$("flip").addEventListener("click", () => board.flip());
$("undo").addEventListener("click", () => { game.undo(); refresh(); });
$("reset").addEventListener("click", () => {
  game.reset();
  $("result").innerHTML = '<span class="muted">Neue Partie gestartet.</span>';
  refresh();
});
$("load-pgn").addEventListener("click", () => {
  const candidate = new Chess();
  const ok = candidate.load_pgn($("pgn").value.trim());
  if (!ok) {
    $("result").textContent = "PGN konnte nicht gelesen werden. Bitte die Zugnotation prüfen (z. B. 1. e4 e5 2. Nf3 Nc6).";
    return;
  }
  game.load(candidate.fen());
  // load_pgn on candidate validates the sequence; restore its move history for the UI.
  game.reset();
  candidate.history({ verbose: true }).forEach(m => game.move({ from:m.from, to:m.to, promotion:m.promotion }));
  $("result").innerHTML = '<span class="muted">Zugfolge geladen. Du kannst jetzt analysieren.</span>';
  refresh();
});

$("analyze").addEventListener("click", async () => {
  const button = $("analyze");
  button.disabled = true;
  button.textContent = "Engine analysiert …";
  $("result").textContent = "Stockfish berechnet den besten Zug …";
  try {
    const moves = game.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || ""));
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ moves })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Analyse fehlgeschlagen");
    const evalText = data.evaluation_cp == null ? "n/a" : (data.evaluation_cp / 100).toFixed(2);
    $("result").innerHTML = `
      <div class="section-title">BESTER ZUG</div>
      <div class="best">${data.best_move_san}</div>
      <div class="muted">Von → nach: ${data.best_move}</div>
      <div class="muted">Bewertung: ${evalText} · Tiefe: ${data.depth}</div>
      <div class="muted">Variantenlinie: ${(data.principal_variation || []).join(" ")}</div>`;
    const from = data.best_move.slice(0,2), to = data.best_move.slice(2,4);
    board.position(data.fen);
    window.setTimeout(() => {
      $(".square-" + (from[1] + from[0])).style.outline = "3px solid #f04452";
      $(".square-" + (to[1] + to[0])).style.outline = "3px solid #f5c451";
    }, 30);
  } catch (error) {
    $("result").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "✦ Besten Zug anzeigen";
  }
});

refresh();
