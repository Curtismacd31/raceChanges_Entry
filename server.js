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
app.use(express.static(__dirname));

// ✅ Ensure JSON directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    console.log("✅ JSON directory created.");
}

// ✅ Serve home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'changes_entry.html'));
});

// ✅ Save JSON Files (Changes & Entries)
app.post('/save', (req, res) => {
    const { fileName, data } = req.body;

    if (!fileName || !data) {
        return res.status(400).json({ error: "Missing fileName or data" });
    }

    const filePath = path.join(JSON_DIR, fileName);

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

    const dataToSave = {
        horseEntries: horseEntries || {},
        raceChanges: raceChanges || []
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

// ✅ Status endpoint
app.get("/status", (req, res) => {
    res.json({ success: true, message: "Server is running." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
