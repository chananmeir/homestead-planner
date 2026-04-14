import React, { useState, useEffect } from 'react';
import { Modal, Button, FormInput, useToast } from '../common';
import { API_BASE_URL } from '../../config';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
  statistics: { adminUsers: number } | null;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onSuccess, user, statistics }) => {
  const { showSuccess, showError } = useToast();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    isAdmin: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill form when user changes or modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        email: user.email,
        isAdmin: user.isAdmin,
      });
      setErrors({});
    }
  }, [isOpen, user]);

  if (!user) return null;

  const isSelf = currentUser?.id === user.id;
  const isLastAdmin = user.isAdmin && statistics?.adminUsers === 1;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          isAdmin: formData.isAdmin,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      const data = await response.json();
      showSuccess(data.message || 'User updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" size="medium">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
          </div>

          {/* Email */}
          <FormInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            placeholder="user@example.com"
            required
          />

          {/* Admin Status */}
          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsAdmin"
                checked={formData.isAdmin}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                disabled={isSelf || isLastAdmin}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="editIsAdmin" className="text-sm text-gray-700 font-medium">
                Admin privileges
              </label>
            </div>

            {/* Warning messages */}
            {isSelf && (
              <p className="mt-1 text-xs text-amber-600">
                You cannot modify your own admin status
              </p>
            )}
            {isLastAdmin && !isSelf && (
              <p className="mt-1 text-xs text-red-600">
                Cannot remove admin status - this is the last admin user
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={loading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
