// ✅ Full server.js with SQLite + all your existing routes

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require("axios");
const xml2js = require("xml2js");
const Database = require('better-sqlite3');

const app = express();
const JSON_DIR = path.join(__dirname, "json");
const db = new Database(path.join(__dirname, 'race_changes.db'));

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(__dirname));

// ✅ Ensure JSON directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    console.log("✅ JSON directory created.");
}

// ✅ Create SQLite table if it doesn't exist
db.prepare(\`
  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY,
    track TEXT,
    date TEXT,
    raceNumber TEXT,
    saddlePad TEXT,
    horseName TEXT,
    category TEXT,
    change TEXT,
    trackCondition TEXT,
    weather TEXT,
    variant TEXT
  )
\`).run();

// ✅ Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'changes_entry.html'));
});

// ✅ API version of saving changes to DB instead of JSON file
app.post('/api/:filename', (req, res) => {
    const [track, datePart] = decodeURIComponent(req.params.filename).split("_");
    const date = datePart.replace("_changes", "");

    const { trackCondition, weather, variant, changes } = req.body;

    if (!track || !date || !Array.isArray(changes)) {
        return res.status(400).json({ error: "Missing or invalid data structure" });
    }

    const insert = db.prepare(\`
        INSERT INTO changes (
          track, date, raceNumber, saddlePad, horseName, category, change,
          trackCondition, weather, variant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`);

    const insertMany = db.transaction((rows) => {
        for (const c of rows) {
            insert.run(
                track,
                date,
                c.raceNumber,
                c.saddlePad,
                c.horseName,
                c.category,
                c.change,
                trackCondition || '',
                weather || '',
                variant || ''
            );
        }
    });

    try {
        insertMany(changes);
        res.json({ success: true, message: "Saved to database." });
    } catch (e) {
        console.error("❌ DB Error:", e);
        res.status(500).json({ error: "Failed to save to DB" });
    }
});

// ✅ Existing route: Save JSON Files
app.post('/save', (req, res) => {
    const { fileName, data, trackCondition, weather, variant } = req.body;
    if (!fileName || !data) return res.status(400).json({ error: "Missing fileName or data" });

    const filePath = path.join(JSON_DIR, fileName);
    const sortedChanges = Array.isArray(data)
        ? data.sort((a, b) => {
            const raceA = parseInt(a.raceNumber?.replace(/\D/g, "") || 0, 10);
            const raceB = parseInt(b.raceNumber?.replace(/\D/g, "") || 0, 10);
            if (raceA !== raceB) return raceA - raceB;
            const padA = parseInt(a.saddlePad || 0, 10);
            const padB = parseInt(b.saddlePad || 0, 10);
            return padA - padB;
        }) : data;

    const finalData = fileName.endsWith("_changes.json")
        ? { trackCondition: trackCondition || "", weather: weather || "", variant: variant || "", changes: sortedChanges }
        : data;

    try {
        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
        res.json({ success: true, message: "File saved: " + fileName });
    } catch (e) {
        console.error("❌ File save failed:", e);
        res.status(500).json({ error: "Failed to save file" });
    }
});

