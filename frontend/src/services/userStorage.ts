const ACTIVE_USER_KEY = "writerhub.activeUserId";

export function setActiveStorageUser(userId: string | null) {
  if (userId) {
    window.localStorage.setItem(ACTIVE_USER_KEY, userId);
  } else {
    window.localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export function userStorageKey(key: string): string {
  const userId = window.localStorage.getItem(ACTIVE_USER_KEY);
  return userId ? `writerhub.user.${userId}.${key}` : `writerhub.user.anonymous.${key}`;
}

export const userStorage = {
  getItem(key: string) {
    return window.localStorage.getItem(userStorageKey(key));
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(userStorageKey(key), value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(userStorageKey(key));
  },
};
