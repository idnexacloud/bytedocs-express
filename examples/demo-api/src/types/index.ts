/**
 * Type definitions for Demo API
 */

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface UpdateUserDTO {
  username?: string;
  email?: string;
  fullName?: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
}

export interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface CreateOrderDTO {
  userId: number;
  items: OrderItem[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  productCount: number;
}
