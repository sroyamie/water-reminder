import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'https://yourusername.pythonanywhere.com';
const DEFAULT_GOAL_ML = 2500;

const BEVERAGES = [
  { id: 'water', label: 'Water' },
  { id: 'tea', label: 'Tea' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'juice', label: 'Juice' },
];

const calculateStreak = (history, goal) => {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const amount = history[dateStr] || 0;
    if (amount >= goal) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
};

const calculateMissedStats = (history, goal, daysBack = 30) => {
  let missedDays = 0;
  let totalShortfall = 0;
  const today = new Date();
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const amount = history[dateStr] || 0;
    if (amount < goal) {
      missedDays++;
      totalShortfall += (goal - amount);
    }
  }
  return {
    missedDays,
    avgShortfall: missedDays > 0 ? Math.round(totalShortfall / missedDays) : 0,
  };
};

const getMonthGrid = (year, month, history, goal) => {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    const amount = history[dateStr] || 0;
    let status = 'future';
    if (date <= today) {
      if (amount >= goal) status = 'met';
      else if (amount > 0) status = 'partial';
      else status = 'missed';
    }
    cells.push({ day, status, amount });
  }
  return cells;
};

const ACHIEVEMENTS = [
  { id: 'first_drop', name: 'First Drop', icon: '💧', check: (s) => s.daysLogged >= 1 },
  { id: 'streak_3', name: '3-Day Streak', icon: '🔥', check: (s) => s.streak >= 3 },
  { id: 'streak_7', name: '7-Day Streak', icon: '🔥', check: (s) => s.streak >= 7 },
  { id: 'streak_30', name: '30-Day Streak', icon: '🏆', check: (s) => s.streak >= 30 },
  { id: 'ten_liters', name: '10 Liters Club', icon: '🥤', check: (s) => s.totalAllTime >= 10000 },
  { id: 'fifty_liters', name: '50 Liters Club', icon: '🌊', check: (s) => s.totalAllTime >= 50000 },
  { id: 'century', name: 'Century (100 days logged)', icon: '💯', check: (s) => s.daysLogged >= 100 },
];

