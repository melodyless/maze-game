// main.js - 2D 太空/量子科技主题卡通迷宫
// 升级特性：
// 1. 关卡递增系统（第1关3个门，每关+1门，上限10个门）
// 2. 必经主路 + 支路分岔口随机分布能量门
// 3. 答错自动轮换新题，直到答对才开门
// 4. 终点直接通关并支持进入下一关

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

let currentLevel = 1;
let MAZE_COLS = 17;
let MAZE_ROWS = 17;
let CELL_SIZE = 30;
let cells = [];
let playerPos = { x: 0, y: 0 };
let steps = 0;
let isGameActive = true;
let stars = [];

// 提示功能变量
let hintChances = 3;
let activeHintPath = []; // 当前显示的10步指引路线
let hintTimer = null;

// 多个能量门数组：[{ id, x, y, answered: false, isMainPath: true/false }]
let doors = [];
let pendingDoor = null; // 当前正在尝试解锁的门
let lastQuizIndex = -1;

// 丰富的科技小常识题库（涵盖量子、航天、人工智能、中国前沿科技）
const QUIZ_LIST = [
  {
    q: "量子计算机相比传统计算机，最突出的强大优势是？",
    options: ["超强的并行计算与极速运算能力", "屏幕分辨率更高更清晰", "体积永远比普通电脑更小巧"],
    correct: 0
  },
  {
    q: "量子物理中，两个粒子跨越空间产生奇妙相互感应的现象叫？",
    options: ["量子纠缠", "引力透镜", "黑洞蒸发"],
    correct: 0
  },
  {
    q: "中国发射的世界上首颗空间量子科学实验卫星叫什么名字？",
    options: ["“墨子号”", "“天问一号”", "“神舟五号”"],
    correct: 0
  },
  {
    q: "量子计算机的基本信息存储与运算单元被称为什么？",
    options: ["量子比特（Qubit）", "晶体管（Transistor）", "字节（Byte）"],
    correct: 0
  },
  {
    q: "中国首台成功构建的光量子计算原型机被命名为？",
    options: ["“九章”", "“天河二号”", "“蛟龙号”"],
    correct: 0
  },
  {
    q: "中国在贵州建造的、被誉为“中国天眼”的巨型射电望远镜简称是？",
    options: ["FAST", "CERN", "NASA"],
    correct: 0
  },
  {
    q: "中国空间站的名字是什么？",
    options: ["天宫空间站", "和平号空间站", "国际空间站"],
    correct: 0
  },
  {
    q: "计算机芯片内部通常由数十亿个什么极微小的元件构成？",
    options: ["晶体管", "发光二极管", "电动机"],
    correct: 0
  },
  {
    q: "中国探月工程发射的第一辆月球车叫什么名字？",
    options: ["玉兔号", "祝融号", "探索号"],
    correct: 0
  },
  {
    q: "现代芯片的“地基”材料主要是从沙子中提炼出来的什么元素？",
    options: ["高纯度硅（Silicon）", "黄金（Gold）", "碳素（Carbon）"],
    correct: 0
  },
  {
    q: "人工智能（AI）的核心技术中，模拟人类大脑神经元网络的方法叫？",
    options: ["人工神经网络（ANN）", "蒸汽动力网", "光纤通信网"],
    correct: 0
  },
  {
    q: "中国第一辆成功登陆火星的火星车名字是？",
    options: ["“祝融号”", "“天舟号”", "“悟空号”"],
    correct: 0
  }
];

// 初始化星空粒子
function initStars() {
  stars = [];
  const count = 55;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2.2 + 1,
      twinkleSpeed: Math.random() * 0.04 + 0.015,
      alpha: Math.random()
    });
  }
}

