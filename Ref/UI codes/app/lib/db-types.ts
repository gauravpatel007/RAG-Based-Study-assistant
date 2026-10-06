/**
 * manual replacement for Prisma-generated enums and types
 */

export enum Role {
  ADMIN = "ADMIN",
  CASHIER = "CASHIER",
}

export enum TableStatus {
  EMPTY = "EMPTY",
  OCCUPIED = "OCCUPIED",
  SENT_TO_KITCHEN = "SENT_TO_KITCHEN",
  WAITING_PAYMENT = "WAITING_PAYMENT",
}

export enum OrderStatus {
  DRAFT = "DRAFT",
  SENT_TO_KITCHEN = "SENT_TO_KITCHEN",
  COMPLETED = "COMPLETED",
  PAID = "PAID",
}

export enum OrderSource {
  CASHIER = "CASHIER",
  SELF_ORDER = "SELF_ORDER",
}

export enum KitchenStatus {
  TO_COOK = "TO_COOK",
  PREPARING = "PREPARING",
  COMPLETED = "COMPLETED",
}

export enum PaymentMethod {
  CASH = "CASH",
  DIGITAL = "DIGITAL",
  UPI = "UPI",
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

export interface Floor {
  id: string;
  name: string;
}

export interface Table {
  id: string;
  floorId: string;
  tableNumber: string;
  seats: number;
  status: TableStatus;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  tax: number;
}
