import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'https://water-reminder-backend.onrender.com';
const DAILY_GOAL_ML = 2500;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

function App() {
  const [totalToday, setTotalToday] = useState(0);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastLogTime, setLastLogTime] = useState(Date.now());
  const [showReminderBanner, setShowReminderBanner] = useState(false);

  const lastLogTimeRef = useRef(lastLogTime);

  useEffect(() => {
    lastLogTimeRef.current = lastLogTime;
  }, [lastLogTime]);

  useEffect(() => {
    fetchToday();
    fetchHistory();

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastLogTimeRef.current;
      if (elapsed >= REMINDER_INTERVAL_MS) {
        setShowReminderBanner(true);
      }
    }, 60 * 1000); // check every 1 minute

    return () => clearInterval(checkInterval);
  }, []);

  const fetchToday = async () => {
    try {
      const res = await fetch(`${API_URL}/today`);
      const data = await res.json();
      setTotalToday(data.total_ml);
    } catch (err) {
      console.error('Error fetching today:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const logWater = async (amount) => {
    try {
      await fetch(`${API_URL}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: amount }),
      });
      setLastLogTime(Date.now());
      setShowReminderBanner(false); // dismiss banner once they log water
      fetchToday();
      fetchHistory();
    } catch (err) {
      console.error('Error logging water:', err);
    }
  };

  const progressPercent = Math.min((totalToday / DAILY_GOAL_ML) * 100, 100);

  const historyEntries = Object.entries(history)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 7)
    .reverse();

  if (loading) return <div className="app"><p>Loading...</p></div>;

  return (
    <div className="app">
      <h1>💧 Water Reminder</h1>

      {showReminderBanner && (
        <div className="reminder-banner">
          Time to hydrate! It's been a while since your last log.
          <button className="dismiss-btn" onClick={() => setShowReminderBanner(false)}>✕</button>
        </div>
      )}

      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="progress-text">
        {totalToday} ml / {DAILY_GOAL_ML} ml
      </p>

      <div className="buttons">
        <button onClick={() => logWater(250)}>+250ml</button>
        <button onClick={() => logWater(500)}>+500ml</button>
        <button onClick={() => logWater(1000)}>+1000ml</button>
      </div>

      <h2 className="history-title">Last 7 Days</h2>
      <div className="history-chart">
        {historyEntries.length === 0 && <p className="no-data">No history yet</p>}
        {historyEntries.map(([day, amount]) => {
          const heightPercent = Math.min((amount / DAILY_GOAL_ML) * 100, 100);
          return (
            <div key={day} className="history-bar-wrapper">
              <div className="history-bar-track">
                <div
                  className="history-bar-fill"
                  style={{ height: `${heightPercent}%` }}
                  title={`${amount} ml`}
                />
              </div>
              <span className="history-label">{day.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;