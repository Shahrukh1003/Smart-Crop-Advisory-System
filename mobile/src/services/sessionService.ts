import * as SecureStore from 'expo-secure-store';

// Storage keys
const SESSION_STATE_KEY = 'session_state';
const LAST_ACTIVITY_KEY = 'last_activity';

// Session configuration
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_WARNING_MS = 23 * 60 * 60 * 1000; // 23 hours (1 hour before expiry)

export interface SessionState {
  userId: string;
  lastActivityAt: number;
  sessionStartedAt: number;
  expiresAt: number;
  isActive: boolean;
}

export interface SessionStatus {
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  remainingTimeMs: number;
  lastActivityAt: number | null;
}

/**
 * Session persistence service
 * Handles storing and restoring session state across app launches
 * Sessions persist for 24 hours of inactivity
 */
class SessionService {
  private sessionState: SessionState | null = null;
  private activityUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize session for a user
   */
  async initSession(userId: string): Promise<void> {
    const now = Date.now();
    this.sessionState = {
      userId,
      lastActivityAt: now,
      sessionStartedAt: now,
      expiresAt: now + SESSION_TIMEOUT_MS,
      isActive: true,
    };

    await this.saveSessionState();
    this.startActivityTracking();
  }

  /**
   * Restore session from secure storage
   */
  async restoreSession(): Promise<SessionStatus> {
    try {
      const storedState = await SecureStore.getItemAsync(SESSION_STATE_KEY);
      
      if (!storedState) {
        return this.getInvalidStatus();
      }

      this.sessionState = JSON.parse(storedState);
      
      if (!this.sessionState) {
        return this.getInvalidStatus();
      }

      const status = this.getSessionStatus();
      
      if (status.isValid && !status.isExpired) {
        // Session is valid, update activity and restart tracking
        await this.updateActivity();
        this.startActivityTracking();
      }

      return status;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return this.getInvalidStatus();
    }
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity(): Promise<void> {
    if (!this.sessionState) return;

    const now = Date.now();
    this.sessionState.lastActivityAt = now;
    this.sessionState.expiresAt = now + SESSION_TIMEOUT_MS;
    this.sessionState.isActive = true;

    await this.saveSessionState();
  }

  /**
   * Get current session status
   */
  getSessionStatus(): SessionStatus {
    if (!this.sessionState) {
      return this.getInvalidStatus();
    }

    const now = Date.now();
    const remainingTimeMs = this.sessionState.expiresAt - now;
    const isExpired = remainingTimeMs <= 0;
    const isExpiringSoon = !isExpired && remainingTimeMs <= (SESSION_TIMEOUT_MS - SESSION_WARNING_MS);

    return {
      isValid: true,
      isExpired,
      isExpiringSoon,
      remainingTimeMs: Math.max(0, remainingTimeMs),
      lastActivityAt: this.sessionState.lastActivityAt,
    };
  }

  /**
   * Check if session is valid and not expired
   */
  isSessionValid(): boolean {
    const status = this.getSessionStatus();
    return status.isValid && !status.isExpired;
  }

  /**
   * Get session expiry time in milliseconds
   */
  getExpiryTime(): number | null {
    return this.sessionState?.expiresAt || null;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): number | null {
    return this.sessionState?.lastActivityAt || null;
  }

  /**
   * Clear session (on logout)
   */
  async clearSession(): Promise<void> {
    this.stopActivityTracking();
    this.sessionState = null;
    
    try {
      await SecureStore.deleteItemAsync(SESSION_STATE_KEY);
      await SecureStore.deleteItemAsync(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Handle session expiration
   */
  async handleExpiration(): Promise<void> {
    if (this.sessionState) {
      this.sessionState.isActive = false;
      await this.saveSessionState();
    }
    this.stopActivityTracking();
  }

  /**
   * Get session timeout duration in milliseconds
   */
  getSessionTimeoutMs(): number {
    return SESSION_TIMEOUT_MS;
  }

  // Private methods

  private async saveSessionState(): Promise<void> {
    if (!this.sessionState) return;

    try {
      await SecureStore.setItemAsync(
        SESSION_STATE_KEY,
        JSON.stringify(this.sessionState)
      );
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  }

  private startActivityTracking(): void {
    // Update activity every 5 minutes while app is active
    this.stopActivityTracking();
    this.activityUpdateInterval = setInterval(() => {
      this.updateActivity();
    }, 5 * 60 * 1000);
  }

  private stopActivityTracking(): void {
    if (this.activityUpdateInterval) {
      clearInterval(this.activityUpdateInterval);
      this.activityUpdateInterval = null;
    }
  }

  private getInvalidStatus(): SessionStatus {
    return {
      isValid: false,
      isExpired: true,
      isExpiringSoon: false,
      remainingTimeMs: 0,
      lastActivityAt: null,
    };
  }
}

// Export singleton instance
export const sessionService = new SessionService();

// Export class for testing
export { SessionService };
