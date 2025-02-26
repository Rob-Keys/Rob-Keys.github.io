import '../styles/App.css'
import "../styles/pages/Game.css"

function GamePage() {
    return (
        <div className="GamePage">
                <div className="Title">
                    <h1>Game of Life</h1>
                </div>
                <div className="content">
                    <div className="gameText">
                        <h2>Game of Life</h2>
                        <p>A simple implementation of Conways Game Of Life. Cell's are alive (black) or dead (white), a cell
                            will live if three surrounding cells are alive, and die otherwise</p>
                    </div>
                    <div className="canvas-container">
                        <canvas id="gameCanvas"></canvas>
                    </div>
                    <div className="controls">
                        <label htmlFor="cellSize"><input type="number" id="cellSize" value="10" min="5" max="50"/></label>
                        <button id="applySize">Apply Size</button>
                        <button id="startButton">Start</button>
                        <button id="stopButton">Stop</button>
                        <button id="clearButton">Clear</button>
                    </div>
                    <script src="/src/js/gameoflife.js" defer></script>
                </div>
            </div>
    );
}
export default GamePage;