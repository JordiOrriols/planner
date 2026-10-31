import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import i18n from "@/i18n";
import { ErrorBoundary } from "../ErrorBoundary";

function ThrowError(): ReactNode {
  throw new Error("Test error");
}

describe("ErrorBoundary localized adapter", () => {
  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await i18n.changeLanguage("en");
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders children normally", () => {
    render(
      <ErrorBoundary>
        <div>Working</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Working")).toBeVisible();
  });

  it("preserves localized title, error details and shared diagnostics", () => {
    render(
      <ErrorBoundary componentName="Roadmap">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Test error");
    expect(screen.getByRole("heading")).toHaveTextContent(
      i18n.t("app.errors.componentTitle", { componentName: "Roadmap" })
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "error-state");
    expect(console.error).toHaveBeenCalledWith(
      "Error in Roadmap:",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it("preserves caller supplied fallbacks", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>Custom: {error.message}</p>}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom: Test error")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
