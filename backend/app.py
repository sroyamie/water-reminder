from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, date
import sqlite3

app = Flask(__name__)
CORS(app)  # allows our React frontend to talk to this backend

DB_NAME = "database.db"

# Set up the database table (runs once when the app starts)
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount_ml INTEGER NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Route 1: Log a new water entry
@app.route("/log", methods=["POST"])
def log_water():
    data = request.get_json()
    amount = data.get("amount_ml", 250)  # default to 250ml if not provided
    timestamp = datetime.now().isoformat()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO logs (amount_ml, timestamp) VALUES (?, ?)", (amount, timestamp))
    conn.commit()
    conn.close()

    return jsonify({"message": "Logged successfully", "amount_ml": amount}), 201

# Route 2: Get today's total intake
@app.route("/today", methods=["GET"])
def get_today():
    today_str = date.today().isoformat()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT amount_ml FROM logs WHERE timestamp LIKE ?", (f"{today_str}%",))
    rows = cursor.fetchall()
    conn.close()

    total = sum(row[0] for row in rows)
    return jsonify({"date": today_str, "total_ml": total})

# Route 3: Get last 7 days history
@app.route("/history", methods=["GET"])
def get_history():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT amount_ml, timestamp FROM logs ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()

    # Group by date
    history = {}
    for amount, timestamp in rows:
        day = timestamp.split("T")[0]
        history[day] = history.get(day, 0) + amount

    return jsonify(history)

if __name__ == "__main__":
    app.run(debug=True, port=5000)