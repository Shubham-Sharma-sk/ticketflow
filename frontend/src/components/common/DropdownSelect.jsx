import { useEffect, useMemo, useRef, useState } from "react";
import "./DropdownSelect.css";

export default function DropdownSelect({
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  size = "md",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || placeholder,
    [options, placeholder, value]
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className={`ds-select ds-select--${size} ${className}`}>
      <button
        type="button"
        className={`ds-trigger ${isOpen ? "open" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{selectedLabel}</span>
        <span className="ds-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="ds-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`ds-option ${option.value === value ? "active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