// ✅ Serve JSON files
app.get("/json/:fileName", (req, res) => {
    const filePath = path.join(JSON_DIR, req.params.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found." });

    try {
        const data = fs.readFileSync(filePath, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ File read error:", err);
        res.status(500).json({ error: "Error reading file" });
    }
});

// ✅ Save entries
app.post("/save-entries", (req, res) => {
    let { trackName, raceDate, horseEntries, raceChanges } = req.body;
    if (!trackName || !raceDate || !horseEntries) return res.status(400).json({ error: "Missing fields" });

    const filePath = path.join(JSON_DIR, \`\${trackName}_\${raceDate}_entries.json\`);
    const sortedChanges = Array.isArray(raceChanges)
        ? raceChanges.sort((a, b) => {
            const raceA = parseInt(a.raceNumber?.replace(/\D/g, "") || 0, 10);
            const raceB = parseInt(b.raceNumber?.replace(/\D/g, "") || 0, 10);
            if (raceA !== raceB) return raceA - raceB;
            const padA = parseInt(a.saddlePad || 0, 10);
            const padB = parseInt(b.saddlePad || 0, 10);
            return padA - padB;
        }) : [];

    const toSave = { horseEntries: horseEntries || {}, raceChanges: sortedChanges };

    try {
        fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
        res.json({ success: true, message: "Entries saved" });
    } catch (e) {
        console.error("❌ Error saving entries:", e);
        res.status(500).json({ error: "Failed to save entries." });
    }
});

// ✅ Get Entries
app.get("/get-entries", (req, res) => {
    const { trackName, raceDate } = req.query;
    const filePath = path.join(JSON_DIR, \`\${trackName}_\${raceDate}_entries.json\`);
    if (!fs.existsSync(filePath)) {
        const empty = { horseEntries: {}, raceChanges: [] };
        fs.writeFileSync(filePath, JSON.stringify(empty, null, 2));
        return res.status(200).json(empty);
    }

    try {
        const data = fs.readFileSync(filePath, "utf8");
        res.json(JSON.parse(data));
    } catch (e) {
        console.error("❌ Error loading entries:", e);
        res.status(500).json({ error: "Failed to read entries." });
    }
});

// ✅ Login Validator
app.post("/validate-login", (req, res) => {
    const { code } = req.body;
    const judgeFile = path.join(JSON_DIR, "judges.json");
    const logFile = path.join(JSON_DIR, "logins.log");
    const timestamp = new Date().toISOString();

    if (!fs.existsSync(judgeFile)) return res.status(500).json({ error: "Judge list not found." });
    const judgeData = JSON.parse(fs.readFileSync(judgeFile, "utf8"));

    const log = `${timestamp} - Login attempt with code: ${code} - `;

    if (judgeData[code]) {
        fs.appendFileSync(logFile, log + "✅ SUCCESS\n");
        return res.json({ success: true, trackOptions: judgeData[code].trackOptions });
    } else {
        fs.appendFileSync(logFile, log + "❌ FAILED\n");
        return res.status(401).json({ success: false, message: "Invalid code." });
    }
});

// ✅ Weather Fetcher
app.get("/get-weather", async (req, res) => {
    const { track } = req.query;
    try {
        const map = JSON.parse(fs.readFileSync(path.join(JSON_DIR, "weather.json"), "utf8"));
        const url = map[track];
        if (!url) return res.status(404).json({ error: "No weather URL for track." });

        const response = await axios.get(url);
        xml2js.parseString(response.data, (err, result) => {
            if (err) return res.status(500).json({ error: "Failed to parse weather XML." });

            const entries = result.feed.entry || [];
            if (entries.length < 2 || !entries[1].title?.[0]) {
                return res.status(404).json({ error: "No current conditions." });
            }

            res.json({ weather: entries[1].title[0] });
        });
    } catch (e) {
        console.error("❌ Weather error:", e);
        res.status(500).json({ error: "Failed to fetch weather." });
    }
});

// ✅ Track locking
app.post("/lock-track", (req, res) => {
    const { trackName, raceDate, user } = req.body;
    if (!trackName || !raceDate || !user) return res.status(400).json({ error: "Missing fields." });

    const lockFile = path.join(JSON_DIR, "locks.json");
    let locks = {};

    if (fs.existsSync(lockFile)) {
        locks = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    }

    const key = \`\${trackName}_\${raceDate}\`;

    if (locks[key] && locks[key].user !== user) {
        return res.status(403).json({ success: false, message: \`Track is locked by \${locks[key].user}\` });
    }

    locks[key] = {
        user,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
    res.json({ success: true, message: "Track locked." });
});

// ✅ Server Health
app.get("/status", (req, res) => {
    res.json({ success: true, message: "Server is running." });
});

// ✅ Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});
