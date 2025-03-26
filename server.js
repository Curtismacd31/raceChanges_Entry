const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const JSON_DIR = path.join(__dirname, "json");

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(__dirname)); // ✅ Serve static files

// ✅ Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'changes_entry.html'));
});

// ✅ Ensure JSON directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    console.log("✅ JSON directory created.");
}

// ✅ Save JSON Files (Changes & Entries)
app.post('/save', (req, res) => {
    const { fileName, data, trackCondition, weather, variant } = req.body;

    if (!fileName || !data) {
        return res.status(400).json({ error: "Missing fileName or data" });
    }

    const filePath = path.join(JSON_DIR, fileName);

    let finalData;

    if (fileName.endsWith("_changes.json")) {
        // ✅ Wrap race changes with extra info if it's a _changes file
        const sortedChanges = Array.isArray(data)
            ? data.sort((a, b) => {
                const raceA = parseInt(a.raceNumber?.replace(/\D/g, "") || 0, 10);
                const raceB = parseInt(b.raceNumber?.replace(/\D/g, "") || 0, 10);
                if (raceA !== raceB) return raceA - raceB;

                const padA = parseInt(a.saddlePad || 0, 10);
                const padB = parseInt(b.saddlePad || 0, 10);
                return padA - padB;
            })
            : data;

        finalData = {
            trackCondition: trackCondition || "",
            weather: weather || "",
            variant: variant || "",
            changes: sortedChanges
        };
    } else {
        // ✅ For non-_changes files (equipment, drivers), just save the data directly
        finalData = data;
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
        console.log(`✅ File saved: ${filePath}`);
        res.json({ success: true, message: `File saved: ${fileName}` });
    } catch (error) {
        console.error("❌ Error saving file:", error);
        res.status(500).json({ error: "Failed to save file." });
    }
});



// ✅ Serve JSON Files
app.get("/json/:fileName", (req, res) => {
    const filePath = path.join(JSON_DIR, req.params.fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return res.status(404).json({ error: "File not found." });
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log(`✅ Serving file: ${filePath}`);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error reading file ${filePath}:`, error);
        res.status(500).json({ error: "Error reading file" });
    }
});

// ✅ Save Race Entries & Changes
app.post("/save-entries", (req, res) => {
    let { trackName, raceDate, horseEntries, raceChanges } = req.body;

    if (!trackName || !raceDate || !horseEntries) {
        console.error("❌ Missing required fields:", { trackName, raceDate, horseEntries });
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        const dateObj = new Date(raceDate);
        if (isNaN(dateObj)) throw new Error("Invalid date");
        raceDate = dateObj.toISOString().split("T")[0];
    } catch (error) {
        console.error("❌ Date parsing failed:", raceDate);
        return res.status(400).json({ error: "Invalid date format." });
    }

    const filePath = path.join(JSON_DIR, `${trackName}_${raceDate}_entries.json`);

    const sortedChanges = Array.isArray(raceChanges)
      ? raceChanges.sort((a, b) => {
          const raceA = parseInt(a.raceNumber?.replace(/\D/g, "") || 0, 10);
          const raceB = parseInt(b.raceNumber?.replace(/\D/g, "") || 0, 10);
          if (raceA !== raceB) return raceA - raceB;
    
          const padA = parseInt(a.saddlePad || 0, 10);
          const padB = parseInt(b.saddlePad || 0, 10);
          return padA - padB;
        })
      : [];
    
    const dataToSave = {
        horseEntries: horseEntries || {},
        raceChanges: sortedChanges
    };


    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`✅ Successfully saved entries for ${trackName} on ${raceDate}`);
        res.json({ success: true, message: `Entries saved: ${filePath}` });
    } catch (error) {
        console.error("❌ Error saving entries:", error);
        res.status(500).json({ error: "Failed to save entries." });
    }
});

// ✅ Retrieve Stored Entries
app.get("/get-entries", (req, res) => {
    const { trackName, raceDate } = req.query;
    const filePath = path.join(JSON_DIR, `${trackName}_${raceDate}_entries.json`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ Entries file not found: ${filePath}`);
        const emptyData = { horseEntries: {}, raceChanges: [] };
        fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
        return res.status(200).json(emptyData);
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log(`✅ Serving entries file: ${filePath}`);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error reading entries file ${filePath}:`, error);
        res.status(500).json({ error: "Error reading entries file" });
    }
});

// ✅ Validate Login
// ✅ Validate Login with Logging
app.post("/validate-login", (req, res) => {
    const { code } = req.body;
    console.log("🔑 Login attempt with code:", code);

    const judgeFile = path.join(JSON_DIR, "judges.json");
    if (!fs.existsSync(judgeFile)) {
        console.log("❌ Judge file not found:", judgeFile);
        return res.status(500).json({ error: "Judge list not found." });
    }

    const judgeData = JSON.parse(fs.readFileSync(judgeFile, "utf8"));
    const logPath = path.join(JSON_DIR, "logins.log");

    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - Login attempt with code: ${code} - `;

    if (judgeData[code]) {
        const trackList = judgeData[code].trackOptions.join(", ");
        const successLine = `${logLine}✅ SUCCESS - Tracks: ${trackList}\n`;
        fs.appendFileSync(logPath, successLine);
        console.log(successLine.trim());
        return res.json({ success: true, trackOptions: judgeData[code].trackOptions });
    } else {
        const failLine = `${logLine}❌ FAILED\n`;
        fs.appendFileSync(logPath, failLine);
        console.log(failLine.trim());
        return res.status(401).json({ success: false, message: "Invalid code." });
    }
});


// GET WEATHER
const axios = require("axios");
const xml2js = require("xml2js");

app.get("/get-weather", async (req, res) => {
    const { track } = req.query;

    try {
        const weatherMap = JSON.parse(fs.readFileSync(path.join(JSON_DIR, "weather.json"), "utf8"));
        const url = weatherMap[track];

        if (!url) {
            return res.status(404).json({ error: "No weather URL found for track." });
        }

        const response = await axios.get(url);
        const xml = response.data;

        xml2js.parseString(xml, (err, result) => {
            if (err) {
                return res.status(500).json({ error: "Failed to parse weather feed." });
            }

            const entries = result.feed.entry || [];
            if (entries.length < 2 || !entries[1].title || !entries[1].title[0]) {
                return res.status(404).json({ error: "No current conditions found." });
            }

            const currentConditions = entries[1].title[0]; // e.g. "Current Conditions: -0.7°C"
            res.json({ weather: currentConditions });
        });
    } catch (error) {
        console.error("❌ Weather fetch error:", error);
        res.status(500).json({ error: "Error fetching weather." });
    }
});

// ✅ Lock Track + Date
app.post("/lock-track", (req, res) => {
    const { trackName, raceDate, user } = req.body;

    if (!trackName || !raceDate || !user) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const lockFile = path.join(JSON_DIR, "locks.json");
    let locks = {};

    // Read current locks
    if (fs.existsSync(lockFile)) {
        locks = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    }

    const key = `${trackName}_${raceDate}`;

    if (locks[key] && locks[key].user !== user) {
        return res.status(403).json({ 
            success: false, 
            message: `Track is currently locked by ${locks[key].user}` 
        });
    }

    // Set or refresh lock
    locks[key] = {
        user,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
    res.json({ success: true, message: "Track locked successfully." });
});





// ✅ Test Server Endpoint
app.get("/status", (req, res) => {
    res.json({ success: true, message: "Server is running." });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
