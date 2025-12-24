/**
 * Payment hook for payment capture flows.
 * Based on iOS: SinglePageContractFormTableViewController.m
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import { useFeatureFlags } from '../context/FeatureFlagContext';
import { paymentApi } from '../services/payment';

import type {
  PaymentCellItem,
  PaymentRequest,
  CreditCardData,
  BankAccountData,
  PaymentMethodType,
} from '../types/payment';

const QUERY_KEYS = {
  permissions: ['payment', 'permissions'] as const,
  leapPay: (companyId: string, officeId?: string) =>
    ['payment', 'leappay', companyId, officeId] as const,
  cells: (templateIds: string[]) =>
    ['payment', 'cells', ...templateIds] as const,
};

/**
 * Hook for checking payment permissions.
 * iOS: checkUserPermissions
 *
 * @returns Payment permissions
 */
export function usePaymentPermissions() {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.permissions,
    queryFn: paymentApi.checkPermissions,
    enabled: flags.paymentCaptureEnabled,
  });
}

/**
 * Hook for LeapPay settings.
 * iOS: getDefaultPaymentMethodWithIndexPath
 *
 * @param companyId - Company ID
 * @param officeId - Optional office ID
 * @returns LeapPay settings
 */
export function useLeapPaySettings(
  companyId: string | undefined,
  officeId?: string,
) {
  const { flags } = useFeatureFlags();

  return useQuery({
    queryKey: QUERY_KEYS.leapPay(companyId ?? '', officeId),
    queryFn: () => paymentApi.getLeapPaySettings(companyId!, officeId),
    enabled: !!companyId && flags.paymentCaptureEnabled,
  });
}

/**
 * Hook for managing payment cell items in contracts.
 *
 * @param templateIds - Selected template IDs
 * @returns Payment cells and handlers
 */
export function usePaymentCells(templateIds: string[]) {
  const { flags } = useFeatureFlags();

  // Get payment cells from templates
  const cellsQuery = useQuery({
    queryKey: QUERY_KEYS.cells(templateIds),
    queryFn: () => paymentApi.getPaymentCells(templateIds),
    enabled: templateIds.length > 0 && flags.paymentCaptureEnabled,
  });

  // Local state for cell values
  const [cellValues, setCellValues] = useState<Map<string, PaymentRequest>>(
    new Map(),
  );

  /**
   * Set payment value for a cell.
   */
  const setCellPayment = useCallback(
    async (
      cellItem: PaymentCellItem,
      paymentRequest: PaymentRequest,
    ): Promise<void> => {
      const result = await paymentApi.setCellPaymentValue(
        cellItem,
        paymentRequest,
      );
      if (result.success) {
        setCellValues(prev => {
          const next = new Map(prev);
          next.set(cellItem.id, paymentRequest);
          return next;
        });
      }
    },
    [],
  );

  /**
   * Get payment value for a cell.
   */
  const getCellPayment = useCallback(
    (cellId: string): PaymentRequest | undefined => {
      return cellValues.get(cellId);
    },
    [cellValues],
  );

  return {
    cells: cellsQuery.data ?? [],
    isLoading: cellsQuery.isLoading,
    error: cellsQuery.error,
    setCellPayment,
    getCellPayment,
    cellValues,
  };
}

/**
 * Hook for payment capture flow.
 *
 * @returns Payment capture state and handlers
 */
export function usePaymentCapture() {
  const [activeMethod, setActiveMethod] = useState<PaymentMethodType | null>(
    null,
  );
  const [activeCellId, setActiveCellId] = useState<string | null>(null);

  /**
   * Start credit card capture.
   */
  const startCreditCardCapture = useCallback((cellId: string): void => {
    setActiveMethod('credit_card');
    setActiveCellId(cellId);
  }, []);

  /**
   * Start bank account capture.
   */
  const startBankAccountCapture = useCallback((cellId: string): void => {
    setActiveMethod('bank_account');
    setActiveCellId(cellId);
  }, []);

  /**
   * Cancel capture flow.
   */
  const cancelCapture = useCallback((): void => {
    setActiveMethod(null);
    setActiveCellId(null);
  }, []);

  return {
    activeMethod,
    activeCellId,
    isCapturing: activeMethod !== null,
    startCreditCardCapture,
    startBankAccountCapture,
    cancelCapture,
  };
}

/**
 * Hook for processing credit card payment.
 * iOS: CreditCardFormDelegate
 */
export function useProcessCreditCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      estimateId,
      cardData,
      amount,
    }: {
      estimateId: string;
      cardData: CreditCardData;
      amount: number;
    }) => paymentApi.processCreditCard(estimateId, cardData, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment'] });
    },
  });
}

/**
 * Hook for processing bank account payment.
 * iOS: BankAccountFormDelegate
 */
export function useProcessBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      estimateId,
      bankData,
      amount,
    }: {
      estimateId: string;
      bankData: BankAccountData;
      amount: number;
    }) => paymentApi.processBankAccount(estimateId, bankData, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment'] });
    },
  });
}
