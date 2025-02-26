document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let cellSize = 10;
    let grid = [];
    let isRunning = false;
    let intervalId;
    let isDrawing = false;
    let lastX = -1;
    let lastY = -1;

    function initGrid() {
        canvas.width = 800;
        canvas.height = 200;

        grid = Array(Math.floor(canvas.height / cellSize)).fill().map(() =>
            Array(Math.floor(canvas.width / cellSize)).fill().map(() =>
                Math.random() > 0.85 ? 1 : 0
            )
        );
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                ctx.fillStyle = cell ? '#000' : '#FFF';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
            });
        });
    }

    function nextGen() {
        const newGrid = grid.map(row => [...row]);

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const neighbors = countNeighbors(x, y);

                if (grid[y][x] === 1) {
                    newGrid[y][x] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
                } else {
                    newGrid[y][x] = neighbors === 3 ? 1 : 0;
                }
            }
        }

        grid = newGrid;
    }

    function countNeighbors(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const ny = (y + dy + grid.length) % grid.length;
                const nx = (x + dx + grid[0].length) % grid[0].length;
                count += grid[ny][nx];
            }
        }
        return count;
    }

    function startGame() {
        if (!isRunning) {
            isRunning = true;
            intervalId = setInterval(() => {
                nextGen();
                draw();
            }, 100);
        }
    }

    function stopGame() {
        isRunning = false;
        clearInterval(intervalId);
    }

    function clearGame() {
        grid = grid.map(row => row.map(() => 0));
        draw();
    }

    // Bresenham's line algorithm
    function getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push([x0, y0]);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        return points;
    }

    // Mouse event handlers
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (y < grid.length && x < grid[0].length) {
            grid[y][x] = grid[y][x] ? 0 : 1;
            lastX = x;
            lastY = y;
            draw();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (y >= grid.length || x >= grid[0].length) return;

        if (x !== lastX || y !== lastY) {
            const points = getLinePoints(lastX, lastY, x, y);
            points.forEach(([px, py]) => {
                if (py < grid.length && px < grid[0].length) {
                    grid[py][px] = 1;
                }
            });
            lastX = x;
            lastY = y;
            draw();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        lastX = -1;
        lastY = -1;
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
        lastX = -1;
        lastY = -1;
    });

    document.getElementById('applySize').addEventListener('click', () => {
        const newSize = parseInt(document.getElementById('cellSize').value);
        if (newSize >= 3 && newSize <= 100) {
            cellSize = newSize;
            initGrid();
            draw();
        } else {
            alert('Cell size must be between 3 and 100');
        }
    });

    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('stopButton').addEventListener('click', stopGame);
    document.getElementById('clearButton').addEventListener('click', clearGame);

    initGrid();
    draw();
});