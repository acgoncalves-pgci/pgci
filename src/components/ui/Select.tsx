import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  ChangeEventHandler,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  UIEvent,
} from "react";
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { OverlayLayerContext } from "./Dialog";

type Option = {
  disabled: boolean;
  label: ReactNode;
  value: string;
  ariaLabel?: string;
};

type NativeProps = SelectHTMLAttributes<HTMLSelectElement>;

export type SelectProps = Omit<
  NativeProps,
  "children" | "value" | "defaultValue" | "onChange" | "onBlur"
> & {
  children: ReactNode;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  onBlur?: ChangeEventHandler<HTMLSelectElement>;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  emptyText?: string;
  searchValue?: string;
  onSearchChange?: (query: string) => void;
  filterOptions?: boolean;
  loading?: boolean;
  loadingText?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadMoreText?: string;
  errorText?: string;
  onRetry?: () => void;
};

export type AdvancedSelectOption = {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
};

export type AdvancedSelectRequest = {
  query: string;
  page: number;
  pageSize: number;
  signal: AbortSignal;
};

export type AdvancedSelectPage = {
  options: AdvancedSelectOption[];
  hasMore: boolean;
};

export type AdvancedSelectProps = Omit<
  SelectProps,
  | "children"
  | "searchable"
  | "searchValue"
  | "onSearchChange"
  | "filterOptions"
  | "loading"
  | "hasMore"
  | "onLoadMore"
  | "errorText"
  | "onRetry"
> & {
  loadOptions: (request: AdvancedSelectRequest) => Promise<AdvancedSelectPage>;
  initialOptions?: AdvancedSelectOption[];
  selectedOption?: AdvancedSelectOption;
  debounceMs?: number;
  pageSize?: number;
};

const optionsFromChildren = (children: ReactNode): Option[] =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const props = child.props as {
      children?: ReactNode;
      disabled?: boolean;
      value?: string | number;
      "aria-label"?: string;
    };
    return [
      {
        disabled: Boolean(props.disabled),
        label: props.children,
        value: String(props.value ?? props.children ?? ""),
        ariaLabel: props["aria-label"],
      },
    ];
  });

const textFromNode = (node: ReactNode): string =>
  Children.toArray(node)
    .map((part) => {
      if (typeof part === "string" || typeof part === "number")
        return String(part);
      if (isValidElement(part))
        return textFromNode((part.props as { children?: ReactNode }).children);
      return "";
    })
    .join(" ");

const normaliseSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

const normaliseAdvancedOptions = (options: AdvancedSelectOption[]): Option[] =>
  options.map((option) => ({
    disabled: Boolean(option.disabled),
    label: option.label,
    value: String(option.value),
    ariaLabel: option.ariaLabel,
  }));

const mergeOptions = (...groups: Option[][]): Option[] => {
  const merged = new Map<string, Option>();
  groups.flat().forEach((option) => merged.set(option.value, option));
  return [...merged.values()];
};

