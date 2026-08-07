from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from datetime import datetime, date
import sqlite3
import requests

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
            timestamp TEXT NOT NULL,
            beverage TEXT DEFAULT 'water'
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Route 1: Log a new water entry
BEVERAGE_MULTIPLIERS = {
    "water": 1.0,
    "tea": 0.9,
    "coffee": 0.8,
    "juice": 0.85,
}

@app.route("/log", methods=["POST"])
def log_water():
    data = request.get_json()
    amount = data.get("amount_ml", 250)
    beverage = data.get("beverage", "water")
    timestamp = datetime.now().isoformat()

    multiplier = BEVERAGE_MULTIPLIERS.get(beverage, 1.0)
    effective_amount = round(amount * multiplier)

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO logs (amount_ml, timestamp, beverage) VALUES (?, ?, ?)",
        (effective_amount, timestamp, beverage)
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Logged successfully", "amount_ml": effective_amount, "beverage": beverage}), 201

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

@app.route("/export", methods=["GET"])
def export_history():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT amount_ml, timestamp, beverage FROM logs ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()

    csv_lines = ["amount_ml,timestamp,beverage"]
    for amount, timestamp, beverage in rows:
        csv_lines.append(f"{amount},{timestamp},{beverage or 'water'}")

    csv_content = "\n".join(csv_lines)
    return Response(csv_content, mimetype="text/csv", headers={"Content-Disposition": "attachment;filename=water_history.csv"})

try:
    from config import GEMINI_API_KEY
except ImportError:
    GEMINI_API_KEY = None

@app.route("/hydration-tip", methods=["POST"])
def hydration_tip():
    data = request.get_json() or {}
    total_today = data.get("total_today", 0)
    goal = data.get("goal", 2500)
    streak = data.get("streak", 0)

    prompt = (
        f"You are a friendly hydration coach. The user has drunk {total_today}ml out of their "
        f"{goal}ml daily water goal today, and has a {streak}-day streak of meeting their goal. "
        f"Give a short, encouraging, practical hydration tip (2-3 sentences max). "
        f"Be warm and specific to their situation."
    )

    try:
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            headers={
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json",
            },
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=15,
        )
        result = response.json()
        tip = result["candidates"][0]["content"]["parts"][0]["text"]
        return jsonify({"tip": tip.strip()})
    except Exception as e:
        return jsonify({
            "tip": "Stay hydrated! Try drinking water consistently throughout the day rather than all at once.",
            "error": str(e)
        }), 200

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", debug=False, port=port)