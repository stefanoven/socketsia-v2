/**
 * Customer Status Service
 * Replicates the PHP Customer model methods: stato(), scadenza(), hasAbbo()
 */

/**
 * Compute customer status, expiration date, and subscription info.
 *
 * Status values (Italian, matching legacy):
 *  - "Anno di Prova"  = Within the first subscription period (trial year)
 *  - "Abbonato"       = Subscription found in abboattivi table (active)
 *  - "Interrotto"     = Trial expired, no active subscription
 *
 * @param {object} customer  - Customer record from DB
 * @param {object} subscription - Subscription plan (from subscriptions table)
 * @param {object[]} abboAttivi - All active subscription records from abboattivi
 * @returns {{ stato: string, scadenza: Date|null, hasAbbo: boolean }}
 */
export function computeCustomerStatus(customer, subscription, abboAttivi) {
  // Base date: use testedAt if available, otherwise createdAt
  const baseDate = customer.testedAt ?? customer.createdAt;
  const daysDuration = subscription?.daysDuration ?? 365;

  // Calculate expiration: baseDate + daysDuration
  const scadenza = new Date(baseDate);
  scadenza.setDate(scadenza.getDate() + daysDuration);

  const now = new Date();

  if (scadenza > now) {
    // Still within the initial subscription period
    return { stato: 'Anno di Prova', scadenza, hasAbbo: false };
  }

  // Check if customer has an active subscription in abboattivi
  const abbo = abboAttivi.find(
    (a) => a.destinazione === customer.surveyeCode
  );
  const hasAbbo = !!abbo;

  if (hasAbbo) {
    return { stato: 'Abbonato', scadenza, hasAbbo: true };
  }

  return { stato: 'Interrotto', scadenza, hasAbbo: false };
}

/**
 * Enrich a list of customers with status info.
 * Loads subscriptions and abboAttivi once to avoid N+1 queries.
 *
 * @param {object[]} customers
 * @param {object[]} subscriptions - All subscription plans
 * @param {object[]} abboAttivi - All active abbo records
 * @param {object[]} keepAlives - All keep_alive records (for lastSeen)
 * @returns {object[]} - Customers with added: stato, scadenza, hasAbbo, keepAliveLastSeen
 */
export function enrichCustomers(customers, subscriptions, abboAttivi, keepAlives) {
  const subMap = Object.fromEntries(subscriptions.map((s) => [s.id, s]));
  const kaMap = Object.fromEntries(keepAlives.map((k) => [k.customerId, k]));

  return customers.map((c) => {
    const sub = subMap[c.subscription] ?? { daysDuration: 365 };
    const { stato, scadenza, hasAbbo } = computeCustomerStatus(c, sub, abboAttivi);
    const ka = kaMap[c.account];
    return {
      ...c,
      stato,
      scadenza,
      hasAbbo,
      keepAliveLastSeen: ka?.updatedAt ?? null,
    };
  });
}
