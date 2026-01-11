export function getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      // Sign-in and Sign-up errors
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address.';
      case 'auth/weak-password':
        return 'The password is too weak. Please use at least 6 characters.';
      case 'auth/user-disabled':
        return 'This user account has been disabled.';
      
      // Password reset errors
      case 'auth/missing-email':
          return 'Please enter an email address to reset your password.';

      // General errors
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      case 'auth/too-many-requests':
        return 'You have made too many requests. Please try again later.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
}
