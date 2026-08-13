"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Rendered in place of `children` when a descendant throws during render. */
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Isolates a subtree so a render-time crash inside it (e.g. a third-party map
 * widget) shows a fallback instead of tearing down the whole page.
 *
 * Error boundaries have no hook equivalent, so this stays a class component.
 * Remount it with a `key` to reset after the underlying cause changes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.error("ErrorBoundary caught an error:", error);
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