function App() {
  const [totalToday, setTotalToday] = useState(0);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastLogTime, setLastLogTime] = useState(Date.now());
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL_ML);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(DEFAULT_GOAL_ML);
  const [chartRange, setChartRange] = useState(7);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedBeverage, setSelectedBeverage] = useState('water');
  const [showCalculator, setShowCalculator] = useState(false);
  const [weightInput, setWeightInput] = useState(70);
  const [activityLevel, setActivityLevel] = useState('medium');
  const [showAchievements, setShowAchievements] = useState(false);

  const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
  const lastLogTimeRef = useRef(lastLogTime);

  useEffect(() => {
    lastLogTimeRef.current = lastLogTime;
  }, [lastLogTime]);

  useEffect(() => {
    const savedGoal = localStorage.getItem('dailyGoal');
    if (savedGoal) {
      setDailyGoal(Number(savedGoal));
      setGoalInput(Number(savedGoal));
    }
    const savedDark = localStorage.getItem('darkMode');
    if (savedDark) setDarkMode(savedDark === 'true');
  }, []);

  useEffect(() => {
    fetchToday();
    fetchHistory();

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastLogTimeRef.current;
      if (elapsed >= REMINDER_INTERVAL_MS) {
        setShowReminderBanner(true);
      }
    }, 60 * 1000);

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
        body: JSON.stringify({ amount_ml: amount, beverage: selectedBeverage }),
      });
      setLastLogTime(Date.now());
      setShowReminderBanner(false);
      fetchToday();
      fetchHistory();
    } catch (err) {
      console.error('Error logging water:', err);
    }
  };

  const saveGoal = () => {
    const newGoal = Math.max(500, Number(goalInput) || DEFAULT_GOAL_ML);
    setDailyGoal(newGoal);
    localStorage.setItem('dailyGoal', newGoal);
    setEditingGoal(false);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
  };

  const calculateSuggestedGoal = () => {
    const weight = Math.max(30, Number(weightInput) || 70);
    let goal = weight * 35;
    if (activityLevel === 'medium') goal += 350;
    if (activityLevel === 'high') goal += 750;
    goal = Math.round(goal / 50) * 50; // round to nearest 50ml
    setGoalInput(goal);
    setDailyGoal(goal);
    localStorage.setItem('dailyGoal', goal);
    setShowCalculator(false);
  };

  const exportHistory = () => {
    window.open(`${API_URL}/export`, '_blank');
  };

  const progressPercent = Math.min((totalToday / dailyGoal) * 100, 100);

  const historyEntries = Object.entries(history)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, chartRange)
    .reverse();

  const streak = calculateStreak(history, dailyGoal);
  const missedStats = calculateMissedStats(history, dailyGoal);

  const totalAllTime = Object.values(history).reduce((sum, v) => sum + v, 0);
  const daysLogged = Object.keys(history).length;
  const achievementStats = { streak, totalAllTime, daysLogged };
  const unlockedAchievements = ACHIEVEMENTS.filter((a) => a.check(achievementStats));

  const changeMonth = (delta) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCalendarDate(newDate);
  };

  const monthCells = getMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth(), history, dailyGoal);
  const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  if (loading) return <div className="app"><p>Loading...</p></div>;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="top-bar">
        <h1>💧 Water Reminder</h1>
        <button className="dark-toggle" onClick={toggleDarkMode}>
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {showReminderBanner && (
        <div className="reminder-banner">
          Time to hydrate! It's been a while since your last log.
          <button className="dismiss-btn" onClick={() => setShowReminderBanner(false)}>✕</button>
        </div>
      )}

      <div className="streak-banner">🔥 {streak} day{streak !== 1 ? 's' : ''} streak</div>

      <div className="ring-container">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke={darkMode ? '#333' : '#e0e0e0'} strokeWidth="16" />
          <circle
            cx="100" cy="100" r={radius}
            fill="none" stroke="#4fc3f7" strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
          <text x="100" y="95" textAnchor="middle" fontSize="28" fontWeight="700" fill={darkMode ? '#fff' : '#333'}>
            {Math.round(progressPercent)}%
          </text>
          <text x="100" y="120" textAnchor="middle" fontSize="14" fill={darkMode ? '#ccc' : '#666'}>
            {totalToday} / {dailyGoal} ml
          </text>
        </svg>
      </div>

      <div className="goal-row">
        {editingGoal ? (
          <>
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="goal-input"
              min="500"
              step="100"
            />
            <button className="goal-btn" onClick={saveGoal}>Save</button>
          </>
        ) : (
          <button className="goal-btn" onClick={() => setEditingGoal(true)}>
            🎯 Edit Daily Goal ({dailyGoal}ml)
          </button>
        )}
        <button className="goal-btn calc-btn" onClick={() => setShowCalculator(!showCalculator)}>
          🧮 Calculate My Goal
        </button>
      </div>

      {showCalculator && (
        <div className="calculator-panel">
          <label>
            Weight (kg):
            <input type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} min="30" />
          </label>
          <label>
            Activity Level:
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <button className="goal-btn" onClick={calculateSuggestedGoal}>Apply Suggested Goal</button>
        </div>
      )}

      <div className="beverage-row">
        {BEVERAGES.map((b) => (
          <button
            key={b.id}
            className={`beverage-btn ${selectedBeverage === b.id ? 'active' : ''}`}
            onClick={() => setSelectedBeverage(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="buttons">
        <button onClick={() => logWater(250)}>+250ml</button>
        <button onClick={() => logWater(500)}>+500ml</button>
        <button onClick={() => logWater(1000)}>+1000ml</button>
      </div>

      <div className="action-row">
        <button className="io-btn" onClick={() => setShowAchievements(!showAchievements)}>
          🏅 Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
        </button>
        <button className="io-btn" onClick={exportHistory}>⬇️ Export History</button>
      </div>

      {showAchievements && (
        <div className="achievements-panel">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = a.check(achievementStats);
            return (
              <div key={a.id} className={`achievement-item ${unlocked ? 'unlocked' : 'locked'}`}>
                <span className="achievement-icon">{a.icon}</span>
                <span>{a.name}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="missed-stats">
        📉 Missed goal {missedStats.missedDays}/30 days &nbsp;|&nbsp; Avg shortfall: {missedStats.avgShortfall}ml
      </div>

      <div className="chart-header">
        <h2 className="history-title">Analytics</h2>
        <div className="range-toggle">
          <button className={chartRange === 7 ? 'active' : ''} onClick={() => setChartRange(7)}>Week</button>
          <button className={chartRange === 30 ? 'active' : ''} onClick={() => setChartRange(30)}>Month</button>
        </div>
      </div>
      <div className={`history-chart ${chartRange === 30 ? 'compact' : ''}`}>
        {historyEntries.length === 0 && <p className="no-data">No history yet</p>}
        {historyEntries.map(([day, amount]) => {
          const heightPercent = Math.min((amount / dailyGoal) * 100, 100);
          return (
            <div key={day} className="history-bar-wrapper">
              <div className="history-bar-track">
                <div className="history-bar-fill" style={{ height: `${heightPercent}%` }} title={`${amount} ml`} />
              </div>
              {chartRange === 7 && <span className="history-label">{day.slice(5)}</span>}
            </div>
          );
        })}
      </div>

      <div className="calendar-section">
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)}>‹</button>
          <span>{monthName}</span>
          <button onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="calendar-grid">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="calendar-day-label">{d}</div>
          ))}
          {monthCells.map((cell, i) => (
            <div
              key={i}
              className={`calendar-cell ${cell ? cell.status : 'empty'}`}
              title={cell ? `${cell.amount}ml` : ''}
            >
              {cell ? cell.day : ''}
            </div>
          ))}
        </div>
        <div className="calendar-legend">
          <span><span className="legend-dot met"></span> Goal met</span>
          <span><span className="legend-dot partial"></span> Partial</span>
          <span><span className="legend-dot missed"></span> Missed</span>
        </div>
      </div>
    </div>
  );
}

export default App;