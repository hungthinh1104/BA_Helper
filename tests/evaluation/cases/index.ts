import { case01 } from './01-cancel-paid-booking-refund';
import { case02 } from './02-prevent-double-refund';
import { case03 } from './03-partial-refund-within-24h';
import { case04 } from './04-notification-after-refund';
import { case05 } from './05-block-cancel-completed-booking';
import { case06 } from './06-require-cancel-reason';
import { case07 } from './07-admin-manual-refund';
import { case08 } from './08-payment-callback-retry';
import { bookingStableEvaluationCases } from './booking-stable';
import { generalFallbackEvaluationCases } from './general-fallback';

export { bookingStableEvaluationCases } from './booking-stable';
export { generalFallbackEvaluationCases } from './general-fallback';

export const ALL_EVALUATION_CASES = [
  case01,
  case02,
  case03,
  case04,
  case05,
  case06,
  case07,
  case08,
  ...bookingStableEvaluationCases,
  ...generalFallbackEvaluationCases,
];
