import HomePage from "./HomePage";
import SianoVenue from "./SianoVenue";

export default function App() {
  // normalizza path
  const path = window.location.pathname.replace(/\/+$/, "");
  const segs = path.split("/").filter(Boolean);
  const first = segs[0] ?? ""; // "" quando sei su "/"

  // Homepage: root, /home, /comune /siano
  if (first === "" || first === "home" || first === "comune" || first === "siano") {
    return <HomePage />;
  }

  // Altrimenti è uno slug di locale e renderizziamo la venue
  return <SianoVenue />;
}
