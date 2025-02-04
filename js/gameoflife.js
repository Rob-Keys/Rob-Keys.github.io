document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let cellSize = 10;
    let grid = [];
    let isRunning = false;
    let intervalId;

    function initGrid() {
        canvas.width = 800;
        canvas.height = 800;

        grid = Array(Math.floor(canvas.height/cellSize)).fill().map(() =>
            Array(Math.floor(canvas.width/cellSize)).fill().map(() =>
                Math.random() > 0.85 ? 1 : 0    /* At least 15% of grid needs to be black to have sustained reactions */
            )
        );
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                ctx.fillStyle = cell ? '#000' : '#FFF';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize-1, cellSize-1);
            });
        });
    }

// Game of Life rules
    function nextGen() {
        const newGrid = grid.map(row => [...row]);

        for(let y = 0; y < grid.length; y++) {
            for(let x = 0; x < grid[y].length; x++) {
                const neighbors = countNeighbors(x, y);

                if(grid[y][x] === 1) {
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
        for(let dy = -1; dy <= 1; dy++) {
            for(let dx = -1; dx <= 1; dx++) {
                if(dx === 0 && dy === 0) continue;
                const ny = (y + dy + grid.length) % grid.length;
                const nx = (x + dx + grid[0].length) % grid[0].length;
                count += grid[ny][nx];
            }
        }
        return count;
    }

// Controls
    function startGame() {
        if(!isRunning) {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        grid = Array(Math.floor(canvas.height/cellSize)).fill().map(() =>
            Array(Math.floor(canvas.width/cellSize)).fill().map(() => 0)
        );
        draw();
    }

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

// Add click interaction
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (y < grid.length && x < grid[0].length) {
            grid[y][x] = grid[y][x] ? 0 : 1;
            draw();
        }
    });

    // Update event listeners to use button IDs
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('stopButton').addEventListener('click', stopGame);
    document.getElementById('clearButton').addEventListener('click', clearGame);

    // Initialization
    initGrid();
    draw();
});