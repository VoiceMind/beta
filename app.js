const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("reset");

const pieces = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚",
};

const startRows = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
];

let state;

function resetGame() {
  state = {
    board: startRows.map((row) => [...row]),
    turn: "w",
    selected: null,
    legalMoves: [],
    moved: new Set(),
    enPassant: null,
    gameOver: false,
  };
  updateHud("בחר כלי כדי להתחיל.");
  render();
}

function updateHud(message) {
  turnEl.textContent = `תור: ${state.turn === "w" ? "לבן" : "שחור"}`;
  statusEl.textContent = message;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareKey(r, c) {
  return `${r},${c}`;
}

function getPieceColor(piece) {
  return piece ? piece[0] : null;
}

function cloneState(s) {
  return {
    board: s.board.map((row) => [...row]),
    turn: s.turn,
    moved: new Set([...s.moved]),
    enPassant: s.enPassant ? { ...s.enPassant } : null,
  };
}

function getPseudoMoves(s, r, c, includeCastle = true) {
  const piece = s.board[r][c];
  if (!piece) return [];

  const color = piece[0];
  const type = piece[1];
  const dir = color === "w" ? -1 : 1;
  const moves = [];

  if (type === "p") {
    const one = [r + dir, c];
    if (inBounds(...one) && !s.board[one[0]][one[1]]) {
      moves.push({ from: [r, c], to: one, special: one[0] === 0 || one[0] === 7 ? "promotion" : null });

      const startRow = color === "w" ? 6 : 1;
      const two = [r + dir * 2, c];
      if (r === startRow && !s.board[two[0]][two[1]]) {
        moves.push({ from: [r, c], to: two, special: "double" });
      }
    }

    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = s.board[nr][nc];
      if (target && getPieceColor(target) !== color) {
        moves.push({ from: [r, c], to: [nr, nc], special: nr === 0 || nr === 7 ? "promotion" : null });
      }
      if (
        s.enPassant &&
        s.enPassant.row === nr &&
        s.enPassant.col === nc &&
        s.enPassant.by !== color
      ) {
        moves.push({ from: [r, c], to: [nr, nc], special: "enpassant" });
      }
    }
  }

  if (type === "n") {
    const jumps = [
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [1, -2],
      [-1, 2],
      [-1, -2],
    ];
    for (const [dr, dc] of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = s.board[nr][nc];
      if (!target || getPieceColor(target) !== color) {
        moves.push({ from: [r, c], to: [nr, nc], special: null });
      }
    }
  }

  if (type === "b" || type === "r" || type === "q") {
    const dirs = [];
    if (type === "b" || type === "q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (type === "r" || type === "q") dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);

    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = s.board[nr][nc];
        if (!target) {
          moves.push({ from: [r, c], to: [nr, nc], special: null });
        } else {
          if (getPieceColor(target) !== color) {
            moves.push({ from: [r, c], to: [nr, nc], special: null });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (type === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = s.board[nr][nc];
        if (!target || getPieceColor(target) !== color) {
          moves.push({ from: [r, c], to: [nr, nc], special: null });
        }
      }
    }

    if (includeCastle && !isInCheck(s, color)) {
      const homeRow = color === "w" ? 7 : 0;
      const kingMoved = s.moved.has(`${color}k`);
      if (!kingMoved && r === homeRow && c === 4) {
        const rightRookMoved = s.moved.has(`${color}r7`);
        if (
          !rightRookMoved &&
          !s.board[homeRow][5] &&
          !s.board[homeRow][6] &&
          !isSquareAttacked(s, homeRow, 5, color === "w" ? "b" : "w") &&
          !isSquareAttacked(s, homeRow, 6, color === "w" ? "b" : "w") &&
          s.board[homeRow][7] === `${color}r`
        ) {
          moves.push({ from: [r, c], to: [homeRow, 6], special: "castle-right" });
        }

        const leftRookMoved = s.moved.has(`${color}r0`);
        if (
          !leftRookMoved &&
          !s.board[homeRow][1] &&
          !s.board[homeRow][2] &&
          !s.board[homeRow][3] &&
          !isSquareAttacked(s, homeRow, 3, color === "w" ? "b" : "w") &&
          !isSquareAttacked(s, homeRow, 2, color === "w" ? "b" : "w") &&
          s.board[homeRow][0] === `${color}r`
        ) {
          moves.push({ from: [r, c], to: [homeRow, 2], special: "castle-left" });
        }
      }
    }
  }

  return moves;
}

function applyMove(s, move) {
  const next = cloneState(s);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const moving = next.board[fr][fc];
  const color = moving[0];
  const type = moving[1];

  next.enPassant = null;

  if (move.special === "enpassant") {
    const victimRow = color === "w" ? tr + 1 : tr - 1;
    next.board[victimRow][tc] = null;
  }

  next.board[fr][fc] = null;
  next.board[tr][tc] = moving;

  if (move.special === "promotion") {
    next.board[tr][tc] = `${color}q`;
  }

  if (move.special === "double") {
    next.enPassant = {
      row: color === "w" ? tr + 1 : tr - 1,
      col: tc,
      by: color,
    };
  }

  if (type === "k") {
    next.moved.add(`${color}k`);
    if (move.special === "castle-right") {
      next.board[tr][5] = next.board[tr][7];
      next.board[tr][7] = null;
      next.moved.add(`${color}r7`);
    }
    if (move.special === "castle-left") {
      next.board[tr][3] = next.board[tr][0];
      next.board[tr][0] = null;
      next.moved.add(`${color}r0`);
    }
  }

  if (type === "r") {
    if (fr === (color === "w" ? 7 : 0) && fc === 0) next.moved.add(`${color}r0`);
    if (fr === (color === "w" ? 7 : 0) && fc === 7) next.moved.add(`${color}r7`);
  }

  next.turn = color === "w" ? "b" : "w";
  return next;
}

function findKing(s, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (s.board[r][c] === `${color}k`) return [r, c];
    }
  }
  return null;
}

