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
      </div>
    </div>
  );
}
