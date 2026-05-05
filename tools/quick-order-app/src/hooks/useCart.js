import { useReducer } from 'react';

let lineIdSeq = 0;

export function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find((l) => l.productId === action.product.id);
      if (existing) {
        return state.map((l) =>
          l.id === existing.id ? { ...l, qty: l.qty + (action.qty || 1) } : l
        );
      }
      return [
        ...state,
        {
          id: `line-${++lineIdSeq}`,
          productId: action.product.id,
          name: action.product._identifier || action.product.name || action.product.id,
          qty: action.qty || 1,
          unitPrice: Number(action.product.standardPrice) || 0,
        },
      ];
    }
    case 'UPDATE_QTY': {
      if (action.qty <= 0) return state.filter((l) => l.id !== action.id);
      return state.map((l) => (l.id === action.id ? { ...l, qty: action.qty } : l));
    }
    case 'UPDATE_PRICE': {
      if (action.price < 0) return state;
      return state.map((l) => (l.id === action.id ? { ...l, unitPrice: action.price } : l));
    }
    case 'REMOVE_ITEM':
      return state.filter((l) => l.id !== action.id);
    case 'CLEAR_CART':
      return [];
    default:
      return state;
  }
}

export function useCart() {
  return useReducer(cartReducer, []);
}
