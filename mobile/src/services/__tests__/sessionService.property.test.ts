import * as fc from 'fast-check';
import * as SecureStore from 'expo-secure-store';
import { SessionService, SessionState, SessionStatus } from '../sessionService';

// Mock SecureStore
const mockStorage: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(mockStorage[key] || null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

/**
 * **Feature: project-finalization, Property 29: Session state persists across idle periods**
 * **Validates: Requirements 9.5**
 *
 * For any user session, the session state should be maintained for at least 24 hours of inactivity.
 */
describe('Property 29: Session state persists across idle periods', () => {
  // Generator for user IDs
  const userIdGenerator = fc.uuid();

  // Generator for timestamps within reasonable range
  const timestampGenerator = fc.integer({
    min: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    max: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
  });

  // Generator for idle periods (in milliseconds)
  const idlePeriodGenerator = fc.integer({
    min: 0,
    max: 48 * 60 * 60 * 1000, // Up to 48 hours
  });

  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  describe('Session initialization', () => {
    it('new sessions should have valid initial state', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service = new SessionService();
          const beforeInit = Date.now();

          await service.initSession(userId);

          const status = service.getSessionStatus();

          // Session should be valid
          expect(status.isValid).toBe(true);
          expect(status.isExpired).toBe(false);

          // Last activity should be recent
          expect(status.lastActivityAt).toBeGreaterThanOrEqual(beforeInit);
          expect(status.lastActivityAt).toBeLessThanOrEqual(Date.now());

          // Remaining time should be close to 24 hours
          const expectedTimeout = service.getSessionTimeoutMs();
          expect(status.remainingTimeMs).toBeGreaterThan(expectedTimeout - 1000);
          expect(status.remainingTimeMs).toBeLessThanOrEqual(expectedTimeout);

          // Clean up
          await service.clearSession();
        }),
        { numRuns: 100 }
      );
    });

    it('session should be stored in secure storage', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service = new SessionService();

          await service.initSession(userId);

          // Verify storage was called
          expect(SecureStore.setItemAsync).toHaveBeenCalled();

          // Verify stored data contains user ID
          const storedData = mockStorage['session_state'];
          expect(storedData).toBeDefined();

          const parsed: SessionState = JSON.parse(storedData);
          expect(parsed.userId).toBe(userId);
          expect(parsed.isActive).toBe(true);

          // Clean up
          await service.clearSession();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Session persistence across idle periods', () => {
    it('sessions should remain valid within 24 hours of inactivity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator,
          fc.integer({ min: 0, max: 23 * 60 * 60 * 1000 }), // Up to 23 hours
          async (userId, idleTimeMs) => {
            const service = new SessionService();
            const now = Date.now();

            // Create a session state that was active idleTimeMs ago
            const sessionState: SessionState = {
              userId,
              lastActivityAt: now - idleTimeMs,
              sessionStartedAt: now - idleTimeMs - 1000,
              expiresAt: now - idleTimeMs + 24 * 60 * 60 * 1000,
              isActive: true,
            };

            // Store the session state
            mockStorage['session_state'] = JSON.stringify(sessionState);

            // Restore session
            const status = await service.restoreSession();

            // Session should still be valid (within 24 hours)
            expect(status.isValid).toBe(true);
            expect(status.isExpired).toBe(false);
            expect(status.remainingTimeMs).toBeGreaterThan(0);

            // Clean up
            await service.clearSession();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sessions should expire after 24 hours of inactivity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator,
          fc.integer({ min: 24 * 60 * 60 * 1000 + 1000, max: 48 * 60 * 60 * 1000 }), // 24+ hours
          async (userId, idleTimeMs) => {
            const service = new SessionService();
            const now = Date.now();

            // Create a session state that was active more than 24 hours ago
            const sessionState: SessionState = {
              userId,
              lastActivityAt: now - idleTimeMs,
              sessionStartedAt: now - idleTimeMs - 1000,
              expiresAt: now - idleTimeMs + 24 * 60 * 60 * 1000, // Expired
              isActive: true,
            };

            // Store the session state
            mockStorage['session_state'] = JSON.stringify(sessionState);

            // Restore session
            const status = await service.restoreSession();

            // Session should be expired
            expect(status.isExpired).toBe(true);
            expect(status.remainingTimeMs).toBe(0);

            // Clean up
            await service.clearSession();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Activity updates extend session', () => {
    it('updating activity should extend session expiry', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service = new SessionService();

          await service.initSession(userId);

          const statusBefore = service.getSessionStatus();
          const expiryBefore = service.getExpiryTime();

          // Wait a small amount and update activity
          await new Promise((resolve) => setTimeout(resolve, 10));
          await service.updateActivity();

          const statusAfter = service.getSessionStatus();
          const expiryAfter = service.getExpiryTime();

          // Expiry should be extended
          expect(expiryAfter).toBeGreaterThanOrEqual(expiryBefore!);

          // Session should still be valid
          expect(statusAfter.isValid).toBe(true);
          expect(statusAfter.isExpired).toBe(false);

          // Last activity should be updated
          expect(statusAfter.lastActivityAt).toBeGreaterThanOrEqual(
            statusBefore.lastActivityAt!
          );

          // Clean up
          await service.clearSession();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Session restoration', () => {
    it('restored sessions should have same user ID', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service1 = new SessionService();

          // Initialize session
          await service1.initSession(userId);

          // Create new service instance (simulating app restart)
          const service2 = new SessionService();

          // Restore session
          const status = await service2.restoreSession();

          // Session should be valid
          expect(status.isValid).toBe(true);

          // Verify stored user ID matches
          const storedData = mockStorage['session_state'];
          const parsed: SessionState = JSON.parse(storedData);
          expect(parsed.userId).toBe(userId);

          // Clean up
          await service2.clearSession();
        }),
        { numRuns: 100 }
      );
    });

    it('restoring non-existent session should return invalid status', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Clear storage
          Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

          const service = new SessionService();
          const status = await service.restoreSession();

          expect(status.isValid).toBe(false);
          expect(status.isExpired).toBe(true);
          expect(status.lastActivityAt).toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Session clearing', () => {
    it('cleared sessions should not be restorable', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service = new SessionService();

          // Initialize and then clear session
          await service.initSession(userId);
          await service.clearSession();

          // Try to restore
          const status = await service.restoreSession();

          // Session should be invalid
          expect(status.isValid).toBe(false);
          expect(status.isExpired).toBe(true);

          // Storage should be cleared
          expect(mockStorage['session_state']).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Session status consistency', () => {
    it('session status should be valid after restore for non-expired sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator,
          fc.integer({ min: 0, max: 23 * 60 * 60 * 1000 }),
          async (userId, idleTimeMs) => {
            const service = new SessionService();
            const now = Date.now();

            // Create session state that is not expired
            const sessionState: SessionState = {
              userId,
              lastActivityAt: now - idleTimeMs,
              sessionStartedAt: now - idleTimeMs - 1000,
              expiresAt: now - idleTimeMs + 24 * 60 * 60 * 1000,
              isActive: true,
            };

            mockStorage['session_state'] = JSON.stringify(sessionState);

            const beforeRestore = Date.now();
            await service.restoreSession();
            const status = service.getSessionStatus();

            // Session should be valid (not expired)
            expect(status.isValid).toBe(true);
            expect(status.isExpired).toBe(false);

            // Last activity should be updated to current time (restore updates activity)
            expect(status.lastActivityAt).toBeGreaterThanOrEqual(beforeRestore);
            expect(status.lastActivityAt).toBeLessThanOrEqual(Date.now());

            // Remaining time should be close to 24 hours (since activity was just updated)
            const expectedTimeout = service.getSessionTimeoutMs();
            expect(status.remainingTimeMs).toBeGreaterThan(expectedTimeout - 1000);

            // Clean up
            await service.clearSession();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isSessionValid should match status.isValid and !status.isExpired', async () => {
      await fc.assert(
        fc.asyncProperty(userIdGenerator, async (userId) => {
          const service = new SessionService();

          await service.initSession(userId);

          const status = service.getSessionStatus();
          const isValid = service.isSessionValid();

          expect(isValid).toBe(status.isValid && !status.isExpired);

          // Clean up
          await service.clearSession();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Session timeout configuration', () => {
    it('session timeout should be 24 hours', () => {
      const service = new SessionService();
      const timeoutMs = service.getSessionTimeoutMs();

      expect(timeoutMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});
