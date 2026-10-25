// Admin navigation kept in sessionStorage, so a reload (or coming back to the
// tab) reopens the same screen. Per profile; storage errors are ignored.
export const ADMIN_VIEWS = ["overview", "clients", "plans"] as const;
export type AdminView = (typeof ADMIN_VIEWS)[number];

export interface AdminNav {
  view: AdminView;
  deliveryClientId: string | null;
}

const DEFAULT_NAV: AdminNav = { view: "overview", deliveryClientId: null };
const key = (profileId: string) => `novicx-planner:admin-nav:${profileId}`;

export function readAdminNav(profileId: string | undefined): AdminNav {
  if (!profileId) return DEFAULT_NAV;
  try {
    const raw = window.sessionStorage.getItem(key(profileId));
    if (!raw) return DEFAULT_NAV;
    const parsed = JSON.parse(raw) as Partial<AdminNav>;
    const view = ADMIN_VIEWS.find((v) => v === parsed.view) ?? DEFAULT_NAV.view;
    const deliveryClientId =
      typeof parsed.deliveryClientId === "string" && parsed.deliveryClientId
        ? parsed.deliveryClientId
        : null;
    return { view, deliveryClientId };
  } catch {
    return DEFAULT_NAV;
  }
}

export function writeAdminNav(profileId: string | undefined, nav: AdminNav) {
  if (!profileId) return;
  try {
    window.sessionStorage.setItem(key(profileId), JSON.stringify(nav));
  } catch {
    // Private mode or storage full: navigation just won't survive a reload.
  }
}