function resizeCanvas() {
  const w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  const h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

  canvas.width = w;
  canvas.height = h;

  // 上方留出标题栏高度(约60px)，下方留出触控按键区(约85px)，左右留出适量边距
  const availW = Math.max(200, w - 40);
  const availH = Math.max(200, h - 145);

  const bestSize = Math.floor(Math.min(availW / MAZE_COLS, availH / MAZE_ROWS));
  CELL_SIZE = Math.max(16, Math.min(bestSize, 38));

  if (cells && cells.length > 0) {
    draw();
  }
}
window.addEventListener('resize', () => {
  resizeCanvas();
  initStars();
});

// 生成迷宫（DFS递归回溯）
function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      N: true, E: true, S: true, W: true, visited: false
    }))
  );

  const stack = [];
  const dirs = [
    { dx: 0, dy: -1, wall: 'N', opp: 'S' },
    { dx: 1, dy: 0, wall: 'E', opp: 'W' },
    { dx: 0, dy: 1, wall: 'S', opp: 'N' },
    { dx: -1, dy: 0, wall: 'W', opp: 'E' }
  ];

  let cx = 0, cy = 0;
  grid[cy][cx].visited = true;
  stack.push({ x: cx, y: cy });

  while (stack.length) {
    const { x, y } = stack[stack.length - 1];
    const neighbours = [];
    for (const d of dirs) {
      const nx = x + d.dx, ny = y + d.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !grid[ny][nx].visited) {
        neighbours.push({ nx, ny, dir: d });
      }
    }

    if (neighbours.length) {
      const { nx, ny, dir } = neighbours[Math.floor(Math.random() * neighbours.length)];
      grid[y][x][dir.wall] = false;
      grid[ny][nx][dir.opp] = false;
      grid[ny][nx].visited = true;
      stack.push({ x: nx, y: ny });
    } else {
      stack.pop();
    }
  }
  return grid;
}

// 寻找起点到终点的唯一正确主干路径（BFS）
function findSolutionPath(grid, cols, rows) {
  const queue = [{ x: 0, y: 0, path: [{ x: 0, y: 0 }] }];
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  visited[0][0] = true;

  const dirs = [
    { dx: 0, dy: -1, wall: 'N' },
    { dx: 1, dy: 0, wall: 'E' },
    { dx: 0, dy: 1, wall: 'S' },
    { dx: -1, dy: 0, wall: 'W' }
  ];

  while (queue.length) {
    const { x, y, path } = queue.shift();
    if (x === cols - 1 && y === rows - 1) {
      return path;
    }

    const cur = grid[y][x];
    for (const d of dirs) {
      if (!cur[d.wall]) {
        const nx = x + d.dx, ny = y + d.dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
  }
  return [];
}

// 部署关卡中的能量门：
// 第1关 3个门；每升1关+1个门；最高 10 个门
function placeDoors(totalDoors, mainPath) {
  doors = [];
  const occupied = new Set();
  occupied.add(`0,0`); // 起点不放
  occupied.add(`${MAZE_COLS - 1},${MAZE_ROWS - 1}`); // 终点不放

  // 1. 必经主路上放置门（通常占总门数的 1/3 ~ 1/2，至少 1~2 个）
  const mainDoorCount = Math.min(Math.max(1, Math.floor(totalDoors / 2)), totalDoors);
  // 在主干路径上均匀挑选点（避开起点和终点）
  const pathAvailable = mainPath.slice(2, mainPath.length - 2);
  const mainStep = Math.max(1, Math.floor(pathAvailable.length / (mainDoorCount + 1)));

  for (let i = 1; i <= mainDoorCount && i * mainStep < pathAvailable.length; i++) {
    const pt = pathAvailable[i * mainStep];
    const key = `${pt.x},${pt.y}`;
    if (!occupied.has(key)) {
      occupied.add(key);
      doors.push({ id: doors.length, x: pt.x, y: pt.y, answered: false, isMain: true });
    }
  }

  // 2. 剩余的门放置在其他支路分支上
  const remainingDoors = totalDoors - doors.length;
  // 收集所有可以放门的支路格子（通路格子，非起点终点）
  const candidateBranchCells = [];
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      const key = `${c},${r}`;
      if (!occupied.has(key)) {
        // 判断是否是支路死胡同或者分支走廊
        candidateBranchCells.push({ x: c, y: r });
      }
    }
  }

  // 随机洗牌支路候选格
  candidateBranchCells.sort(() => Math.random() - 0.5);

  for (let i = 0; i < remainingDoors && i < candidateBranchCells.length; i++) {
    const pt = candidateBranchCells[i];
    doors.push({ id: doors.length, x: pt.x, y: pt.y, answered: false, isMain: false });
    occupied.add(`${pt.x},${pt.y}`);
  }
}

