/**
 * Users Controller
 */

import { Request, Response } from 'express';
import { attachExample, attachExamples } from '@bytedocs/express';
import { User, CreateUserDTO, UpdateUserDTO } from '../types';

// Mock database
const users: User[] = [
  {
    id: 1,
    username: 'johndoe',
    email: 'john@example.com',
    fullName: 'John Doe',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    username: 'janedoe',
    email: 'jane@example.com',
    fullName: 'Jane Doe',
    role: 'user',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 3,
    username: 'bobsmith',
    email: 'bob@example.com',
    fullName: 'Bob Smith',
    role: 'user',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

let nextUserId = 4;

/**
 * Get all users
 */
const getAllUsersHandler = (req: Request, res: Response) => {
  const { role, search } = req.query;

  let filteredUsers = [...users];

  if (role) {
    filteredUsers = filteredUsers.filter(u => u.role === role);
  }

  if (search) {
    const searchLower = String(search).toLowerCase();
    filteredUsers = filteredUsers.filter(
      u =>
        u.username.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.fullName.toLowerCase().includes(searchLower)
    );
  }

  res.json({
    success: true,
    data: filteredUsers,
    total: filteredUsers.length,
  });
};

// Attach example response
export const getAllUsers = attachExample(getAllUsersHandler, {
  success: true,
  data: [
    {
      id: 1,
      username: 'johndoe',
      email: 'john@example.com',
      fullName: 'John Doe',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  total: 3,
}) as typeof getAllUsersHandler;

/**
 * Get user by ID
 */
export const getUserById = (req: Request, res: Response) => {
  const { id } = req.params;
  const user = users.find(u => u.id === parseInt(id));

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    data: user,
  });
};

/**
 * Create new user
 */
const createUserHandler = (req: Request, res: Response) => {
  const userData: CreateUserDTO = req.body;

  // Validation
  if (!userData.username || !userData.email || !userData.fullName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: username, email, fullName',
    });
  }

  // Check if username or email already exists
  const existing = users.find(
    u => u.username === userData.username || u.email === userData.email
  );

  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'Username or email already exists',
    });
  }

  const newUser: User = {
    id: nextUserId++,
    username: userData.username,
    email: userData.email,
    fullName: userData.fullName,
    role: userData.role || 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(newUser);

  res.status(201).json({
    success: true,
    data: newUser,
    message: 'User created successfully',
  });
};

// Attach request body and response examples
export const createUser = attachExamples(
  createUserHandler,
  // Request body example
  {
    username: 'newuser',
    email: 'newuser@example.com',
    fullName: 'New User',
    role: 'user',
  },
  // Response example
  {
    success: true,
    data: {
      id: 4,
      username: 'newuser',
      email: 'newuser@example.com',
      fullName: 'New User',
      role: 'user',
      createdAt: '2024-01-04T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
    },
    message: 'User created successfully',
  }
) as typeof createUserHandler;

/**
 * Update user
 */
export const updateUser = (req: Request, res: Response) => {
  const { id } = req.params;
  const userData: UpdateUserDTO = req.body;

  const userIndex = users.findIndex(u => u.id === parseInt(id));

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  const updatedUser = {
    ...users[userIndex],
    ...userData,
    updatedAt: new Date(),
  };

  users[userIndex] = updatedUser;

  res.json({
    success: true,
    data: updatedUser,
    message: 'User updated successfully',
  });
};

/**
 * Delete user
 */
export const deleteUser = (req: Request, res: Response) => {
  const { id } = req.params;
  const userIndex = users.findIndex(u => u.id === parseInt(id));

  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  users.splice(userIndex, 1);

  res.status(204).send();
};
