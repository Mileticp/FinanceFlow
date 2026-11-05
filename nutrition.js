/* Uses the existing food_logs / weight_logs schema; never writes financeflow_data. */
(() => {
  'use strict';
  const FOOD = 'id,logged_on,meal,food_name,quantity,calories,protein_g,estimated,notes,created_at';
  const WEIGHT = 'id,logged_on,weight_kg,created_at';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const number = (value, min, max) => String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  function foodInput(values) {
    if (!validDate(values.logged_on) || !values.food_name.trim() || values.food_name.length > 150 ||
        !number(values.calories, 0, 100000) || !number(values.protein_g, 0, 10000) ||
        values.quantity.length > 100 || values.notes.length > 500 ||
        !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'].includes(values.meal)) throw Error('Check the meal details and nutrition values.');
    return {logged_on: values.logged_on, meal: values.meal, food_name: values.food_name.trim(),
      quantity: values.quantity.trim(), calories: Number(values.calories), protein_g: Number(values.protein_g),
      estimated: Boolean(values.estimated), notes: values.notes.trim()};
  }
  function totals(rows) {
    return rows.reduce((sum, row) => ({calories: sum.calories + Number(row.calories), protein: sum.protein + Number(row.protein_g)}), {calories: 0, protein: 0});
  }
  // Also exported for the dependency-free validation tests.
  if (typeof module !== 'undefined') module.exports = {validDate, foodInput, totals};
  if (typeof window === 'undefined') return;
  window.initNutrition = ({cloud, getUser, isReady, localDate}) => {
    const $ = id => document.getElementById(id);
    let account = null, generation = 0, foods = [], weights = [], presets = [], busy = false, loaded = false, presetsReadable = true;
    const view = $('nutritionView');
    view.innerHTML = `
      <div class="hero row"><div><h1>Food & Weight</h1><div class="muted">Your meals, daily nutrition and weight history.</div></div>
        <label class="field">Day<input id="nutritionDay" type="date" required></label></div>
      <p id="nutritionStatus" role="status" aria-live="polite"></p>
      <div class="toolbar"><button class="btn secondary" id="nutritionRefresh">Refresh records</button><button class="btn secondary" id="nutritionExport">Export nutrition backup</button></div>
      <section class="grid section"><div class="card"><h2>Daily calories</h2><div class="metric" id="nutritionCalories">—</div></div>
        <div class="card"><h2>Daily protein</h2><div class="metric" id="nutritionProtein">—</div></div>
        <div class="card"><h2>Latest weight</h2><div class="metric" id="nutritionWeight">—</div><div class="tiny muted" id="nutritionWeightDate"></div></div></section>
      <section class="split section"><div class="card"><h2>Log a meal</h2>
        <label class="field">Reusable food preset<select id="nutritionPreset"><option value="">Choose a preset</option></select></label>
        <p class="tiny muted">Presets stay on this device for your account. Nutrition values are for the whole quantity entered.</p>
        <form id="nutritionFoodForm" class="formgrid"><label class="field">Meal<select id="nutritionMeal"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option><option>Other</option></select></label>
        <label class="field">Food<input id="nutritionName" maxlength="150" required></label>
        <label class="field">Quantity / serving<input id="nutritionQuantity" maxlength="100" placeholder="e.g. 200 g or 1 bowl"></label>
        <label class="field">Calories (kcal)<input id="nutritionKcal" type="number" min="0" max="100000" step="0.1" required></label>
        <label class="field">Protein (g)<input id="nutritionGrams" type="number" min="0" max="10000" step="0.1" value="0" required></label>
        <label class="field">Values<select id="nutritionEstimated"><option value="false">From nutrition label</option><option value="true">Estimated</option></select></label>
        <label class="field full">Notes<input id="nutritionNotes" maxlength="500"></label>
        <button class="btn full" type="submit">Save meal for selected day</button>
        <button class="btn secondary" type="button" id="nutritionSavePreset">Save form as preset</button>
        <button class="btn secondary" type="button" id="nutritionDeletePreset">Delete selected preset</button></form></div>
      <div class="card"><h2>Log weight</h2><form id="nutritionWeightForm" class="stack">
        <label class="field">Weight (kg)<input id="nutritionKg" type="number" min="0.01" max="499.99" step="0.01" required></label>
        <button class="btn" type="submit">Save weight for selected day</button></form>
        <p class="muted tiny">Each save adds a record; existing measurements are preserved.</p><h2 class="section">Meals for selected day</h2><div id="nutritionMeals"></div></div></section>
      <section class="card section"><h2>Daily nutrition history</h2><p class="tiny muted">Choose any date above to see or add meals. History includes all loaded records.</p>
        <div class="worktable-wrap"><table class="worktable"><thead><tr><th>Date</th><th>Calories (kcal)</th><th>Protein (g)</th><th>Meals</th></tr></thead><tbody id="nutritionHistory"></tbody></table></div></section>
      <section class="card section"><h2>Weight history</h2><div class="worktable-wrap"><table class="worktable"><thead><tr><th>Date</th><th>Weight (kg)</th><th></th></tr></thead><tbody id="nutritionWeights"></tbody></table></div></section>`;
    $('nutritionDay').value = localDate();
    const message = text => { $('nutritionStatus').textContent = text; };
    const format = n => Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
    const key = () => `financeflow.nutrition.presets.v1.${account}`;
    function setBusy(value) {
      busy = value;
      view.querySelectorAll('button, input, select').forEach(el => { el.disabled = value || !account; });
    }
    function userId() {
      const user = getUser();
      if (!user || user.id !== account || !isReady()) throw Error('Sign in and connect before using the tracker.');
      return user.id;
    }
    function renderPresets() {
      const select = $('nutritionPreset'); select.replaceChildren(new Option('Choose a preset', ''));
      presets.forEach((p, i) => select.add(new Option(`${p.food_name} · ${p.quantity || '1 serving'}`, String(i))));
    }
    function render() {
      const day = $('nutritionDay').value, daily = foods.filter(r => r.logged_on === day), total = totals(daily);
      $('nutritionCalories').textContent = loaded ? format(total.calories) + ' kcal' : '—';
      $('nutritionProtein').textContent = loaded ? format(total.protein) + ' g' : '—';
      $('nutritionWeight').textContent = weights.length ? format(weights[0].weight_kg) + ' kg' : '—';
      $('nutritionWeightDate').textContent = weights[0]?.logged_on || '';
      const meals = $('nutritionMeals'); meals.replaceChildren();
      if (!daily.length) meals.textContent = loaded ? 'No meals for this day.' : 'Refresh to load records.';
      daily.forEach(row => {
        const wrap = document.createElement('div'); wrap.className = 'txn';
        const main = document.createElement('div'); main.className = 'txn-main';
        const title = document.createElement('div'); title.className = 'txn-title'; title.textContent = `${row.meal}: ${row.food_name}`;
        const sub = document.createElement('div'); sub.className = 'txn-sub';
        sub.textContent = `${row.quantity || '1 serving'} · ${format(row.calories)} kcal · ${format(row.protein_g)} g protein${row.estimated ? ' · estimated' : ''}${row.notes ? ' · ' + row.notes : ''}`;
        main.append(title, sub); wrap.append(main, deleteButton('food_logs', row)); meals.append(wrap);
      });
      const grouped = new Map();
      foods.forEach(row => { if (!grouped.has(row.logged_on)) grouped.set(row.logged_on, []); grouped.get(row.logged_on).push(row); });
      const history = $('nutritionHistory'); history.replaceChildren();
      [...grouped.keys()].sort().reverse().forEach(date => {
        const rows = grouped.get(date), sum = totals(rows);
        tableRow(history, [date, format(sum.calories), format(sum.protein), String(rows.length)]);
      });
      if (!grouped.size) tableRow(history, [loaded ? 'No meal history yet.' : 'Records not loaded.']);
      const weightBody = $('nutritionWeights'); weightBody.replaceChildren();
      weights.forEach(row => {
        const tr = tableRow(weightBody, [row.logged_on, format(row.weight_kg)]), td = document.createElement('td');
        td.append(deleteButton('weight_logs', row)); tr.append(td);
      });
      if (!weights.length) tableRow(weightBody, [loaded ? 'No weight history yet.' : 'Records not loaded.']);
    }
    function tableRow(parent, values) {
      const tr = document.createElement('tr');
      values.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
      parent.append(tr); return tr;
    }
    function deleteButton(table, row) {
      const button = document.createElement('button'); button.className = 'delete'; button.textContent = '×';
      button.setAttribute('aria-label', `Delete ${table === 'food_logs' ? row.food_name : 'weight'} on ${row.logged_on}`);
      button.disabled = busy || !account;
      button.onclick = () => {
        if (!confirm(`Delete this ${table === 'food_logs' ? 'meal' : 'weight record'} on ${row.logged_on}?`)) return;
        run(async uid => {
          const {data, error} = await cloud.from(table).delete().eq('id', row.id).eq('user_id', uid).select('id');
          if (error) throw error;
          if (!data?.length) throw Error('Record was not deleted. Refresh and try again.');
        }, 'Record deleted.', true);
      }; return button;
    }
    // Page explicitly: Supabase normally caps a response at 1,000 rows.
    async function fetchAll(table, columns, uid) {
      const rows = [];
      for (let start = 0; ; start += 500) {
        const {data, error} = await cloud.from(table).select(columns).eq('user_id', uid)
          .order('logged_on', {ascending: false}).order('created_at', {ascending: false}).order('id', {ascending: false}).range(start, start + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
      }
    }
    async function refresh(uid, token) {
      const [nextFoods, nextWeights] = await Promise.all([fetchAll('food_logs', FOOD, uid), fetchAll('weight_logs', WEIGHT, uid)]);
      if (token !== generation || uid !== account) return;
      foods = nextFoods; weights = nextWeights; loaded = true; render();
    }
    async function run(action, success, mutates = false) {
      if (busy) return;
      const token = generation; let changed = false;
      try {
        const uid = userId(); setBusy(true); message('Working…');
        await action(uid); changed = mutates;
        if (token !== generation) return;
        await refresh(uid, token);
        if (token === generation) message(success);
      } catch (error) {
        if (token === generation) message(`${changed ? 'Change saved, but refresh failed. Refresh before retrying.' : 'Request failed; check records before retrying.'} ${error.message}`);
      } finally { if (token === generation) setBusy(false); }
    }
    function readForm() {
      return foodInput({logged_on: $('nutritionDay').value, meal: $('nutritionMeal').value,
        food_name: $('nutritionName').value, quantity: $('nutritionQuantity').value,
        calories: $('nutritionKcal').value, protein_g: $('nutritionGrams').value,
        estimated: $('nutritionEstimated').value === 'true', notes: $('nutritionNotes').value});
    }
    $('nutritionFoodForm').onsubmit = e => {
      e.preventDefault(); let row;
      try { row = readForm(); } catch (error) { message(error.message); return; }
      run(async uid => {
        const {error} = await cloud.from('food_logs').insert({...row, user_id: uid}); if (error) throw error;
      }, 'Meal saved.', true);
    };
    $('nutritionWeightForm').onsubmit = e => {
      e.preventDefault(); const date = $('nutritionDay').value, kg = $('nutritionKg').value;
      if (!validDate(date) || !number(kg, 0.01, 499.99)) { message('Enter a valid day and weight between 0 and 500 kg.'); return; }
      run(async uid => {
        const {error} = await cloud.from('weight_logs').insert({user_id: uid, logged_on: date, weight_kg: Number(kg)}); if (error) throw error;
      }, 'Weight saved.', true);
    };
    function storePresets(next) {
      userId(); if (!presetsReadable) throw Error('Existing presets could not be read. Export or repair device storage before changing presets.'); localStorage.setItem(key(), JSON.stringify(next)); presets = next; renderPresets();
    }
    $('nutritionSavePreset').onclick = () => {
      try {
        const row = readForm(); delete row.logged_on;
        if (presets.length >= 500) throw Error('Preset limit reached. Delete a preset first.');
        storePresets([...presets, row]); message('Preset saved on this device.');
      } catch (error) { message('Preset not saved: ' + error.message); }
    };
    $('nutritionDeletePreset').onclick = () => {
      const index = $('nutritionPreset').value;
      if (index === '' || !confirm('Delete this device preset?')) return;
      try { storePresets(presets.filter((_, i) => String(i) !== index)); message('Preset deleted.'); }
      catch (error) { message('Preset not deleted: ' + error.message); }
    };
    $('nutritionPreset').onchange = () => {
      const p = presets[$('nutritionPreset').value]; if (!p) return;
      for (const [id, value] of Object.entries({nutritionMeal: p.meal, nutritionName: p.food_name,
        nutritionQuantity: p.quantity, nutritionKcal: p.calories, nutritionGrams: p.protein_g,
        nutritionEstimated: String(p.estimated), nutritionNotes: p.notes})) $(id).value = value;
    };
    $('nutritionDay').onchange = render;
    $('nutritionRefresh').onclick = () => run(async () => {}, 'Records refreshed.');
    $('nutritionExport').onclick = () => run(async (uid) => {
      const token = generation; await refresh(uid, token); if (token !== generation) return;
      const blob = new Blob([JSON.stringify({version: 1, exportedAt: new Date().toISOString(), food_logs: foods, weight_logs: weights, presets}, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `financeflow-nutrition-${localDate()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'Nutrition backup exported. Finance backups are separate.');
    function reset() {
      generation++; account = null; foods = []; weights = []; presets = []; loaded = false; busy = false; presetsReadable = true;
      $('nutritionFoodForm').reset(); $('nutritionWeightForm').reset(); $('nutritionDay').value = localDate();
      renderPresets(); render(); setBusy(false); message('Sign in to load nutrition records.');
    }
    function connect() {
      reset(); account = getUser()?.id || null; if (!account) return;
      try {
        const stored = JSON.parse(localStorage.getItem(key()) || '[]');
        if (!Array.isArray(stored) || stored.length > 500) throw Error('Invalid presets');
        presets = stored.map(p => { const row = foodInput({...p, logged_on: localDate()}); delete row.logged_on; return row; });
        renderPresets();
      } catch (error) { presetsReadable = false; message('Device presets could not be loaded; stored presets have not been changed.'); }
      setBusy(false);
      run(async () => {}, presetsReadable ? 'Nutrition records loaded.' : 'Records loaded. Device presets could not be read; stored presets were preserved.');
    }
    cloud?.auth.onAuthStateChange?.((event) => { if (event === 'SIGNED_OUT') reset(); });
    reset(); return {connect, reset};
  };
})();
