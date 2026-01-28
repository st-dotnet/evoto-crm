export type PurchaseEntry = {
  uuid?: string;
  invoice_number: string;
  date: string;
  amount: number | "";
  entered_bill: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
};