function isSquareAttacked(s, r, c, byColor) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const piece = s.board[rr][cc];
      if (!piece || piece[0] !== byColor) continue;
      const pseudo = getPseudoMoves(s, rr, cc, false);
      if (pseudo.some((m) => m.to[0] === r && m.to[1] === c)) {
        return true;
      }
    }
  }
  return false;
}

function isInCheck(s, color) {
  const king = findKing(s, color);
  if (!king) return false;
  return isSquareAttacked(s, king[0], king[1], color === "w" ? "b" : "w");
}

function getLegalMovesForPiece(s, r, c) {
  const piece = s.board[r][c];
  if (!piece || piece[0] !== s.turn) return [];

  const pseudo = getPseudoMoves(s, r, c);
  return pseudo.filter((m) => {
    const next = applyMove(s, m);
    return !isInCheck(next, piece[0]);
  });
}

function getAllLegalMoves(s, color) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = s.board[r][c];
      if (piece && piece[0] === color) {
        const legal = getLegalMovesForPiece({ ...s, turn: color }, r, c);
        all.push(...legal);
      }
    }
  }
  return all;
}

function handleSquareClick(r, c) {
  if (state.gameOver) return;

  const piece = state.board[r][c];

  if (state.selected) {
    const chosenMove = state.legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
    if (chosenMove) {
      state = {
        ...applyMove(state, chosenMove),
        selected: null,
        legalMoves: [],
        gameOver: false,
      };

      const current = state.turn;
      const inCheck = isInCheck(state, current);
      const legal = getAllLegalMoves(state, current);
      if (legal.length === 0) {
        state.gameOver = true;
        updateHud(inCheck ? `מט! ${current === "w" ? "שחור" : "לבן"} ניצח.` : "פט! תיקו.");
      } else {
        updateHud(inCheck ? "שח! המלך בסכנה." : "מהלך בוצע.");
      }
      render();
      return;
    }
  }

  if (piece && piece[0] === state.turn) {
    const legalMoves = getLegalMovesForPiece(state, r, c);
    state.selected = [r, c];
    state.legalMoves = legalMoves;
    updateHud(legalMoves.length ? "בחר יעד לכלי שנבחר." : "לכלי הזה אין מהלכים חוקיים כרגע.");
  } else {
    state.selected = null;
    state.legalMoves = [];
    updateHud("בחר כלי שלך.");
  }

  render();
}

function render() {
  boardEl.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement("button");
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.setAttribute("aria-label", `square-${r}-${c}`);

      const piece = state.board[r][c];
      sq.textContent = piece ? pieces[piece] : "";

      if (state.selected && state.selected[0] === r && state.selected[1] === c) {
        sq.classList.add("selected");
      }
      if (state.legalMoves.some((m) => m.to[0] === r && m.to[1] === c)) {
        sq.classList.add("legal");
      }

      sq.addEventListener("click", () => handleSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
}

resetBtn.addEventListener("click", resetGame);
resetGame();
