export default function SettingsPanel({ settings, setSettings }) {
  function update(patch) {
    setSettings({ ...settings, ...patch });
  }

  return (
    <div className="card settings-panel">
      <div className="card-title">
        <h2>Settings</h2>
      </div>

      <label className="settings-row settings-checkbox">
        <input
          type="checkbox"
          checked={settings.excludeWeekends}
          onChange={(e) => update({ excludeWeekends: e.target.checked })}
        />
        Exclude weekends as viable meeting options
      </label>

      <div className="settings-row">
        <label className="settings-field">
          Day starts at
          <input
            type="time"
            value={settings.dayStart}
            onChange={(e) => update({ dayStart: e.target.value })}
          />
        </label>
        <label className="settings-field">
          Day ends at
          <input
            type="time"
            value={settings.dayEnd}
            onChange={(e) => update({ dayEnd: e.target.value })}
          />
        </label>
        <label className="settings-field">
          Meeting length
          <select
            value={settings.meetingLength}
            onChange={(e) => update({ meetingLength: Number(e.target.value) })}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </label>
      </div>
    </div>
  );
}