// 启动或重置关卡
function startLevel(level) {
  currentLevel = level;
  hintChances = 3;
  activeHintPath = [];
  if (hintTimer) clearTimeout(hintTimer);
  document.getElementById('hintCount').innerText = hintChances;
  const hintBtn = document.getElementById('hintBtn');
  if (hintBtn) {
    hintBtn.style.opacity = '1';
    hintBtn.style.cursor = 'pointer';
  }

  // 计算当前关卡的能量门数量：第1关3个，往后每关+1，最多10个
  const totalDoors = Math.min(10, 2 + currentLevel);

  document.getElementById('levelBadge').innerText = `第 ${currentLevel} 关（${totalDoors}道能量门）`;

  cells = generateMaze(MAZE_COLS, MAZE_ROWS);
  playerPos = { x: 0, y: 0 };
  steps = 0;
  isGameActive = true;
  pendingDoor = null;

  const mainPath = findSolutionPath(cells, MAZE_COLS, MAZE_ROWS);
  placeDoors(totalDoors, mainPath);

  document.getElementById('stepCounter').innerText = `👣 步数: ${steps}`;
  document.getElementById('quizOverlay').style.display = 'none';
  document.getElementById('winBanner').style.display = 'none';
  draw();
}

// 绘制插画装饰（地球 - 起点）
function drawEarth(ctx, cx, cy, radius) {
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.35);
  glow.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
  glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
  oceanGrad.addColorStop(0, '#48cae4');
  oceanGrad.addColorStop(0.7, '#0077b6');
  oceanGrad.addColorStop(1, '#023e8a');
  ctx.fillStyle = oceanGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#52b788';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.25, cy - radius * 0.1, radius * 0.45, 0.3, 2.2);
  ctx.bezierCurveTo(cx - radius * 0.4, cy + radius * 0.4, cx + radius * 0.1, cy + radius * 0.3, cx - radius * 0.25, cy - radius * 0.1);
  ctx.fill();

  ctx.fillStyle = '#74c69d';
  ctx.beginPath();
  ctx.arc(cx + radius * 0.35, cy - radius * 0.2, radius * 0.35, 1.2, 3.8);
  ctx.fill();

  ctx.strokeStyle = '#caf0f8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// 绘制插画装饰（火箭 - 终点）