export const Select = forwardRef<HTMLInputElement, SelectProps>(
  (
    {
      children,
      className = "",
      value,
      defaultValue,
      name,
      id,
      disabled = false,
      required,
      onChange,
      onBlur,
      searchable = true,
      searchPlaceholder = "Buscar...",
      searchAriaLabel = "Buscar opções",
      emptyText = "Nenhuma opção encontrada.",
      searchValue,
      onSearchChange,
      filterOptions = true,
      loading = false,
      loadingText = "Carregando opções...",
      hasMore = false,
      onLoadMore,
      loadMoreText = "Carregar mais",
      errorText,
      onRetry,
      "aria-label": ariaLabel,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const options = useMemo(() => optionsFromChildren(children), [children]);
    const initialValue = Array.isArray(defaultValue)
      ? defaultValue[0]
      : defaultValue;
    const [uncontrolledValue, setUncontrolledValue] = useState(
      String(initialValue ?? options[0]?.value ?? ""),
    );
    const [open, setOpen] = useState(false);
    const [uncontrolledSearch, setUncontrolledSearch] = useState("");
    const [highlightedValue, setHighlightedValue] = useState<string | null>(
      null,
    );
    const [contentStyle, setContentStyle] = useState<CSSProperties | null>(
      null,
    );
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listboxId = useId();
    const overlayLayer = useContext(OverlayLayerContext);
    const selectLayer = Math.max(120, overlayLayer + 20);
    const isControlled = value !== undefined;
    const rawValue = Array.isArray(value) ? value[0] : value;
    const currentValue = String(
      isControlled ? (rawValue ?? "") : uncontrolledValue,
    );
    const selected = options.find((option) => option.value === currentValue);
    const selectedLabel = selected?.label ?? "Selecione";
    const query = searchValue ?? uncontrolledSearch;
    const normalisedQuery = normaliseSearch(query);
    const visibleOptions = useMemo(
      () =>
        searchable && filterOptions && normalisedQuery
          ? options.filter((option) =>
              normaliseSearch(
                `${option.ariaLabel ?? ""} ${textFromNode(option.label)}`,
              ).includes(normalisedQuery),
            )
          : options,
      [filterOptions, normalisedQuery, options, searchable],
    );
    const enabledOptions = useMemo(
      () => visibleOptions.filter((option) => !option.disabled),
      [visibleOptions],
    );
    const highlightedIndex = visibleOptions.findIndex(
      (option) => option.value === highlightedValue && !option.disabled,
    );
    const highlightedOptionId =
      highlightedIndex >= 0
        ? `${listboxId}-option-${highlightedIndex}`
        : undefined;

    const updateSearch = (nextQuery: string) => {
      setHighlightedValue(null);
      if (searchValue === undefined) setUncontrolledSearch(nextQuery);
      onSearchChange?.(nextQuery);
    };

    const updateContentPosition = useCallback(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const computedZoom = Number.parseFloat(
        window.getComputedStyle(document.body).zoom,
      );
      const portalZoom =
        Number.isFinite(computedZoom) && computedZoom > 0 ? computedZoom : 1;
      const anchorTop = rect.top / portalZoom;
      const anchorBottom = rect.bottom / portalZoom;
      const anchorLeft = rect.left / portalZoom;
      const anchorWidth = rect.width / portalZoom;
      const padding = 8;
      const gap = 4;
      const viewportWidth = window.innerWidth / portalZoom;
      const viewportHeight = window.innerHeight / portalZoom;
      const spaceAbove = Math.max(0, anchorTop - padding);
      const spaceBelow = Math.max(
        0,
        viewportHeight - anchorBottom - padding,
      );
      const searchHeight = searchable ? 52 : 0;
      const estimatedHeight = Math.min(
        320,
        Math.max(88, options.length * 44 + searchHeight + 8),
      );
      const opensUpward =
        spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        1,
        Math.min(320, (opensUpward ? spaceAbove : spaceBelow) - gap),
      );
      const height = Math.min(estimatedHeight, maxHeight);
      const maxWidth = Math.max(1, viewportWidth - padding * 2);
      const width = Math.min(
        Math.max(anchorWidth, Math.min(240, maxWidth)),
        maxWidth,
      );
      const left = Math.min(
        Math.max(padding, anchorLeft),
        Math.max(padding, viewportWidth - width - padding),
      );
      setContentStyle(
        opensUpward
          ? {
              position: "fixed",
              zIndex: selectLayer,
              bottom: viewportHeight - anchorTop + gap,
              left,
              width,
              height,
              maxHeight,
            }
          : {
              position: "fixed",
              zIndex: selectLayer,
              top: anchorBottom + gap,
              left,
              width,
              height,
              maxHeight,
            },
      );
    }, [options.length, searchable, selectLayer]);

    useEffect(() => {
      if (!open) {
        setContentStyle(null);
        return;
      }
      updateContentPosition();
      const closeOnOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          !rootRef.current?.contains(target) &&
          !contentRef.current?.contains(target)
        )
          setOpen(false);
      };
      const repositionOnOutsideScroll = (event: Event) => {
        const target = event.target;
        if (target instanceof Node && contentRef.current?.contains(target))
          return;
        updateContentPosition();
      };
      document.addEventListener("mousedown", closeOnOutside);
      window.addEventListener("resize", updateContentPosition);
      document.addEventListener("scroll", repositionOnOutsideScroll, true);
      return () => {
        document.removeEventListener("mousedown", closeOnOutside);
        window.removeEventListener("resize", updateContentPosition);
        document.removeEventListener("scroll", repositionOnOutsideScroll, true);
      };
    }, [open, updateContentPosition]);

    useEffect(() => {
      if (!open || !searchable || !contentStyle) return;
      const frame = window.requestAnimationFrame(() =>
        searchRef.current?.focus(),
      );
      return () => window.cancelAnimationFrame(frame);
    }, [contentStyle, open, searchable]);

    useEffect(() => {
      if (!open) return;
      setHighlightedValue((current) =>
        enabledOptions.some((option) => option.value === current)
          ? current
          : (enabledOptions[0]?.value ?? null),
      );
    }, [enabledOptions, open]);

    useEffect(() => {
      if (!open || !highlightedOptionId) return;
      document
        .getElementById(highlightedOptionId)
        ?.scrollIntoView?.({ block: "nearest" });
    }, [highlightedOptionId, open]);

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) Object.assign(ref, { current: node });
      },
      [ref],
    );

    const eventFor = (nextValue: string) => {
      const input = inputRef.current;
      if (input) {
        input.value = nextValue;
        return {
          type: "change",
          target: input,
          currentTarget: input,
        } as unknown as ChangeEvent<HTMLSelectElement>;
      }
      return {
        type: "change",
        target: { name, value: nextValue },
        currentTarget: { name, value: nextValue },
      } as ChangeEvent<HTMLSelectElement>;
    };

    const choose = (nextValue: string) => {
      if (!isControlled) setUncontrolledValue(nextValue);
      const event = eventFor(nextValue);
      onChange?.(event);
      onBlur?.(event);
      setHighlightedValue(null);
      setOpen(false);
    };

    const moveHighlight = (direction: 1 | -1) => {
      if (!enabledOptions.length) return;
      const index = enabledOptions.findIndex(
        (option) => option.value === highlightedValue,
      );
      const start = index < 0 ? (direction === 1 ? -1 : 0) : index;
      const next =
        enabledOptions[
          (start + direction + enabledOptions.length) % enabledOptions.length
        ];
      if (next) setHighlightedValue(next.value);
    };

    const chooseHighlighted = () => {
      const highlighted =
        enabledOptions.find((option) => option.value === highlightedValue) ??
        enabledOptions[0];
      if (highlighted) choose(highlighted.value);
    };

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!open && searchable) updateSearch("");
        setOpen((current) => !current);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          if (searchable) updateSearch("");
          setOpen(true);
          return;
        }
        moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      }
    };

    const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlight(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        chooseHighlighted();
      }
    };

    const onContentScroll = (event: UIEvent<HTMLDivElement>) => {
      if (!hasMore || loading || !onLoadMore) return;
      const element = event.currentTarget;
      if (element.scrollHeight - element.scrollTop - element.clientHeight <= 48)
        onLoadMore();
    };

    const triggerProps =
      props as unknown as ButtonHTMLAttributes<HTMLButtonElement>;
    const content = open && contentStyle && (
      <div
        ref={contentRef}
        style={contentStyle}
        className="ui-select-content flex flex-col overflow-hidden rounded-md border bg-white p-1 shadow-lg dark:bg-slate-900"
      >
        {searchable && (
          <div className="z-10 shrink-0 bg-white p-1 dark:bg-slate-900">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
                onKeyDown={onSearchKeyDown}
                aria-label={searchAriaLabel}
                aria-controls={listboxId}
                aria-activedescendant={highlightedOptionId}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="field ui-input !h-9 !pl-9"
              />
            </div>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto mt-2" onScroll={onContentScroll}>
          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ? `Opções de ${ariaLabel}` : "Opções"}
          >
            {visibleOptions.map((option, index) => (
              <button
                id={`${listboxId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-label={option.ariaLabel}
                aria-selected={option.value === currentValue}
                data-highlighted={option.value === highlightedValue}
                disabled={option.disabled}
                className="ui-select-option"
                onMouseEnter={() =>
                  !option.disabled && setHighlightedValue(option.value)
                }
                onClick={() => choose(option.value)}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-5 text-pretty">
                  {option.label}
                </span>
                {option.value === currentValue && (
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-public-700"
                  />
                )}
              </button>
            ))}
          </div>
          {!loading && !errorText && visibleOptions.length === 0 && (
            <p className="px-3 py-3 text-center text-sm text-slate-500">
              {emptyText}
            </p>
          )}
          {loading && (
            <p
              role="status"
              className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-slate-500"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {loadingText}
            </p>
          )}
          {errorText && (
            <div
              role="alert"
              className="px-3 py-3 text-center text-sm text-red-700"
            >
              <p>{errorText}</p>
              {onRetry && (
                <button
                  type="button"
                  className="mt-2 font-semibold underline"
                  onClick={onRetry}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          {hasMore && !loading && !errorText && onLoadMore && (
            <button
              type="button"
              className="ui-select-option justify-center font-semibold text-public-700"
              onClick={onLoadMore}
            >
              {loadMoreText}
            </button>
          )}
        </div>
      </div>
    );

    const toggleOpen = () => {
      if (!open) {
        setHighlightedValue(null);
        if (searchable) updateSearch("");
      }
      setOpen((current) => !current);
    };

    return (
      <div ref={rootRef} className="relative min-w-0 w-full">
        <input
          ref={setInputRef}
          type="hidden"
          aria-hidden="true"
          name={name}
          value={currentValue}
          disabled={disabled}
          required={required}
        />
        <button
          {...triggerProps}
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete={searchable ? "list" : "none"}
          disabled={disabled}
          onClick={toggleOpen}
          onKeyDown={onTriggerKeyDown}
          className={`field ui-select ${className}`}
        >
          <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-5 text-pretty">
            {selectedLabel}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {content && createPortal(content, document.body)}
      </div>
    );
  },
);
Select.displayName = "Select";

/** Alias explícito do Select, que usa busca local por padrão. */
export const SearchableSelect = forwardRef<HTMLInputElement, SelectProps>(
  (props, ref) => <Select {...props} ref={ref} searchable />,
);
SearchableSelect.displayName = "SearchableSelect";

/** Select paginado com busca remota, indicado para conjuntos de dados grandes. */
export const AdvancedSelect = forwardRef<HTMLInputElement, AdvancedSelectProps>(
  (
    {
      loadOptions,
      initialOptions = [],
      selectedOption,
      debounceMs = 300,
      pageSize = 50,
      value,
      ...props
    },
    ref,
  ) => {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [options, setOptions] = useState<Option[]>(() =>
      normaliseAdvancedOptions(initialOptions),
    );
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reloadToken, setReloadToken] = useState(0);
    const loaderRef = useRef(loadOptions);
    const requestIdRef = useRef(0);
    const pendingControllerRef = useRef<AbortController | null>(null);
    const rawValue = Array.isArray(value) ? value[0] : value;
    const currentValue = String(rawValue ?? "");

    useEffect(() => {
      loaderRef.current = loadOptions;
    }, [loadOptions]);

    useEffect(() => {
      const timer = window.setTimeout(
        () => setDebouncedQuery(query),
        Math.max(0, debounceMs),
      );
      return () => window.clearTimeout(timer);
    }, [debounceMs, query]);

    useEffect(() => {
      const controller = new AbortController();
      pendingControllerRef.current?.abort();
      pendingControllerRef.current = controller;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError("");
      void loaderRef
        .current({
          query: debouncedQuery,
          page: 1,
          pageSize,
          signal: controller.signal,
        })
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current)
            return;
          const nextOptions = normaliseAdvancedOptions(result.options);
          setOptions((current) =>
            mergeOptions(
              current.filter((option) => option.value === currentValue),
              nextOptions,
            ),
          );
          setPage(1);
          setHasMore(result.hasMore);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current)
            return;
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar as opções.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted && requestId === requestIdRef.current)
            setLoading(false);
        });
      return () => controller.abort();
    }, [currentValue, debouncedQuery, pageSize, reloadToken]);

    useEffect(() => () => pendingControllerRef.current?.abort(), []);

    const loadMore = () => {
      if (loading || !hasMore) return;
      const controller = new AbortController();
      pendingControllerRef.current?.abort();
      pendingControllerRef.current = controller;
      const requestId = ++requestIdRef.current;
      const nextPage = page + 1;
      setLoading(true);
      setError("");
      void loaderRef
        .current({
          query: debouncedQuery,
          page: nextPage,
          pageSize,
          signal: controller.signal,
        })
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current)
            return;
          setOptions((current) =>
            mergeOptions(current, normaliseAdvancedOptions(result.options)),
          );
          setPage(nextPage);
          setHasMore(result.hasMore);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current)
            return;
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar mais opções.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted && requestId === requestIdRef.current)
            setLoading(false);
        });
    };

    const visibleOptions = selectedOption
      ? mergeOptions(normaliseAdvancedOptions([selectedOption]), options)
      : options;
    return (
      <Select
        {...props}
        ref={ref}
        value={value}
        searchable
        searchValue={query}
        onSearchChange={setQuery}
        filterOptions={false}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        errorText={error}
        onRetry={() => setReloadToken((current) => current + 1)}
      >
        {visibleOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.ariaLabel}
          >
            {option.label}
          </option>
        ))}
      </Select>
    );
  },
);
AdvancedSelect.displayName = "AdvancedSelect";
