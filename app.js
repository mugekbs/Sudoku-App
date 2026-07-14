const SIZE = 9;
const BOX = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'kirecte-trocki-state-v4';
const NYT_HARD_SUDOKU_URL = 'https://www.nytimes.com/puzzles/sudoku/hard';
const LEVELS = {
  uzman: { label: 'Uzman', holes: 48, minScore: 850, subtitle: 'Mantıksal uzman' },
  ekstrem: { label: 'Ekstrem', holes: 53, minScore: 1350, requireAdvanced: true, subtitle: 'Tek çözüm, zor mantık' },
  kabus: { label: 'Kâbus', holes: 57, minScore: 1300, requireNightmare: true, subtitle: 'Tahminsiz meydan okuma' },
};
const TECHNIQUE_SCORE = { nakedSingle: 8, hiddenSingle: 22, nakedPair: 110, pointingPair: 160, boxLineReduction: 190, hiddenPair: 230, nakedTriple: 300, hiddenTriple: 360, xWing: 480, swordfish: 720, xyWing: 820 };
const EMPTY = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
function clone(board) { return board.map((row) => [...row]); }
function notesGrid() { return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [])); }
function cloneNotes(notes) { return notes.map((row) => row.map((cell) => [...cell])); }
function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function isSafe(board, row, col, value) {
  for (let i = 0; i < SIZE; i += 1) if (board[row][i] === value || board[i][col] === value) return false;
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) for (let c = boxCol; c < boxCol + BOX; c += 1) if (board[r][c] === value) return false;
  return true;
}
function fill(board) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!board[r][c]) {
        for (const value of shuffle(DIGITS)) {
          if (isSafe(board, r, c, value)) {
            board[r][c] = value;
            if (fill(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}
function boardCandidates(board, row, col) {
  if (board[row][col]) return [];
  return DIGITS.filter((value) => isSafe(board, row, col, value));
}
function countSolutions(board, limit = 2) {
  let best = null;
  let bestCandidates = null;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!board[row][col]) {
        const candidates = boardCandidates(board, row, col);
        if (!candidates.length) return 0;
        if (!best || candidates.length < bestCandidates.length) {
          best = { row, col };
          bestCandidates = candidates;
        }
      }
    }
  }
  if (!best) return 1;
  let total = 0;
  for (const value of bestCandidates) {
    board[best.row][best.col] = value;
    total += countSolutions(board, limit - total);
    board[best.row][best.col] = 0;
    if (total >= limit) return total;
  }
  return total;
}
function units() {
  const list = [];
  for (let i = 0; i < SIZE; i += 1) {
    list.push(DIGITS.map((_, col) => [i, col]));
    list.push(DIGITS.map((_, row) => [row, i]));
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX) {
      const unit = [];
      for (let row = boxRow; row < boxRow + BOX; row += 1) for (let col = boxCol; col < boxCol + BOX; col += 1) unit.push([row, col]);
      list.push(unit);
    }
  }
  return list;
}
const ALL_UNITS = units();
function candidateMap(board) {
  return board.map((row, r) => row.map((value, c) => (value ? [] : boardCandidates(board, r, c))));
}
function placeLogical(board, row, col, value) {
  if (!isSafe(board, row, col, value)) return false;
  board[row][col] = value;
  return true;
}
function applyNakedSingle(board) {
  const candidates = candidateMap(board);
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
    if (!board[row][col] && candidates[row][col].length === 1 && placeLogical(board, row, col, candidates[row][col][0])) return 'nakedSingle';
  }
  return null;
}
function applyHiddenSingle(board) {
  const candidates = candidateMap(board);
  for (const unit of ALL_UNITS) {
    for (const value of DIGITS) {
      const places = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].includes(value));
      if (places.length === 1 && placeLogical(board, places[0][0], places[0][1], value)) return 'hiddenSingle';
    }
  }
  return null;
}
function placeAfterCandidateRemoval(board, candidates, row, col, removeValues, technique) {
  if (board[row][col]) return null;
  const reduced = candidates[row][col].filter((value) => !removeValues.includes(value));
  if (reduced.length === 1 && reduced.length < candidates[row][col].length && placeLogical(board, row, col, reduced[0])) return technique;
  return null;
}
function applyNakedPair(board) {
  const candidates = candidateMap(board);
  for (const unit of ALL_UNITS) {
    const pairs = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].length === 2);
    for (let a = 0; a < pairs.length; a += 1) {
      for (let b = a + 1; b < pairs.length; b += 1) {
        const first = candidates[pairs[a][0]][pairs[a][1]].join('');
        const second = candidates[pairs[b][0]][pairs[b][1]].join('');
        if (first !== second) continue;
        for (const [row, col] of unit) {
          if ((row === pairs[a][0] && col === pairs[a][1]) || (row === pairs[b][0] && col === pairs[b][1]) || board[row][col]) continue;
          const remaining = candidates[row][col].filter((value) => !first.includes(String(value)));
          if (remaining.length === 1 && placeLogical(board, row, col, remaining[0])) return 'nakedPair';
        }
      }
    }
  }
  return null;
}
function applyPointingPair(board) {
  const candidates = candidateMap(board);
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX) {
      const boxCells = [];
      for (let row = boxRow; row < boxRow + BOX; row += 1) for (let col = boxCol; col < boxCol + BOX; col += 1) boxCells.push([row, col]);
      for (const value of DIGITS) {
        const places = boxCells.filter(([row, col]) => !board[row][col] && candidates[row][col].includes(value));
        if (places.length < 2) continue;
        const sameRow = places.every(([row]) => row === places[0][0]);
        const sameCol = places.every(([, col]) => col === places[0][1]);
        if (sameRow) {
          const row = places[0][0];
          for (let col = 0; col < SIZE; col += 1) {
            if (col >= boxCol && col < boxCol + BOX) continue;
            const result = placeAfterCandidateRemoval(board, candidates, row, col, [value], 'pointingPair');
            if (result) return result;
          }
        }
        if (sameCol) {
          const col = places[0][1];
          for (let row = 0; row < SIZE; row += 1) {
            if (row >= boxRow && row < boxRow + BOX) continue;
            const result = placeAfterCandidateRemoval(board, candidates, row, col, [value], 'pointingPair');
            if (result) return result;
          }
        }
      }
    }
  }
  return null;
}
function applyBoxLineReduction(board) {
  const candidates = candidateMap(board);
  for (const value of DIGITS) {
    for (let row = 0; row < SIZE; row += 1) {
      const cols = DIGITS.map((_, col) => col).filter((col) => !board[row][col] && candidates[row][col].includes(value));
      if (cols.length > 1 && cols.every((col) => Math.floor(col / BOX) === Math.floor(cols[0] / BOX))) {
        const boxRow = Math.floor(row / BOX) * BOX;
        const boxCol = Math.floor(cols[0] / BOX) * BOX;
        for (let r = boxRow; r < boxRow + BOX; r += 1) for (let c = boxCol; c < boxCol + BOX; c += 1) {
          if (r === row) continue;
          const result = placeAfterCandidateRemoval(board, candidates, r, c, [value], 'boxLineReduction');
          if (result) return result;
        }
      }
    }
    for (let col = 0; col < SIZE; col += 1) {
      const rows = DIGITS.map((_, row) => row).filter((row) => !board[row][col] && candidates[row][col].includes(value));
      if (rows.length > 1 && rows.every((row) => Math.floor(row / BOX) === Math.floor(rows[0] / BOX))) {
        const boxRow = Math.floor(rows[0] / BOX) * BOX;
        const boxCol = Math.floor(col / BOX) * BOX;
        for (let r = boxRow; r < boxRow + BOX; r += 1) for (let c = boxCol; c < boxCol + BOX; c += 1) {
          if (c === col) continue;
          const result = placeAfterCandidateRemoval(board, candidates, r, c, [value], 'boxLineReduction');
          if (result) return result;
        }
      }
    }
  }
  return null;
}
function applyHiddenPair(board) {
  const candidates = candidateMap(board);
  for (const unit of ALL_UNITS) {
    for (let a = 0; a < DIGITS.length; a += 1) for (let b = a + 1; b < DIGITS.length; b += 1) {
      const pair = [DIGITS[a], DIGITS[b]];
      const cellsA = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].includes(pair[0]));
      const cellsB = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].includes(pair[1]));
      if (cellsA.length !== 2 || cellsB.length !== 2) continue;
      const sameCells = cellsA.every(([row, col]) => cellsB.some(([r, c]) => r === row && c === col));
      if (!sameCells) continue;
      for (const [row, col] of cellsA) {
        const extras = candidates[row][col].filter((value) => !pair.includes(value));
        const result = placeAfterCandidateRemoval(board, candidates, row, col, extras, 'hiddenPair');
        if (result) return result;
      }
    }
  }
  return null;
}
function applyNakedTriple(board) {
  const candidates = candidateMap(board);
  for (const unit of ALL_UNITS) {
    const cells = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].length >= 2 && candidates[row][col].length <= 3);
    for (let a = 0; a < cells.length; a += 1) for (let b = a + 1; b < cells.length; b += 1) for (let c = b + 1; c < cells.length; c += 1) {
      const tripleCells = [cells[a], cells[b], cells[c]];
      const union = [...new Set(tripleCells.flatMap(([row, col]) => candidates[row][col]))];
      if (union.length !== 3) continue;
      for (const [row, col] of unit) {
        if (tripleCells.some(([r, cc]) => r === row && cc === col) || board[row][col]) continue;
        const result = placeAfterCandidateRemoval(board, candidates, row, col, union, 'nakedTriple');
        if (result) return result;
      }
    }
  }
  return null;
}
function applyHiddenTriple(board) {
  const candidates = candidateMap(board);
  for (const unit of ALL_UNITS) {
    for (let a = 0; a < DIGITS.length; a += 1) for (let b = a + 1; b < DIGITS.length; b += 1) for (let c = b + 1; c < DIGITS.length; c += 1) {
      const triple = [DIGITS[a], DIGITS[b], DIGITS[c]];
      const cells = unit.filter(([row, col]) => !board[row][col] && candidates[row][col].some((value) => triple.includes(value)));
      if (cells.length !== 3) continue;
      if (!triple.every((value) => cells.some(([row, col]) => candidates[row][col].includes(value)))) continue;
      for (const [row, col] of cells) {
        const extras = candidates[row][col].filter((value) => !triple.includes(value));
        const result = placeAfterCandidateRemoval(board, candidates, row, col, extras, 'hiddenTriple');
        if (result) return result;
      }
    }
  }
  return null;
}
function applyXWing(board) {
  const candidates = candidateMap(board);
  for (const value of DIGITS) {
    const rowPatterns = [];
    for (let row = 0; row < SIZE; row += 1) {
      const cols = DIGITS.map((_, col) => col).filter((col) => !board[row][col] && candidates[row][col].includes(value));
      if (cols.length === 2) rowPatterns.push({ row, cols: cols.join(',') });
    }
    for (let a = 0; a < rowPatterns.length; a += 1) for (let b = a + 1; b < rowPatterns.length; b += 1) {
      if (rowPatterns[a].cols !== rowPatterns[b].cols) continue;
      for (const col of rowPatterns[a].cols.split(',').map(Number)) for (let row = 0; row < SIZE; row += 1) {
        if (row === rowPatterns[a].row || row === rowPatterns[b].row) continue;
        const result = placeAfterCandidateRemoval(board, candidates, row, col, [value], 'xWing');
        if (result) return result;
      }
    }
  }
  return null;
}
function applySwordfish(board) {
  const candidates = candidateMap(board);
  for (const value of DIGITS) {
    const rowPatterns = [];
    for (let row = 0; row < SIZE; row += 1) {
      const cols = DIGITS.map((_, col) => col).filter((col) => !board[row][col] && candidates[row][col].includes(value));
      if (cols.length >= 2 && cols.length <= 3) rowPatterns.push({ row, cols });
    }
    for (let a = 0; a < rowPatterns.length; a += 1) for (let b = a + 1; b < rowPatterns.length; b += 1) for (let c = b + 1; c < rowPatterns.length; c += 1) {
      const rows = [rowPatterns[a], rowPatterns[b], rowPatterns[c]];
      const cols = [...new Set(rows.flatMap((pattern) => pattern.cols))];
      if (cols.length !== 3) continue;
      for (const col of cols) for (let row = 0; row < SIZE; row += 1) {
        if (rows.some((pattern) => pattern.row === row)) continue;
        const result = placeAfterCandidateRemoval(board, candidates, row, col, [value], 'swordfish');
        if (result) return result;
      }
    }
  }
  return null;
}
function peers(row, col) {
  const cells = new Set();
  for (let i = 0; i < SIZE; i += 1) { cells.add(`${row},${i}`); cells.add(`${i},${col}`); }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) for (let c = boxCol; c < boxCol + BOX; c += 1) cells.add(`${r},${c}`);
  cells.delete(`${row},${col}`);
  return [...cells].map((cell) => cell.split(',').map(Number));
}
function sees(a, b) {
  return a[0] === b[0] || a[1] === b[1] || (Math.floor(a[0] / BOX) === Math.floor(b[0] / BOX) && Math.floor(a[1] / BOX) === Math.floor(b[1] / BOX));
}
function applyXYWing(board) {
  const candidates = candidateMap(board);
  const bivalueCells = [];
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) if (!board[row][col] && candidates[row][col].length === 2) bivalueCells.push([row, col]);
  for (const pivot of bivalueCells) {
    const [x, y] = candidates[pivot[0]][pivot[1]];
    const wings = peers(pivot[0], pivot[1]).filter(([row, col]) => !board[row][col] && candidates[row][col].length === 2);
    for (const wingA of wings) for (const wingB of wings) {
      if (wingA[0] === wingB[0] && wingA[1] === wingB[1]) continue;
      const candA = candidates[wingA[0]][wingA[1]];
      const candB = candidates[wingB[0]][wingB[1]];
      const z = DIGITS.find((value) => value !== x && value !== y && candA.includes(value) && candB.includes(value));
      if (!z) continue;
      const wingAIsXZ = candA.includes(x) && candA.includes(z) && !candA.includes(y);
      const wingAIsYZ = candA.includes(y) && candA.includes(z) && !candA.includes(x);
      const wingBIsXZ = candB.includes(x) && candB.includes(z) && !candB.includes(y);
      const wingBIsYZ = candB.includes(y) && candB.includes(z) && !candB.includes(x);
      const complementaryWings = (wingAIsXZ && wingBIsYZ) || (wingAIsYZ && wingBIsXZ);
      if (!complementaryWings || sees(wingA, wingB)) continue;
      for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] || !candidates[row][col].includes(z)) continue;
        if (sees([row, col], wingA) && sees([row, col], wingB)) {
          const result = placeAfterCandidateRemoval(board, candidates, row, col, [z], 'xyWing');
          if (result) return result;
        }
      }
    }
  }
  return null;
}
function emptyTechniqueStats() { return { nakedSingle: 0, hiddenSingle: 0, nakedPair: 0, pointingPair: 0, boxLineReduction: 0, hiddenPair: 0, nakedTriple: 0, hiddenTriple: 0, xWing: 0, swordfish: 0, xyWing: 0 }; }
function rateTechniqueStats(techniques) {
  return Object.entries(techniques).reduce((total, [technique, count]) => total + (TECHNIQUE_SCORE[technique] || 0) * count, 0);
}
const HUMAN_LOGIC_STEPS = [applyNakedSingle, applyHiddenSingle, applyNakedPair, applyPointingPair, applyBoxLineReduction, applyHiddenPair, applyNakedTriple, applyHiddenTriple, applyXWing, applySwordfish, applyXYWing];
function logicSolve(puzzle, logicSteps = HUMAN_LOGIC_STEPS) {
  const board = clone(puzzle);
  const techniques = emptyTechniqueStats();
  let hardest = 'none';
  let guard = 0;
  while (!completeBoard(board) && guard < 240) {
    guard += 1;
    const technique = logicSteps.reduce((found, step) => found || step(board), null);
    if (technique) {
      techniques[technique] += 1;
      if (TECHNIQUE_SCORE[technique] >= (TECHNIQUE_SCORE[hardest] || 0)) hardest = technique;
      continue;
    }
    return { solved: false, hardest, score: rateTechniqueStats(techniques), techniques };
  }
  return { solved: completeBoard(board), hardest, score: rateTechniqueStats(techniques), techniques };
}
function completeBoard(board) {
  return board.every((row) => row.every((value) => value !== 0));
}
function meetsDifficulty(level, rating) {
  const config = LEVELS[level];
  return rating.score >= config.minScore
    && (!config.requireAdvanced || rating.techniques.pointingPair > 0 || rating.techniques.boxLineReduction > 0 || rating.techniques.hiddenPair > 0 || rating.techniques.nakedTriple > 0 || rating.techniques.hiddenTriple > 0 || rating.techniques.xWing > 0 || rating.techniques.swordfish > 0 || rating.techniques.xyWing > 0)
    && (!config.requireNightmare || rating.techniques.xWing > 0 || rating.techniques.swordfish > 0 || rating.techniques.xyWing > 0 || rating.techniques.hiddenTriple > 0);
}
function betterPuzzle(candidate, current) {
  if (!current) return true;
  if (candidate.rating.score !== current.rating.score) return candidate.rating.score > current.rating.score;
  return candidate.removed > current.removed;
}
function generate(level) {
  const target = LEVELS[level].holes;
  let best = null;
  const maxAttempts = level === 'kabus' ? 12 : 18;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = clone(EMPTY);
    fill(solution);
    const puzzle = clone(solution);
    let removed = 0;
    for (const cell of shuffle([...Array(81).keys()])) {
      if (removed >= target) break;
      const row = Math.floor(cell / SIZE);
      const col = cell % SIZE;
      const previous = puzzle[row][col];
      puzzle[row][col] = 0;
      const unique = countSolutions(clone(puzzle), 2) === 1;
      const rating = unique ? logicSolve(puzzle) : { solved: false, score: 0, techniques: emptyTechniqueStats(), hardest: 'none' };
      if (unique && rating.solved) removed += 1;
      else puzzle[row][col] = previous;
    }
    const rating = logicSolve(puzzle);
    const candidate = { puzzle: clone(puzzle), solution: clone(solution), rating, removed };
    if (betterPuzzle(candidate, best)) best = candidate;
    if (removed >= target && meetsDifficulty(level, rating)) return { puzzle, solution, rating };
  }

  return best;
}
function newState(level = 'uzman') {
  const { puzzle, solution, rating } = generate(level);
  return { level, puzzle, solution, rating, grid: clone(puzzle), notes: notesGrid(), autoCandidates: false, autoCandidateSnapshot: null, selected: { row: 0, col: 0 }, noteMode: false, mistakes: 0, hints: 3, elapsed: 0, history: [] };
}
function isValidSavedState(saved) {
  return saved?.puzzle?.length === SIZE
    && saved?.solution?.length === SIZE
    && saved?.grid?.length === SIZE
    && saved?.notes?.length === SIZE
    && saved?.selected
    && LEVELS[saved.level];
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidSavedState(saved)) return { ...saved, rating: saved.rating || logicSolve(saved.puzzle), elapsed: saved.elapsed || 0, history: saved.history || [], autoCandidates: saved.autoCandidates || false, autoCandidateSnapshot: saved.autoCandidateSnapshot || null };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return newState();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function cleanRelatedNotes(row, col, value) {
  for (let index = 0; index < SIZE; index += 1) {
    if (index !== col) state.notes[row][index] = state.notes[row][index].filter((note) => note !== value);
    if (index !== row) state.notes[index][col] = state.notes[index][col].filter((note) => note !== value);
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) {
    for (let c = boxCol; c < boxCol + BOX; c += 1) {
      if (r === row && c === col) continue;
      state.notes[r][c] = state.notes[r][c].filter((note) => note !== value);
    }
  }
}
function candidateNotesForGrid() {
  return state.notes.map((rowNotes, row) => rowNotes.map((cellNotes, col) => {
    if (state.grid[row][col] || state.puzzle[row][col]) return [];
    return boardCandidates(state.grid, row, col);
  }));
}
function refreshAutoCandidates() {
  if (state.autoCandidates) state.notes = candidateNotesForGrid();
}
function toggleAutoCandidates() {
  if (complete()) return;
  pushHistory();
  if (state.autoCandidates) {
    state.notes = state.autoCandidateSnapshot ? cloneNotes(state.autoCandidateSnapshot) : notesGrid();
    state.autoCandidates = false;
    state.autoCandidateSnapshot = null;
  } else {
    state.autoCandidateSnapshot = cloneNotes(state.notes);
    state.autoCandidates = true;
    state.notes = candidateNotesForGrid();
  }
  render();
}
function moveSelection(rowDelta, colDelta) {
  const nextRow = (state.selected.row + rowDelta + SIZE) % SIZE;
  const nextCol = (state.selected.col + colDelta + SIZE) % SIZE;
  select(nextRow, nextCol);
}
function openNytHardSudoku() {
  window.open(NYT_HARD_SUDOKU_URL, '_blank', 'noopener,noreferrer');
}
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
function tick() {
  if (complete()) return;
  state.elapsed = (state.elapsed || 0) + 1;
  save();
  const timer = document.querySelector('[data-timer]');
  if (timer) timer.textContent = formatTime(state.elapsed);
}
function complete() { return state.grid.every((row, r) => row.every((value, c) => value === state.solution[r][c])); }
function pushHistory() { state.history = [...state.history, { grid: clone(state.grid), notes: cloneNotes(state.notes), mistakes: state.mistakes, hints: state.hints, elapsed: state.elapsed || 0, autoCandidates: state.autoCandidates || false, autoCandidateSnapshot: state.autoCandidateSnapshot ? cloneNotes(state.autoCandidateSnapshot) : null }].slice(-40); }
function select(row, col) { state.selected = { row, col }; render(); }
function place(value) {
  const { row, col } = state.selected;
  if (state.puzzle[row][col] || complete()) return;
  pushHistory();
  if (state.noteMode) {
    const set = new Set(state.notes[row][col]);
    set.has(value) ? set.delete(value) : set.add(value);
    state.notes[row][col] = [...set].sort((a, b) => a - b);
  } else {
    state.grid[row][col] = value;
    state.notes[row][col] = [];
    if (value === state.solution[row][col]) cleanRelatedNotes(row, col, value);
    else state.mistakes += 1;
    refreshAutoCandidates();
  }
  render();
}
function erase() {
  const { row, col } = state.selected;
  if (state.puzzle[row][col]) return;
  pushHistory();
  state.grid[row][col] = 0;
  state.notes[row][col] = [];
  refreshAutoCandidates();
  render();
}
function undo() {
  const last = state.history.pop();
  if (!last) return;
  state.grid = clone(last.grid);
  state.notes = cloneNotes(last.notes);
  state.mistakes = last.mistakes;
  state.hints = last.hints;
  state.elapsed = last.elapsed ?? state.elapsed;
  state.autoCandidates = last.autoCandidates || false;
  state.autoCandidateSnapshot = last.autoCandidateSnapshot ? cloneNotes(last.autoCandidateSnapshot) : null;
  render();
}
function hint() {
  if (state.hints <= 0 || complete()) return;
  let target = state.selected;
  if (state.grid[target.row][target.col] === state.solution[target.row][target.col]) {
    outer: for (let r = 0; r < SIZE; r += 1) for (let c = 0; c < SIZE; c += 1) if (state.grid[r][c] !== state.solution[r][c]) { target = { row: r, col: c }; break outer; }
  }
  pushHistory();
  state.grid[target.row][target.col] = state.solution[target.row][target.col];
  state.notes[target.row][target.col] = [];
  state.selected = target;
  state.hints -= 1;
  refreshAutoCandidates();
  render();
}
function restart(level = state.level) { state = newState(level); render(); }
function requestRestart(level = state.level) {
  if (!complete() && !window.confirm('Yeni oyun açmak istediğine emin misin?')) return;
  restart(level);
}
function numberComplete(value) {
  let count = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (state.grid[r][c] === value && value === state.solution[r][c]) count += 1;
    }
  }
  return count >= SIZE;
}
function cellClass(row, col, value) {
  return ['cell', state.selected.row === row && state.selected.col === col && 'selected', state.puzzle[row][col] && 'given', value && value !== state.solution[row][col] && 'wrong'].filter(Boolean).join(' ');
}
function render() {
  save();
  const blanks = state.grid.flat().filter((cell) => !cell).length;
  document.querySelector('#root').innerHTML = `
    <main class="app-shell">
      <section class="hero compact"><div><p class="eyebrow">Kireçte Troçki</p></div></section>
      <section class="game-panel"><aside class="sidebar"><div class="level-grid">${Object.entries(LEVELS).map(([key, level]) => `<button class="level ${state.level === key ? 'active' : ''}" data-level="${key}"><strong>${level.label}</strong><span>${level.subtitle}</span></button>`).join('')}</div><div class="stats"><span>Süre <strong data-timer>${formatTime(state.elapsed || 0)}</strong></span><span>Hata <strong>${state.mistakes}</strong></span><span>İpucu <strong>${state.hints}</strong></span><span>Boş <strong>${blanks}</strong></span></div></aside><div class="board-wrap"><div class="catwalk" aria-hidden="true"><span class="cat">🐈‍⬛</span></div><div class="board" aria-label="Sudoku tahtası">${state.grid.map((row, r) => row.map((value, c) => `<button class="${cellClass(r, c, value)}" data-row="${r}" data-col="${c}">${value ? `<span>${value}</span>` : `<small>${DIGITS.map((note) => `<em>${state.notes[r][c].includes(note) ? note : ''}</em>`).join('')}</small>`}</button>`).join('')).join('')}</div>${complete() ? '<div class="completion-banner">🏆 Tebrikler! Bu Sudoku tamamlandı.</div>' : ''}<div class="number-pad">${DIGITS.map((value) => `<button class="${numberComplete(value) ? 'complete-number' : ''}" data-number="${value}" ${numberComplete(value) ? 'disabled' : ''}>${value}</button>`).join('')}<button class="erase" data-action="erase">Sil</button></div><div class="action-pad"><button data-action="new">↻ Yeni oyun</button><button class="${state.noteMode ? 'active-tool' : ''}" data-action="note">✎ Not</button><button data-action="hint">💡 İpucu</button><button data-action="undo">↶ Geri al</button><button class="${state.autoCandidates ? 'active-tool' : ''}" data-action="auto-candidates">☷ Auto-candidate</button><button data-action="nyt-hard">NYT Hard ↗</button></div></div></section>
    </main>`;
}
let state = loadState();
let timerId = window.setInterval(tick, 1000);

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.row) select(Number(button.dataset.row), Number(button.dataset.col));
  if (button.dataset.number) place(Number(button.dataset.number));
  if (button.dataset.level) requestRestart(button.dataset.level);
  if (button.dataset.action === 'new') requestRestart();
  if (button.dataset.action === 'note') { state.noteMode = !state.noteMode; render(); }
  if (button.dataset.action === 'hint') hint();
  if (button.dataset.action === 'undo') undo();
  if (button.dataset.action === 'erase') erase();
  if (button.dataset.action === 'auto-candidates') toggleAutoCandidates();
  if (button.dataset.action === 'nyt-hard') openNytHardSudoku();
});
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (key === 'ArrowUp') { event.preventDefault(); moveSelection(-1, 0); }
  else if (key === 'ArrowDown') { event.preventDefault(); moveSelection(1, 0); }
  else if (key === 'ArrowLeft') { event.preventDefault(); moveSelection(0, -1); }
  else if (key === 'ArrowRight') { event.preventDefault(); moveSelection(0, 1); }
  else if (/^[1-9]$/.test(key)) { event.preventDefault(); place(Number(key)); }
  else if (key === 'Backspace' || key === 'Delete' || key === '0') { event.preventDefault(); erase(); }
  else if (key.toLowerCase() === 'n' || key === ' ') { event.preventDefault(); state.noteMode = !state.noteMode; render(); }
  else if (key.toLowerCase() === 'u') { event.preventDefault(); undo(); }
  else if (key.toLowerCase() === 'a') { event.preventDefault(); toggleAutoCandidates(); }
});
try {
  render();
  window.kirecteTrockiReady = true;
} catch (error) {
  console.error('Kireçte Troçki başlatılamadı, kayıt sıfırlanıyor:', error);
  localStorage.removeItem(STORAGE_KEY);
  state = newState();
  render();
  window.kirecteTrockiReady = true;
}
