import { createFileRoute } from "@tanstack/react-router";
import CentralAtendimentoView from "@/components/admin/CentralAtendimentoView";

export const Route = createFileRoute("/_authenticated/admin/atendimento/$appointmentId")({
  ssr: false,
  component: CentralAtendimentoViewPage,
});

function CentralAtendimentoViewPage() {
  const { appointmentId } = Route.useParams();
  return <CentralAtendimentoView appointmentId={appointmentId} />;
}
