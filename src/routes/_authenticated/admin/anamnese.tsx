import { createFileRoute } from "@tanstack/react-router";
import AdminAnamnesisQuestions from "@/components/admin/AdminAnamnesisQuestions";

export const Route = createFileRoute("/_authenticated/admin/anamnese")({
  ssr: false,
  component: AdminAnamnesisQuestions,
});
