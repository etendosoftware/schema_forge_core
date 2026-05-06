import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartReducer } from '../src/hooks/useCart.js';

const product = (id, price = 10, name = null) => ({
  id,
  _identifier: name || `Product ${id}`,
  standardPrice: price,
});

test('ADD_ITEM adds a new line with default qty 1', () => {
  const state = cartReducer([], { type: 'ADD_ITEM', product: product('p1', 12.5) });
  assert.equal(state.length, 1);
  assert.equal(state[0].productId, 'p1');
  assert.equal(state[0].qty, 1);
  assert.equal(state[0].unitPrice, 12.5);
  assert.equal(state[0].name, 'Product p1');
});

test('ADD_ITEM merges qty when product is already in cart', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1') });
  const s2 = cartReducer(s1, { type: 'ADD_ITEM', product: product('p1'), qty: 2 });
  assert.equal(s2.length, 1);
  assert.equal(s2[0].qty, 3);
});

test('UPDATE_QTY changes quantity for the matching line id', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1') });
  const lineId = s1[0].id;
  const s2 = cartReducer(s1, { type: 'UPDATE_QTY', id: lineId, qty: 5 });
  assert.equal(s2[0].qty, 5);
});

test('UPDATE_QTY to 0 or below removes the line', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1') });
  const lineId = s1[0].id;
  const s2 = cartReducer(s1, { type: 'UPDATE_QTY', id: lineId, qty: 0 });
  assert.equal(s2.length, 0);
});

test('UPDATE_PRICE sets the unit price', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1', 10) });
  const lineId = s1[0].id;
  const s2 = cartReducer(s1, { type: 'UPDATE_PRICE', id: lineId, price: 7.25 });
  assert.equal(s2[0].unitPrice, 7.25);
});

test('UPDATE_PRICE ignores negative values', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1', 10) });
  const lineId = s1[0].id;
  const s2 = cartReducer(s1, { type: 'UPDATE_PRICE', id: lineId, price: -1 });
  assert.equal(s2[0].unitPrice, 10);
});

test('REMOVE_ITEM deletes the matching line', () => {
  let state = [];
  state = cartReducer(state, { type: 'ADD_ITEM', product: product('p1') });
  state = cartReducer(state, { type: 'ADD_ITEM', product: product('p2') });
  const firstId = state[0].id;
  state = cartReducer(state, { type: 'REMOVE_ITEM', id: firstId });
  assert.equal(state.length, 1);
  assert.equal(state[0].productId, 'p2');
});

test('CLEAR_CART resets to empty', () => {
  let state = cartReducer([], { type: 'ADD_ITEM', product: product('p1') });
  state = cartReducer(state, { type: 'CLEAR_CART' });
  assert.deepEqual(state, []);
});

test('unknown action type leaves state untouched', () => {
  const s1 = cartReducer([], { type: 'ADD_ITEM', product: product('p1') });
  const s2 = cartReducer(s1, { type: 'NOPE' });
  assert.equal(s2, s1);
});
