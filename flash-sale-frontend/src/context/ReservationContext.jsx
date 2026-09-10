import React, { createContext, useContext, useState, useCallback } from 'react';

const ReservationContext = createContext(null);

export function ReservationProvider({ children }) {
  // { id, sku, quantity, status, expires_at }
  const [reservation, setReservation] = useState(null);
  // Snapshot of the product at the moment it was reserved, so
  // checkout/confirmation can render name/price without re-fetching
  // (and without depending on an /orders/:id endpoint that doesn't exist).
  const [productSnapshot, setProductSnapshot] = useState(null);
  // { orderId, sku, name, priceCents, quantity }
  const [order, setOrder] = useState(null);

  const startReservation = useCallback((reservationData, product) => {
    setReservation(reservationData);
    setProductSnapshot(product);
    setOrder(null);
  }, []);

  const clear = useCallback(() => {
    setReservation(null);
    setProductSnapshot(null);
    setOrder(null);
  }, []);

  return (
    <ReservationContext.Provider
      value={{
        reservation,
        setReservation,
        productSnapshot,
        order,
        setOrder,
        startReservation,
        clear,
      }}
    >
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const ctx = useContext(ReservationContext);
  if (!ctx) throw new Error('useReservation must be used within ReservationProvider');
  return ctx;
}
