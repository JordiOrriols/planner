import React from "react";
import { Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlatformRoadmap from "./pages/platform-roadmap";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route index element={<PlatformRoadmap />} />
        <Route path="workspaces/:workspace/roadmap" element={<PlatformRoadmap />} />
        <Route path="*" element={<PlatformRoadmap />} />
      </Routes>
    </QueryClientProvider>
  );
}
