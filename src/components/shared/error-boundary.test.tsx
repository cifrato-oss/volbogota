// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./error-boundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <div>contenido</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("renders the fallback when a child throws during render", () => {
    // React logs the caught error to console.error — silence it for a clean run.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("fallback")).toBeInTheDocument();
    spy.mockRestore();
  });
});