function drawRocket(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);

  // 尾焰
  const flameGrad = ctx.createLinearGradient(0, size * 0.5, 0, size * 1.15);
  flameGrad.addColorStop(0, '#ffbe0b');
  flameGrad.addColorStop(0.5, '#fb5607');
  flameGrad.addColorStop(1, 'rgba(255, 0, 110, 0)');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-size * 0.25, size * 0.5);
  ctx.quadraticCurveTo(0, size * 1.15, size * 0.25, size * 0.5);
  ctx.closePath();
  ctx.fill();

  // 尾翼
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, size * 0.45);
  ctx.lineTo(-size * 0.5, size * 0.55);
  ctx.lineTo(-size * 0.25, size * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.3, size * 0.45);
  ctx.lineTo(size * 0.5, size * 0.55);
  ctx.lineTo(size * 0.25, size * 0.1);
  ctx.closePath();
  ctx.fill();

  // 舱身
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1d3557';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.65);
  ctx.bezierCurveTo(size * 0.4, -size * 0.2, size * 0.35, size * 0.45, 0, size * 0.5);
  ctx.bezierCurveTo(-size * 0.35, size * 0.45, -size * 0.4, -size * 0.2, 0, -size * 0.65);
  ctx.fill();
  ctx.stroke();

  // 红色头部
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.65);
  ctx.bezierCurveTo(size * 0.22, -size * 0.35, -size * 0.22, -size * 0.35, 0, -size * 0.65);
  ctx.fill();

  // 视窗
  ctx.fillStyle = '#00b4d8';
  ctx.beginPath();
  ctx.arc(0, -size * 0.05, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d3557';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// 绘制从当前位置出发的10格最简提示虚线与箭头
function drawHintPath(ctx, path, size) {
  if (path.length < 2) return;

  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 5]); // 虚线效果
  ctx.shadowColor = '#ffbe0b';
  ctx.shadowBlur = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = path[i].x * size + size / 2;
    const py = path[i].y * size + size / 2;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  // 在提示终点绘制发光导航箭头
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const arrowX = last.x * size + size / 2;
  const arrowY = last.y * size + size / 2;
  const arrowSize = size * 0.35;

  ctx.setLineDash([]); // 实线箭头
  ctx.fillStyle = '#ffbe0b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(
    arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
    arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    arrowX - (arrowSize * 0.6) * Math.cos(angle),
    arrowY - (arrowSize * 0.6) * Math.sin(angle)
  );
  ctx.lineTo(
    arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
    arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
function drawAstronaut(ctx, px, py, radius) {
  ctx.save();
  const glow = ctx.createRadialGradient(px, py, radius * 0.3, px, py, radius * 1.4);
  glow.addColorStop(0, 'rgba(255, 209, 102, 0.8)');
  glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px, py, radius * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#118ab2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const visor = ctx.createLinearGradient(px - radius * 0.6, py - radius * 0.5, px + radius * 0.6, py + radius * 0.5);
  visor.addColorStop(0, '#00f0ff');
  visor.addColorStop(1, '#073b4c');
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.ellipse(px, py - radius * 0.05, radius * 0.65, radius * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px - radius * 0.25, py - radius * 0.2, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 绘制能量门
function drawDoor(ctx, door, size) {
  const px = door.x * size + size / 2;
  const py = door.y * size + size / 2;

  ctx.save();
  if (!door.answered) {
    // 未解锁：红色脉冲边框与 🔒 锁头标记
    ctx.fillStyle = 'rgba(230, 57, 70, 0.4)';
    ctx.fillRect(door.x * size + 2, door.y * size + 2, size - 4, size - 4);

    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(door.x * size + 2, door.y * size + 2, size - 4, size - 4);

    ctx.fillStyle = '#ffbe0b';
    ctx.font = `bold ${Math.floor(size * 0.65)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', px, py);
  } else {
    // 已解锁：绿色通行能量场
    ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
    ctx.fillRect(door.x * size + 2, door.y * size + 2, size - 4, size - 4);
    ctx.fillStyle = '#2ecc71';
    ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔓', px, py);
  }
  ctx.restore();
}

// 主绘制函数
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 科技深空背景
  const bgGrad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 80,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
  );
  bgGrad.addColorStop(0, '#102a43');
  bgGrad.addColorStop(0.5, '#0b1d3a');
  bgGrad.addColorStop(1, '#050c1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. 闪烁星空
  for (const s of stars) {
    s.alpha += s.twinkleSpeed;
    const a = (Math.sin(s.alpha) + 1) / 2 * 0.7 + 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 迷宫居中位置计算（考虑顶部标题栏和底部按键，做最佳视觉居中）
  const mazeWidth = MAZE_COLS * CELL_SIZE;
  const mazeHeight = MAZE_ROWS * CELL_SIZE;
  const startX = Math.round((canvas.width - mazeWidth) / 2);
  // 垂直方向：将迷宫在顶部标题(约60px)与底部控制栏(约80px)的有效净空区域内居中
  const startY = Math.round(55 + (canvas.height - 135 - mazeHeight) / 2);

  // 4. 左下角地球与右上角火箭（装饰大小随屏幕弹性适配）
  const sideSpace = Math.min(startX, canvas.width - (startX + mazeWidth));
  const decorRadius = Math.max(25, Math.min(sideSpace * 0.55, 60));
  if (sideSpace >= 35) {
    drawEarth(ctx, startX - decorRadius * 0.7, startY + mazeHeight - decorRadius * 0.4, decorRadius);
    drawRocket(ctx, startX + mazeWidth + decorRadius * 0.7, startY + decorRadius * 0.5, decorRadius * 0.9);
  }

  ctx.save();
  ctx.translate(startX, startY);

  // 5. 迷宫底板
  ctx.fillStyle = 'rgba(15, 30, 60, 0.78)';
  ctx.beginPath();
  ctx.roundRect(-8, -8, mazeWidth + 16, mazeHeight + 16, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 起点：绿色传送门
  ctx.fillStyle = 'rgba(46, 204, 113, 0.35)';
  ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
  ctx.fillStyle = '#2ecc71';
  ctx.font = `bold ${CELL_SIZE * 0.4}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('起', CELL_SIZE / 2, CELL_SIZE / 2);

  // 终点：火箭发射台
  const endX = (MAZE_COLS - 1) * CELL_SIZE;
  const endY = (MAZE_ROWS - 1) * CELL_SIZE;
  ctx.fillStyle = 'rgba(255, 183, 3, 0.4)';
  ctx.fillRect(endX, endY, CELL_SIZE, CELL_SIZE);
  ctx.fillStyle = '#ffb703';
  ctx.fillText('终', endX + CELL_SIZE / 2, endY + CELL_SIZE / 2);

  // 5.5 绘制提示路径（金色发光虚线 + 箭头）
  if (activeHintPath && activeHintPath.length > 1) {
    drawHintPath(ctx, activeHintPath, CELL_SIZE);
  }

  // 6. 绘制所有能量门
  for (const door of doors) {
    drawDoor(ctx, door, CELL_SIZE);
  }

  // 7. 绘制明亮白蓝色立体迷宫墙体
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 6;

  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      const cell = cells[r][c];
      const px = c * CELL_SIZE;
      const py = r * CELL_SIZE;

      if (cell.N) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + CELL_SIZE, py);
        ctx.stroke();
      }
      if (cell.W) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + CELL_SIZE);
        ctx.stroke();
      }
      if (c === MAZE_COLS - 1 && cell.E) {
        ctx.beginPath();
        ctx.moveTo(px + CELL_SIZE, py);
        ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
        ctx.stroke();
      }
      if (r === MAZE_ROWS - 1 && cell.S) {
        ctx.beginPath();
        ctx.moveTo(px, py + CELL_SIZE);
        ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
        ctx.stroke();
      }
    }
  }

  ctx.shadowBlur = 0;

  // 8. 绘制主角小宇航员
  const astronautX = playerPos.x * CELL_SIZE + CELL_SIZE / 2;
  const astronautY = playerPos.y * CELL_SIZE + CELL_SIZE / 2;
  drawAstronaut(ctx, astronautX, astronautY, CELL_SIZE * 0.38);

  ctx.restore();
}

