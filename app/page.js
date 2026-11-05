import { redirect } from "next/navigation";

// La portada pública no existe todavía: "/" lleva al panel.
// Si no hay sesión, proxy.js redirige "/" y "/admin" directamente a "/login".
export default function Inicio() {
  redirect("/admin");
}
