import React from 'react';

interface LoginRequiredMessageProps {
  onLoginClick: () => void;
}

export const LoginRequiredMessage: React.FC<LoginRequiredMessageProps> = ({ onLoginClick }) => {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 px-4"
      role="alert"
      aria-live="polite"
      aria-label="Login required to access this feature"
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Login Required
        </h2>
        <p className="text-gray-600 mb-6">
          Please login or create an account to access this feature.
        </p>
        <button
          onClick={onLoginClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
        >
          Login / Register
        </button>
      </div>
    </div>
  );
};