// 移动逻辑 & 碰撞检测
function canMove(dx, dy) {
  if (!isGameActive) return false;
  const nx = playerPos.x + dx;
  const ny = playerPos.y + dy;
  if (nx < 0 || ny < 0 || nx >= MAZE_COLS || ny >= MAZE_ROWS) return false;

  const current = cells[playerPos.y][playerPos.x];
  if (dx === -1 && current.W) return false;
  if (dx === 1 && current.E) return false;
  if (dy === -1 && current.N) return false;
  if (dy === 1 && current.S) return false;

  // 检查是否撞上了任何未解锁的能量门
  const hitDoor = doors.find(d => d.x === nx && d.y === ny && !d.answered);
  if (hitDoor) {
    // 触发能量门认证
    pendingDoor = hitDoor;
    isGameActive = false;
    setTimeout(() => {
      showQuestion();
    }, 150);
    return false; // 阻拦，无法穿过
  }

  return true;
}

function handleMove(dx, dy) {
  if (canMove(dx, dy)) {
    playerPos.x += dx;
    playerPos.y += dy;
    steps++;
    document.getElementById('stepCounter').innerText = `👣 步数: ${steps}`;

    // 如果当前有激活的提示路径，玩家向前走时自动削减已走过的提示格子
    if (activeHintPath && activeHintPath.length > 0) {
      if (activeHintPath[0].x === playerPos.x && activeHintPath[0].y === playerPos.y) {
        // 已经在当前位置
      } else if (activeHintPath.length > 1 && activeHintPath[1].x === playerPos.x && activeHintPath[1].y === playerPos.y) {
        activeHintPath.shift(); // 沿提示前进，消除走过的一格
      } else {
        // 走偏了路线，自动清除提示
        activeHintPath = [];
      }
    }

    draw();

    // 检查是否到达终点（终点直接通关，无需答题）
    if (playerPos.x === MAZE_COLS - 1 && playerPos.y === MAZE_ROWS - 1) {
      isGameActive = false;
      setTimeout(showVictory, 300);
    }
  }
}

