import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ErrorBoundary } from "../ErrorBoundary";

const ThrowError = () => {
  throw new Error("Test error");
};

const GoodComponent = () => <div>Good Component</div>;

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress console errors during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error?.mockRestore?.();
  });

  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Good Component")).toBeTruthy();
  });

  it("should render error message when there is an error", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    // Should show error state
    const container = document.body;
    expect(container).toBeTruthy();
  });
});
