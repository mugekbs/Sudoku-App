const SIZE = 9;
const BOX = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const STORAGE_KEY = 'kirecte-trocki-state-v2';
const LEVELS = {
  uzman: { label: 'Uzman', holes: 54, subtitle: 'Sert ama akıcı' },
  ekstrem: { label: 'Ekstrem', holes: 60, subtitle: 'Çok az ipucu' },
  kabus: { label: 'Kâbus', holes: 64, subtitle: 'Sadece sabırlılara' },
};
const EMPTY = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
let state = loadState();
let timerId = window.setInterval(tick, 1000);

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
function generate(level) {
  const solution = clone(EMPTY);
  fill(solution);
  const puzzle = clone(solution);
  let removed = 0;
  for (const cell of shuffle([...Array(81).keys()])) {
    if (removed >= LEVELS[level].holes) break;
    puzzle[Math.floor(cell / SIZE)][cell % SIZE] = 0;
    removed += 1;
  }
  return { puzzle, solution };
}
function newState(level = 'uzman') {
  const { puzzle, solution } = generate(level);
  return { level, puzzle, solution, grid: clone(puzzle), notes: notesGrid(), selected: { row: 0, col: 0 }, noteMode: false, mistakes: 0, hints: 3, elapsed: 0, history: [] };
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
    if (isValidSavedState(saved)) return { ...saved, elapsed: saved.elapsed || 0, history: saved.history || [] };
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
      <section class="game-panel"><aside class="sidebar"><div class="level-grid">${Object.entries(LEVELS).map(([key, level]) => `<button class="level ${state.level === key ? 'active' : ''}" data-level="${key}"><strong>${level.label}</strong><span>${level.subtitle}</span></button>`).join('')}</div><div class="stats"><span>Süre <strong data-timer>${formatTime(state.elapsed || 0)}</strong></span><span>Hata <strong>${state.mistakes}</strong></span><span>İpucu <strong>${state.hints}</strong></span><span>Boş <strong>${blanks}</strong></span></div><div class="tools"><button class="${state.noteMode ? 'active-tool' : ''}" data-action="note">✎ Not</button><button data-action="hint">💡 İpucu</button><button data-action="undo">↶ Geri al</button></div>${complete() ? '<div class="win">🏆 Tebrikler, bu seviye çözüldü.</div>' : ''}</aside><div class="board-wrap"><div class="catwalk" aria-hidden="true"><span class="cat">🐈‍⬛</span></div><div class="board" aria-label="Sudoku tahtası">${state.grid.map((row, r) => row.map((value, c) => `<button class="${cellClass(r, c, value)}" data-row="${r}" data-col="${c}">${value ? `<span>${value}</span>` : `<small>${state.notes[r][c].map((note) => `<em>${note}</em>`).join('')}</small>`}</button>`).join('')).join('')}</div><div class="number-pad">${DIGITS.map((value) => `<button data-number="${value}">${value}</button>`).join('')}<button class="erase" data-action="erase">Sil</button></div></div></section>
    </main>`;
}
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
} catch (error) {
  console.error('Kireçte Troçki başlatılamadı, kayıt sıfırlanıyor:', error);
  localStorage.removeItem(STORAGE_KEY);
  state = newState();
  render();
}
