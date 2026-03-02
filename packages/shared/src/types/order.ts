// WindoorDesigner - 订单与报价类型定义

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'quality_check'
  | 'ready_to_ship'
  | 'shipped'
  | 'installed'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  designId: string;
  windowName: string;
  quantity: number;
  unitPrice: number;
  width: number;
  height: number;
}

export interface QuoteSheet {
  id: string;
  orderId: string;
  profileCost: number;
  glassCost: number;
  hardwareCost: number;
  laborCost: number;
  totalCost: number;
  margin: number;
  finalPrice: number;
  items: QuoteItem[];
}

export interface QuoteItem {
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: 'profile' | 'glass' | 'hardware' | 'seal' | 'labor' | 'other';
}
