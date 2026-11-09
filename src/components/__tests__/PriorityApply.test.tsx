import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PriorityProposals } from "@/components/organisms/priority-proposals";
import type { PublicRoadmap } from "@/lib/publicRoadmap";
import i18n from "@/i18n";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const official: PublicRoadmap = {
  name: "Local priorities",
  revision: "a".repeat(32),
  startDate: "2026-02-02",
  markers: [],
  features: [first, second].map((id, index) => ({
    id,
    name: index === 0 ? "Alpha" : "Beta",
    project: "Local",
    status: "pending",
    start: null,
    end: null,
    complete: false,
    dependency_ids: [],
  })),
};
const preview: PublicRoadmap = { ...official, features: [...official.features].reverse() };
const applyLabel = "Apply priorities to official plan";

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
});
function renderProposal(onApply?: (ids: string[], revision: string) => Promise<void>) {
  const repository = {
    roadmap: vi.fn().mockResolvedValue(preview),
    proposals: vi.fn().mockResolvedValue([]),
    saveProposal: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PriorityProposals
        scope="workspace"
        official={official}
        repository={repository}
        audience="workspace"
        {...(onApply ? { onApply } : {})}
      />
    </QueryClientProvider>
  );
  return repository;
}
async function experiment() {
  fireEvent.keyDown(await screen.findByRole("button", { name: "Reorder Beta", exact: true }), {
    key: "ArrowUp",
  });
  await screen.findByText("Temporary experiment. The official priorities have not changed.");
}

it("does not offer official writes without an internal apply callback", async () => {
  renderProposal();
  await experiment();
  expect(screen.queryByRole("button", { name: applyLabel })).not.toBeInTheDocument();
});

it("requires an experiment and explicit confirmation before applying captured priorities", async () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  renderProposal(onApply);
  expect(screen.getByRole("button", { name: applyLabel })).toBeDisabled();
  await experiment();
  await userEvent.click(screen.getByRole("button", { name: applyLabel }));
  let confirm = await screen.findByRole("alertdialog");
  expect(confirm).toHaveTextContent("saved proposals remain unchanged");
  await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: applyLabel }));
  confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: applyLabel }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledExactlyOnceWith([second, first], official.revision)
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Temporary experiment. The official priorities have not changed.")
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: applyLabel })).toBeDisabled();
});

it("keeps the experiment and surfaces a rejected official write for retry", async () => {
  const onApply = vi
    .fn()
    .mockRejectedValue(new Error("Roadmap changed. Refresh before proposing priorities."));
  renderProposal(onApply);
  await experiment();
  await userEvent.click(screen.getByRole("button", { name: applyLabel }));
  const confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: applyLabel }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Roadmap changed");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    screen.getByText("Temporary experiment. The official priorities have not changed.")
  ).toBeVisible();
  expect(screen.getByRole("button", { name: applyLabel })).toBeEnabled();
});
