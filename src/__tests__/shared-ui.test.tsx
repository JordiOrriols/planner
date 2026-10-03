import React from "react";
import { describe, expect, it } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { EmptyState, Button, ProgressIndicator } from "@jordiorriols/ui";
import { useSupabaseAuth } from "@jordiorriols/ui/hooks";
import { User } from "@jordiorriols/ui/icons";
import { Accordion } from "@jordiorriols/ui/radix";

describe("Planner shared foundation", () => {
  it("renders shared views, icons and direct Radix exports under React 18", () => {
    render(
      <>
        <EmptyState
          icon={<User />}
          title="No projects"
          description="Create a project"
          action={<Button>Create</Button>}
        />
        <ProgressIndicator value={60} label="Progress" />
        <Accordion.Root type="single">
          <Accordion.Item value="details">
            <Accordion.Header>
              <Accordion.Trigger>Details</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </>
    );
    expect(screen.getByRole("heading", { name: "No projects" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
  });
  it("uses shared authentication without importing Ladders tables", async () => {
    const { result } = renderHook(() => useSupabaseAuth(null));
    expect(result.current.authEnabled).toBe(false);
    await expect(result.current.signIn("ada@example.com", "password")).rejects.toThrow(
      "not configured"
    );
  });
});
