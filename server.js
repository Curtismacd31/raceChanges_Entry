const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const JSON_DIR = path.join(__dirname, "json");

console.log(`Checking JSON_DIR existence: ${fs.existsSync(JSON_DIR)}`);
console.log(`JSON_DIR Path: ${JSON_DIR}`);

// ✅ Ensure JSON directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
    console.log("✅ JSON directory created on startup.");
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());
app.use(express.static(__dirname)); // ✅ Serve static files

// ✅ Save JSON Files
app.post('/save', (req, res) => {
    const { fileName, data } = req.body;
    if (!fileName || !data) {
        return res.status(400).send("Invalid request: Missing fileName or data");
    }

    const filePath = path.join(JSON_DIR, fileName);
    console.log(`Saving file: ${filePath}`);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("❌ Error saving file:", err);
            return res.status(500).send("Error saving file.");
        } else {
            res.send(`✅ File saved as ${fileName}`);
        }
    });
});

// ✅ Serve JSON Files
app.get("/json/:fileName", (req, res) => {
    const filePath = path.join(JSON_DIR, req.params.fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
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

// ✅ Save Race Entries & Changes (Now in /json folder)
app.post("/save-entries", (req, res) => {
    const { trackName, raceDate, horseEntries, raceChanges } = req.body;

    if (!trackName || !raceDate || !horseEntries) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const filePath = path.join(JSON_DIR, `${trackName}_${raceDate}_entries.json`);

    const dataToSave = {
        horseEntries,
        raceChanges: raceChanges || []
    };

    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`✅ Entries & changes saved for ${trackName} on ${raceDate}`);
        res.json({ success: true, message: "Entries stored successfully." });
    } catch (error) {
        console.error("❌ Error saving entries:", error);
        res.status(500).json({ error: "Failed to save entries." });
    }
});

// ✅ Retrieve Stored Entries (From /json instead of /temp_entries)
app.get("/get-entries", (req, res) => {
    const { trackName, raceDate } = req.query;
    const filePath = path.join(JSON_DIR, `${trackName}_${raceDate}_entries.json`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "No stored entries found." });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json({
        horseEntries: data.horseEntries || {},
        raceChanges: data.raceChanges || []
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
