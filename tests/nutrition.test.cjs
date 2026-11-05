const test = require('node:test');
const assert = require('node:assert/strict');
const {validDate, foodInput, totals} = require('../nutrition.js');
const meal = {logged_on: '2026-11-05', meal: 'Lunch', food_name: ' Rice ', quantity: '200 g', calories: '260', protein_g: '5.4', estimated: true, notes: ''};
test('rejects impossible dates and accepts leap dates', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
});
test('meal normalization uses verified column names and numeric values', () => {
  assert.deepEqual(foodInput(meal), {...meal, food_name: 'Rice', calories: 260, protein_g: 5.4});
  for (const change of [{calories: ''}, {calories: -1}, {protein_g: Infinity}, {food_name: ' '}, {meal: 'Invalid'}, {protein_g: 10001}]) {
    assert.throws(() => foodInput({...meal, ...change}));
  }
  assert.equal(foodInput({...meal, calories: 0, protein_g: 0}).calories, 0);
});
test('totals handle Supabase numeric strings without concatenation', () => {
  assert.deepEqual(totals([{calories: '260', protein_g: '5.4'}, {calories: 40, protein_g: 2}]), {calories: 300, protein: 7.4});
  assert.deepEqual(totals([]), {calories: 0, protein: 0});
});
