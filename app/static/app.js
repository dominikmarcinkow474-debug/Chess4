
const game = new Chess();

let board;
let suggestedMove = null;

const $ = id => document.getElementById(id);

// Remove old move markings
function clearSuggestion() {
    suggestedMove = null;

    document.querySelectorAll(
        "#board .best-from, #board .best-to"
    ).forEach(square => {
        square.classList.remove("best-from", "best-to");
    });

    $("play-best").disabled = true;
}

// Highlight the recommended move
function markBestMove(uci) {
    clearSuggestion();

    suggestedMove = uci;

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);

    const fromSquare = document.querySelector(
        "#board .square-" + from
    );

    const toSquare = document.querySelector(
        "#board .square-" + to
    );

    if (fromSquare) {
        fromSquare.classList.add("best-from");
    }

    if (toSquare) {
        toSquare.classList.add("best-to");
    }

    $("play-best").disabled = false;
}

// Update board and history
function refresh() {

    board.position(game.fen());

    $("turn-label").textContent =
        game.game_over()
        ? "Partie beendet"
        : game.turn() === "w"
        ? "Weiß am Zug"
        : "Schwarz am Zug";

    const history = game.history();

    $("history").innerHTML = "";

    if (history.length === 0) {
        $("history").innerHTML =
            "<li>Noch keine Züge</li>";
    }

    for (let i = 0; i < history.length; i += 2) {

        const li = document.createElement("li");

        li.textContent =
            `${Math.floor(i / 2) + 1}. ${history[i]} ${
                history[i + 1] || ""
            }`;

        $("history").appendChild(li);
    }

    $("pgn").value = game.pgn();
}

// Move pieces using drag and drop
function onDrop(source, target) {

    const move = game.move({
        from: source,
        to: target,
        promotion: "q"
    });

    if (move === null) {
        return "snapback";
    }

    clearSuggestion();

    $("result").textContent =
        "Zug gespielt. Du kannst jetzt erneut analysieren.";

    refresh();
}

function onSnapEnd() {
    board.position(game.fen());

    if (suggestedMove) {
        markBestMove(suggestedMove);
    }
}

// Initialize chessboard with all 32 pieces
board = Chessboard("board", {

    position: "start",

    draggable: true,

    pieceTheme:
        "https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png",

    onDrop: onDrop,

    onSnapEnd: onSnapEnd
});

window.addEventListener("resize", () => {
    board.resize();
});

// Rotate board
$("flip").onclick = () => {
    board.flip();
};

// Undo last move
$("undo").onclick = () => {

    game.undo();

    clearSuggestion();

    refresh();

    $("result").textContent =
        "Letzter Zug zurückgenommen.";
};

// Reset game
$("reset").onclick = () => {

    game.reset();

    clearSuggestion();

    refresh();

    $("result").textContent =
        "Neue Partie gestartet!";
};

// Import PGN
$("load-pgn").onclick = () => {

    const candidate = new Chess();

    const valid = candidate.load_pgn(
        $("pgn").value.trim()
    );

    if (!valid) {
        $("result").textContent =
            "Ungültige PGN-Zugfolge!";
        return;
    }

    game.reset();

    candidate.history({ verbose: true }).forEach(move => {

        game.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion
        });

    });

    clearSuggestion();

    refresh();

    $("result").textContent =
        "Zugfolge erfolgreich geladen!";
};

// Ask Stockfish for the best move
$("analyze").onclick = async () => {

    const button = $("analyze");

    button.disabled = true;

    button.textContent = "STOCKFISH ANALYSIERT...";

    clearSuggestion();

    $("result").textContent =
        "Berechne den besten Zug...";

    try {

        const moves = game.history({
            verbose: true
        }).map(move =>
            move.from +
            move.to +
            (move.promotion || "")
        );

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
            throw new Error(
                data.detail || "Analyse fehlgeschlagen"
            );
        }

        const evaluation =
            data.evaluation_cp === null
            ? "Nicht verfügbar"
            : (data.evaluation_cp / 100).toFixed(2);

        $("result").innerHTML = `
            <div class="section-title">
                STOCKFISH BESTER ZUG
            </div>

            <div class="best">
                ${data.best_move_san}
            </div>

            <div class="move-route">
                ${data.best_move.slice(0,2).toUpperCase()}
                →
                ${data.best_move.slice(2,4).toUpperCase()}
            </div>

            <p>Bewertung: ${evaluation}</p>

            <p>Suchttiefe: ${data.depth}</p>

            <p>
                Variante:
                ${(data.principal_variation || []).join(" ")}
            </p>
        `;

        markBestMove(data.best_move);

    } catch (error) {

        $("result").textContent = error.message;

    } finally {

        button.disabled = false;

        button.textContent =
            "✦ BESTEN ZUG ANZEIGEN";
    }
};

// Automatically play the suggested move
$("play-best").onclick = () => {

    if (!suggestedMove) return;

    const move = game.move({

        from: suggestedMove.slice(0, 2),

        to: suggestedMove.slice(2, 4),

        promotion:
            suggestedMove.length === 5
            ? suggestedMove[4]
            : "q"

    });

    if (!move) {

        clearSuggestion();

        $("result").textContent =
            "Stellung hat sich geändert. Bitte neu analysieren.";

        return;
    }

    clearSuggestion();

    refresh();

    $("result").textContent =
        "Stockfish-Zug " + move.san + " wurde gespielt.";
};

// Start application
refresh();
