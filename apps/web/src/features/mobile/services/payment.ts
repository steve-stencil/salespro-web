/**
 * Payment API service.
 * Handles payment method permissions, capture, and LeapPay integration.
 * Based on iOS: SinglePageContractFormTableViewController.m
 */
import { get, post } from '../lib/api-client';

import type {
  PaymentPermissions,
  LeapPaySettings,
  CreditCardData,
  BankAccountData,
  PaymentRequest,
  PaymentCellItem,
  PaymentCaptureResult,
} from '../types/payment';

/**
 * Payment API methods.
 */
export const paymentApi = {
  /**
   * Check user permissions for payment methods.
   * iOS: checkUserPermissions cloud call
   *
   * @returns Payment permissions status
   */
  checkPermissions: async (): Promise<PaymentPermissions> => {
    return get<PaymentPermissions>('/payments/permissions');
  },

  /**
   * Get LeapPay settings for company/office.
   * iOS: getDefaultPaymentMethodWithIndexPath
   *
   * @param companyId - Company ID
   * @param officeId - Optional office ID
   * @returns LeapPay configuration
   */
  getLeapPaySettings: async (
    companyId: string,
    officeId?: string,
  ): Promise<LeapPaySettings> => {
    return get<LeapPaySettings>('/payments/leappay/settings', {
      companyId,
      officeId,
    });
  },

  /**
   * Process credit card payment.
   * iOS: CreditCardFormDelegate
   *
   * @param estimateId - Estimate ID
   * @param cardData - Credit card details
   * @param amount - Payment amount in cents
   * @returns Created payment request
   */
  processCreditCard: async (
    estimateId: string,
    cardData: CreditCardData,
    amount: number,
  ): Promise<PaymentRequest> => {
    return post<PaymentRequest>('/payments/credit-card', {
      estimateId,
      cardData,
      amount,
    });
  },

  /**
   * Process bank account payment.
   * iOS: BankAccountFormDelegate
   *
   * @param estimateId - Estimate ID
   * @param bankData - Bank account details
   * @param amount - Payment amount in cents
   * @returns Created payment request
   */
  processBankAccount: async (
    estimateId: string,
    bankData: BankAccountData,
    amount: number,
  ): Promise<PaymentRequest> => {
    return post<PaymentRequest>('/payments/bank-account', {
      estimateId,
      bankData,
      amount,
    });
  },

  /**
   * Set payment capture value for a contract cell.
   * iOS: setPaymentCaptureValueForCellItem:atIndexPath:
   *
   * @param cellItem - The cell requiring payment
   * @param paymentRequest - The captured payment
   * @returns Result of setting the value
   */
  setCellPaymentValue: async (
    cellItem: PaymentCellItem,
    paymentRequest: PaymentRequest,
  ): Promise<PaymentCaptureResult> => {
    return post<PaymentCaptureResult>('/payments/cell-value', {
      cellId: cellItem.id,
      paymentRequestId: paymentRequest.id,
    });
  },

  /**
   * Add payment request to customer record.
   * iOS: addPaymentRequestObjectToCustomerIfNeeded
   *
   * @param customerId - Customer ID
   * @param paymentRequest - Payment request to add
   */
  addPaymentToCustomer: async (
    customerId: string,
    paymentRequest: PaymentRequest,
  ): Promise<void> => {
    await post(`/customers/${customerId}/payments`, {
      paymentRequestId: paymentRequest.id,
    });
  },

  /**
   * Get payment cells from contract form.
   *
   * @param templateIds - Selected template IDs
   * @returns Payment cells requiring capture
   */
  getPaymentCells: async (
    templateIds: string[],
  ): Promise<PaymentCellItem[]> => {
    return post<PaymentCellItem[]>('/payments/cells', { templateIds });
  },
};