// 抽取一个与上一题不同的新题目
function getRandomQuiz() {
  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * QUIZ_LIST.length);
  } while (nextIdx === lastQuizIndex && QUIZ_LIST.length > 1);
  lastQuizIndex = nextIdx;
  return QUIZ_LIST[nextIdx];
}

// 渲染答题弹窗：答错后换新题继续答，直到答对为止
function showQuestion() {
  const quiz = getRandomQuiz();
  const overlay = document.getElementById('quizOverlay');
  const qDesc = document.getElementById('quizQuestion');
  const optContainer = document.getElementById('quizOptions');
  const feedback = document.getElementById('feedback');

  qDesc.innerText = quiz.q;
  optContainer.innerHTML = '';

  quiz.options.forEach((optText, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = `${String.fromCharCode(65 + index)}. ${optText}`;

    btn.onclick = () => {
      // 禁用所有选项防止重复点击
      Array.from(optContainer.children).forEach(b => b.disabled = true);

      if (index === quiz.correct) {
        btn.classList.add('correct');
        feedback.style.color = '#28a745';
        feedback.innerText = '✅ 回答正确！能量门已成功打开！';
        if (pendingDoor) {
          pendingDoor.answered = true;
          pendingDoor = null;
        }
        draw();

        setTimeout(() => {
          overlay.style.display = 'none';
          feedback.innerText = '';
          isGameActive = true;
        }, 1100);
      } else {
        btn.classList.add('wrong');
        feedback.style.color = '#dc3545';
        feedback.innerText = '❌ 答案不正确！换一道新题继续挑战...';

        // 答错后 1 秒自动切换为全新题目，直到回答正确为止
        setTimeout(() => {
          showQuestion();
        }, 1100);
      }
    };
    optContainer.appendChild(btn);
  });

  overlay.style.display = 'flex';
}

// 弹出通关结算界面
function showVictory() {
  const winBanner = document.getElementById('winBanner');
  const winTitle = document.getElementById('winTitle');
  const winDetails = document.getElementById('winDetails');
  const nextLevelBtn = document.getElementById('nextLevelBtn');

  if (currentLevel < 8) {
    winTitle.innerText = `🎉 恭喜通关第 ${currentLevel} 关！`;
    winDetails.innerText = `太厉害了！你破解了本关所有能量门，用 ${steps} 步顺利抵达终点！下一关将迎来更多挑战！`;
    nextLevelBtn.style.display = 'inline-block';
    nextLevelBtn.innerText = `进入第 ${currentLevel + 1} 关 ➡️`;
  } else {
    winTitle.innerText = `🏆 终极科技大宗师！`;
    winDetails.innerText = `不可思议！你已通过所有高难关卡（10 道能量门满级挑战），知识与迷宫探险全满分！`;
    nextLevelBtn.style.display = 'none';
  }

  winBanner.style.display = 'flex';
}

// 进入下一关
function goToNextLevel() {
  startLevel(currentLevel + 1);
}

