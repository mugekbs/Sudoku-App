const SIZE = 9;
const BOX = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'kirecte-trocki-state-v2';
const LEVELS = {
  uzman: { label: 'Uzman', holes: 46, minScore: 420, subtitle: 'Mantıksal uzman' },
  ekstrem: { label: 'Ekstrem', holes: 50, minScore: 760, subtitle: 'Tek çözüm, zor mantık' },
  kabus: { label: 'Kâbus', holes: 54, minScore: 1100, requirePair: true, subtitle: 'Tahminsiz meydan okuma' },
};
const TECHNIQUE_SCORE = { nakedSingle: 8, hiddenSingle: 22, nakedPair: 110 };
const EMPTY = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
function clone(board) { return board.map((row) => [...row]); }
function notesGrid() { return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [])); }
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
function emptyTechniqueStats() { return { nakedSingle: 0, hiddenSingle: 0, nakedPair: 0 }; }
function rateTechniqueStats(techniques) {
  return Object.entries(techniques).reduce((total, [technique, count]) => total + (TECHNIQUE_SCORE[technique] || 0) * count, 0);
}
function logicSolve(puzzle) {
  const board = clone(puzzle);
  const techniques = emptyTechniqueStats();
  let hardest = 'none';
  let guard = 0;
  while (!completeBoard(board) && guard < 240) {
    guard += 1;
    const technique = applyNakedSingle(board) || applyHiddenSingle(board) || applyNakedPair(board);
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
  return rating.score >= config.minScore && (!config.requirePair || rating.techniques.nakedPair > 0);
}
function betterPuzzle(candidate, current) {
  if (!current) return true;
  if (candidate.rating.score !== current.rating.score) return candidate.rating.score > current.rating.score;
  return candidate.removed > current.removed;
}
function generate(level) {
  const target = LEVELS[level].holes;
  let best = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
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
  return { level, puzzle, solution, rating, grid: clone(puzzle), notes: notesGrid(), selected: { row: 0, col: 0 }, noteMode: false, mistakes: 0, hints: 3, elapsed: 0, history: [] };
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
    if (isValidSavedState(saved)) return { ...saved, rating: saved.rating || logicSolve(saved.puzzle), elapsed: saved.elapsed || 0, history: saved.history || [] };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return newState();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
function pushHistory() { state.history = [...state.history, { grid: clone(state.grid), notes: state.notes.map((row) => row.map((cell) => [...cell])), mistakes: state.mistakes, hints: state.hints, elapsed: state.elapsed || 0 }].slice(-40); }
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
    if (value !== state.solution[row][col]) state.mistakes += 1;
  }
  render();
}
function erase() {
  const { row, col } = state.selected;
  if (state.puzzle[row][col]) return;
  pushHistory();
  state.grid[row][col] = 0;
  state.notes[row][col] = [];
  render();
}
function undo() {
  const last = state.history.pop();
  if (!last) return;
  state.grid = clone(last.grid);
  state.notes = last.notes.map((row) => row.map((cell) => [...cell]));
  state.mistakes = last.mistakes;
  state.hints = last.hints;
  state.elapsed = last.elapsed ?? state.elapsed;
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
  render();
}
function restart(level = state.level) { state = newState(level); render(); }
function cellClass(row, col, value) {
  const selectedValue = state.grid[state.selected.row][state.selected.col];
  const peer = state.selected.row === row || state.selected.col === col || (Math.floor(state.selected.row / BOX) === Math.floor(row / BOX) && Math.floor(state.selected.col / BOX) === Math.floor(col / BOX));
  return ['cell', state.selected.row === row && state.selected.col === col && 'selected', peer && 'peer', selectedValue && selectedValue === value && 'same-number', state.puzzle[row][col] && 'given', value && value !== state.solution[row][col] && 'wrong'].filter(Boolean).join(' ');
}
function render() {
  save();
  const blanks = state.grid.flat().filter((cell) => !cell).length;
  document.querySelector('#root').innerHTML = `
    <main class="app-shell">
      <section class="hero compact"><div><p class="eyebrow">Kireçte Troçki</p></div><button class="new-game" data-action="new">↻ Yeni oyun</button></section>
      <section class="game-panel"><aside class="sidebar"><div class="level-grid">${Object.entries(LEVELS).map(([key, level]) => `<button class="level ${state.level === key ? 'active' : ''}" data-level="${key}"><strong>${level.label}</strong><span>${level.subtitle}</span></button>`).join('')}</div><div class="stats"><span>Süre <strong data-timer>${formatTime(state.elapsed || 0)}</strong></span><span>Skor <strong>${state.rating?.score || 0}</strong></span><span>Hata <strong>${state.mistakes}</strong></span><span>İpucu <strong>${state.hints}</strong></span><span>Boş <strong>${blanks}</strong></span><span>Teknik <strong>${state.rating?.hardest || 'single'}</strong></span></div><div class="tools"><button class="${state.noteMode ? 'active-tool' : ''}" data-action="note">✎ Not</button><button data-action="hint">💡 İpucu</button><button data-action="undo">↶ Geri al</button></div>${complete() ? '<div class="win">🏆 Tebrikler, bu seviye çözüldü.</div>' : ''}</aside><div class="board-wrap"><div class="catwalk" aria-hidden="true"><span class="cat">🐈‍⬛</span></div><div class="board" aria-label="Sudoku tahtası">${state.grid.map((row, r) => row.map((value, c) => `<button class="${cellClass(r, c, value)}" data-row="${r}" data-col="${c}">${value ? `<span>${value}</span>` : `<small>${state.notes[r][c].map((note) => `<em>${note}</em>`).join('')}</small>`}</button>`).join('')).join('')}</div><div class="number-pad">${DIGITS.map((value) => `<button data-number="${value}">${value}</button>`).join('')}<button class="erase" data-action="erase">Sil</button></div></div></section>
    </main>`;
}
let state = loadState();
let timerId = window.setInterval(tick, 1000);

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.row) select(Number(button.dataset.row), Number(button.dataset.col));
  if (button.dataset.number) place(Number(button.dataset.number));
  if (button.dataset.level) restart(button.dataset.level);
  if (button.dataset.action === 'new') restart();
  if (button.dataset.action === 'note') { state.noteMode = !state.noteMode; render(); }
  if (button.dataset.action === 'hint') hint();
  if (button.dataset.action === 'undo') undo();
  if (button.dataset.action === 'erase') erase();
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
