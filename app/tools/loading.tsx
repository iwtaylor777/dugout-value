import { Publication } from "../site-shell";

export default function LoadingTools() {
  return <Publication active="tools"><section className="tool-loading" role="status" aria-live="polite"><h1>Loading baseball tools</h1><p>Preparing the player database and your tool view. No values are shown until they are ready.</p></section></Publication>;
}
