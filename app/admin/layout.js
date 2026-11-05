import PanelAdmin from "@/frontend/componentes/PanelAdmin";

export const metadata = {
  title: "Ponceano Soccer — Administración",
};

// Marco común de todo /admin. Lo dinámico (usuario, cierre de sesión) vive en el
// componente cliente PanelAdmin, así este layout puede prerenderizarse.
export default function LayoutAdmin({ children }) {
  return <PanelAdmin>{children}</PanelAdmin>;
}
