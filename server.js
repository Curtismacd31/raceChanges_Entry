const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // Allow cross-origin requests
app.use(express.static(__dirname)); // Serve static files

// Save JSON file
app.post('/save', (req, res) => {
    const { fileName, data } = req.body;
    if (!fileName || !data) {
        return res.status(400).send("Invalid request: Missing fileName or data");
    }

    const filePath = path.join(__dirname, "data", fileName);
    
    // Ensure the data folder exists
    if (!fs.existsSync(path.join(__dirname, "data"))) {
        fs.mkdirSync(path.join(__dirname, "data"));
    }

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Error saving file:", err);
            return res.status(500).send("Error saving file.");
        } else {
            res.send(`File saved as ${fileName}`);
        }
    });
});

// Serve JSON files dynamically
app.get('/json/:fileName', (req, res) => {
    const filePath = path.join(__dirname, "data", req.params.fileName);
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send("File not found.");
        }
        res.sendFile(filePath);
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
