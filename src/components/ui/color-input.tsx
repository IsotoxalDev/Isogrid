"use client";

import { useEffect, useRef } from 'react';

interface ColorInputProps {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  title?: string;
}

// Wraps a native <input type="color">, but only commits the value on the
// native `change` event (fires once, when the picker closes) instead of
// React's onChange — which is wired to the native `input` event and fires
// continuously as the user drags through colors inside the picker. Using
// onChange directly meant every color briefly hovered over while picking got
// saved immediately, so clicking "Cancel" in the browser's own picker UI
// (which doesn't revert the input's value) still left whatever was last
// previewed applied and persisted.
export default function ColorInput({ value, onCommit, className, title }: ColorInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleChange = (e: Event) => onCommit((e.target as HTMLInputElement).value);
    el.addEventListener('change', handleChange);
    return () => el.removeEventListener('change', handleChange);
  }, [onCommit]);

  return (
    <input
      key={value}
      ref={ref}
      type="color"
      defaultValue={value}
      className={className}
      title={title}
    />
  );
}
