import { useRef, useEffect, useCallback } from "react";

interface MenuState {
  scrollY: number;
  search: string;
  activeCategory: string;
}

const menuStateStore: MenuState = {
  scrollY: 0,
  search: "",
  activeCategory: "Todos",
};

export const useMenuState = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const restoreState = useCallback(() => {
    // Restore scroll position after render
    requestAnimationFrame(() => {
      window.scrollTo(0, menuStateStore.scrollY);
    });
    return {
      search: menuStateStore.search,
      activeCategory: menuStateStore.activeCategory,
    };
  }, []);

  const saveScroll = useCallback(() => {
    menuStateStore.scrollY = window.scrollY;
  }, []);

  const saveSearch = useCallback((v: string) => {
    menuStateStore.search = v;
  }, []);

  const saveCategory = useCallback((v: string) => {
    menuStateStore.activeCategory = v;
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => window.removeEventListener("scroll", saveScroll);
  }, [saveScroll]);

  return { containerRef, restoreState, saveSearch, saveCategory };
};