// 重新玩当前关卡
function restartCurrentLevel() {
  startLevel(currentLevel);
}

// 键盘控制（WASD + 方向键）
window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': handleMove(0, -1); break;
    case 'ArrowDown': case 'KeyS': handleMove(0, 1); break;
    case 'ArrowLeft': case 'KeyA': handleMove(-1, 0); break;
    case 'ArrowRight': case 'KeyD': handleMove(1, 0); break;
  }
});

// 虚拟按钮绑定
function bindCtrlButton(id, dx, dy) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const trigger = (e) => {
    e.preventDefault();
    handleMove(dx, dy);
  };
  btn.addEventListener('touchstart', trigger, { passive: false });
  btn.addEventListener('click', trigger);
}

bindCtrlButton('btnUp', 0, -1);
bindCtrlButton('btnDown', 0, 1);
bindCtrlButton('btnLeft', -1, 0);
bindCtrlButton('btnRight', 1, 0);

// 触发提示功能：寻找从当前位置到终点的最简路线，并截取前10格
function triggerHint() {
  if (!isGameActive) return;
  if (hintChances <= 0) {
    alert("本关的 3 次导航提示机会已经用完啦！加油靠自己探索吧！");
    return;
  }

  // 计算从当前玩家位置到终点的最短路径（BFS）
  const queue = [{ x: playerPos.x, y: playerPos.y, path: [{ x: playerPos.x, y: playerPos.y }] }];
  const visited = Array.from({ length: MAZE_ROWS }, () => Array(MAZE_COLS).fill(false));
  visited[playerPos.y][playerPos.x] = true;

  const dirs = [
    { dx: 0, dy: -1, wall: 'N' },
    { dx: 1, dy: 0, wall: 'E' },
    { dx: 0, dy: 1, wall: 'S' },
    { dx: -1, dy: 0, wall: 'W' }
  ];

  let fullPath = [];
  while (queue.length) {
    const { x, y, path } = queue.shift();
    if (x === MAZE_COLS - 1 && y === MAZE_ROWS - 1) {
      fullPath = path;
      break;
    }

    const cur = cells[y][x];
    for (const d of dirs) {
      if (!cur[d.wall]) {
        const nx = x + d.dx, ny = y + d.dy;
        if (nx >= 0 && nx < MAZE_COLS && ny >= 0 && ny < MAZE_ROWS && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
  }

  if (fullPath.length > 1) {
    // 截取从当前位置起最多移动10格（包含起点则长度为11以内）
    activeHintPath = fullPath.slice(0, 11);
    hintChances--;
    document.getElementById('hintCount').innerText = hintChances;
    if (hintChances <= 0) {
      const hintBtn = document.getElementById('hintBtn');
      if (hintBtn) {
        hintBtn.style.opacity = '0.6';
      }
    }
    draw();

    // 提示持续显示 8 秒后自动渐隐清除，或者玩家移动时会跟随清除
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      activeHintPath = [];
      draw();
    }, 8000);
  }
}

// 按钮事件
document.getElementById('hintBtn').onclick = triggerHint;
document.getElementById('restartBtn').onclick = restartCurrentLevel;
document.getElementById('playAgainBtn').onclick = restartCurrentLevel;
document.getElementById('nextLevelBtn').onclick = goToNextLevel;

// 触摸滑动手势支持
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 25 || Math.abs(dy) > 25) {
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? 1 : -1, 0);
    } else {
      handleMove(0, dy > 0 ? 1 : -1);
    }
  }
}, { passive: true });

// 页面就绪后双保险启动：立即执行 + DOMContentLoaded + 延迟一次确保视口稳定
function bootstrap() {
  initStars();
  resizeCanvas();
  startLevel(1);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// 延迟 50ms 与 200ms 再校准一次（解决部分手机浏览器视口初始化时 innerWidth 延迟汇报导致的黑屏或偏位）
setTimeout(resizeCanvas, 50);
setTimeout(resizeCanvas, 200);
