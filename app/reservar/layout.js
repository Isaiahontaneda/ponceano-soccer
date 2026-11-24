import PanelCliente from "@/frontend/componentes/PanelCliente";

export const metadata = {
  title: "Reservar",
};

// Marco de la página del cliente (usuario y cierre de sesión).
export default function LayoutReservar({ children }) {
  return <PanelCliente>{children}</PanelCliente>;
}
