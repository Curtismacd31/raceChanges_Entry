const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const db = new Database('./race_changes.db');

const username = 'judge101'; // Change this
const plainPassword = 'securePassword123'; // Change this
const trackOptions = JSON.stringify(["Woodbine", "Flamboro", "Mohawk"]); // Change this

const hashedPassword = bcrypt.hashSync(plainPassword, 10);

try {
  const stmt = db.prepare("INSERT INTO users (username, password, trackOptions) VALUES (?, ?, ?)");
  stmt.run(username, hashedPassword, trackOptions);
  console.log("✅ User created successfully");
} catch (err) {
  console.error("❌ Failed to create user:", err.message);
}
