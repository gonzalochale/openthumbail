"use client";

import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { animate } from "motion/react";
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";

type PromptInputContextType = {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 125,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
});

function usePromptInput() {
  return useContext(PromptInputContext);
}

export type PromptInputProps = {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & React.ComponentProps<"div">;

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 125,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  onClick,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!disabled) textareaRef.current?.focus();
    onClick?.(e);
  };

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          disabled,
          textareaRef,
        }}
      >
        <div
          onClick={handleClick}
          className={cn(
            "border-input cursor-text rounded-t-2xl sm:rounded-2xl border p-2 bg-card",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  );
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean;
} & React.ComponentProps<typeof Textarea>;

const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputTextareaProps
>(function PromptInputTextarea(
  { className, onKeyDown, disableAutosize = false, placeholder, ...props },
  forwardedRef,
) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput();

  const heightAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  const measureScrollHeight = (el: HTMLTextAreaElement) => {
    if (!el.value && el.placeholder) {
      el.value = el.placeholder;
      const h = el.scrollHeight;
      el.value = "";
      return h;
    }
    return el.scrollHeight;
  };

  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el || disableAutosize) return;
    el.style.height = "auto";
    const scrollH = measureScrollHeight(el);
    if (typeof maxHeight === "number") {
      el.style.height = `${Math.min(scrollH, maxHeight)}px`;
    } else {
      el.style.height = `min(${scrollH}px, ${maxHeight})`;
    }
  };

  const handleRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
      adjustHeight(el);
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    if (!textareaRef.current || disableAutosize) return;
    const el = textareaRef.current;

    const from = el.offsetHeight;
    el.style.height = "auto";
    const scrollH = measureScrollHeight(el);
    const to =
      typeof maxHeight === "number"
        ? Math.min(scrollH, maxHeight)
        : scrollH;
    el.style.height = `${from}px`;

    heightAnimRef.current?.stop();
    heightAnimRef.current = animate(el, { height: to }, {
      duration: 0.22,
      ease: [0.25, 1, 0.5, 1],
    });
  }, [value, maxHeight, disableAutosize, placeholder]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(e.target);
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={handleRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "text-primary text-base min-h-28 sm:min-h-11 w-full resize-none border-none bg-transparent dark:bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [scrollbar-color:var(--border)_transparent]",
        className,
      )}
      rows={1}
      disabled={disabled}
      {...props}
    />
  );
});

export type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export type PromptInputActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput();

  return (
    <Tooltip {...props}>
      <TooltipTrigger
        disabled={disabled}
        render={children as React.ReactElement}
        onClick={(event) => event.stopPropagation()}
      />
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
};
