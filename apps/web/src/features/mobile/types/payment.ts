/**
 * Payment flow types for iOS parity.
 * Based on iOS source: SinglePageContractFormTableViewController.m
 */

/**
 * Payment method type supported by LeapPay.
 */
export type PaymentMethodType = 'credit_card' | 'bank_account' | 'omnibus';

/**
 * User permission status for payment methods.
 * Based on iOS checkUserPermissions cloud call.
 */
export type PaymentPermissions = {
  canRead: boolean;
  canWrite: boolean;
  errorMessage?: string;
};

/**
 * LeapPay association settings for company/office.
 */
export type LeapPaySettings = {
  isEnabled: boolean;
  companyId: string;
  officeId?: string;
  defaultPaymentMethod?: PaymentMethodType;
  allowedMethods: PaymentMethodType[];
};

/**
 * Credit card capture form data.
 */
export type CreditCardData = {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  billingZip: string;
};

/**
 * Bank account capture form data.
 */
export type BankAccountData = {
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  accountHolderName: string;
};

/**
 * Payment request created from captured payment info.
 */
export type PaymentRequest = {
  id: string;
  type: PaymentMethodType;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  /** Last 4 digits of card/account for display. */
  displaySuffix?: string;
};

/**
 * Cell item that requires payment capture.
 * Represents a form field in the contract that needs payment info.
 */
export type PaymentCellItem = {
  id: string;
  indexPath: { section: number; row: number };
  label: string;
  isRequired: boolean;
  value?: PaymentRequest;
};

/**
 * Result of setting payment capture value on a cell.
 */
export type PaymentCaptureResult = {
  success: boolean;
  cellItem: PaymentCellItem;
  paymentRequest?: PaymentRequest;
  errorMessage?: string;
};
