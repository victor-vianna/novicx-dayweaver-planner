import { Eye, Home, LogOut, Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { useAuth } from "@/features/auth/useAuth";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const DESKTOP_MENU_QUERY = "(min-width: 64rem)";

export function AppFrame({
  name,
  role,
  nav,
  active,
  onNavigate,
  menuOpen,
  onMenuOpen,
  preview,
  children,
}: {
  name: string;
  role: string;
  nav: { id: string; label: string; icon: typeof Home }[];
  active: string;
  onNavigate: (id: string) => void;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  preview?: boolean;
  children: ReactNode;
}) {
  const { signOut, stopPreview } = useAuth();
  const [isMobileMenu, setIsMobileMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const restoreMenuFocus = useRef(false);
  const menuPanelId = useId();
  const mobileMenuClosed = isMobileMenu && !menuOpen;

  const closeMenu = useCallback(() => {
    restoreMenuFocus.current = isMobileMenu;
    onMenuOpen(false);
  }, [isMobileMenu, onMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_MENU_QUERY);
    const updateMenuMode = () => setIsMobileMenu(!desktopQuery.matches);

    desktopQuery.addEventListener("change", updateMenuMode);
    updateMenuMode();
    return () => desktopQuery.removeEventListener("change", updateMenuMode);
  }, []);

  useEffect(() => {
    if (isMobileMenu && menuOpen) menuPanelRef.current?.focus();
  }, [isMobileMenu, menuOpen]);

  useEffect(() => {
    if (!menuOpen && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!isMobileMenu || !menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeMenu, isMobileMenu, menuOpen]);

  return (
    <div className="min-h-screen bg-background">
      {preview && (
        <div className="sticky top-0 z-40 flex h-11 items-center justify-center gap-3 bg-primary px-4 text-xs font-semibold text-primary-foreground">
          <Eye className="h-4 w-4" /> Você está visualizando o portal do cliente
          <button
            type="button"
            onClick={stopPreview}
            className="rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25"
          >
            Voltar ao painel
          </button>
        </div>
      )}

      <header
        className={cn(
          "sticky z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden",
          preview ? "top-11" : "top-0",
        )}
      >
        <Wordmark variant="inline" />
        <button
          ref={menuButtonRef}
          type="button"
          className="pressable grid h-10 w-10 place-items-center rounded-xl bg-surface"
          onClick={() => (menuOpen ? closeMenu() : onMenuOpen(true))}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls={menuPanelId}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={closeMenu}
          aria-label="Fechar menu"
        />
      )}
      <aside
        ref={menuPanelRef}
        id={menuPanelId}
        tabIndex={-1}
        inert={mobileMenuClosed}
        aria-hidden={mobileMenuClosed || undefined}
        aria-label="Menu principal"
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-5 transition-transform duration-200 lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <Wordmark variant="inline" />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sidebar-accent lg:hidden"
            onClick={closeMenu}
            aria-label="Fechar menu lateral"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="mt-8 space-y-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  closeMenu();
                }}
                className={cn(
                  "pressable flex h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-semibold",
                  selected
                    ? "bg-primary-soft text-primary-glow"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-xs font-bold text-white">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{role}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="pressable flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
        </div>
      </aside>

      <main className="pb-24 lg:ml-72 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-9">{children}</div>
      </main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-xl lg:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "pressable flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold",
                selected ? "text-primary-glow" : "text-subtle-foreground",
              )}
            >
              <Icon className="h-5 w-5" /> {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
