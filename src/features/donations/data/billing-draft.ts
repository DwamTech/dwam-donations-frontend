import { latinDigits } from "./guest-draft";

// Mirrors CreateDonationPaymentRequest and the stricter DonationBillingData DTO.
export const billingFields = {
  first_name: { label: "الاسم الأول للفوترة", max: 120, autoComplete: "given-name" },
  last_name: { label: "اسم العائلة للفوترة", max: 120, autoComplete: "family-name" },
  phone_number: { label: "هاتف الفوترة", max: 32, autoComplete: "tel" },
  email: { label: "بريد الفوترة الإلكتروني", max: 255, autoComplete: "email" },
  street: { label: "الشارع", max: 255, autoComplete: "address-line1" },
  building: { label: "المبنى", max: 100, autoComplete: "address-line2" },
  floor: { label: "الطابق", max: 50, autoComplete: "off" },
  apartment: { label: "الشقة", max: 50, autoComplete: "off" },
  city: { label: "المدينة", max: 120, autoComplete: "address-level2" },
  state: { label: "المحافظة / الولاية", max: 120, autoComplete: "address-level1" },
  country: { label: "دولة عنوان الفوترة", max: 2, autoComplete: "country" },
} as const;
export type BillingField = keyof typeof billingFields;
export type BillingDraft = Record<BillingField, string>;
export type BillingErrors = Partial<Record<BillingField, string>>;
/** Exactly the eleven fields allowed inside the future payment request's billing. */
export type BillingDetails = BillingDraft;
export const emptyBilling: BillingDraft = { first_name: "", last_name: "", phone_number: "", email: "", street: "", building: "", floor: "", apartment: "", city: "", state: "", country: "" };
function invalidUnicode(value: string) {
  return Array.from(value).some(char => { const point = char.codePointAt(0)!; return point >= 0xd800 && point <= 0xdfff; });
}
export function validateBilling(draft: BillingDraft): { errors: BillingErrors; billing: BillingDetails | null } {
  const errors: BillingErrors = {};
  const values: BillingDetails = { ...emptyBilling };
  for (const field of Object.keys(billingFields) as BillingField[]) {
    const value = draft[field].trim();
    values[field] = value;
    if (!value) errors[field] = `أدخل ${billingFields[field].label}.`;
    else if (/[\u0000-\u001f\u007f]/.test(value) || invalidUnicode(value) || ["n/a", "na", "-"].includes(value.toLowerCase())) errors[field] = "اكتب قيمة فعلية وصالحة، دون رموز تحكم أو قيم بديلة مثل N/A.";
    else if (Array.from(value).length > billingFields[field].max) errors[field] = `الحد الأقصى لهذا الحقل ${billingFields[field].max} حرفًا.`;
  }
  values.phone_number = latinDigits(values.phone_number);
  values.country = values.country.toUpperCase();
  if (!errors.phone_number && !/^\+?[0-9][0-9\s\-()]{5,31}$/.test(values.phone_number)) errors.phone_number = "أدخل هاتف فوترة صالحًا، مع علامة + اختيارية وأرقام ومسافات أو شرطات أو أقواس.";
  // A basic conventional email check; PHP FILTER_VALIDATE_EMAIL remains authoritative.
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values.email)) errors.email = "أدخل بريد فوترة إلكترونيًا صالحًا.";
  if (!errors.country && values.country !== "EG") errors.country = "بيانات الفوترة تدعم دولة مصر (EG) فقط في هذه المرحلة.";
  return { errors, billing: Object.keys(errors).length ? null : values };
}
