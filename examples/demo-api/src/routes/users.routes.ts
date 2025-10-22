/**
 * Users Routes
 */

import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/users.controller';

const router = Router();

/**
 * Get all users
 * @summary List all users
 * @tag Users
 * @description Retrieve a list of all users with optional filtering
 */
router.get('/', getAllUsers);

/**
 * Get user by ID
 * @summary Get a specific user
 * @tag Users
 * @param id path string true "User ID"
 * @description Retrieve detailed information about a specific user
 */
router.get('/:id', getUserById);

/**
 * Create new user
 * @summary Create a new user
 * @tag Users
 * @description Create a new user account with the provided information
 */
router.post('/', createUser);

/**
 * Update user
 * @summary Update an existing user
 * @tag Users
 * @param id path string true "User ID to update"
 * @description Update user information
 */
router.put('/:id', updateUser);

/**
 * Partially update user
 * @summary Partially update a user
 * @tag Users
 * @param id path string true "User ID to update"
 * @description Update specific fields of a user
 */
router.patch('/:id', updateUser);

/**
 * Delete user
 * @summary Delete a user
 * @tag Users
 * @param id path string true "User ID to delete"
 * @description Permanently delete a user account
 */
router.delete('/:id', deleteUser);

export default router;
