const express = require("express");
const cors = require("cors");
const app = express();
const port = 4000;

const corsOptions = {
    origin: [
        'https://live-pixels.vercel.app',
        'https://live-pixels-kkbi.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const GRID_SIZE = 25;
let grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));

let userLimits = {}; // { userId: { count: 10, reset: timestamp } }
const MAX_PER_HOUR = 10;


const cleanupOldLimits = () => {
    const now = Date.now();
    Object.keys(userLimits).forEach(userId => {
        if (now > userLimits[userId].reset) {
            delete userLimits[userId];
        }
    });
};


setInterval(cleanupOldLimits, 10 * 60 * 1000);

app.get("/api/grid", (req, res) => {
    res.json(grid);
});

app.get("/api/stats", (req, res) => {

    const filledCells = grid.flat().filter(cell => cell?.color);
    const uniqueUsers = new Set(filledCells.map(cell => cell.userId).filter(Boolean));

    res.json({
        totalClicks: filledCells.length,
        uniqueUsers: uniqueUsers.size,
        artwork: Math.floor(filledCells.length / 10)
    });
});

app.post("/api/grid", (req, res) => {
    const { x, y, color, userId } = req.body;
    const now = Date.now();


    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Invalid userId" });
    }

    if (!color || typeof color !== 'string') {
        return res.status(400).json({ error: "Invalid color" });
    }

    const xNum = parseInt(x);
    const yNum = parseInt(y);

    if (isNaN(xNum) || isNaN(yNum)) {
        return res.status(400).json({ error: "Coordinates must be numbers" });
    }

    if (xNum < 0 || xNum >= GRID_SIZE || yNum < 0 || yNum >= GRID_SIZE) {
        return res.status(400).json({ error: "Invalid coordinates" });
    }

    if (!userLimits[userId] || now > userLimits[userId].reset) {
        userLimits[userId] = {
            count: MAX_PER_HOUR,
            reset: now + 3600 * 1000
        };
    }

    if (userLimits[userId].count <= 0) {
        return res.status(429).json({
            error: "Limit reached",
            resetTime: userLimits[userId].reset
        });
    }


    grid[yNum][xNum] = {
        color,
        userId,
        timestamp: now
    };

    userLimits[userId].count -= 1;


    const filledCells = grid.flat().filter(cell => cell?.color);
    const uniqueUsers = new Set(filledCells.map(cell => cell.userId).filter(Boolean));

    res.json({
        success: true,
        remaining: userLimits[userId].count,
        stats: {
            totalClicks: filledCells.length,
            uniqueUsers: uniqueUsers.size,
            artwork: Math.floor(filledCells.length / 10)
        }
    });
});


app.post("/api/reset", (req, res) => {
    grid = Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill(null));
    userLimits = {};
    res.json({ success: true, message: "Grid reset" });
});


app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: Date.now(),
        gridSize: GRID_SIZE,
        activeUsers: Object.keys(userLimits).length
    });
});


app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: "Internal server error" });
});


app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
    console.log(`Grid size: ${GRID_SIZE}x${GRID_SIZE}`);
    console.log(`Max clicks per hour: ${MAX_PER_HOUR}`);
});