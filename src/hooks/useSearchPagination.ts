"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";

interface SearchPaginationOptions<TFilterName extends string = string> {
  defaultPage?: number;
  searchParamName?: string;
  pageParamName?: string;
  debounceMs?: number;
  filterParamNames?: readonly TFilterName[];
}

interface SearchPaginationResult<TFilterName extends string = string> {
  searchQuery: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSearch: () => void;
  currentPage: number;
  handlePageChange: (newPage: number) => void;
  filters: Record<TFilterName, string>;
  handleFilterChange: (paramName: TFilterName, value: string) => void;
  handleFiltersChange: (updates: Partial<Record<TFilterName, string>>) => void;
  resetFilters: () => void;
}

export function useSearchPagination<TFilterName extends string = string>(options?: SearchPaginationOptions<TFilterName>): SearchPaginationResult<TFilterName> {
  const { defaultPage = 1, searchParamName = "search", pageParamName = "page", debounceMs = 500, filterParamNames = [] as readonly TFilterName[] } = options || {};

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentSearchQuery = searchParams.get(searchParamName) || "";
  const currentPage = Number(searchParams.get(pageParamName)) || defaultPage;

  const filterParamNamesKey = filterParamNames.join("|");

  const currentFilters = React.useMemo(() => {
    const result = {} as Record<TFilterName, string>;
    filterParamNames.forEach((name) => {
      result[name] = searchParams.get(name) || "";
    });
    return result;
  }, [searchParams, filterParamNamesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [inputValue, setInputValue] = React.useState<string>(currentSearchQuery);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSearchParams = React.useCallback(
    (updates: Record<string, string>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) newParams.set(key, value);
        else newParams.delete(key);
      });
      router.push(`${pathname}?${newParams.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const handleSearch = React.useCallback(() => {
    updateSearchParams({
      [searchParamName]: inputValue,
      [pageParamName]: String(defaultPage),
    });
  }, [inputValue, defaultPage, searchParamName, pageParamName, updateSearchParams]);

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      updateSearchParams({ [pageParamName]: String(newPage) });
    },
    [pageParamName, updateSearchParams],
  );

  const handleFilterChange = React.useCallback(
    (paramName: TFilterName, value: string) => {
      updateSearchParams({
        [paramName]: value,
        [pageParamName]: String(defaultPage),
      });
    },
    [pageParamName, defaultPage, updateSearchParams],
  );

  const handleFiltersChange = React.useCallback(
    (updates: Partial<Record<TFilterName, string>>) => {
      updateSearchParams({
        ...(updates as Record<string, string>),
        [pageParamName]: String(defaultPage),
      });
    },
    [pageParamName, defaultPage, updateSearchParams],
  );

  const resetFilters = React.useCallback(() => {
    setInputValue("");
    router.push(pathname);
  }, [pathname, router]);

  React.useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (inputValue !== currentSearchQuery) handleSearch();
    }, debounceMs);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [inputValue, currentSearchQuery, debounceMs, handleSearch]);

  return {
    searchQuery: currentSearchQuery,
    inputValue,
    setInputValue,
    handleSearch,
    currentPage,
    handlePageChange,
    filters: currentFilters,
    handleFilterChange,
    handleFiltersChange,
    resetFilters,
  };
}
