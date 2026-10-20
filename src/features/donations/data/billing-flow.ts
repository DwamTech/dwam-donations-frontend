import { guestDraftReducer, initialDraftState, type DraftAction, type DraftState } from "./guest-draft";
import { emptyBilling, validateBilling, type BillingDraft, type BillingDetails, type BillingErrors, type BillingField } from "./billing-draft";

export type BillingFlowState = {
  step: "entry" | "billing" | "review";
  guest: DraftState;
  billing: BillingDraft;
  billingErrors: BillingErrors;
  billingReview: BillingDetails | null;
  contactEdited: { email: boolean; phone_number: boolean };
};
export const initialBillingFlow: BillingFlowState = { step: "entry", guest: initialDraftState, billing: emptyBilling, billingErrors: {}, billingReview: null, contactEdited: { email: false, phone_number: false } };
export type BillingFlowAction =
  | { type: "guest"; action: DraftAction }
  | { type: "next"; currency: string }
  | { type: "billing-field"; field: BillingField; value: string }
  | { type: "review"; currency: string }
  | { type: "edit"; step: "entry" | "billing" };

export function billingFlowReducer(state: BillingFlowState, action: BillingFlowAction): BillingFlowState {
  if (action.type === "guest") {
    // Navigation is owned by this flow; only donor edits reach the old reducer.
    if (action.action.type !== "field" && action.action.type !== "anonymous") return state;
    return { ...state, step: "entry", guest: guestDraftReducer(state.guest, action.action), billingReview: null };
  }
  if (action.type === "billing-field") return {
    ...state, step: state.guest.review ? "billing" : "entry", billingReview: null,
    billing: { ...state.billing, [action.field]: action.value }, billingErrors: { ...state.billingErrors, [action.field]: undefined },
    contactEdited: action.field === "email" || action.field === "phone_number" ? { ...state.contactEdited, [action.field]: true } : state.contactEdited,
  };
  if (action.type === "edit") return { ...state, step: action.step === "billing" && state.guest.review ? "billing" : "entry", billingReview: null,
    guest: action.step === "entry" ? guestDraftReducer(state.guest, { type: "edit" }) : state.guest };
  if (action.type === "next") {
    if (state.step !== "entry") return state; // Ignore a repeated submit after navigation.
    const guest = guestDraftReducer(state.guest, { type: "review", currency: action.currency });
    if (!guest.review) return { ...state, guest, billingReview: null };
    return { ...state, guest, step: "billing", billingReview: null, billingErrors: {
      ...state.billingErrors, email: state.contactEdited.email ? state.billingErrors.email : undefined,
      phone_number: state.contactEdited.phone_number ? state.billingErrors.phone_number : undefined,
    }, billing: {
      ...state.billing,
      email: state.contactEdited.email ? state.billing.email : guest.review.email,
      phone_number: state.contactEdited.phone_number ? state.billing.phone_number : guest.review.phone,
    } };
  }
  if (state.step !== "billing") return state;
  const guest = guestDraftReducer(state.guest, { type: "review", currency: action.currency });
  if (!guest.review) return { ...state, guest, step: "entry", billingReview: null };
  const result = validateBilling(state.billing);
  return { ...state, guest, billingErrors: result.errors, billingReview: result.billing, step: result.billing ? "review" : "billing" };
}
